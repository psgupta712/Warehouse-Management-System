// One-time setup route — runs migrations + seed on production DB
// Protected by a secret key so only you can run it
const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

router.get('/migrate', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Forbidden — wrong secret' });
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS categories (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS warehouses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(150) NOT NULL,
        location VARCHAR(255) NOT NULL,
        capacity INTEGER NOT NULL CHECK (capacity > 0),
        used_capacity INTEGER DEFAULT 0,
        manager_name VARCHAR(100),
        phone VARCHAR(20),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS suppliers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(150) NOT NULL,
        contact_person VARCHAR(100),
        email VARCHAR(150),
        phone VARCHAR(20),
        address TEXT,
        city VARCHAR(100),
        country VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        sku VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
        warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL DEFAULT 0,
        min_stock_level INTEGER DEFAULT 10,
        unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        unit VARCHAR(30) DEFAULT 'units',
        weight DECIMAL(10,2),
        image_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shipments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        shipment_number VARCHAR(50) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL CHECK (type IN ('incoming', 'outgoing')),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'cancelled')),
        warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
        supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
        contact_name VARCHAR(100),
        contact_phone VARCHAR(20),
        origin_address TEXT,
        destination_address TEXT,
        expected_date DATE,
        actual_date DATE,
        notes TEXT,
        total_value DECIMAL(14,2) DEFAULT 0,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shipment_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS inventory_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
        transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('stock_in', 'stock_out', 'adjustment', 'transfer')),
        quantity INTEGER NOT NULL,
        quantity_before INTEGER NOT NULL,
        quantity_after INTEGER NOT NULL,
        reference_type VARCHAR(30),
        reference_id UUID,
        notes TEXT,
        performed_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
      CREATE INDEX IF NOT EXISTS idx_products_warehouse ON products(warehouse_id);
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id);
      CREATE INDEX IF NOT EXISTS idx_inventory_logs_created ON inventory_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);

      CREATE OR REPLACE FUNCTION update_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
      $$ language 'plpgsql';

      DO $$ BEGIN
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TRIGGER update_warehouses_updated_at BEFORE UPDATE ON warehouses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    res.json({ success: true, message: '✅ Migration complete — all tables created!' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

router.get('/seed', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== process.env.SETUP_SECRET) {
    return res.status(403).json({ error: 'Forbidden — wrong secret' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear in dependency order
    await client.query('DELETE FROM inventory_logs');
    await client.query('DELETE FROM shipment_items');
    await client.query('DELETE FROM shipments');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM categories');
    await client.query('DELETE FROM suppliers');
    await client.query('DELETE FROM warehouses');
    await client.query('DELETE FROM users');

    const hp = await bcrypt.hash('password123', 10);
    await client.query(`
      INSERT INTO users (name, email, password, role) VALUES
        ('Rajesh Kumar',  'admin@wareflow.in',  $1, 'admin'),
        ('Priya Sharma',  'priya@wareflow.in',  $1, 'staff'),
        ('Amit Patel',    'amit@wareflow.in',   $1, 'admin'),
        ('Sunita Verma',  'sunita@wareflow.in', $1, 'staff'),
        ('Vikram Singh',  'vikram@wareflow.in', $1, 'staff')
    `, [hp]);

    await client.query(`
      INSERT INTO categories (name, description) VALUES
        ('Electronics',          'Mobile phones, laptops, accessories'),
        ('Textiles & Clothing',  'Fabrics, sarees, garments, uniforms'),
        ('FMCG & Grocery',       'Packaged food, beverages, household goods'),
        ('Pharmaceuticals',      'Medicines, health supplements'),
        ('Automobile Parts',     'Two-wheeler and four-wheeler spare parts'),
        ('Agricultural Goods',   'Seeds, fertilizers, irrigation equipment'),
        ('Furniture & Fixtures', 'Office furniture, wooden items'),
        ('Industrial Tools',     'Power tools, hand tools, safety equipment')
    `);

    await client.query(`
      INSERT INTO warehouses (name, location, capacity, used_capacity, manager_name, phone) VALUES
        ('Mumbai Central Hub',       'Bhiwandi, Thane, Maharashtra 421302',           15000, 10200, 'Suresh Nair',   '+91-98201-11001'),
        ('Delhi NCR Distribution',   'Kundli Industrial Area, Sonipat, Haryana',      12000,  7800, 'Deepak Sharma', '+91-98101-22002'),
        ('Bengaluru Tech Warehouse', 'Peenya Industrial Area, Bengaluru, Karnataka',  10000,  6500, 'Kavitha Rao',   '+91-98441-33003'),
        ('Chennai South Depot',      'Ambattur Industrial Estate, Chennai, TN',        8000,  4100, 'Murugan S',     '+91-98401-44004'),
        ('Kolkata East Hub',         'Dankuni Industrial Complex, Hooghly, WB',        7000,  3200, 'Sandip Das',    '+91-98301-55005'),
        ('Ahmedabad Gujarat Depot',  'Vatva GIDC, Ahmedabad, Gujarat 382445',          9000,  5600, 'Kiran Mehta',   '+91-98251-66006')
    `);

    await client.query(`
      INSERT INTO suppliers (name, contact_person, email, phone, city, country) VALUES
        ('Tata Electronics Pvt Ltd',     'Ratan Joshi',     'ratan@tataelectronics.in', '+91-22-4001-1001', 'Mumbai',    'India'),
        ('Reliance Retail Suppliers',    'Asha Ambani',     'asha@reliancesupply.in',   '+91-22-4002-2002', 'Navi Mumbai','India'),
        ('Arvind Mills Ltd',             'Sanjay Lalbhai',  'sanjay@arvindmills.in',    '+91-79-3001-3001', 'Ahmedabad', 'India'),
        ('Sun Pharma Distributors',      'Dilip Shanghvi',  'dilip@sunpharma.in',       '+91-22-4003-4003', 'Mumbai',    'India'),
        ('Bajaj Auto Parts',             'Rajiv Bajaj',     'rajiv@bajajauto.in',       '+91-20-6601-5005', 'Pune',      'India'),
        ('ITC Agro Division',            'Yogesh Deveshwar','yogesh@itcagro.in',        '+91-33-2288-6006', 'Kolkata',   'India'),
        ('Godrej Interio Suppliers',     'Adi Godrej',      'adi@godrejinterio.in',     '+91-22-6796-7007', 'Mumbai',    'India'),
        ('Stanley Black & Decker India', 'Pramod Kumar',    'pramod@stanleybd.in',      '+91-44-4201-8008', 'Chennai',   'India')
    `);

    const cats = await client.query('SELECT id, name FROM categories');
    const whs  = await client.query('SELECT id FROM warehouses ORDER BY name');
    const sups = await client.query('SELECT id FROM suppliers ORDER BY name');
    const adm  = await client.query("SELECT id FROM users WHERE email='admin@wareflow.in'");

    const cat = {}; cats.rows.forEach(r => { cat[r.name] = r.id; });
    const w = whs.rows.map(r => r.id);
    const s = sups.rows.map(r => r.id);
    const uid = adm.rows[0].id;

    const prods = [
      ['SKU-ELEC-001','Samsung Galaxy M34 5G','6.5" Super AMOLED, 6000mAh','Electronics',7,5,85,15,18999,'units'],
      ['SKU-ELEC-002','Redmi Note 13 Pro 5G','200MP camera, 67W HyperCharge','Electronics',7,2,120,20,26999,'units'],
      ['SKU-ELEC-003','boAt Rockerz 450 Headphones','Wireless Bluetooth, 15hr playtime','Electronics',7,5,6,10,1299,'units'],
      ['SKU-ELEC-004','HP Laptop 15s Core i5','15.6" FHD, 16GB RAM, 512GB SSD','Electronics',7,1,42,10,62990,'units'],
      ['SKU-ELEC-005','Zebronics 24" FHD Monitor','HDMI+VGA, 75Hz, flicker-free','Electronics',4,2,55,8,9499,'units'],
      ['SKU-TEXT-001','Cotton Formal Shirt Pack 5','Mens formal shirts, assorted colours','Textiles & Clothing',0,0,350,50,1499,'packs'],
      ['SKU-TEXT-002','Kanjivaram Pure Silk Saree','Handwoven, zari border, 6.3 metres','Textiles & Clothing',0,3,180,20,8500,'units'],
      ['SKU-TEXT-003','School Uniform Fabric 10m','White poly-cotton blend, anti-wrinkle','Textiles & Clothing',0,4,500,80,850,'rolls'],
      ['SKU-FMCG-001','Amul Butter 500g Case 24','Pasteurised table butter, cold chain','FMCG & Grocery',4,5,8,30,6240,'cases'],
      ['SKU-FMCG-002','Tata Salt 1kg Box 50','Iodised vacuum evaporated salt','FMCG & Grocery',4,1,420,60,2250,'boxes'],
      ['SKU-FMCG-003','Surf Excel Matic 3kg','Front load detergent powder','FMCG & Grocery',4,5,680,100,780,'units'],
      ['SKU-FMCG-004','Aashirvaad Whole Wheat Atta 10kg','MP chakki atta, fortified','FMCG & Grocery',1,0,320,50,460,'bags'],
      ['SKU-PHRM-001','Dolo 650mg Paracetamol Strip','10 tablets per strip, fever relief','Pharmaceuticals',6,5,2500,300,30,'strips'],
      ['SKU-PHRM-002','Volini Pain Relief Spray 100g','Topical analgesic, fast action','Pharmaceuticals',6,2,7,50,210,'units'],
      ['SKU-PHRM-003','N95 Respirator Mask Box 50','IS 9473 certified, melt-blown','Pharmaceuticals',6,1,430,100,650,'boxes'],
      ['SKU-AUTO-001','Bajaj Pulsar Engine Oil 1L','SAE 20W50 mineral engine oil','Automobile Parts',3,0,860,100,320,'litres'],
      ['SKU-AUTO-002','Maruti Swift Brake Pad Set','Front axle, ceramic compound','Automobile Parts',3,1,290,40,950,'sets'],
      ['SKU-AUTO-003','Amaron Pro Bike Battery 9Ah','Maintenance-free VRLA battery','Automobile Parts',3,2,145,20,1850,'units'],
      ['SKU-AGRI-001','Mahyco Hybrid Tomato Seeds 10g','High yield, disease resistant','Agricultural Goods',5,4,3200,500,125,'packets'],
      ['SKU-AGRI-002','IFFCO DAP Fertilizer 50kg','Di-ammonium phosphate, granular','Agricultural Goods',5,4,680,80,1350,'bags'],
      ['SKU-AGRI-003','Kirloskar 1HP Water Pump','Self-priming centrifugal, 230V','Agricultural Goods',5,0,55,10,7500,'units'],
      ['SKU-FURN-001','Godrej Interio Ergonomic Chair','Mesh back, lumbar support','Furniture & Fixtures',2,5,65,8,8999,'units'],
      ['SKU-FURN-002','Sheesham Solid Wood Study Table','4x2 ft, 2 drawers, natural finish','Furniture & Fixtures',2,1,38,5,12500,'units'],
      ['SKU-FURN-003','Steel 3-Door Almirah','Powder coated, central locking','Furniture & Fixtures',2,3,4,5,9800,'units'],
      ['SKU-TOOL-001','Stanley 20V Cordless Drill Kit','Brushless, 2 batteries, case','Industrial Tools',7,1,95,12,5499,'units'],
      ['SKU-TOOL-002','Taparia 12pc Spanner Set','CrV steel, 8mm to 32mm','Industrial Tools',7,3,8,15,1850,'sets'],
      ['SKU-TOOL-003','Karam Safety Helmet IS:2925','HDPE shell, 6-point suspension','Industrial Tools',7,4,640,80,395,'units'],
      ['SKU-TOOL-004','Bosch GWS 600 Angle Grinder','670W, 11000 RPM, spindle lock','Industrial Tools',7,2,48,8,2890,'units'],
    ];

    for (const p of prods) {
      await client.query(
        `INSERT INTO products (sku,name,description,category_id,supplier_id,warehouse_id,quantity,min_stock_level,unit_price,unit)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (sku) DO NOTHING`,
        [p[0], p[1], p[2], cat[p[3]], s[p[4]], w[p[5]], p[6], p[7], p[8], p[9]]
      );
    }

    const allP = await client.query('SELECT id, quantity, warehouse_id FROM products');
    for (const p of allP.rows) {
      await client.query(
        `INSERT INTO inventory_logs (product_id,warehouse_id,transaction_type,quantity,quantity_before,quantity_after,notes,performed_by)
         VALUES ($1,$2,'stock_in',$3,0,$3,'Initial stock entry',$4)`,
        [p.id, p.warehouse_id, p.quantity, uid]
      );
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      message: '✅ Seed complete!',
      credentials: {
        admin: 'admin@wareflow.in / password123',
        staff: 'priya@wareflow.in / password123'
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
