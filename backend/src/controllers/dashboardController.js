const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

// @route GET /api/dashboard/stats
const getStats = asyncHandler(async (req, res) => {
  const [
    products,
    warehouses,
    lowStock,
    incomingShipments,
    outgoingShipments,
    totalInventoryValue,
    suppliers
  ] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM products WHERE is_active = TRUE'),
    pool.query('SELECT COUNT(*) FROM warehouses WHERE is_active = TRUE'),
    pool.query('SELECT COUNT(*) FROM products WHERE quantity <= min_stock_level AND is_active = TRUE'),
    pool.query("SELECT COUNT(*) FROM shipments WHERE type = 'incoming' AND status NOT IN ('delivered', 'cancelled')"),
    pool.query("SELECT COUNT(*) FROM shipments WHERE type = 'outgoing' AND status NOT IN ('delivered', 'cancelled')"),
    pool.query('SELECT COALESCE(SUM(quantity * unit_price), 0) as total FROM products WHERE is_active = TRUE'),
    pool.query('SELECT COUNT(*) FROM suppliers WHERE is_active = TRUE'),
  ]);

  res.json({
    success: true,
    data: {
      totalProducts: parseInt(products.rows[0].count),
      totalWarehouses: parseInt(warehouses.rows[0].count),
      lowStockItems: parseInt(lowStock.rows[0].count),
      incomingShipments: parseInt(incomingShipments.rows[0].count),
      outgoingShipments: parseInt(outgoingShipments.rows[0].count),
      totalInventoryValue: parseFloat(totalInventoryValue.rows[0].total),
      totalSuppliers: parseInt(suppliers.rows[0].count),
    }
  });
});

// @route GET /api/dashboard/recent-activity
const getRecentActivity = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      il.id,
      il.transaction_type,
      il.quantity,
      il.quantity_before,
      il.quantity_after,
      il.notes,
      il.created_at,
      p.name AS product_name,
      p.sku,
      u.name AS performed_by_name,
      w.name AS warehouse_name
    FROM inventory_logs il
    LEFT JOIN products p ON il.product_id = p.id
    LEFT JOIN users u ON il.performed_by = u.id
    LEFT JOIN warehouses w ON il.warehouse_id = w.id
    ORDER BY il.created_at DESC
    LIMIT 15
  `);

  res.json({ success: true, data: { activities: result.rows } });
});

// @route GET /api/dashboard/inventory-chart
const getInventoryChart = asyncHandler(async (req, res) => {
  // Stock in/out per day last 30 days
  const result = await pool.query(`
    SELECT
      DATE(created_at) AS date,
      SUM(CASE WHEN transaction_type = 'stock_in' THEN quantity ELSE 0 END) AS stock_in,
      SUM(CASE WHEN transaction_type = 'stock_out' THEN quantity ELSE 0 END) AS stock_out
    FROM inventory_logs
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `);

  res.json({ success: true, data: { chart: result.rows } });
});

// @route GET /api/dashboard/category-breakdown
const getCategoryBreakdown = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      c.name AS category,
      COUNT(p.id) AS product_count,
      COALESCE(SUM(p.quantity), 0) AS total_quantity,
      COALESCE(SUM(p.quantity * p.unit_price), 0) AS total_value
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.is_active = TRUE
    GROUP BY c.id, c.name
    ORDER BY total_value DESC
  `);

  res.json({ success: true, data: { breakdown: result.rows } });
});

// @route GET /api/dashboard/warehouse-utilization
const getWarehouseUtilization = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      w.id,
      w.name,
      w.capacity,
      w.used_capacity,
      ROUND((w.used_capacity::DECIMAL / NULLIF(w.capacity, 0) * 100), 1) AS utilization_percent,
      COUNT(p.id) AS product_types
    FROM warehouses w
    LEFT JOIN products p ON p.warehouse_id = w.id AND p.is_active = TRUE
    WHERE w.is_active = TRUE
    GROUP BY w.id, w.name, w.capacity, w.used_capacity
    ORDER BY utilization_percent DESC
  `);

  res.json({ success: true, data: { warehouses: result.rows } });
});

// @route GET /api/dashboard/low-stock
const getLowStock = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      p.id,
      p.sku,
      p.name,
      p.quantity,
      p.min_stock_level,
      p.unit_price,
      c.name AS category,
      w.name AS warehouse_name,
      s.name AS supplier_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN warehouses w ON p.warehouse_id = w.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.quantity <= p.min_stock_level AND p.is_active = TRUE
    ORDER BY p.quantity ASC
    LIMIT 10
  `);

  res.json({ success: true, data: { products: result.rows } });
});

module.exports = {
  getStats,
  getRecentActivity,
  getInventoryChart,
  getCategoryBreakdown,
  getWarehouseUtilization,
  getLowStock
};
