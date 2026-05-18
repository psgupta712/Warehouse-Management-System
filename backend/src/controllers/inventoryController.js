const { pool, withTransaction } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @route GET /api/inventory/logs
const getLogs = asyncHandler(async (req, res) => {
  const { product_id, warehouse_id, type, start_date, end_date, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (product_id) { params.push(product_id); conditions.push(`il.product_id = $${params.length}`); }
  if (warehouse_id) { params.push(warehouse_id); conditions.push(`il.warehouse_id = $${params.length}`); }
  if (type) { params.push(type); conditions.push(`il.transaction_type = $${params.length}`); }
  if (start_date) { params.push(start_date); conditions.push(`il.created_at >= $${params.length}`); }
  if (end_date) { params.push(end_date + ' 23:59:59'); conditions.push(`il.created_at <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const dataQuery = `
    SELECT il.*,
      p.name AS product_name, p.sku,
      w.name AS warehouse_name,
      u.name AS performed_by_name
    FROM inventory_logs il
    LEFT JOIN products p ON il.product_id = p.id
    LEFT JOIN warehouses w ON il.warehouse_id = w.id
    LEFT JOIN users u ON il.performed_by = u.id
    ${where}
    ORDER BY il.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  const countQuery = `SELECT COUNT(*) FROM inventory_logs il ${where}`;

  const [data, total] = await Promise.all([
    pool.query(dataQuery, [...params, limit, offset]),
    pool.query(countQuery, params)
  ]);

  res.json({
    success: true,
    data: {
      logs: data.rows,
      pagination: {
        total: parseInt(total.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total.rows[0].count / limit)
      }
    }
  });
});

// @route POST /api/inventory/stock-in
const stockIn = asyncHandler(async (req, res) => {
  const { product_id, warehouse_id, quantity, notes } = req.body;

  if (!product_id || !quantity || quantity <= 0) {
    throw new AppError('Product ID and positive quantity are required', 400);
  }

  const result = await withTransaction(async (client) => {
    // Lock the product row to prevent race conditions
    const prod = await client.query(
      'SELECT * FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE',
      [product_id]
    );
    if (!prod.rows.length) throw new AppError('Product not found', 404);

    const product = prod.rows[0];
    const newQty = product.quantity + parseInt(quantity);

    await client.query('UPDATE products SET quantity = $1 WHERE id = $2', [newQty, product_id]);

    const log = await client.query(
      `INSERT INTO inventory_logs (product_id, warehouse_id, transaction_type, quantity, quantity_before, quantity_after, notes, performed_by)
       VALUES ($1,$2,'stock_in',$3,$4,$5,$6,$7) RETURNING *`,
      [product_id, warehouse_id || product.warehouse_id, quantity, product.quantity, newQty, notes, req.user.id]
    );

    return { product: { ...product, quantity: newQty }, log: log.rows[0] };
  });

  res.json({
    success: true,
    message: `Successfully added ${quantity} units to stock`,
    data: result
  });
});

// @route POST /api/inventory/stock-out
const stockOut = asyncHandler(async (req, res) => {
  const { product_id, warehouse_id, quantity, notes } = req.body;

  if (!product_id || !quantity || quantity <= 0) {
    throw new AppError('Product ID and positive quantity are required', 400);
  }

  const result = await withTransaction(async (client) => {
    const prod = await client.query(
      'SELECT * FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE',
      [product_id]
    );
    if (!prod.rows.length) throw new AppError('Product not found', 404);

    const product = prod.rows[0];

    if (product.quantity < quantity) {
      throw new AppError(
        `Insufficient stock. Available: ${product.quantity}, Requested: ${quantity}`,
        400
      );
    }

    const newQty = product.quantity - parseInt(quantity);
    await client.query('UPDATE products SET quantity = $1 WHERE id = $2', [newQty, product_id]);

    const log = await client.query(
      `INSERT INTO inventory_logs (product_id, warehouse_id, transaction_type, quantity, quantity_before, quantity_after, notes, performed_by)
       VALUES ($1,$2,'stock_out',$3,$4,$5,$6,$7) RETURNING *`,
      [product_id, warehouse_id || product.warehouse_id, quantity, product.quantity, newQty, notes, req.user.id]
    );

    return { product: { ...product, quantity: newQty }, log: log.rows[0] };
  });

  res.json({
    success: true,
    message: `Successfully removed ${quantity} units from stock`,
    data: result
  });
});

// @route POST /api/inventory/adjust
const adjustInventory = asyncHandler(async (req, res) => {
  const { product_id, new_quantity, notes } = req.body;

  if (!product_id || new_quantity === undefined || new_quantity < 0) {
    throw new AppError('Product ID and non-negative quantity are required', 400);
  }

  const result = await withTransaction(async (client) => {
    const prod = await client.query(
      'SELECT * FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE',
      [product_id]
    );
    if (!prod.rows.length) throw new AppError('Product not found', 404);

    const product = prod.rows[0];
    const diff = new_quantity - product.quantity;

    await client.query('UPDATE products SET quantity = $1 WHERE id = $2', [new_quantity, product_id]);

    const log = await client.query(
      `INSERT INTO inventory_logs (product_id, warehouse_id, transaction_type, quantity, quantity_before, quantity_after, notes, performed_by)
       VALUES ($1,$2,'adjustment',$3,$4,$5,$6,$7) RETURNING *`,
      [product_id, product.warehouse_id, Math.abs(diff), product.quantity, new_quantity, notes || 'Manual adjustment', req.user.id]
    );

    return { product: { ...product, quantity: new_quantity }, log: log.rows[0] };
  });

  res.json({ success: true, message: 'Inventory adjusted successfully', data: result });
});

// @route GET /api/inventory/summary
const getSummary = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT
      p.id, p.sku, p.name, p.quantity, p.min_stock_level, p.unit_price,
      p.quantity * p.unit_price AS total_value,
      c.name AS category,
      w.name AS warehouse,
      CASE WHEN p.quantity = 0 THEN 'out_of_stock'
           WHEN p.quantity <= p.min_stock_level THEN 'low_stock'
           ELSE 'in_stock' END AS stock_status,
      COALESCE(SUM(CASE WHEN il.transaction_type = 'stock_in' THEN il.quantity ELSE 0 END), 0) AS total_received,
      COALESCE(SUM(CASE WHEN il.transaction_type = 'stock_out' THEN il.quantity ELSE 0 END), 0) AS total_dispatched
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN warehouses w ON p.warehouse_id = w.id
    LEFT JOIN inventory_logs il ON il.product_id = p.id
    WHERE p.is_active = TRUE
    GROUP BY p.id, c.name, w.name
    ORDER BY p.name ASC
  `);

  res.json({ success: true, data: { summary: result.rows } });
});

module.exports = { getLogs, stockIn, stockOut, adjustInventory, getSummary };
