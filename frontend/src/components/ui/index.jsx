import React from 'react';
import { Loader2, ChevronLeft, ChevronRight, AlertCircle, X } from 'lucide-react';

// Loading spinner
export const Spinner = ({ size = 20, className = '' }) => (
  <Loader2 size={size} className={`animate-spin text-amber-400 ${className}`} />
);

// Full page loading
export const PageLoader = () => (
  <div className="flex items-center justify-center min-h-64">
    <div className="flex flex-col items-center gap-3">
      <Spinner size={32} />
      <span className="text-slate-400 text-sm">Loading...</span>
    </div>
  </div>
);

// Empty state
export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
      {Icon && <Icon size={28} className="text-slate-500" />}
    </div>
    <h3 className="text-white font-semibold mb-1">{title}</h3>
    {description && <p className="text-slate-400 text-sm mb-4 max-w-xs">{description}</p>}
    {action}
  </div>
);

// Pagination
export const Pagination = ({ pagination, onPageChange }) => {
  if (!pagination || pagination.pages <= 1) return null;
  const { page, pages, total, limit } = pagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800">
      <span className="text-xs text-slate-400">Showing {start}–{end} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          const pageNum = Math.max(1, Math.min(page - 2, pages - 4)) + i;
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`w-7 h-7 rounded text-xs font-medium transition-colors ${pageNum === page ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// Modal wrapper
export const Modal = ({ open, onClose, title, size = 'modal', children }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={size} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

// Confirm dialog
export const ConfirmDialog = ({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete', danger = true }) => (
  <Modal open={open} onClose={onClose} title={title}>
    <p className="text-slate-300 text-sm mb-6">{message}</p>
    <div className="flex gap-3 justify-end">
      <button onClick={onClose} className="btn-secondary">Cancel</button>
      <button onClick={onConfirm} className={danger ? 'btn-danger' : 'btn-primary'}>
        {confirmLabel}
      </button>
    </div>
  </Modal>
);

// Stats card
export const StatCard = ({ icon: Icon, label, value, sub, color = 'amber', trend }) => {
  const colors = {
    amber: 'bg-amber-500/10 text-amber-400',
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-emerald-500/10 text-emerald-400',
    red: 'bg-red-500/10 text-red-400',
    purple: 'bg-purple-500/10 text-purple-400',
    slate: 'bg-slate-700/50 text-slate-400',
  };

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
          <Icon size={18} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white font-['Space_Grotesk']">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
};

// Search input
export const SearchInput = ({ value, onChange, placeholder = 'Search...' }) => (
  <div className="relative">
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="input pl-9 w-64"
    />
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  </div>
);

// Alert banner
export const Alert = ({ type = 'error', message }) => {
  const styles = {
    error: 'bg-red-500/10 border-red-500/20 text-red-400',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
  };
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm ${styles[type]}`}>
      <AlertCircle size={16} />
      {message}
    </div>
  );
};
