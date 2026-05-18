const { pool } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @route GET /api/suppliers
const getSuppliers = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  let where = 'WHERE s.is_active = TRUE';

  if (search) {
    params.push(`%${search}%`);
    where += ` AND (s.name ILIKE $${params.length} OR s.email ILIKE $${params.length} OR s.contact_person ILIKE $${params.length})`;
  }

  const dataQuery = `
    SELECT s.*, COUNT(p.id) AS product_count,
      COALESCE(SUM(p.quantity * p.unit_price), 0) AS supplied_value
    FROM suppliers s
    LEFT JOIN products p ON p.supplier_id = s.id AND p.is_active = TRUE
    ${where}
    GROUP BY s.id
    ORDER BY s.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  const countQuery = `SELECT COUNT(*) FROM suppliers s ${where}`;

  const [data, total] = await Promise.all([
    pool.query(dataQuery, [...params, limit, offset]),
    pool.query(countQuery, params)
  ]);

  res.json({
    success: true,
    data: {
      suppliers: data.rows,
      pagination: { total: parseInt(total.rows[0].count), page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total.rows[0].count / limit) }
    }
  });
});

// @route GET /api/suppliers/:id
const getSupplier = asyncHandler(async (req, res) => {
  const supplier = await pool.query('SELECT * FROM suppliers WHERE id = $1', [req.params.id]);
  if (!supplier.rows.length) throw new AppError('Supplier not found', 404);

  const products = await pool.query(`
    SELECT p.id, p.sku, p.name, p.quantity, p.unit_price, c.name AS category, w.name AS warehouse
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN warehouses w ON p.warehouse_id = w.id
    WHERE p.supplier_id = $1 AND p.is_active = TRUE
    ORDER BY p.name ASC
  `, [req.params.id]);

  const shipments = await pool.query(
    'SELECT * FROM shipments WHERE supplier_id = $1 ORDER BY created_at DESC LIMIT 10',
    [req.params.id]
  );

  res.json({
    success: true,
    data: { supplier: supplier.rows[0], products: products.rows, shipments: shipments.rows }
  });
});

// @route POST /api/suppliers
const createSupplier = asyncHandler(async (req, res) => {
  const { name, contact_person, email, phone, address, city, country } = req.body;
  if (!name) throw new AppError('Supplier name is required', 400);

  const result = await pool.query(
    `INSERT INTO suppliers (name, contact_person, email, phone, address, city, country)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name.trim(), contact_person, email, phone, address, city, country]
  );

  res.status(201).json({ success: true, message: 'Supplier created', data: { supplier: result.rows[0] } });
});

// @route PUT /api/suppliers/:id
const updateSupplier = asyncHandler(async (req, res) => {
  const { name, contact_person, email, phone, address, city, country, is_active } = req.body;

  const existing = await pool.query('SELECT id FROM suppliers WHERE id = $1', [req.params.id]);
  if (!existing.rows.length) throw new AppError('Supplier not found', 404);

  const result = await pool.query(
    `UPDATE suppliers SET
      name=COALESCE($1,name), contact_person=COALESCE($2,contact_person),
      email=COALESCE($3,email), phone=COALESCE($4,phone),
      address=COALESCE($5,address), city=COALESCE($6,city),
      country=COALESCE($7,country), is_active=COALESCE($8,is_active)
     WHERE id=$9 RETURNING *`,
    [name, contact_person, email, phone, address, city, country, is_active, req.params.id]
  );

  res.json({ success: true, message: 'Supplier updated', data: { supplier: result.rows[0] } });
});

// @route DELETE /api/suppliers/:id
const deleteSupplier = asyncHandler(async (req, res) => {
  await pool.query('UPDATE suppliers SET is_active = FALSE WHERE id = $1', [req.params.id]);
  res.json({ success: true, message: 'Supplier deleted' });
});

module.exports = { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier };
