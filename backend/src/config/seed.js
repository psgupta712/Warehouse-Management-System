const { pool } = require('./db');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const seed = async () => {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database with Indian data...');
    await client.query('BEGIN');

    // ── CLEAR EXISTING DATA (dependency order) ─────────────────────────────
    await client.query('DELETE FROM inventory_logs');
    await client.query('DELETE FROM shipment_items');
    await client.query('DELETE FROM shipments');
    await client.query('DELETE FROM products');
    await client.query('DELETE FROM categories');
    await client.query('DELETE FROM suppliers');
    await client.query('DELETE FROM warehouses');
    await client.query('DELETE FROM users');
    console.log('🗑️  Cleared old data');

    // ── USERS ──────────────────────────────────────────────────────────────
    const hp = await bcrypt.hash('password123', 10);
    await client.query(`
      INSERT INTO users (name, email, password, role) VALUES
        ('Rajesh Kumar',   'admin@wareflow.in',   $1, 'admin'),
        ('Priya Sharma',   'priya@wareflow.in',   $1, 'staff'),
        ('Amit Patel',     'amit@wareflow.in',    $1, 'admin'),
        ('Sunita Verma',   'sunita@wareflow.in',  $1, 'staff'),
        ('Vikram Singh',   'vikram@wareflow.in',  $1, 'staff')
    `, [hp]);
    console.log('✅ Users seeded (5)');

    // ── CATEGORIES ────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO categories (name, description) VALUES
        ('Electronics',          'Mobile phones, laptops, accessories, gadgets'),
        ('Textiles & Clothing',  'Fabrics, sarees, garments, uniforms'),
        ('FMCG & Grocery',       'Packaged food, beverages, household FMCG'),
        ('Pharmaceuticals',      'Medicines, health supplements, medical supplies'),
        ('Automobile Parts',     'Two-wheeler and four-wheeler spare parts'),
        ('Agricultural Goods',   'Seeds, fertilizers, irrigation equipment'),
        ('Furniture & Fixtures', 'Office furniture, wooden items, steel almirahs'),
        ('Industrial Tools',     'Power tools, hand tools, safety equipment')
    `);
    console.log('✅ Categories seeded (8)');

    // ── WAREHOUSES ────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO warehouses (name, location, capacity, used_capacity, manager_name, phone) VALUES
        ('Mumbai Central Hub',       'Bhiwandi, Thane District, Maharashtra 421302',         15000, 10200, 'Suresh Nair',     '+91-98201-11001'),
        ('Delhi NCR Distribution',   'Kundli Industrial Area, Sonipat, Haryana 131028',      12000,  7800, 'Deepak Sharma',   '+91-98101-22002'),
        ('Bengaluru Tech Warehouse', 'Peenya Industrial Area, Bengaluru, Karnataka 560058',  10000,  6500, 'Kavitha Rao',     '+91-98441-33003'),
        ('Chennai South Depot',      'Ambattur Industrial Estate, Chennai, Tamil Nadu 600058', 8000, 4100, 'Murugan S',       '+91-98401-44004'),
        ('Kolkata East Hub',         'Dankuni Industrial Complex, Hooghly, West Bengal 712311', 7000, 3200, 'Sandip Das',     '+91-98301-55005'),
        ('Ahmedabad Gujarat Depot',  'Vatva GIDC, Ahmedabad, Gujarat 382445',                 9000,  5600, 'Kiran Mehta',     '+91-98251-66006')
    `);
    console.log('✅ Warehouses seeded (6)');

    // ── SUPPLIERS ─────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO suppliers (name, contact_person, email, phone, address, city, country) VALUES
        ('Tata Electronics Pvt Ltd',      'Ratan Joshi',      'ratan@tataelectronics.in',  '+91-22-4001-1001', 'Nariman Point, BKC',              'Mumbai',     'India'),
        ('Reliance Retail Suppliers',     'Asha Ambani',      'asha@reliancesupply.in',    '+91-22-4002-2002', 'Dhirubhai Ambani Knowledge City', 'Navi Mumbai','India'),
        ('Arvind Mills Ltd',              'Sanjay Lalbhai',   'sanjay@arvindmills.in',     '+91-79-3001-3001', 'Naroda Road, GIDC',               'Ahmedabad',  'India'),
        ('Sun Pharma Distributors',       'Dilip Shanghvi',   'dilip@sunpharma.in',        '+91-22-4003-4003', 'Goregaon East, SEEPZ',            'Mumbai',     'India'),
        ('Bajaj Auto Parts',              'Rajiv Bajaj',      'rajiv@bajajauto.in',        '+91-20-6601-5005', 'Akurdi, Pimpri-Chinchwad',        'Pune',       'India'),
        ('ITC Agro Division',             'Yogesh Deveshwar', 'yogesh@itcagro.in',         '+91-33-2288-6006', 'Virginia House, Chowringhee',     'Kolkata',    'India'),
        ('Godrej Interio Suppliers',      'Adi Godrej',       'adi@godrejinterio.in',      '+91-22-6796-7007', 'Pirojshanagar, Vikhroli',         'Mumbai',     'India'),
        ('Stanley Black & Decker India',  'Pramod Kumar',     'pramod@stanleybd.in',       '+91-44-4201-8008', 'Ambattur Industrial Estate',      'Chennai',    'India')
    `);
    console.log('✅ Suppliers seeded (8)');

    // ── FETCH IDs ─────────────────────────────────────────────────────────
    const cats = await client.query('SELECT id, name FROM categories');
    const whs  = await client.query('SELECT id FROM warehouses ORDER BY name');
    const sups = await client.query('SELECT id FROM suppliers ORDER BY name');
    const adm  = await client.query("SELECT id FROM users WHERE email='admin@wareflow.in'");

    const cat = {};
    cats.rows.forEach(r => { cat[r.name] = r.id; });
    const w   = whs.rows.map(r => r.id);   // 0=Ahmedabad,1=Bengaluru,2=Chennai,3=Delhi,4=Kolkata,5=Mumbai
    const s   = sups.rows.map(r => r.id);  // 0=Arvind,1=Bajaj,2=Godrej,3=ITC,4=Reliance,5=Stanley,6=Sun,7=Tata
    const uid = adm.rows[0].id;

    // ── PRODUCTS ──────────────────────────────────────────────────────────
    // [sku, name, desc, cat_key, sup_idx, wh_idx, qty, min, price_inr, unit]
    const prods = [
      // Electronics
      ['SKU-ELEC-001','Samsung Galaxy M34 5G','6.5" Super AMOLED, 6000mAh battery','Electronics',7,5,85,15,18999,'units'],
      ['SKU-ELEC-002','Redmi Note 13 Pro 5G','200MP camera, 67W HyperCharge','Electronics',7,1,120,20,26999,'units'],
      ['SKU-ELEC-003','boAt Rockerz 450 Headphones','Wireless Bluetooth, 15hr playtime','Electronics',7,5,6,10,1299,'units'],
      ['SKU-ELEC-004','HP Laptop 15s Core i5 12th Gen','15.6" FHD, 16GB RAM, 512GB SSD','Electronics',7,3,42,10,62990,'units'],
      ['SKU-ELEC-005','Zebronics 24" FHD IPS Monitor','HDMI+VGA, 75Hz, flicker-free','Electronics',4,1,55,8,9499,'units'],
      ['SKU-ELEC-006','TP-Link Archer C6 WiFi Router','AC1200 dual band, MU-MIMO','Electronics',4,3,4,8,1599,'units'],

      // Textiles
      ['SKU-TEXT-001','Cotton Formal Shirt (Pack 5)','Men\'s formal shirts, assorted colours, S–XXL','Textiles & Clothing',0,0,350,50,1499,'packs'],
      ['SKU-TEXT-002','Kanjivaram Pure Silk Saree','Handwoven, zari border, 6.3 metres','Textiles & Clothing',0,2,180,20,8500,'units'],
      ['SKU-TEXT-003','Denim Jeans Wholesale (Dozen)','Stretchable denim, sizes 28–40','Textiles & Clothing',0,0,9,15,4800,'dozens'],
      ['SKU-TEXT-004','School Uniform Fabric 10m Roll','White poly-cotton blend, anti-wrinkle','Textiles & Clothing',0,4,500,80,850,'rolls'],

      // FMCG
      ['SKU-FMCG-001','Amul Butter 500g (Case 24)','Pasteurised table butter, cold chain','FMCG & Grocery',4,5,8,30,6240,'cases'],
      ['SKU-FMCG-002','Tata Salt 1kg (Box 50)','Iodised vacuum evaporated salt','FMCG & Grocery',4,3,420,60,2250,'boxes'],
      ['SKU-FMCG-003','Surf Excel Matic 3kg','Front load detergent powder','FMCG & Grocery',4,5,680,100,780,'units'],
      ['SKU-FMCG-004','Maggi Masala Noodles (Carton 48)','70g per pack, 2-minute noodles','FMCG & Grocery',4,3,5,20,1632,'cartons'],
      ['SKU-FMCG-005','Aashirvaad Whole Wheat Atta 10kg','MP chakki atta, fortified','FMCG & Grocery',3,0,320,50,460,'bags'],

      // Pharma
      ['SKU-PHRM-001','Dolo 650mg Paracetamol Strip','10 tablets per strip, fever relief','Pharmaceuticals',6,5,2500,300,30,'strips'],
      ['SKU-PHRM-002','Volini Pain Relief Spray 100g','Topical analgesic, fast action','Pharmaceuticals',6,1,7,50,210,'units'],
      ['SKU-PHRM-003','Shelcal 500 Calcium Tablets','Calcium + Vit D3, 15 tabs/strip','Pharmaceuticals',6,2,1800,200,85,'strips'],
      ['SKU-PHRM-004','N95 Respirator Mask (Box 50)','IS 9473 certified, melt-blown filter','Pharmaceuticals',6,3,430,100,650,'boxes'],

      // Automobile
      ['SKU-AUTO-001','Bajaj Pulsar Engine Oil SAE 20W50 1L','Mineral oil for air-cooled engines','Automobile Parts',1,0,860,100,320,'litres'],
      ['SKU-AUTO-002','MRF Hero Splendor Plus Tyre Set','Front 2.75-18 + Rear 3.00-18','Automobile Parts',1,5,4,10,2800,'sets'],
      ['SKU-AUTO-003','Maruti Swift Disc Brake Pad Set','Front axle, ceramic compound','Automobile Parts',1,3,290,40,950,'sets'],
      ['SKU-AUTO-004','Amaron Pro Bike Rider Battery 9Ah','Maintenance-free VRLA battery','Automobile Parts',1,1,145,20,1850,'units'],

      // Agriculture
      ['SKU-AGRI-001','Mahyco Hybrid Tomato Seeds 10g','High yield, disease resistant variety','Agricultural Goods',3,4,3200,500,125,'packets'],
      ['SKU-AGRI-002','IFFCO DAP Fertilizer 50kg','Di-ammonium phosphate, granular','Agricultural Goods',3,4,680,80,1350,'bags'],
      ['SKU-AGRI-003','Kirloskar 1HP Self-Priming Pump','Cast iron, 25mm outlet, 230V','Agricultural Goods',3,0,55,10,7500,'units'],
      ['SKU-AGRI-004','HDPE Drip Irrigation Kit 1 Acre','16mm lateral, inline emitters','Agricultural Goods',3,4,7,5,12500,'kits'],

      // Furniture
      ['SKU-FURN-001','Godrej Interio Ergonomic Chair','Mesh back, lumbar support, armrests','Furniture & Fixtures',2,5,65,8,8999,'units'],
      ['SKU-FURN-002','Sheesham Solid Wood Study Table','4x2 ft, 2 drawers, natural finish','Furniture & Fixtures',2,3,38,5,12500,'units'],
      ['SKU-FURN-003','Steel 3-Door Almirah','Powder coated, central locking','Furniture & Fixtures',2,2,4,5,9800,'units'],
      ['SKU-FURN-004','PP Stacking Chair Pack of 6','UV stabilised polypropylene, stackable','Furniture & Fixtures',2,1,110,15,3600,'packs'],

      // Industrial Tools
      ['SKU-TOOL-001','Stanley 20V Cordless Drill Kit','Brushless, 2x batteries, carrying case','Industrial Tools',5,3,95,12,5499,'units'],
      ['SKU-TOOL-002','Taparia 12pc Combination Spanner Set','CrV steel, 8mm–32mm, mirror finish','Industrial Tools',5,2,8,15,1850,'sets'],
      ['SKU-TOOL-003','Karam Safety Helmet IS:2925','HDPE shell, 6-point ratchet suspension','Industrial Tools',5,4,640,80,395,'units'],
      ['SKU-TOOL-004','Bosch GWS 600 Angle Grinder 4"','670W, 11000 RPM, spindle lock','Industrial Tools',5,1,48,8,2890,'units'],
      ['SKU-TOOL-005','3M 6200 Half Face Respirator','Reusable, with P100 filters included','Industrial Tools',5,3,3,10,1250,'units']
    ];

    for (const p of prods) {
      await client.query(`
        INSERT INTO products (sku,name,description,category_id,supplier_id,warehouse_id,quantity,min_stock_level,unit_price,unit)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT (sku) DO NOTHING
      `, [p[0], p[1], p[2], cat[p[3]], s[p[4]], w[p[5]], p[6], p[7], p[8], p[9]]);
    }
    console.log('✅ Products seeded (35 products with ₹ INR prices)');

    // ── INVENTORY LOGS ────────────────────────────────────────────────────
    const allP = await client.query('SELECT id, quantity, warehouse_id FROM products');
    for (const p of allP.rows) {
      await client.query(`
        INSERT INTO inventory_logs (product_id,warehouse_id,transaction_type,quantity,quantity_before,quantity_after,notes,performed_by)
        VALUES ($1,$2,'stock_in',$3,0,$3,'प्रारंभिक स्टॉक लोडिंग — Initial warehouse stock entry',$4)
      `, [p.id, p.warehouse_id, p.quantity, uid]);
    }
    // Recent dispatch logs
    const recent = allP.rows.slice(0, 10);
    for (const p of recent) {
      const out = Math.min(Math.floor(Math.random() * 8) + 2, p.quantity);
      const nq  = p.quantity - out;
      await client.query(`
        INSERT INTO inventory_logs (product_id,warehouse_id,transaction_type,quantity,quantity_before,quantity_after,notes,performed_by)
        VALUES ($1,$2,'stock_out',$3,$4,$5,'Retail dispatch — dealer order fulfilment',$6)
      `, [p.id, p.warehouse_id, out, p.quantity, nq, uid]);
      await client.query('UPDATE products SET quantity=$1 WHERE id=$2', [nq, p.id]);
    }
    console.log('✅ Inventory logs seeded');

    // ── SHIPMENTS ─────────────────────────────────────────────────────────
    const shipData = [
      ['SHP-2025-001','incoming','delivered',  5,7,'Rahul Mehta',    '+91-98200-10001','Samsung India, Noida UP 201301',                         'Mumbai Central Hub, Bhiwandi MH',         '2025-04-10','2025-04-11',2389600.00,'Samsung smartphones Q1 bulk order'],
      ['SHP-2025-002','outgoing','in_transit', 3,4,'Deepak Sharma',  '+91-98101-22002','Delhi NCR Distribution, Kundli Haryana',                 'Reliance Fresh, Connaught Place, Delhi',   '2025-05-20',null,        182500.00, 'FMCG monthly replenishment — Delhi stores'],
      ['SHP-2025-003','incoming','pending',    1,0,'Kavitha Rao',    '+91-98441-33003','Arvind Mills, Naroda GIDC, Ahmedabad',                   'Bengaluru Tech Warehouse, Peenya KA',     '2025-05-25',null,        425000.00, 'Summer collection textiles — Bengaluru'],
      ['SHP-2025-004','outgoing','pending',    2,6,'Murugan S',      '+91-98401-44004','Chennai South Depot, Ambattur TN',                       'Apollo Pharmacy, Anna Nagar, Chennai',    '2025-05-22',null,         98750.00, 'Pharma monthly supply — Apollo cluster'],
      ['SHP-2025-005','incoming','in_transit', 4,3,'Sandip Das',     '+91-98301-55005','ITC Agro, Guntur, Andhra Pradesh 522001',                'Kolkata East Hub, Dankuni WB',            '2025-05-21',null,        335000.00, 'Kharif season agri inputs — East India'],
      ['SHP-2025-006','incoming','delivered',  0,1,'Kiran Mehta',    '+91-98251-66006','Bajaj Auto, Waluj, Aurangabad MH 431136',                'Ahmedabad Gujarat Depot, Vatva GIDC',     '2025-04-28','2025-04-30',512000.00, 'Auto spare parts Q2 stock — Gujarat dealers'],
      ['SHP-2025-007','outgoing','delivered',  5,2,'Suresh Nair',    '+91-98201-11001','Mumbai Central Hub, Bhiwandi MH',                        'Godrej Interio Showroom, Navi Mumbai',    '2025-04-15','2025-04-16',178600.00, 'Furniture — warranty replacement units'],
      ['SHP-2025-008','incoming','pending',    3,5,'Deepak Sharma',  '+91-98101-22002','Stanley BD India, Ambattur, Chennai TN',                 'Delhi NCR Distribution, Kundli Haryana',  '2025-05-28',null,        267500.00, 'Industrial tools restocking — North India']
    ];

    for (const sh of shipData) {
      await client.query(`
        INSERT INTO shipments (shipment_number,type,status,warehouse_id,supplier_id,contact_name,contact_phone,origin_address,destination_address,expected_date,actual_date,notes,total_value,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT (shipment_number) DO NOTHING
      `, [sh[0],sh[1],sh[2],w[sh[3]],s[sh[4]],sh[5],sh[6],sh[7],sh[8],sh[9],sh[10]||null,sh[12],sh[11],uid]);
    }
    console.log('✅ Shipments seeded (8)');

    // ── SHIPMENT ITEMS ────────────────────────────────────────────────────
    const ships = await client.query('SELECT id FROM shipments ORDER BY created_at LIMIT 8');
    const plist = await client.query('SELECT id, unit_price FROM products LIMIT 20');

    for (let i = 0; i < ships.rows.length; i++) {
      const sid = ships.rows[i].id;
      const p1  = plist.rows[i * 2];
      const p2  = plist.rows[i * 2 + 1];
      if (p1) await client.query('INSERT INTO shipment_items (shipment_id,product_id,quantity,unit_price) VALUES ($1,$2,$3,$4)', [sid, p1.id, 10, p1.unit_price]);
      if (p2) await client.query('INSERT INTO shipment_items (shipment_id,product_id,quantity,unit_price) VALUES ($1,$2,$3,$4)', [sid, p2.id, 5,  p2.unit_price]);
    }
    console.log('✅ Shipment items seeded');

    await client.query('COMMIT');

    console.log('\n🎉 ══════════════════════════════════════════════════════════');
    console.log('   WareFlow Indian Database Seeded Successfully!');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('\n📋 LOGIN CREDENTIALS:');
    console.log('   🔑 Admin  →  admin@wareflow.in   /  password123');
    console.log('   🔑 Admin  →  amit@wareflow.in    /  password123');
    console.log('   👤 Staff  →  priya@wareflow.in   /  password123');
    console.log('   👤 Staff  →  sunita@wareflow.in  /  password123');
    console.log('   👤 Staff  →  vikram@wareflow.in  /  password123');
    console.log('\n🏭 WAREHOUSES (6):');
    console.log('   Mumbai · Delhi NCR · Bengaluru · Chennai · Kolkata · Ahmedabad');
    console.log('\n🏢 SUPPLIERS (8):');
    console.log('   Tata Electronics · Reliance Retail · Arvind Mills · Sun Pharma');
    console.log('   Bajaj Auto · ITC Agro · Godrej Interio · Stanley Black & Decker');
    console.log('\n📦 PRODUCTS (35) across 8 categories — all prices in ₹ INR:');
    console.log('   Electronics · Textiles · FMCG · Pharma · Auto · Agri · Furniture · Tools');
    console.log('\n🚚 SHIPMENTS (8): Mix of incoming/outgoing, delivered/in-transit/pending');
    console.log('══════════════════════════════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Seeding failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

seed();
