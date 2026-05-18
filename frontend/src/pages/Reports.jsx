import React, { useState, useEffect } from 'react';
import { reportAPI, warehouseAPI, productAPI } from '../utils/api';
import { formatCurrency, formatDate, formatDateTime, exportToCSV, getShipmentStatusBadge, getStockStatusBadge } from '../utils/helpers';
import { PageLoader, EmptyState } from '../components/ui/index';
import { BarChart3, Download, FileText, TrendingDown, Package, Truck, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const REPORT_TYPES = [
  { id: 'inventory_movement', label: 'Inventory Movement', icon: TrendingDown, description: 'All stock in/out transactions' },
  { id: 'stock_summary', label: 'Stock Summary', icon: Package, description: 'Current stock levels by product' },
  { id: 'shipment_history', label: 'Shipment History', icon: Truck, description: 'All incoming and outgoing shipments' },
  { id: 'low_stock', label: 'Low Stock Report', icon: BarChart3, description: 'Products below minimum stock level' },
];

const Reports = () => {
  const [activeReport, setActiveReport] = useState('inventory_movement');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({
    start_date: '', end_date: '', warehouse_id: '', category_id: '', type: '', status: ''
  });

  useEffect(() => {
    warehouseAPI.getAll({ limit: 100 }).then(r => setWarehouses(r.data.data.warehouses));
    productAPI.getCategories().then(r => setCategories(r.data.data.categories));
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    setData([]);
    try {
      let res;
      const params = {};
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.warehouse_id) params.warehouse_id = filters.warehouse_id;
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;

      switch (activeReport) {
        case 'inventory_movement': res = await reportAPI.inventoryMovement(params); setData(res.data.data.report); break;
        case 'stock_summary': res = await reportAPI.stockSummary(params); setData(res.data.data.report); break;
        case 'shipment_history': res = await reportAPI.shipmentHistory(params); setData(res.data.data.report); break;
        case 'low_stock': res = await reportAPI.lowStock(); setData(res.data.data.report); break;
        default: break;
      }
    } catch { toast.error('Failed to generate report'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(); }, [activeReport]);

  const handleExportCSV = () => {
    if (!data.length) return toast.error('No data to export');
    exportToCSV(data, activeReport);
    toast.success('CSV exported successfully');
  };

  const renderTable = () => {
    if (!data.length) return <EmptyState icon={FileText} title="No data found" description="Try adjusting your filters or date range." />;

    switch (activeReport) {
      case 'inventory_movement':
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Product</th>
                <th>SKU</th>
                <th>Type</th>
                <th>Qty</th>
                <th>Before</th>
                <th>After</th>
                <th>Value</th>
                <th>Warehouse</th>
                <th>Performed By</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const typeColor = row.transaction_type === 'stock_in' ? 'text-emerald-400' : row.transaction_type === 'stock_out' ? 'text-red-400' : 'text-blue-400';
                return (
                  <tr key={i}>
                    <td className="text-xs text-slate-400 whitespace-nowrap">{formatDateTime(row.created_at)}</td>
                    <td className="text-white font-medium">{row.product_name}</td>
                    <td className="font-mono text-xs text-slate-400">{row.sku}</td>
                    <td><span className={`text-xs font-medium capitalize ${typeColor}`}>{row.transaction_type.replace('_', ' ')}</span></td>
                    <td className={`font-bold ${typeColor}`}>{row.transaction_type === 'stock_in' ? '+' : row.transaction_type === 'stock_out' ? '-' : '~'}{row.quantity}</td>
                    <td className="text-slate-400">{row.quantity_before}</td>
                    <td className="text-slate-300 font-medium">{row.quantity_after}</td>
                    <td className="text-slate-300">{formatCurrency(row.transaction_value)}</td>
                    <td className="text-slate-400 text-sm">{row.warehouse_name || '—'}</td>
                    <td className="text-slate-400 text-sm">{row.performed_by || '—'}</td>
                    <td className="text-slate-500 text-xs max-w-xs truncate">{row.notes || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );

      case 'stock_summary':
        return (
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Category</th>
                <th>Warehouse</th>
                <th>Current Stock</th>
                <th>Min Level</th>
                <th>Status</th>
                <th>Unit Price</th>
                <th>Total Value</th>
                <th>Total Received</th>
                <th>Total Dispatched</th>
                <th>Supplier</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const status = row.status === 'Out of Stock' ? 'badge-red' : row.status === 'Low Stock' ? 'badge-amber' : 'badge-green';
                return (
                  <tr key={i}>
                    <td className="font-mono text-xs text-slate-400">{row.sku}</td>
                    <td className="text-white font-medium">{row.name}</td>
                    <td className="text-slate-400">{row.category || '—'}</td>
                    <td className="text-slate-400">{row.warehouse || '—'}</td>
                    <td className="text-slate-300 font-medium">{row.current_stock} <span className="text-xs text-slate-500">{row.unit}</span></td>
                    <td className="text-slate-400">{row.min_stock_level}</td>
                    <td><span className={`badge ${status}`}>{row.status}</span></td>
                    <td className="text-slate-300">{formatCurrency(row.unit_price)}</td>
                    <td className="text-amber-400 font-medium">{formatCurrency(row.total_value)}</td>
                    <td className="text-emerald-400">{row.total_received}</td>
                    <td className="text-red-400">{row.total_dispatched}</td>
                    <td className="text-slate-400 text-sm">{row.supplier || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );

      case 'shipment_history':
        return (
          <table className="table">
            <thead>
              <tr>
                <th>Shipment #</th>
                <th>Type</th>
                <th>Status</th>
                <th>Warehouse</th>
                <th>Supplier</th>
                <th>Items</th>
                <th>Units</th>
                <th>Value</th>
                <th>Expected</th>
                <th>Delivered</th>
                <th>Created By</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => {
                const badge = getShipmentStatusBadge(row.status);
                return (
                  <tr key={i}>
                    <td className="font-mono text-amber-400 text-xs font-medium">{row.shipment_number}</td>
                    <td>
                      <span className={`text-xs font-medium ${row.type === 'incoming' ? 'text-emerald-400' : 'text-blue-400'}`}>
                        {row.type === 'incoming' ? '↓' : '↑'} {row.type}
                      </span>
                    </td>
                    <td><span className={`badge ${badge.class}`}>{badge.label}</span></td>
                    <td className="text-slate-400">{row.warehouse || '—'}</td>
                    <td className="text-slate-400">{row.supplier || '—'}</td>
                    <td className="text-slate-300">{row.item_count}</td>
                    <td className="text-slate-300">{row.total_units}</td>
                    <td className="text-slate-300">{formatCurrency(row.total_value)}</td>
                    <td className="text-slate-400 text-sm">{formatDate(row.expected_date)}</td>
                    <td className="text-slate-400 text-sm">{formatDate(row.actual_date)}</td>
                    <td className="text-slate-400 text-sm">{row.created_by || '—'}</td>
                    <td className="text-slate-400 text-xs">{formatDate(row.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        );

      case 'low_stock':
        return (
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product</th>
                <th>Category</th>
                <th>Warehouse</th>
                <th>Current Stock</th>
                <th>Min Level</th>
                <th>Shortage</th>
                <th>Unit Price</th>
                <th>Reorder Cost Est.</th>
                <th>Supplier</th>
                <th>Supplier Email</th>
                <th>Supplier Phone</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i}>
                  <td className="font-mono text-xs text-slate-400">{row.sku}</td>
                  <td className="text-white font-medium">{row.name}</td>
                  <td className="text-slate-400">{row.category || '—'}</td>
                  <td className="text-slate-400">{row.warehouse || '—'}</td>
                  <td>
                    <span className={`badge ${row.current_stock === 0 ? 'badge-red' : 'badge-amber'}`}>{row.current_stock}</span>
                  </td>
                  <td className="text-slate-400">{row.min_stock_level}</td>
                  <td className="text-red-400 font-bold">{row.shortage}</td>
                  <td className="text-slate-300">{formatCurrency(row.unit_price)}</td>
                  <td className="text-amber-400 font-medium">{formatCurrency(row.reorder_cost_estimate)}</td>
                  <td className="text-slate-400">{row.supplier || '—'}</td>
                  <td className="text-slate-400 text-xs">{row.supplier_email || '—'}</td>
                  <td className="text-slate-400 text-xs">{row.supplier_phone || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );

      default: return null;
    }
  };

  // Summary stats for current report
  const getSummaryStats = () => {
    if (!data.length) return null;
    switch (activeReport) {
      case 'inventory_movement': {
        const totalIn = data.filter(r => r.transaction_type === 'stock_in').reduce((s, r) => s + parseInt(r.quantity), 0);
        const totalOut = data.filter(r => r.transaction_type === 'stock_out').reduce((s, r) => s + parseInt(r.quantity), 0);
        const totalValue = data.reduce((s, r) => s + parseFloat(r.transaction_value || 0), 0);
        return [{ label: 'Total Transactions', value: data.length }, { label: 'Total Stock In', value: totalIn, color: 'text-emerald-400' }, { label: 'Total Stock Out', value: totalOut, color: 'text-red-400' }, { label: 'Total Value', value: formatCurrency(totalValue), color: 'text-amber-400' }];
      }
      case 'stock_summary': {
        const totalValue = data.reduce((s, r) => s + parseFloat(r.total_value || 0), 0);
        const outOfStock = data.filter(r => r.status === 'Out of Stock').length;
        const lowStock = data.filter(r => r.status === 'Low Stock').length;
        return [{ label: 'Total Products', value: data.length }, { label: 'Total Value', value: formatCurrency(totalValue), color: 'text-amber-400' }, { label: 'Low Stock', value: lowStock, color: 'text-amber-400' }, { label: 'Out of Stock', value: outOfStock, color: 'text-red-400' }];
      }
      case 'shipment_history': {
        const totalValue = data.reduce((s, r) => s + parseFloat(r.total_value || 0), 0);
        const delivered = data.filter(r => r.status === 'delivered').length;
        return [{ label: 'Total Shipments', value: data.length }, { label: 'Delivered', value: delivered, color: 'text-emerald-400' }, { label: 'Pending/Transit', value: data.length - delivered }, { label: 'Total Value', value: formatCurrency(totalValue), color: 'text-amber-400' }];
      }
      case 'low_stock': {
        const totalShortage = data.reduce((s, r) => s + parseInt(r.shortage || 0), 0);
        const reorderCost = data.reduce((s, r) => s + parseFloat(r.reorder_cost_estimate || 0), 0);
        const outOfStock = data.filter(r => parseInt(r.current_stock) === 0).length;
        return [{ label: 'Items Below Min', value: data.length, color: 'text-amber-400' }, { label: 'Out of Stock', value: outOfStock, color: 'text-red-400' }, { label: 'Total Shortage', value: totalShortage }, { label: 'Est. Reorder Cost', value: formatCurrency(reorderCost), color: 'text-amber-400' }];
      }
      default: return null;
    }
  };

  const summaryStats = getSummaryStats();

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Generate and export operational reports</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchReport} className="btn-secondary">
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleExportCSV} disabled={!data.length} className="btn-primary">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {REPORT_TYPES.map(rt => (
          <button
            key={rt.id}
            onClick={() => { setActiveReport(rt.id); setFilters({ start_date: '', end_date: '', warehouse_id: '', category_id: '', type: '', status: '' }); }}
            className={`p-4 rounded-xl border text-left transition-all ${activeReport === rt.id ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
          >
            <rt.icon size={18} className="mb-2" />
            <div className="font-medium text-sm">{rt.label}</div>
            <div className="text-xs opacity-70 mt-0.5">{rt.description}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="card">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Filters</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {(activeReport === 'inventory_movement' || activeReport === 'shipment_history') && (
            <>
              <div>
                <label className="label">From Date</label>
                <input type="date" className="input" value={filters.start_date} onChange={e => setFilters(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="label">To Date</label>
                <input type="date" className="input" value={filters.end_date} onChange={e => setFilters(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </>
          )}
          {(activeReport === 'inventory_movement' || activeReport === 'stock_summary') && (
            <div>
              <label className="label">Warehouse</label>
              <select className="select" value={filters.warehouse_id} onChange={e => setFilters(f => ({ ...f, warehouse_id: e.target.value }))}>
                <option value="">All</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
          {activeReport === 'stock_summary' && (
            <div>
              <label className="label">Category</label>
              <select className="select" value={filters.category_id} onChange={e => setFilters(f => ({ ...f, category_id: e.target.value }))}>
                <option value="">All</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          {activeReport === 'shipment_history' && (
            <>
              <div>
                <label className="label">Type</label>
                <select className="select" value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}>
                  <option value="">All</option>
                  <option value="incoming">Incoming</option>
                  <option value="outgoing">Outgoing</option>
                </select>
              </div>
              <div>
                <label className="label">Status</label>
                <select className="select" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="in_transit">In Transit</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </>
          )}
          <div className="flex items-end">
            <button onClick={fetchReport} className="btn-primary w-full justify-center">
              Generate
            </button>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      {summaryStats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryStats.map((stat, i) => (
            <div key={i} className="stat-card">
              <div className="text-xs text-slate-500 mb-1">{stat.label}</div>
              <div className={`text-xl font-bold font-['Space_Grotesk'] ${stat.color || 'text-white'}`}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Data table */}
      <div className="card p-0">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-slate-400" />
            <span className="text-sm font-medium text-white">
              {REPORT_TYPES.find(r => r.id === activeReport)?.label}
            </span>
            {data.length > 0 && <span className="badge badge-slate">{data.length} rows</span>}
          </div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16"><PageLoader /></div>
        ) : (
          <div className="table-wrapper border-0 max-h-[600px] overflow-auto">
            {renderTable()}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
