import React, { useState, useEffect, useCallback } from 'react';
import { supplierAPI } from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { PageLoader, Pagination, Modal, ConfirmDialog, SearchInput, EmptyState } from '../components/ui/index';
import { Plus, Edit, Trash2, Users, Mail, Phone, MapPin, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const EMPTY_FORM = { name: '', contact_person: '', email: '', phone: '', address: '', city: '', country: '' };

const Suppliers = () => {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await supplierAPI.getAll({ search, page, limit: 12 });
      setSuppliers(res.data.data.suppliers);
      setPagination(res.data.data.pagination);
    } finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const openDetail = async (id) => {
    setDetailId(id);
    const res = await supplierAPI.getOne(id);
    setDetail(res.data.data);
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditItem(null); setModal('form'); };
  const openEdit = (s) => {
    setForm({ name: s.name, contact_person: s.contact_person || '', email: s.email || '', phone: s.phone || '', address: s.address || '', city: s.city || '', country: s.country || '' });
    setEditItem(s); setModal('form');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) { await supplierAPI.update(editItem.id, form); toast.success('Supplier updated'); }
      else { await supplierAPI.create(form); toast.success('Supplier created'); }
      setModal(null); load();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await supplierAPI.delete(deleteId); toast.success('Supplier deleted'); setDeleteId(null); load(); } catch {}
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">Manage your supply chain partners</p>
        </div>
        {isAdmin() && <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Add Supplier</button>}
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search suppliers..." />

      {loading ? <PageLoader /> : suppliers.length === 0 ? (
        <EmptyState icon={Users} title="No suppliers found" description="Add supplier contacts to manage your supply chain." action={isAdmin() && <button onClick={openCreate} className="btn-primary">Add Supplier</button>} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {suppliers.map(s => (
              <div key={s.id} className="card hover:border-slate-700 transition-all cursor-pointer" onClick={() => openDetail(s.id)}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white">{s.name}</h3>
                    {s.contact_person && <p className="text-xs text-slate-400 mt-0.5">{s.contact_person}</p>}
                  </div>
                  {isAdmin() && (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(s)} className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"><Edit size={13} /></button>
                      <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 mb-4">
                  {s.email && <div className="flex items-center gap-2 text-xs text-slate-400"><Mail size={11} className="flex-shrink-0" />{s.email}</div>}
                  {s.phone && <div className="flex items-center gap-2 text-xs text-slate-400"><Phone size={11} className="flex-shrink-0" />{s.phone}</div>}
                  {(s.city || s.country) && <div className="flex items-center gap-2 text-xs text-slate-400"><MapPin size={11} className="flex-shrink-0" />{[s.city, s.country].filter(Boolean).join(', ')}</div>}
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-800">
                  <div className="text-center">
                    <div className="text-lg font-bold text-white">{s.product_count}</div>
                    <div className="text-xs text-slate-500">Products</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-white">{formatCurrency(s.supplied_value)}</div>
                    <div className="text-xs text-slate-500">Stock Value</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modal === 'form'} onClose={() => setModal(null)} title={editItem ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Company Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Acme Corp" />
          </div>
          <div>
            <label className="label">Contact Person</label>
            <input className="input" value={form.contact_person} onChange={e => setForm(f => ({ ...f, contact_person: e.target.value }))} placeholder="John Smith" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@acme.com" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1-555-0100" />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="123 Main St" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">City</label>
              <input className="input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="New York" />
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="USA" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editItem ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailId} onClose={() => { setDetailId(null); setDetail(null); }} title="Supplier Details" size="modal-lg">
        {detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Contact</div>
                <div className="text-sm text-white">{detail.supplier.contact_person || '—'}</div>
                <div className="text-xs text-slate-400 mt-1">{detail.supplier.email}</div>
                <div className="text-xs text-slate-400">{detail.supplier.phone}</div>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">Location</div>
                <div className="text-sm text-white">{detail.supplier.address || '—'}</div>
                <div className="text-xs text-slate-400">{[detail.supplier.city, detail.supplier.country].filter(Boolean).join(', ')}</div>
              </div>
            </div>

            {detail.products.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-white mb-2">Supplied Products ({detail.products.length})</h4>
                <div className="table-wrapper max-h-48 overflow-y-auto">
                  <table className="table">
                    <thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Price</th></tr></thead>
                    <tbody>
                      {detail.products.map(p => (
                        <tr key={p.id}>
                          <td><div className="text-white text-sm">{p.name}</div><div className="text-xs text-slate-500 font-mono">{p.sku}</div></td>
                          <td className="text-slate-400 text-sm">{p.category || '—'}</td>
                          <td className="text-slate-300">{p.quantity}</td>
                          <td className="text-slate-300">{formatCurrency(p.unit_price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" /></div>}
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Supplier" message="Delete this supplier? This will not remove their products." />
    </div>
  );
};

export default Suppliers;
