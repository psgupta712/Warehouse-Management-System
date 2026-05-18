import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' }
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('wms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle global errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || 'Something went wrong';
    if (error.response?.status === 401) {
      localStorage.removeItem('wms_token');
      localStorage.removeItem('wms_user');
      window.location.href = '/login';
    } else if (error.response?.status !== 404) {
      toast.error(message);
    }
    return Promise.reject(error);
  }
);

// ---- Auth ----
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  register: (data) => api.post('/auth/register', data),
  changePassword: (data) => api.put('/auth/change-password', data),
  getUsers: () => api.get('/auth/users'),
};

// ---- Dashboard ----
export const dashboardAPI = {
  getStats: () => api.get('/dashboard/stats'),
  getRecentActivity: () => api.get('/dashboard/recent-activity'),
  getInventoryChart: () => api.get('/dashboard/inventory-chart'),
  getCategoryBreakdown: () => api.get('/dashboard/category-breakdown'),
  getWarehouseUtilization: () => api.get('/dashboard/warehouse-utilization'),
  getLowStock: () => api.get('/dashboard/low-stock'),
};

// ---- Warehouses ----
export const warehouseAPI = {
  getAll: (params) => api.get('/warehouses', { params }),
  getOne: (id) => api.get(`/warehouses/${id}`),
  create: (data) => api.post('/warehouses', data),
  update: (id, data) => api.put(`/warehouses/${id}`, data),
  delete: (id) => api.delete(`/warehouses/${id}`),
};

// ---- Products ----
export const productAPI = {
  getAll: (params) => api.get('/products', { params }),
  getOne: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getCategories: () => api.get('/products/categories'),
  createCategory: (data) => api.post('/products/categories', data),
};

// ---- Inventory ----
export const inventoryAPI = {
  getLogs: (params) => api.get('/inventory/logs', { params }),
  getSummary: () => api.get('/inventory/summary'),
  stockIn: (data) => api.post('/inventory/stock-in', data),
  stockOut: (data) => api.post('/inventory/stock-out', data),
  adjust: (data) => api.post('/inventory/adjust', data),
};

// ---- Suppliers ----
export const supplierAPI = {
  getAll: (params) => api.get('/suppliers', { params }),
  getOne: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
};

// ---- Shipments ----
export const shipmentAPI = {
  getAll: (params) => api.get('/shipments', { params }),
  getOne: (id) => api.get(`/shipments/${id}`),
  create: (data) => api.post('/shipments', data),
  update: (id, data) => api.put(`/shipments/${id}`, data),
  updateStatus: (id, status) => api.put(`/shipments/${id}/status`, { status }),
};

// ---- Reports ----
export const reportAPI = {
  inventoryMovement: (params) => api.get('/reports/inventory-movement', { params }),
  stockSummary: (params) => api.get('/reports/stock-summary', { params }),
  shipmentHistory: (params) => api.get('/reports/shipment-history', { params }),
  lowStock: () => api.get('/reports/low-stock'),
};

export default api;
