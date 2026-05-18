import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../utils/api';
import { formatCurrency, formatNumber, getStockStatusBadge, timeAgo, getUtilizationBarColor, getUtilizationColor } from '../utils/helpers';
import { StatCard, PageLoader } from '../components/ui/index';
import {
  Package, Warehouse, AlertTriangle, TruckIcon, ArrowDownCircle,
  ArrowUpCircle, DollarSign, Users
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { format } from 'date-fns';

const COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#6b7280'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-slate-400 mb-1">{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color }} className="font-medium">{p.name}: {p.value}</div>
      ))}
    </div>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [chart, setChart] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, a, c, cat, w, ls] = await Promise.all([
          dashboardAPI.getStats(),
          dashboardAPI.getRecentActivity(),
          dashboardAPI.getInventoryChart(),
          dashboardAPI.getCategoryBreakdown(),
          dashboardAPI.getWarehouseUtilization(),
          dashboardAPI.getLowStock(),
        ]);
        setStats(s.data.data);
        setActivity(a.data.data.activities);
        setChart(c.data.data.chart.map(r => ({
          ...r,
          date: format(new Date(r.date), 'MMM dd'),
          stock_in: parseInt(r.stock_in),
          stock_out: parseInt(r.stock_out),
        })));
        setCategoryData(cat.data.data.breakdown.map(r => ({
          name: r.category,
          value: parseFloat(r.total_value),
          count: parseInt(r.product_count),
        })));
        setWarehouses(w.data.data.warehouses);
        setLowStock(ls.data.data.products);
      } catch (err) { /* handled */ }
      finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) return <PageLoader />;

  const txBadge = (type) => {
    const map = { stock_in: 'text-emerald-400', stock_out: 'text-red-400', adjustment: 'text-blue-400' };
    const labels = { stock_in: '↑ In', stock_out: '↓ Out', adjustment: '⟳ Adj' };
    return <span className={`text-xs font-medium ${map[type] || 'text-slate-400'}`}>{labels[type] || type}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Package} label="Total Products" value={formatNumber(stats?.totalProducts)} color="amber" />
        <StatCard icon={Warehouse} label="Warehouses" value={formatNumber(stats?.totalWarehouses)} color="blue" />
        <StatCard icon={AlertTriangle} label="Low Stock Items" value={formatNumber(stats?.lowStockItems)} color="red" />
        <StatCard icon={DollarSign} label="Inventory Value" value={formatCurrency(stats?.totalInventoryValue)} color="green" />
        <StatCard icon={ArrowDownCircle} label="Incoming Shipments" value={formatNumber(stats?.incomingShipments)} color="blue" />
        <StatCard icon={ArrowUpCircle} label="Outgoing Shipments" value={formatNumber(stats?.outgoingShipments)} color="purple" />
        <StatCard icon={Users} label="Active Suppliers" value={formatNumber(stats?.totalSuppliers)} color="amber" />
        <StatCard icon={TruckIcon} label="Active Shipments" value={formatNumber((stats?.incomingShipments || 0) + (stats?.outgoingShipments || 0))} color="slate" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Line chart */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-white mb-4 text-sm">Inventory Movement (30 days)</h3>
          {chart.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="stock_in" name="Stock In" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="stock_out" name="Stock Out" stroke="#ef4444" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No movement data yet</div>
          )}
        </div>

        {/* Pie chart */}
        <div className="card">
          <h3 className="font-semibold text-white mb-4 text-sm">Value by Category</h3>
          {categoryData.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={categoryData.filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                  {categoryData.filter(d => d.value > 0).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val) => formatCurrency(val)} contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No data</div>
          )}
          <div className="space-y-1 mt-2">
            {categoryData.filter(d => d.value > 0).slice(0, 4).map((cat, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-slate-400">{cat.name}</span>
                </div>
                <span className="text-slate-300">{formatCurrency(cat.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Warehouse utilization */}
        <div className="card">
          <h3 className="font-semibold text-white mb-4 text-sm">Warehouse Utilization</h3>
          <div className="space-y-4">
            {warehouses.map((w) => {
              const pct = parseFloat(w.utilization_percent) || 0;
              return (
                <div key={w.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">{w.name}</span>
                    <span className={getUtilizationColor(pct)}>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getUtilizationBarColor(pct)}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{formatNumber(w.used_capacity)} / {formatNumber(w.capacity)} units</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent activity */}
        <div className="card">
          <h3 className="font-semibold text-white mb-4 text-sm">Recent Activity</h3>
          <div className="space-y-2.5 max-h-64 overflow-y-auto">
            {activity.length === 0 ? (
              <div className="text-slate-500 text-sm text-center py-8">No recent activity</div>
            ) : activity.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {txBadge(log.transaction_type)}
                    <span className="text-xs text-slate-300 font-medium truncate">{log.product_name}</span>
                    <span className="text-xs text-slate-500 ml-auto flex-shrink-0">×{log.quantity}</span>
                  </div>
                  <div className="text-xs text-slate-500">{log.warehouse_name} · {timeAgo(log.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low stock table */}
      {lowStock.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-400" />
            <h3 className="font-semibold text-white text-sm">Low Stock Alert</h3>
            <span className="badge badge-amber ml-auto">{lowStock.length} items</span>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Warehouse</th>
                  <th>Current Stock</th>
                  <th>Min Level</th>
                  <th>Supplier</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.map(p => {
                  const badge = getStockStatusBadge(p.quantity, p.min_stock_level);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="font-medium text-white">{p.name}</div>
                        <div className="text-xs text-slate-500">{p.sku}</div>
                      </td>
                      <td className="text-slate-400">{p.category || '—'}</td>
                      <td className="text-slate-400">{p.warehouse_name || '—'}</td>
                      <td>
                        <span className={`badge ${badge.class}`}>{p.quantity}</span>
                      </td>
                      <td className="text-slate-400">{p.min_stock_level}</td>
                      <td className="text-slate-400">{p.supplier_name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
