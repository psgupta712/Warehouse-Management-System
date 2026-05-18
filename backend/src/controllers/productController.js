const { pool } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @route GET /api/products
const getProducts = asyncHandler(async (req, res) => {
  const { search, category, warehouse, min_price, max_price, low_stock, page = 1, limit = 10, sort = 'created_at', order = 'DESC' } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = ['p.is_active = TRUE'];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.description ILIKE $${params.length})`);
  }
  if (category) { params.push(category); conditions.push(`p.category_id = $${params.length}`); }
  if (warehouse) { params.push(warehouse); conditions.push(`p.warehouse_id = $${params.length}`); }
  if (min_price) { params.push(min_price); conditions.push(`p.unit_price >= $${params.length}`); }
  if (max_price) { params.push(max_price); conditions.push(`p.unit_price <= $${params.length}`); }
  if (low_stock === 'true') conditions.push('p.quantity <= p.min_stock_level');

  const where = conditions.join(' AND ');
  const validSorts = ['name', 'sku', 'quantity', 'unit_price', 'created_at'];
  const sortCol = validSorts.includes(sort) ? `p.${sort}` : 'p.created_at';
  const sortDir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const dataQuery = `
    SELECT p.*,
      c.name AS category_name,
      w.name AS warehouse_name,
      s.name AS supplier_name,
      CASE WHEN p.quantity <= p.min_stock_level THEN TRUE ELSE FALSE END AS is_low_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN warehouses w ON p.warehouse_id = w.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE ${where}
    ORDER BY ${sortCol} ${sortDir}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const countQuery = `SELECT COUNT(*) FROM products p WHERE ${where}`;

  const [data, total] = await Promise.all([
    pool.query(dataQuery, [...params, limit, offset]),
    pool.query(countQuery, params)
  ]);

  res.json({
    success: true,
    data: {
      products: data.rows,
      pagination: {
        total: parseInt(total.rows[0].count),
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total.rows[0].count / limit)
      }
    }
  });
});

// @route GET /api/products/:id
const getProduct = asyncHandler(async (req, res) => {
  const result = await pool.query(`
    SELECT p.*, c.name AS category_name, w.name AS warehouse_name, s.name AS supplier_name,
      CASE WHEN p.quantity <= p.min_stock_level THEN TRUE ELSE FALSE END AS is_low_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN warehouses w ON p.warehouse_id = w.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    WHERE p.id = $1
  `, [req.params.id]);

  if (!result.rows.length) throw new AppError('Product not found', 404);

  const logs = await pool.query(`
    SELECT il.*, u.name AS performed_by_name
    FROM inventory_logs il
    LEFT JOIN users u ON il.performed_by = u.id
    WHERE il.product_id = $1
    ORDER BY il.created_at DESC LIMIT 20
  `, [req.params.id]);

  res.json({
    success: true,
    data: { product: result.rows[0], inventoryHistory: logs.rows }
  });
});

// @route POST /api/products
const createProduct = asyncHandler(async (req, res) => {
  const { sku, name, description, category_id, supplier_id, warehouse_id, quantity = 0, min_stock_level = 10, unit_price, unit = 'units', weight } = req.body;

  if (!sku || !name || unit_price === undefined) {
    throw new AppError('SKU, name, and unit price are required', 400);
  }

  const result = await pool.query(
    `INSERT INTO products (sku, name, description, category_id, supplier_id, warehouse_id, quantity, min_stock_level, unit_price, unit, weight)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [sku.toUpperCase().trim(), name.trim(), description, category_id || null, supplier_id || null, warehouse_id || null, quantity, min_stock_level, unit_price, unit, weight || null]
  );

  // Log initial stock if qty > 0
  if (quantity > 0) {
    await pool.query(
      `INSERT INTO inventory_logs (product_id, warehouse_id, transaction_type, quantity, quantity_before, quantity_after, notes, performed_by)
       VALUES ($1,$2,'stock_in',$3,0,$3,'Initial stock entry',$4)`,
      [result.rows[0].id, warehouse_id || null, quantity, req.user.id]
    );
  }

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: { product: result.rows[0] }
  });
});

// @route PUT /api/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const { name, description, category_id, supplier_id, warehouse_id, min_stock_level, unit_price, unit, weight, is_active } = req.body;

  const existing = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
  if (!existing.rows.length) throw new AppError('Product not found', 404);

  const result = await pool.query(
    `UPDATE products SET
      name = COALESCE($1, name), description = COALESCE($2, description),
      category_id = COALESCE($3, category_id), supplier_id = COALESCE($4, supplier_id),
      warehouse_id = COALESCE($5, warehouse_id), min_stock_level = COALESCE($6, min_stock_level),
      unit_price = COALESCE($7, unit_price), unit = COALESCE($8, unit),
      weight = COALESCE($9, weight), is_active = COALESCE($10, is_active)
     WHERE id = $11 RETURNING *`,
    [name, description, category_id, supplier_id, warehouse_id, min_stock_level, unit_price, unit, weight, is_active, req.params.id]
  );

  res.json({ success: true, message: 'Product updated', data: { product: result.rows[0] } });
});

// @route DELETE /api/products/:id
const deleteProduct = asyncHandler(async (req, res) => {
  await pool.query('UPDATE products SET is_active = FALSE WHERE id = $1', [req.params.id]);
  res.json({ success: true, message: 'Product deleted successfully' });
});

// @route GET /api/products/categories
const getCategories = asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
  res.json({ success: true, data: { categories: result.rows } });
});

// @route POST /api/products/categories
const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) throw new AppError('Category name is required', 400);

  const result = await pool.query(
    'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
    [name.trim(), description]
  );
  res.status(201).json({ success: true, data: { category: result.rows[0] } });
});

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getCategories, createCategory };
