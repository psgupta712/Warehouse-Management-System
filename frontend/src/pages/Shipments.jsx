import React, { useState, useEffect, useCallback } from 'react';
import { shipmentAPI, warehouseAPI, supplierAPI, productAPI } from '../utils/api';
import { formatCurrency, formatDate, getShipmentStatusBadge } from '../utils/helpers';
import { PageLoader, Pagination, Modal, SearchInput, EmptyState } from '../components/ui/index';
import { Plus, Truck, ArrowDownCircle, ArrowUpCircle, Filter, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

const STATUS_FLOW = ['pending', 'in_transit', 'delivered'];

const Shipments = () => {
  const [shipments, setShipments] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ type: '', status: '' });
  const [modal, setModal] = useState(null);
  const [detailShipment, setDetailShipment] = useState(null);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const EMPTY_FORM = {
    type: 'incoming', warehouse_id: '', supplier_id: '', contact_name: '', contact_phone: '',
    origin_address: '', destination_address: '', expected_date: '', notes: '', items: []
  };
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await shipmentAPI.getAll({ search, page, limit: 15, ...filters });
      setShipments(res.data.data.shipments);
      setPagination(res.data.data.pagination);
    } finally { setLoading(false); }
  }, [search, page, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filters]);

  useEffect(() => {
    Promise.all([warehouseAPI.getAll({ limit: 100 }), supplierAPI.getAll({ limit: 100 }), productAPI.getAll({ limit: 500 })]).then(([w, s, p]) => {
      setWarehouses(w.data.data.warehouses);
      setSuppliers(s.data.data.suppliers);
      setProducts(p.data.data.products);
    });
  }, []);

  const openDetail = async (id) => {
    const res = await shipmentAPI.getOne(id);
    setDetailShipment(res.data.data);
    setModal('detail');
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { product_id: '', quantity: '', unit_price: '' }] }));
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, field, val) => setForm(f => ({ ...f, items: f.items.map((item, idx) => idx === i ? { ...item, [field]: val } : item) }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, items: form.items.filter(i => i.product_id && i.quantity) };
      await shipmentAPI.create(payload);
      toast.success('Shipment created successfully');
      setModal(null);
      load();
    } finally { setSaving(false); }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      await shipmentAPI.updateStatus(id, status);
      toast.success(`Status updated to ${status.replace('_', ' ')}`);
      if (modal === 'detail') {
        const res = await shipmentAPI.getOne(id);
        setDetailShipment(res.data.data);
      }
      load();
    } catch {}
  };

  const getNextStatus = (current) => {
    const idx = STATUS_FLOW.indexOf(current);
    return idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Shipments</h1>
          <p className="page-subtitle">Track incoming and outgoing shipments</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setModal('create'); }} className="btn-primary">
          <Plus size={16} /> New Shipment
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="Search shipments..." />
        <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary ${showFilters ? 'border-amber-500/50 text-amber-400' : ''}`}>
          <Filter size={14} /> Filters
        </button>
        <div className="flex gap-2 ml-auto">
          {['', 'incoming', 'outgoing'].map(t => (
            <button key={t} onClick={() => setFilters(f => ({ ...f, type: t }))}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${filters.type === t ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
              {t === '' ? 'All' : t === 'incoming' ? '↓ Incoming' : '↑ Outgoing'}
            </button>
          ))}
        </div>
      </div>

      {showFilters && (
        <div className="card">
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="label">Status</label>
              <select className="select w-40" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => setFilters({ type: '', status: '' })} className="btn-secondary">Reset</button>
            </div>
          </div>
        </div>
      )}

      {loading ? <PageLoader /> : shipments.length === 0 ? (
        <EmptyState icon={Truck} title="No shipments found" description="Create your first shipment record." action={<button onClick={() => { setForm(EMPTY_FORM); setModal('create'); }} className="btn-primary">New Shipment</button>} />
      ) : (
        <div className="card p-0">
          <div className="table-wrapper border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Shipment #</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Warehouse</th>
                  <th>Supplier</th>
                  <th>Items</th>
                  <th>Value</th>
                  <th>Expected</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map(s => {
                  const badge = getShipmentStatusBadge(s.status);
                  const next = getNextStatus(s.status);
                  return (
                    <tr key={s.id} className="cursor-pointer" onClick={() => openDetail(s.id)}>
                      <td>
                        <div className="font-mono text-amber-400 text-xs font-medium">{s.shipment_number}</div>
                      </td>
                      <td>
                        <div className={`flex items-center gap-1 text-xs font-medium ${s.type === 'incoming' ? 'text-emerald-400' : 'text-blue-400'}`}>
                          {s.type === 'incoming' ? <ArrowDownCircle size={12} /> : <ArrowUpCircle size={12} />}
                          {s.type}
                        </div>
                      </td>
                      <td><span className={`badge ${badge.class}`}>{badge.label}</span></td>
                      <td className="text-slate-400 text-sm">{s.warehouse_name || '—'}</td>
                      <td className="text-slate-400 text-sm">{s.supplier_name || '—'}</td>
                      <td className="text-slate-300">{s.item_count}</td>
                      <td className="text-slate-300">{formatCurrency(s.total_value)}</td>
                      <td className="text-slate-400 text-sm">{formatDate(s.expected_date)}</td>
                      <td onClick={e => e.stopPropagation()}>
                        {next && s.status !== 'cancelled' && (
                          <button
                            onClick={() => handleStatusUpdate(s.id, next)}
                            className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors whitespace-nowrap"
                          >
                            → {next.replace('_', ' ')}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </div>
      )}

      {/* Create Shipment Modal */}
      <Modal open={modal === 'create'} onClose={() => setModal(null)} title="Create Shipment" size="modal-lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type *</label>
              <select className="select" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} required>
                <option value="incoming">Incoming</option>
                <option value="outgoing">Outgoing</option>
              </select>
            </div>
            <div>
              <label className="label">Warehouse *</label>
              <select className="select" value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))} required>
                <option value="">Select warehouse</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Supplier</label>
              <select className="select" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Expected Date</label>
              <input type="date" className="input" value={form.expected_date} onChange={e => setForm(f => ({ ...f, expected_date: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Contact Name</label>
              <input className="input" value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="John Doe" />
            </div>
            <div>
              <label className="label">Contact Phone</label>
              <input className="input" value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} placeholder="+1-555-0100" />
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">Shipment Items</label>
              <button type="button" onClick={addItem} className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1">
                <Plus size={12} /> Add Item
              </button>
            </div>
            {form.items.length === 0 ? (
              <div className="border border-dashed border-slate-700 rounded-lg p-4 text-center text-xs text-slate-500">No items added yet</div>
            ) : (
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <select className="select text-xs" value={item.product_id} onChange={e => updateItem(i, 'product_id', e.target.value)}>
                        <option value="">Select product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <input type="number" className="input text-xs" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Qty" min="1" />
                    </div>
                    <div className="col-span-3">
                      <input type="number" step="0.01" className="input text-xs" value={item.unit_price} onChange={e => updateItem(i, 'unit_price', e.target.value)} placeholder="Unit price" />
                    </div>
                    <div className="col-span-1">
                      <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-300 p-1">×</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create Shipment'}</button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      {modal === 'detail' && detailShipment && (
        <Modal open onClose={() => { setModal(null); setDetailShipment(null); }} title={`Shipment ${detailShipment.shipment.shipment_number}`} size="modal-lg">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Type', value: detailShipment.shipment.type },
                { label: 'Status', value: <span className={`badge ${getShipmentStatusBadge(detailShipment.shipment.status).class}`}>{getShipmentStatusBadge(detailShipment.shipment.status).label}</span> },
                { label: 'Total Value', value: formatCurrency(detailShipment.shipment.total_value) },
                { label: 'Warehouse', value: detailShipment.shipment.warehouse_name || '—' },
                { label: 'Supplier', value: detailShipment.shipment.supplier_name || '—' },
                { label: 'Expected', value: formatDate(detailShipment.shipment.expected_date) },
              ].map((f, i) => (
                <div key={i} className="bg-slate-800/50 rounded-lg p-2.5">
                  <div className="text-xs text-slate-500 mb-0.5">{f.label}</div>
                  <div className="text-sm text-white capitalize">{f.value}</div>
                </div>
              ))}
            </div>

            {detailShipment.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white mb-2">Items ({detailShipment.items.length})</h4>
                <div className="table-wrapper">
                  <table className="table">
                    <thead><tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                    <tbody>
                      {detailShipment.items.map(item => (
                        <tr key={item.id}>
                          <td><div className="text-white">{item.product_name}</div><div className="text-xs text-slate-500">{item.sku}</div></td>
                          <td className="text-slate-300">{item.quantity}</td>
                          <td className="text-slate-300">{formatCurrency(item.unit_price)}</td>
                          <td className="text-slate-300 font-medium">{formatCurrency(item.quantity * item.unit_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detailShipment.shipment.status !== 'delivered' && detailShipment.shipment.status !== 'cancelled' && (
              <div className="flex gap-2 justify-end pt-2 border-t border-slate-800">
                <button onClick={() => handleStatusUpdate(detailShipment.shipment.id, 'cancelled')} className="btn-danger">Cancel Shipment</button>
                {getNextStatus(detailShipment.shipment.status) && (
                  <button onClick={() => handleStatusUpdate(detailShipment.shipment.id, getNextStatus(detailShipment.shipment.status))} className="btn-primary">
                    Mark as {getNextStatus(detailShipment.shipment.status).replace('_', ' ')}
                  </button>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Shipments;
