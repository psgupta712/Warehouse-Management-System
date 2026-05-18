import React, { useState, useEffect, useCallback } from 'react';
import { warehouseAPI } from '../utils/api';
import { formatCurrency, formatNumber, getUtilizationBarColor, getUtilizationColor } from '../utils/helpers';
import { PageLoader, Pagination, Modal, ConfirmDialog, SearchInput, EmptyState } from '../components/ui/index';
import { Plus, Edit, Trash2, MapPin, Package, Warehouse } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const EMPTY_FORM = { name: '', location: '', capacity: '', manager_name: '', phone: '' };

const Warehouses = () => {
  const { isAdmin } = useAuth();
  const [warehouses, setWarehouses] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // 'create' | 'edit'
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await warehouseAPI.getAll({ search, page, limit: 9 });
      setWarehouses(res.data.data.warehouses);
      setPagination(res.data.data.pagination);
    } finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search]);

  const openCreate = () => { setForm(EMPTY_FORM); setEditItem(null); setModal('create'); };
  const openEdit = (w) => { setForm({ name: w.name, location: w.location, capacity: w.capacity, manager_name: w.manager_name || '', phone: w.phone || '' }); setEditItem(w); setModal('edit'); };
  const closeModal = () => { setModal(null); setEditItem(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editItem) {
        await warehouseAPI.update(editItem.id, form);
        toast.success('Warehouse updated');
      } else {
        await warehouseAPI.create(form);
        toast.success('Warehouse created');
      }
      closeModal();
      load();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await warehouseAPI.delete(deleteId);
      toast.success('Warehouse deleted');
      setDeleteId(null);
      load();
    } catch {}
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Warehouses</h1>
          <p className="page-subtitle">Manage your warehouse locations and capacity</p>
        </div>
        {isAdmin() && (
          <button onClick={openCreate} className="btn-primary">
            <Plus size={16} /> Add Warehouse
          </button>
        )}
      </div>

      <div className="flex items-center gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search warehouses..." />
      </div>

      {loading ? <PageLoader /> : warehouses.length === 0 ? (
        <EmptyState icon={Warehouse} title="No warehouses found" description="Add your first warehouse to get started." action={isAdmin() && <button onClick={openCreate} className="btn-primary">Add Warehouse</button>} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {warehouses.map((w) => {
              const pct = parseFloat(w.utilization_percent) || 0;
              return (
                <div key={w.id} className="card hover:border-slate-700 transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-white">{w.name}</h3>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mt-1">
                        <MapPin size={11} /> {w.location}
                      </div>
                    </div>
                    {isAdmin() && (
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(w)} className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => setDeleteId(w.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-slate-800/50 rounded-lg p-2.5">
                      <div className="text-xs text-slate-500 mb-0.5">Products</div>
                      <div className="text-lg font-bold text-white">{formatNumber(w.product_count)}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-2.5">
                      <div className="text-xs text-slate-500 mb-0.5">Value</div>
                      <div className="text-sm font-bold text-white">{formatCurrency(w.inventory_value)}</div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Capacity</span>
                      <span className={getUtilizationColor(pct)}>{pct}% used</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${getUtilizationBarColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{formatNumber(w.used_capacity)} / {formatNumber(w.capacity)} units</div>
                  </div>

                  {w.manager_name && (
                    <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
                      Manager: <span className="text-slate-300">{w.manager_name}</span>
                      {w.phone && <span className="ml-2 text-slate-500">{w.phone}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal open={!!modal} onClose={closeModal} title={editItem ? 'Edit Warehouse' : 'Add Warehouse'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Warehouse Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Main Distribution Center" />
          </div>
          <div>
            <label className="label">Location *</label>
            <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} required placeholder="Chicago, IL 60601" />
          </div>
          <div>
            <label className="label">Capacity (units) *</label>
            <input type="number" className="input" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} required min="1" placeholder="10000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Manager Name</label>
              <input className="input" value={form.manager_name} onChange={e => setForm(f => ({ ...f, manager_name: e.target.value }))} placeholder="John Doe" />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1-312-555-0100" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editItem ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Warehouse"
        message="Are you sure you want to delete this warehouse? All associated data will be removed."
      />
    </div>
  );
};

export default Warehouses;
