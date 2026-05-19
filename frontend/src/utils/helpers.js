import { format, formatDistanceToNow } from 'date-fns';

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
};

export const formatNumber = (num) => {
  return new Intl.NumberFormat('en-US').format(num || 0);
};

export const formatDate = (date) => {
  if (!date) return '—';
  return format(new Date(date), 'MMM dd, yyyy');
};

export const formatDateTime = (date) => {
  if (!date) return '—';
  return format(new Date(date), 'MMM dd, yyyy HH:mm');
};

export const timeAgo = (date) => {
  if (!date) return '—';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
};

export const getStockStatusBadge = (quantity, minStock) => {
  if (quantity === 0) return { label: 'Out of Stock', class: 'badge-red' };
  if (quantity <= minStock) return { label: 'Low Stock', class: 'badge-amber' };
  return { label: 'In Stock', class: 'badge-green' };
};

export const getShipmentStatusBadge = (status) => {
  const map = {
    pending: { label: 'Pending', class: 'badge-slate' },
    in_transit: { label: 'In Transit', class: 'badge-blue' },
    delivered: { label: 'Delivered', class: 'badge-green' },
    cancelled: { label: 'Cancelled', class: 'badge-red' },
  };
  return map[status] || { label: status, class: 'badge-slate' };
};

export const getTransactionBadge = (type) => {
  const map = {
    stock_in: { label: 'Stock In', class: 'badge-green' },
    stock_out: { label: 'Stock Out', class: 'badge-red' },
    adjustment: { label: 'Adjustment', class: 'badge-blue' },
    transfer: { label: 'Transfer', class: 'badge-amber' },
  };
  return map[type] || { label: type, class: 'badge-slate' };
};

// Export table data to CSV
export const exportToCSV = (data, filename) => {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      return typeof val === 'string' && val.includes(',') ? `"${val}"` : val ?? '';
    }).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const getUtilizationColor = (percent) => {
  if (percent >= 90) return 'text-red-400';
  if (percent >= 70) return 'text-amber-400';
  return 'text-emerald-400';
};

export const getUtilizationBarColor = (percent) => {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
};
