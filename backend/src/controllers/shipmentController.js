const { pool, withTransaction } = require('../config/db');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

// @route GET /api/shipments
const getShipments = asyncHandler(async (req, res) => {
  const { type, status, search, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (type) { params.push(type); conditions.push(`s.type = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`s.status = $${params.length}`); }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(s.shipment_number ILIKE $${params.length} OR s.contact_name ILIKE $${params.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const dataQuery = `
    SELECT s.*,
      w.name AS warehouse_name,
      sup.name AS supplier_name,
      u.name AS created_by_name,
      COUNT(si.id) AS item_count
    FROM shipments s
    LEFT JOIN warehouses w ON s.warehouse_id = w.id
    LEFT JOIN suppliers sup ON s.supplier_id = sup.id
    LEFT JOIN users u ON s.created_by = u.id
    LEFT JOIN shipment_items si ON si.shipment_id = s.id
    ${where}
    GROUP BY s.id, w.name, sup.name, u.name
    ORDER BY s.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  const countQuery = `SELECT COUNT(*) FROM shipments s ${where}`;

  const [data, total] = await Promise.all([
    pool.query(dataQuery, [...params, limit, offset]),
    pool.query(countQuery, params)
  ]);

  res.json({
    success: true,
    data: {
      shipments: data.rows,
      pagination: { total: parseInt(total.rows[0].count), page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total.rows[0].count / limit) }
    }
  });
});

// @route GET /api/shipments/:id
const getShipment = asyncHandler(async (req, res) => {
  const shipment = await pool.query(`
    SELECT s.*, w.name AS warehouse_name, sup.name AS supplier_name, u.name AS created_by_name
    FROM shipments s
    LEFT JOIN warehouses w ON s.warehouse_id = w.id
    LEFT JOIN suppliers sup ON s.supplier_id = sup.id
    LEFT JOIN users u ON s.created_by = u.id
    WHERE s.id = $1
  `, [req.params.id]);

  if (!shipment.rows.length) throw new AppError('Shipment not found', 404);

  const items = await pool.query(`
    SELECT si.*, p.name AS product_name, p.sku
    FROM shipment_items si
    JOIN products p ON si.product_id = p.id
    WHERE si.shipment_id = $1
  `, [req.params.id]);

  res.json({ success: true, data: { shipment: shipment.rows[0], items: items.rows } });
});

// Generate unique shipment number
const generateShipmentNumber = async (client) => {
  const year = new Date().getFullYear();
  const result = await client.query(
    "SELECT COUNT(*) FROM shipments WHERE shipment_number LIKE $1",
    [`SHP-${year}-%`]
  );
  const seq = (parseInt(result.rows[0].count) + 1).toString().padStart(4, '0');
  return `SHP-${year}-${seq}`;
};

// @route POST /api/shipments
const createShipment = asyncHandler(async (req, res) => {
  const {
    type, warehouse_id, supplier_id, contact_name, contact_phone,
    origin_address, destination_address, expected_date, notes, items = []
  } = req.body;

  if (!type || !warehouse_id) throw new AppError('Type and warehouse are required', 400);
  if (!['incoming', 'outgoing'].includes(type)) throw new AppError('Type must be incoming or outgoing', 400);

  const result = await withTransaction(async (client) => {
    const shipmentNumber = await generateShipmentNumber(client);

    // Calculate total value from items
    let totalValue = 0;
    for (const item of items) {
      totalValue += item.quantity * item.unit_price;
    }

    const shipment = await client.query(
      `INSERT INTO shipments (shipment_number, type, warehouse_id, supplier_id, contact_name, contact_phone, origin_address, destination_address, expected_date, notes, total_value, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [shipmentNumber, type, warehouse_id, supplier_id || null, contact_name, contact_phone, origin_address, destination_address, expected_date || null, notes, totalValue, req.user.id]
    );

    // Insert shipment items
    for (const item of items) {
      await client.query(
        'INSERT INTO shipment_items (shipment_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)',
        [shipment.rows[0].id, item.product_id, item.quantity, item.unit_price]
      );
    }

    return shipment.rows[0];
  });

  res.status(201).json({ success: true, message: 'Shipment created', data: { shipment: result } });
});

// @route PUT /api/shipments/:id/status
const updateStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'in_transit', 'delivered', 'cancelled'];

  if (!validStatuses.includes(status)) throw new AppError('Invalid status', 400);

  const shipmentRes = await pool.query('SELECT * FROM shipments WHERE id = $1', [req.params.id]);
  if (!shipmentRes.rows.length) throw new AppError('Shipment not found', 404);
  const shipment = shipmentRes.rows[0];

  const result = await withTransaction(async (client) => {
    const updated = await client.query(
      'UPDATE shipments SET status=$1, actual_date=CASE WHEN $1=$2 THEN NOW() ELSE actual_date END WHERE id=$3 RETURNING *',
      [status, 'delivered', req.params.id]
    );

    // On delivery of incoming shipment, auto stock-in
    if (status === 'delivered' && shipment.type === 'incoming' && shipment.status !== 'delivered') {
      const items = await client.query('SELECT * FROM shipment_items WHERE shipment_id = $1', [req.params.id]);
      for (const item of items.rows) {
        const prod = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [item.product_id]);
        if (prod.rows.length) {
          const newQty = prod.rows[0].quantity + item.quantity;
          await client.query('UPDATE products SET quantity = $1 WHERE id = $2', [newQty, item.product_id]);
          await client.query(
            `INSERT INTO inventory_logs (product_id, warehouse_id, transaction_type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes, performed_by)
             VALUES ($1,$2,'stock_in',$3,$4,$5,'shipment',$6,$7,$8)`,
            [item.product_id, shipment.warehouse_id, item.quantity, prod.rows[0].quantity, newQty, req.params.id, `Auto stock-in from shipment ${shipment.shipment_number}`, req.user.id]
          );
        }
      }
    }

    return updated.rows[0];
  });

  res.json({ success: true, message: 'Shipment status updated', data: { shipment: result } });
});

// @route PUT /api/shipments/:id
const updateShipment = asyncHandler(async (req, res) => {
  const { contact_name, contact_phone, origin_address, destination_address, expected_date, notes, supplier_id } = req.body;

  const result = await pool.query(
    `UPDATE shipments SET
      contact_name=COALESCE($1,contact_name), contact_phone=COALESCE($2,contact_phone),
      origin_address=COALESCE($3,origin_address), destination_address=COALESCE($4,destination_address),
      expected_date=COALESCE($5,expected_date), notes=COALESCE($6,notes), supplier_id=COALESCE($7,supplier_id)
     WHERE id=$8 RETURNING *`,
    [contact_name, contact_phone, origin_address, destination_address, expected_date, notes, supplier_id, req.params.id]
  );

  if (!result.rows.length) throw new AppError('Shipment not found', 404);
  res.json({ success: true, message: 'Shipment updated', data: { shipment: result.rows[0] } });
});

module.exports = { getShipments, getShipment, createShipment, updateStatus, updateShipment };
