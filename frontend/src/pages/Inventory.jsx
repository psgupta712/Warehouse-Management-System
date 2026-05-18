import React, { useState, useEffect, useCallback } from 'react';
import { inventoryAPI, productAPI, warehouseAPI } from '../utils/api';
import { formatCurrency, formatDateTime, getTransactionBadge } from '../utils/helpers';
import { PageLoader, Pagination, Modal, SearchInput, EmptyState } from '../components/ui/index';
import { ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, ClipboardList, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

const EMPTY_STOCK_FORM = { product_id: '', warehouse_id: '', quantity: '', notes: '' };

const Inventory = () => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ type: '', warehouse_id: '', start_date: '', end_date: '' });
  const [modal, setModal] = useState(null); // 'stock_in' | 'stock_out' | 'adjust'
  const [form, setForm] = useState(EMPTY_STOCK_FORM);
  const [adjustQty, setAdjustQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await inventoryAPI.getLogs({ page, limit: 20, ...filters });
      setLogs(res.data.data.logs);
      setPagination(res.data.data.pagination);
    } finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filters]);

  useEffect(() => {
    Promise.all([
      productAPI.getAll({ limit: 500 }),
      warehouseAPI.getAll({ limit: 100 })
    ]).then(([p, w]) => {
      setProducts(p.data.data.products);
      setWarehouses(w.data.data.warehouses);
    });
  }, []);

  const openModal = (type) => {
    setForm(EMPTY_STOCK_FORM);
    setAdjustQty('');
    setSelectedProduct(null);
    setModal(type);
  };

  const handleProductSelect = (e) => {
    const pid = e.target.value;
    setForm(f => ({ ...f, product_id: pid }));
    const prod = products.find(p => p.id === pid);
    setSelectedProduct(prod || null);
    if (prod?.warehouse_id) setForm(f => ({ ...f, product_id: pid, warehouse_id: prod.warehouse_id }));
  };

  const handleStockIn = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await inventoryAPI.stockIn(form);
      toast.success(`Stock added successfully`);
      setModal(null);
      load();
    } finally { setSaving(false); }
  };

  const handleStockOut = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await inventoryAPI.stockOut(form);
      toast.success(`Stock removed successfully`);
      setModal(null);
      load();
    } finally { setSaving(false); }
  };

  const handleAdjust = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await inventoryAPI.adjust({ product_id: form.product_id, new_quantity: adjustQty, notes: form.notes });
      toast.success('Inventory adjusted');
      setModal(null);
      load();
    } finally { setSaving(false); }
  };

  const txColor = (type) => {
    if (type === 'stock_in') return 'text-emerald-400';
    if (type === 'stock_out') return 'text-red-400';
    return 'text-blue-400';
  };

  const txSign = (type) => (type === 'stock_in' ? '+' : type === 'stock_out' ? '-' : '~');

  const ProductSelect = () => (
    <div>
      <label className="label">Product *</label>
      <select className="select" value={form.product_id} onChange={handleProductSelect} required>
        <option value="">Select product</option>
        {products.map(p => (
          <option key={p.id} value={p.id}>{p.name} ({p.sku}) — Stock: {p.quantity}</option>
        ))}
      </select>
      {selectedProduct && (
        <div className="mt-2 p-2 bg-slate-800/50 rounded-lg text-xs text-slate-400">
          Current stock: <span className="text-white font-medium">{selectedProduct.quantity} {selectedProduct.unit}</span>
          {selectedProduct.quantity <= selectedProduct.min_stock_level && (
            <span className="ml-2 text-amber-400">⚠ Low stock</span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Track stock movements and inventory logs</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openModal('stock_in')} className="btn-primary">
            <ArrowDownCircle size={15} /> Stock In
          </button>
          <button onClick={() => openModal('stock_out')} className="btn-secondary">
            <ArrowUpCircle size={15} /> Stock Out
          </button>
          <button onClick={() => openModal('adjust')} className="btn-secondary">
            <SlidersHorizontal size={15} /> Adjust
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary ${showFilters ? 'border-amber-500/50 text-amber-400' : ''}`}>
          <Filter size={14} /> Filters
        </button>
        {(filters.type || filters.warehouse_id || filters.start_date) && (
          <span className="badge badge-amber">Filtered</span>
        )}
      </div>

      {showFilters && (
        <div className="card grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Transaction Type</label>
            <select className="select" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
              <option value="">All types</option>
              <option value="stock_in">Stock In</option>
              <option value="stock_out">Stock Out</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </div>
          <div>
            <label className="label">Warehouse</label>
            <select className="select" value={filters.warehouse_id} onChange={e => setFilters(f => ({ ...f, warehouse_id: e.target.value }))}>
              <option value="">All warehouses</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">From Date</label>
            <input type="date" className="input" value={filters.start_date} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
          </div>
          <div>
            <label className="label">To Date</label>
            <input type="date" className="input" value={filters.end_date} onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />
          </div>
          <div className="col-span-full flex justify-end">
            <button onClick={() => setFilters({ type: '', warehouse_id: '', start_date: '', end_date: '' })} className="btn-secondary">Reset Filters</button>
          </div>
        </div>
      )}

      {loading ? <PageLoader /> : logs.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No inventory logs" description="Stock movements will appear here." />
      ) : (
        <div className="card p-0">
          <div className="table-wrapper border-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Qty Change</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Warehouse</th>
                  <th>Performed By</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => {
                  const badge = getTransactionBadge(log.transaction_type);
                  return (
                    <tr key={log.id}>
                      <td className="text-xs text-slate-400 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                      <td>
                        <div className="font-medium text-white text-sm">{log.product_name}</div>
                        <div className="text-xs text-slate-500 font-mono">{log.sku}</div>
                      </td>
                      <td><span className={`badge ${badge.class}`}>{badge.label}</span></td>
                      <td>
                        <span className={`font-bold text-sm ${txColor(log.transaction_type)}`}>
                          {txSign(log.transaction_type)}{log.quantity}
                        </span>
                      </td>
                      <td className="text-slate-400">{log.quantity_before}</td>
                      <td className="text-slate-300 font-medium">{log.quantity_after}</td>
                      <td className="text-slate-400 text-sm">{log.warehouse_name || '—'}</td>
                      <td className="text-slate-400 text-sm">{log.performed_by_name || '—'}</td>
                      <td className="text-slate-500 text-xs max-w-xs truncate">{log.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </div>
      )}

      {/* Stock In Modal */}
      <Modal open={modal === 'stock_in'} onClose={() => setModal(null)} title="Stock In — Add Inventory">
        <form onSubmit={handleStockIn} className="space-y-4">
          <ProductSelect />
          <div>
            <label className="label">Warehouse</label>
            <select className="select" value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
              <option value="">Select warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quantity to Add *</label>
            <input type="number" className="input" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required min="1" placeholder="0" />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason or reference..." />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
              <ArrowDownCircle size={15} /> {saving ? 'Processing...' : 'Add Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Stock Out Modal */}
      <Modal open={modal === 'stock_out'} onClose={() => setModal(null)} title="Stock Out — Remove Inventory">
        <form onSubmit={handleStockOut} className="space-y-4">
          <ProductSelect />
          <div>
            <label className="label">Warehouse</label>
            <select className="select" value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
              <option value="">Select warehouse</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Quantity to Remove *</label>
            <input type="number" className="input" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required min="1"
              max={selectedProduct?.quantity || undefined} placeholder="0" />
            {selectedProduct && <p className="text-xs text-slate-500 mt-1">Available: {selectedProduct.quantity}</p>}
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason or reference..." />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="bg-red-500 hover:bg-red-400 text-white font-semibold px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors">
              <ArrowUpCircle size={15} /> {saving ? 'Processing...' : 'Remove Stock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust Modal */}
      <Modal open={modal === 'adjust'} onClose={() => setModal(null)} title="Adjust Inventory">
        <form onSubmit={handleAdjust} className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
            ⚠ Adjustment directly sets the stock quantity. Use with caution.
          </div>
          <ProductSelect />
          <div>
            <label className="label">New Quantity *</label>
            <input type="number" className="input" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} required min="0" placeholder="0" />
            {selectedProduct && (
              <p className="text-xs text-slate-500 mt-1">
                Current: {selectedProduct.quantity} → New: {adjustQty || '?'}
                {adjustQty !== '' && <span className={adjustQty > selectedProduct.quantity ? ' text-emerald-400' : ' text-red-400'}> ({adjustQty > selectedProduct.quantity ? '+' : ''}{adjustQty - selectedProduct.quantity})</span>}
              </p>
            )}
          </div>
          <div>
            <label className="label">Reason *</label>
            <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Reason for adjustment..." required />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Apply Adjustment'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Inventory;
