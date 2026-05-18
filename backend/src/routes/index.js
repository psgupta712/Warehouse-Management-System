const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const dash = require('../controllers/dashboardController');
const warehouse = require('../controllers/warehouseController');
const product = require('../controllers/productController');
const inventory = require('../controllers/inventoryController');
const supplier = require('../controllers/supplierController');
const shipment = require('../controllers/shipmentController');
const report = require('../controllers/reportController');
const { authenticate, authorize } = require('../middleware/auth');

// Auth routes
router.post('/auth/login', auth.login);
router.get('/auth/me', authenticate, auth.getMe);
router.post('/auth/register', authenticate, authorize('admin'), auth.register);
router.put('/auth/change-password', authenticate, auth.changePassword);
router.get('/auth/users', authenticate, authorize('admin'), auth.getUsers);

// Dashboard routes
router.get('/dashboard/stats', authenticate, dash.getStats);
router.get('/dashboard/recent-activity', authenticate, dash.getRecentActivity);
router.get('/dashboard/inventory-chart', authenticate, dash.getInventoryChart);
router.get('/dashboard/category-breakdown', authenticate, dash.getCategoryBreakdown);
router.get('/dashboard/warehouse-utilization', authenticate, dash.getWarehouseUtilization);
router.get('/dashboard/low-stock', authenticate, dash.getLowStock);

// Warehouse routes
router.get('/warehouses', authenticate, warehouse.getWarehouses);
router.get('/warehouses/:id', authenticate, warehouse.getWarehouse);
router.post('/warehouses', authenticate, authorize('admin'), warehouse.createWarehouse);
router.put('/warehouses/:id', authenticate, authorize('admin'), warehouse.updateWarehouse);
router.delete('/warehouses/:id', authenticate, authorize('admin'), warehouse.deleteWarehouse);

// Product routes
router.get('/products/categories', authenticate, product.getCategories);
router.post('/products/categories', authenticate, authorize('admin'), product.createCategory);
router.get('/products', authenticate, product.getProducts);
router.get('/products/:id', authenticate, product.getProduct);
router.post('/products', authenticate, authorize('admin'), product.createProduct);
router.put('/products/:id', authenticate, product.updateProduct);
router.delete('/products/:id', authenticate, authorize('admin'), product.deleteProduct);

// Inventory routes
router.get('/inventory/logs', authenticate, inventory.getLogs);
router.get('/inventory/summary', authenticate, inventory.getSummary);
router.post('/inventory/stock-in', authenticate, inventory.stockIn);
router.post('/inventory/stock-out', authenticate, inventory.stockOut);
router.post('/inventory/adjust', authenticate, authorize('admin'), inventory.adjustInventory);

// Supplier routes
router.get('/suppliers', authenticate, supplier.getSuppliers);
router.get('/suppliers/:id', authenticate, supplier.getSupplier);
router.post('/suppliers', authenticate, authorize('admin'), supplier.createSupplier);
router.put('/suppliers/:id', authenticate, supplier.updateSupplier);
router.delete('/suppliers/:id', authenticate, authorize('admin'), supplier.deleteSupplier);

// Shipment routes
router.get('/shipments', authenticate, shipment.getShipments);
router.get('/shipments/:id', authenticate, shipment.getShipment);
router.post('/shipments', authenticate, shipment.createShipment);
router.put('/shipments/:id', authenticate, shipment.updateShipment);
router.put('/shipments/:id/status', authenticate, shipment.updateStatus);

// Report routes
router.get('/reports/inventory-movement', authenticate, report.inventoryMovement);
router.get('/reports/stock-summary', authenticate, report.stockSummary);
router.get('/reports/shipment-history', authenticate, report.shipmentHistory);
router.get('/reports/low-stock', authenticate, report.lowStockReport);

module.exports = router;
