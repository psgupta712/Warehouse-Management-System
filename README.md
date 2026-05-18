# WareFlow — Warehouse Management System

A full-stack, production-ready Warehouse Management System built with **React.js**, **Node.js**, **Express.js**, and **PostgreSQL**.

---

## 📸 Features

| Module | Capabilities |
|--------|-------------|
| **Auth** | JWT login/logout, role-based access (Admin / Staff) |
| **Dashboard** | KPI cards, inventory charts, warehouse utilization, low-stock alerts |
| **Warehouses** | CRUD, capacity tracking, utilization percentage |
| **Products** | CRUD, categories, SKU, search & filter, pagination |
| **Inventory** | Stock In, Stock Out, Adjust, full transaction log |
| **Suppliers** | CRUD, contact info, supplied products view |
| **Shipments** | Create, track status (Pending → In Transit → Delivered), auto stock-in on delivery |
| **Reports** | Inventory movement, stock summary, shipment history, low-stock — CSV export |

---

## 🛠 Tech Stack

- **Frontend:** React 18, Tailwind CSS, Recharts, React Router v6, Axios
- **Backend:** Node.js, Express.js, JWT, bcryptjs
- **Database:** PostgreSQL with UUID primary keys, transactions, indexes

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- PostgreSQL ≥ 14

### 1. Clone & Install

```bash
# Backend
cd backend
npm install
cp .env.example .env   # Fill in your DB credentials & JWT secret

# Frontend
cd ../frontend
npm install
```

### 2. Configure Environment

Edit `backend/.env`:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=warehouse_db
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_super_secret_key
FRONTEND_URL=http://localhost:3000
```

### 3. Set Up Database

```bash
# Create DB in PostgreSQL
psql -U postgres -c "CREATE DATABASE warehouse_db;"

# Run migrations (creates all tables + indexes)
cd backend
npm run db:migrate

# Seed demo data
npm run db:seed
```

### 4. Start the App

```bash
# Terminal 1 — Backend
cd backend
npm run dev       # starts on http://localhost:5000

# Terminal 2 — Frontend
cd frontend
npm start         # starts on http://localhost:3000
```

---

## 🔑 Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@wareflow.in | password123 |
| Staff | vikram@wareflow.in | password123 |

---

## 📁 Project Structure

```
wms/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js              # PostgreSQL pool + transaction helper
│   │   │   ├── migrate.js         # Schema migration script
│   │   │   └── seed.js            # Demo data seeder
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── dashboardController.js
│   │   │   ├── warehouseController.js
│   │   │   ├── productController.js
│   │   │   ├── inventoryController.js
│   │   │   ├── supplierController.js
│   │   │   ├── shipmentController.js
│   │   │   └── reportController.js
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT verify + role authorization
│   │   │   └── errorHandler.js    # Global error handler + AppError class
│   │   ├── routes/
│   │   │   └── index.js           # All API routes
│   │   └── server.js              # Express entry point
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── components/
    │   │   ├── layout/
    │   │   │   ├── Layout.jsx     # App shell with topbar
    │   │   │   └── Sidebar.jsx    # Responsive sidebar nav
    │   │   └── ui/
    │   │       └── index.jsx      # Spinner, Modal, Pagination, StatCard, etc.
    │   ├── context/
    │   │   └── AuthContext.jsx    # Auth state + login/logout
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── Dashboard.jsx
    │   │   ├── Warehouses.jsx
    │   │   ├── Products.jsx
    │   │   ├── Inventory.jsx
    │   │   ├── Suppliers.jsx
    │   │   ├── Shipments.jsx
    │   │   └── Reports.jsx
    │   ├── utils/
    │   │   ├── api.js             # Axios instance + all API calls
    │   │   └── helpers.js         # formatCurrency, exportCSV, badges, etc.
    │   ├── App.jsx                # Router + protected routes
    │   ├── index.js
    │   └── index.css              # Tailwind + custom component classes
    ├── tailwind.config.js
    └── package.json
```

---

## 🗄 Database Schema

```
users           → id, name, email, password, role
categories      → id, name, description
warehouses      → id, name, location, capacity, used_capacity
suppliers       → id, name, contact_person, email, phone, address
products        → id, sku, name, category_id, supplier_id, warehouse_id, quantity, unit_price
shipments       → id, shipment_number, type, status, warehouse_id, supplier_id, total_value
shipment_items  → id, shipment_id, product_id, quantity, unit_price
inventory_logs  → id, product_id, transaction_type, quantity, quantity_before, quantity_after
```

---

## 🔒 SQL Concepts Demonstrated

- **Joins** — Products with category, warehouse, supplier
- **Aggregate functions** — SUM, COUNT, AVG in dashboard queries
- **GROUP BY** — Category breakdown, warehouse utilization
- **Transactions** — Stock in/out with row-level locking (`FOR UPDATE`)
- **Indexing** — On product SKU, category, warehouse, inventory log timestamps
- **Pagination** — LIMIT + OFFSET with total count
- **Filtering** — Dynamic WHERE clauses with parameterized queries

---

## 📡 API Endpoints

```
POST   /api/auth/login
GET    /api/auth/me
POST   /api/auth/register          [admin]

GET    /api/dashboard/stats
GET    /api/dashboard/recent-activity
GET    /api/dashboard/inventory-chart
GET    /api/dashboard/category-breakdown
GET    /api/dashboard/warehouse-utilization
GET    /api/dashboard/low-stock

GET/POST        /api/warehouses
GET/PUT/DELETE  /api/warehouses/:id

GET/POST        /api/products
GET/PUT/DELETE  /api/products/:id
GET/POST        /api/products/categories

GET             /api/inventory/logs
GET             /api/inventory/summary
POST            /api/inventory/stock-in
POST            /api/inventory/stock-out
POST            /api/inventory/adjust

GET/POST        /api/suppliers
GET/PUT/DELETE  /api/suppliers/:id

GET/POST        /api/shipments
GET/PUT         /api/shipments/:id
PUT             /api/shipments/:id/status

GET  /api/reports/inventory-movement
GET  /api/reports/stock-summary
GET  /api/reports/shipment-history
GET  /api/reports/low-stock
```

---

## 🎨 UI Design

- Dark theme with **slate + amber** accent palette
- **DM Sans** (body) + **Space Grotesk** (headings)
- Fully **responsive** — mobile sidebar drawer, stacked cards
- Toast notifications via `react-hot-toast`
- Interactive charts via `recharts`
- Custom Tailwind component classes (`.card`, `.btn-primary`, `.badge`, `.table`, etc.)

---

## 📄 License

MIT — free to use for portfolio, interviews, and learning.
