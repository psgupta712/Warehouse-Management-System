const { pool } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @route GET /api/warehouses
const getWarehouses = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  let query = `
    SELECT w.*,
      COUNT(DISTINCT p.id) AS product_count,
      COALESCE(SUM(p.quantity * p.unit_price), 0) AS inventory_value,
      ROUND((w.used_capacity::DECIMAL / NULLIF(w.capacity, 0) * 100), 1) AS utilization_percent
    FROM warehouses w
    LEFT JOIN products p ON p.warehouse_id = w.id AND p.is_active = TRUE
    WHERE w.is_active = TRUE
  `;
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    query += ` AND (w.name ILIKE $${params.length} OR w.location ILIKE $${params.length})`;
  }

  query += ` GROUP BY w.id ORDER BY w.created_at DESC`;

  const countQuery = query.replace(
    /SELECT w\.\*.*?FROM warehouses w/s,
    'SELECT COUNT(DISTINCT w.id) FROM warehouses w'
  ).replace(/GROUP BY.*$/s, '');

  const [data, total] = await Promise.all([
    pool.query(query + ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`, [...params, limit, offset]),
    pool.query(countQuery, params)
  ]);

  res.json({
    success: true,
    data: {
      warehouses: data.rows,
      pagination: {
        total: parseInt(total.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total.rows[0].count / limit)
      }
    }
  });
});

// @route GET /api/warehouses/:id
const getWarehouse = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT w.*,
      COUNT(DISTINCT p.id) AS product_count,
      COALESCE(SUM(p.quantity), 0) AS total_units,
      COALESCE(SUM(p.quantity * p.unit_price), 0) AS inventory_value
    FROM warehouses w
    LEFT JOIN products p ON p.warehouse_id = w.id AND p.is_active = TRUE
    WHERE w.id = $1
    GROUP BY w.id
  `, [req.params.id]);

  if (!result.rows.length) throw new AppError('Warehouse not found', 404);

  // Recent activity for this warehouse
  const activity = await pool.query(`
    SELECT il.*, p.name AS product_name, u.name AS performed_by_name
    FROM inventory_logs il
    LEFT JOIN products p ON il.product_id = p.id
    LEFT JOIN users u ON il.performed_by = u.id
    WHERE il.warehouse_id = $1
    ORDER BY il.created_at DESC LIMIT 10
  `, [req.params.id]);

  res.json({
    success: true,
    data: { warehouse: result.rows[0], recentActivity: activity.rows }
  });
});

// @route POST /api/warehouses
const createWarehouse = asyncHandler(async (req, res) => {
  const { name, location, capacity, manager_name, phone } = req.body;

  if (!name || !location || !capacity) {
    throw new AppError('Name, location, and capacity are required', 400);
  }
  if (capacity <= 0) throw new AppError('Capacity must be greater than 0', 400);

  const result = await pool.query(
    `INSERT INTO warehouses (name, location, capacity, manager_name, phone)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [name.trim(), location.trim(), capacity, manager_name, phone]
  );

  res.status(201).json({
    success: true,
    message: 'Warehouse created successfully',
    data: { warehouse: result.rows[0] }
  });
});

// @route PUT /api/warehouses/:id
const updateWarehouse = asyncHandler(async (req, res) => {
  const { name, location, capacity, manager_name, phone, is_active } = req.body;

  const existing = await pool.query('SELECT * FROM warehouses WHERE id = $1', [req.params.id]);
  if (!existing.rows.length) throw new AppError('Warehouse not found', 404);

  const result = await pool.query(
    `UPDATE warehouses SET
      name = COALESCE($1, name),
      location = COALESCE($2, location),
      capacity = COALESCE($3, capacity),
      manager_name = COALESCE($4, manager_name),
      phone = COALESCE($5, phone),
      is_active = COALESCE($6, is_active)
     WHERE id = $7 RETURNING *`,
    [name, location, capacity, manager_name, phone, is_active, req.params.id]
  );

  res.json({
    success: true,
    message: 'Warehouse updated successfully',
    data: { warehouse: result.rows[0] }
  });
});

// @route DELETE /api/warehouses/:id
const deleteWarehouse = asyncHandler(async (req, res) => {
  const products = await pool.query(
    'SELECT COUNT(*) FROM products WHERE warehouse_id = $1 AND is_active = TRUE',
    [req.params.id]
  );

  if (parseInt(products.rows[0].count) > 0) {
    throw new AppError('Cannot delete warehouse with active products. Reassign products first.', 400);
  }

  await pool.query('UPDATE warehouses SET is_active = FALSE WHERE id = $1', [req.params.id]);

  res.json({ success: true, message: 'Warehouse deleted successfully' });
});

module.exports = { getWarehouses, getWarehouse, createWarehouse, updateWarehouse, deleteWarehouse };
