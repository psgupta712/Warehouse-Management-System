import React, { useState, useEffect, useCallback } from 'react';
import { productAPI, warehouseAPI, supplierAPI } from '../utils/api';
import { formatCurrency, getStockStatusBadge } from '../utils/helpers';
import { PageLoader, Pagination, Modal, ConfirmDialog, SearchInput, EmptyState } from '../components/ui/index';
import { Plus, Edit, Trash2, Package, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  sku: '', name: '', description: '', category_id: '', supplier_id: '',
  warehouse_id: '', quantity: 0, min_stock_level: 10, unit_price: '', unit: 'units', weight: ''
};

const Products = () => {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ category: '', warehouse: '', low_stock: '' });
  const [modal, setModal] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [categories, setCategories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productAPI.getAll({ search, page, limit: 15, ...filters });
      setProducts(res.data.data.products);
      setPagination(res.data.data.pagination);
    } finally { setLoading(false); }
  }, [search, page, filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, filters]);

  useEffect(() => {
    Promise.all([productAPI.getCategories(), warehouseAPI.getAll({ limit: 100 }), supplierAPI.getAll({ limit: 100 })]).then(([c, w, s]) => {
      setCategories(c.data.data.categories);
      setWarehouses(w.data.data.warehouses);
      setSuppliers(s.data.data.suppliers);
    });
  }, []);

  const openCreate = () => { setForm(EMPTY_FORM); setEditItem(null); setModal('form'); };
  const openEdit = (p) => {
    setForm({ sku: p.sku, name: p.name, description: p.description || '', category_id: p.category_id || '', supplier_id: p.supplier_id || '', warehouse_id: p.warehouse_id || '', quantity: p.quantity, min_stock_level: p.min_stock_level, unit_price: p.unit_price, unit: p.unit, weight: p.weight || '' });
    setEditItem(p); setModal('form');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, category_id: form.category_id || null, supplier_id: form.supplier_id || null, warehouse_id: form.warehouse_id || null };
      if (editItem) { await productAPI.update(editItem.id, payload); toast.success('Product updated'); }
      else { await productAPI.create(payload); toast.success('Product created'); }
      setModal(null); load();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await productAPI.delete(deleteId); toast.success('Product deleted'); setDeleteId(null); load(); } catch {}
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">{pagination?.total || 0} products in inventory</p>
        </div>
        {isAdmin() && <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Add Product</button>}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, SKU..." />
        <button onClick={() => setShowFilters(!showFilters)} className={`btn-secondary ${showFilters ? 'border-amber-500/50 text-amber-400' : ''}`}>
          <Filter size={14} /> Filters
        </button>
        {filters.low_stock && <span className="badge badge-amber">Low stock only</span>}
      </div>

      {showFilters && (
        <div className="card grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Category</label>
            <select className="select" value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
              <option value="">All categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Warehouse</label>
            <select className="select" value={filters.warehouse} onChange={e => setFilters(f => ({ ...f, warehouse: e.target.value }))}>
              <option value="">All warehouses</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Stock Status</label>
            <select className="select" value={filters.low_stock} onChange={e => setFilters(f => ({ ...f, low_stock: e.target.value }))}>
              <option value="">All</option>
              <option value="true">Low stock only</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => setFilters({ category: '', warehouse: '', low_stock: '' })} className="btn-secondary w-full justify-center">Reset</button>
          </div>
        </div>
      )}

      {loading ? <PageLoader /> : products.length === 0 ? (
        <EmptyState icon={Package} title="No products found" description="Add products to your inventory." action={isAdmin() && <button onClick={openCreate} className="btn-primary">Add Product</button>} />
      ) : (
        <div className="card p-0">
          <div className="table-wrapper border-0 rounded-none">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Warehouse</th>
                  <th>Stock</th>
                  <th>Unit Price</th>
                  <th>Total Value</th>
                  <th>Status</th>
                  {isAdmin() && <th></th>}
                </tr>
              </thead>
              <tbody>
                {products.map(p => {
                  const badge = getStockStatusBadge(p.quantity, p.min_stock_level);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="font-medium text-white">{p.name}</div>
                        <div className="text-xs text-slate-500 font-mono">{p.sku}</div>
                      </td>
                      <td className="text-slate-400">{p.category_name || '—'}</td>
                      <td className="text-slate-400">{p.warehouse_name || '—'}</td>
                      <td>
                        <div className="font-medium text-white">{p.quantity} <span className="text-xs text-slate-500">{p.unit}</span></div>
                        <div className="text-xs text-slate-500">Min: {p.min_stock_level}</div>
                      </td>
                      <td className="text-slate-300">{formatCurrency(p.unit_price)}</td>
                      <td className="text-slate-300">{formatCurrency(p.quantity * p.unit_price)}</td>
                      <td><span className={`badge ${badge.class}`}>{badge.label}</span></td>
                      {isAdmin() && (
                        <td>
                          <div className="flex gap-1">
                            <button onClick={() => openEdit(p)} className="p-1.5 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"><Edit size={13} /></button>
                            <button onClick={() => setDeleteId(p.id)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"><Trash2 size={13} /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination pagination={pagination} onPageChange={setPage} />
        </div>
      )}

      <Modal open={modal === 'form'} onClose={() => setModal(null)} title={editItem ? 'Edit Product' : 'Add Product'} size="modal-lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">SKU *</label>
              <input className="input font-mono" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} required placeholder="SKU-ELEC-001" disabled={!!editItem} />
            </div>
            <div>
              <label className="label">Unit</label>
              <input className="input" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="units" />
            </div>
          </div>
          <div>
            <label className="label">Product Name *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Product name" />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Product description..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Category</label>
              <select className="select" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Warehouse</label>
              <select className="select" value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
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
              <label className="label">Unit Price *</label>
              <input type="number" step="0.01" className="input" value={form.unit_price} onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))} required placeholder="0.00" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Initial Qty</label>
              <input type="number" className="input" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} min="0" disabled={!!editItem} />
            </div>
            <div>
              <label className="label">Min Stock Level</label>
              <input type="number" className="input" value={form.min_stock_level} onChange={e => setForm(f => ({ ...f, min_stock_level: e.target.value }))} min="0" />
            </div>
            <div>
              <label className="label">Weight (kg)</label>
              <input type="number" step="0.01" className="input" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} placeholder="0.00" />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editItem ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Product" message="Delete this product? This action cannot be undone." />
    </div>
  );
};

export default Products;
