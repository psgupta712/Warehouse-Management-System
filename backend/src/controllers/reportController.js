const { pool } = require('../config/db');
const { asyncHandler } = require('../middleware/errorHandler');

// @route GET /api/reports/inventory-movement
const inventoryMovement = asyncHandler(async (req, res) => {
  const { start_date, end_date, warehouse_id } = req.query;
  const params = [];
  const conditions = [];

  if (start_date) { params.push(start_date); conditions.push(`il.created_at >= $${params.length}`); }
  if (end_date) { params.push(end_date + ' 23:59:59'); conditions.push(`il.created_at <= $${params.length}`); }
  if (warehouse_id) { params.push(warehouse_id); conditions.push(`il.warehouse_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(`
    SELECT
      il.created_at,
      il.transaction_type,
      il.quantity,
      il.quantity_before,
      il.quantity_after,
      il.notes,
      p.sku,
      p.name AS product_name,
      p.unit_price,
      il.quantity * p.unit_price AS transaction_value,
      w.name AS warehouse_name,
      u.name AS performed_by
    FROM inventory_logs il
    JOIN products p ON il.product_id = p.id
    LEFT JOIN warehouses w ON il.warehouse_id = w.id
    LEFT JOIN users u ON il.performed_by = u.id
    ${where}
    ORDER BY il.created_at DESC
  `, params);

  res.json({ success: true, data: { report: result.rows } });
});

// @route GET /api/reports/stock-summary
const stockSummary = asyncHandler(async (req, res) => {
  const { warehouse_id, category_id } = req.query;
  const params = [];
  const conditions = ['p.is_active = TRUE'];

  if (warehouse_id) { params.push(warehouse_id); conditions.push(`p.warehouse_id = $${params.length}`); }
  if (category_id) { params.push(category_id); conditions.push(`p.category_id = $${params.length}`); }

  const where = conditions.join(' AND ');

  const result = await pool.query(`
    SELECT
      p.sku,
      p.name,
      p.quantity AS current_stock,
      p.min_stock_level,
      p.unit_price,
      p.quantity * p.unit_price AS total_value,
      p.unit,
      c.name AS category,
      w.name AS warehouse,
      s.name AS supplier,
      CASE WHEN p.quantity = 0 THEN 'Out of Stock'
           WHEN p.quantity <= p.min_stock_level THEN 'Low Stock'
           ELSE 'In Stock' END AS status,
      COALESCE(received.total, 0) AS total_received,
      COALESCE(dispatched.total, 0) AS total_dispatched
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN warehouses w ON p.warehouse_id = w.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS total FROM inventory_logs WHERE transaction_type = 'stock_in' GROUP BY product_id
    ) received ON received.product_id = p.id
    LEFT JOIN (
      SELECT product_id, SUM(quantity) AS total FROM inventory_logs WHERE transaction_type = 'stock_out' GROUP BY product_id
    ) dispatched ON dispatched.product_id = p.id
    WHERE ${where}
    ORDER BY p.name ASC
  `, params);

  res.json({ success: true, data: { report: result.rows } });
});

// @route GET /api/reports/shipment-history
const shipmentHistory = asyncHandler(async (req, res) => {
  const { type, status, start_date, end_date } = req.query;
  const params = [];
  const conditions = [];

  if (type) { params.push(type); conditions.push(`s.type = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`s.status = $${params.length}`); }
  if (start_date) { params.push(start_date); conditions.push(`s.created_at >= $${params.length}`); }
  if (end_date) { params.push(end_date + ' 23:59:59'); conditions.push(`s.created_at <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(`
    SELECT
      s.shipment_number,
      s.type,
      s.status,
      s.total_value,
      s.expected_date,
      s.actual_date,
      s.created_at,
      w.name AS warehouse,
      sup.name AS supplier,
      u.name AS created_by,
      COUNT(si.id) AS item_count,
      COALESCE(SUM(si.quantity), 0) AS total_units
    FROM shipments s
    LEFT JOIN warehouses w ON s.warehouse_id = w.id
    LEFT JOIN suppliers sup ON s.supplier_id = sup.id
    LEFT JOIN users u ON s.created_by = u.id
    LEFT JOIN shipment_items si ON si.shipment_id = s.id
    ${where}
    GROUP BY s.id, w.name, sup.name, u.name
    ORDER BY s.created_at DESC
  `, params);

  res.json({ success: true, data: { report: result.rows } });
});

// @route GET /api/reports/low-stock
const lowStockReport = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      p.sku,
      p.name,
      p.quantity AS current_stock,
      p.min_stock_level,
      p.min_stock_level - p.quantity AS shortage,
      p.unit_price,
      (p.min_stock_level - p.quantity) * p.unit_price AS reorder_cost_estimate,
      c.name AS category,
      w.name AS warehouse,
      s.name AS supplier,
      s.email AS supplier_email,
      s.phone AS supplier_phone
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN warehouses w ON p.warehouse_id = w.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.quantity <= p.min_stock_level AND p.is_active = TRUE
    ORDER BY (p.quantity::DECIMAL / NULLIF(p.min_stock_level, 0)) ASC
  `);

  res.json({ success: true, data: { report: result.rows } });
});

module.exports = { inventoryMovement, stockSummary, shipmentHistory, lowStockReport };
