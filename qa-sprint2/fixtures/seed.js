/**
 * fixtures/seed.js
 * ----------------
 * QA Sprint 2 — Heba
 *
 * Inserts test fixtures into backend/database.sqlite so the test runner
 * has a real queryable state. Uses INSERT OR REPLACE so the script is
 * safe to run multiple times without duplicating rows.
 *
 * Tables seeded:    Addresses, Orders, OrderItems
 * Tables skipped:   users (pending Recep / Sprint 2), chart_configs (pending Sprint 2)
 *
 * HOW TO RUN:
 *   node fixtures/seed.js
 */

const sqlite3 = require('sqlite3');
const sqlite  = require('sqlite');
const path    = require('path');

const DB_PATH = path.resolve(__dirname, '../../backend/database.sqlite');

// ---------------------------------------------------------------------------
// 1. TEST USERS  (one per role)
//    Skipped — users table is a Sprint 2 backend deliverable (Recep)
// ---------------------------------------------------------------------------
const TEST_USERS = [
  {
    id: "user-001",
    username: "heba_admin",
    email: "admin@eliotax-test.com",
    password: "Test123!",
    role: "admin",
    active: true,
  },
  {
    id: "user-002",
    username: "heba_analyst",
    email: "analyst@eliotax-test.com",
    password: "Test123!",
    role: "analyst",
    active: true,
  },
  {
    id: "user-003",
    username: "heba_viewer",
    email: "viewer@eliotax-test.com",
    password: "Test123!",
    role: "viewer",
    active: true,
  },
];

// ---------------------------------------------------------------------------
// 2. TEST ADDRESSES  (Canadian customers — mirrors real Addresses table)
// ---------------------------------------------------------------------------
const TEST_ADDRESSES = [
  {
    id: 9001,
    firstName: "Test",
    lastName: "Admin",
    address1: "100 Queen St",
    city: "Winnipeg",
    province: "Manitoba",
    postalCode: "R3C 0V8",
    country: "ca",
    email: "test.admin@example.com",
    phone: "+12045550100",
  },
  {
    id: 9002,
    firstName: "Test",
    lastName: "Analyst",
    address1: "200 Jasper Ave",
    city: "Edmonton",
    province: "Alberta",
    postalCode: "T5J 2Z1",
    country: "ca",
    email: "test.analyst@example.com",
    phone: "+17805550200",
  },
  {
    id: 9003,
    firstName: "Test",
    lastName: "Viewer",
    address1: "300 Granville St",
    city: "Vancouver",
    province: "British Columbia",
    postalCode: "V6C 1T2",
    country: "ca",
    email: "test.viewer@example.com",
    phone: "+16045550300",
  },
];

// ---------------------------------------------------------------------------
// 3. TEST ORDERS  (mirrors real Orders table)
// ---------------------------------------------------------------------------
const TEST_ORDERS = [
  {
    id: 9001,
    status: "shipped",
    tax: 0.15,
    subtotal: 628.30,
    total: 94.24,
    addressId: 9001,
    createdAt: "2023-07-30 20:32:49",
  },
  {
    id: 9002,
    status: "paid",
    tax: 0.15,
    subtotal: 390.00,
    total: 58.50,
    addressId: 9002,
    createdAt: "2024-03-15 10:00:00",
  },
  {
    id: 9003,
    status: "cart",
    tax: 0.15,
    subtotal: 225.50,
    total: 33.83,
    addressId: 9003,
    createdAt: "2024-11-01 08:45:00",
  },
];

// ---------------------------------------------------------------------------
// 4. TEST ORDER ITEMS  (mirrors real OrderItems table)
// ---------------------------------------------------------------------------
const TEST_ORDER_ITEMS = [
  { id: 9001, price: 322.74, quantity: 1, orderId: 9001, productId: 1  },
  { id: 9002, price: 305.56, quantity: 1, orderId: 9001, productId: 5  },
  { id: 9003, price: 390.00, quantity: 1, orderId: 9002, productId: 38 },
  { id: 9004, price: 225.50, quantity: 1, orderId: 9003, productId: 15 },
];

// ---------------------------------------------------------------------------
// 5. SAVED CHART CONFIGURATIONS
//    Skipped — chart_configs table is a Sprint 2 backend deliverable
// ---------------------------------------------------------------------------
const CHART_CONFIGS = [
  {
    id: "chart-001",
    title: "Revenue by province",
    created_by: "user-002",
    question: "Show me revenue by province",
    spec: {
      chartType: "bar",
      xAxis: "province",
      yAxis: "SUM(Orders.subtotal)",
      joins: ["Orders → Addresses"],
      filters: [],
    },
    share_uuid: "share-aaa-001",
  },
  {
    id: "chart-002",
    title: "Orders over time (by year)",
    created_by: "user-001",
    question: "How have orders changed over the years?",
    spec: {
      chartType: "line",
      xAxis: "year(Orders.createdAt)",
      yAxis: "COUNT(Orders.id)",
      joins: [],
      filters: [],
    },
    share_uuid: "share-bbb-002",
  },
  {
    id: "chart-003",
    title: "Orders per province",
    created_by: "user-002",
    question: "How many orders came from each province?",
    spec: {
      chartType: "bar",
      xAxis: "Addresses.province",
      yAxis: "COUNT(Orders.id)",
      joins: ["Orders → Addresses"],
      filters: [],
    },
    share_uuid: "share-ccc-003",
  },
  {
    id: "chart-004",
    title: "Average order value by year",
    created_by: "user-002",
    question: "How has the average order value changed over the years?",
    spec: {
      chartType: "line",
      xAxis: "year(Orders.createdAt)",
      yAxis: "AVG(Orders.subtotal)",
      joins: [],
      filters: [],
    },
    share_uuid: "share-ddd-004",
  },
  {
    id: "chart-005",
    title: "Order status breakdown",
    created_by: "user-001",
    question: "What is the breakdown of order statuses?",
    spec: {
      chartType: "pie",
      xAxis: "Orders.status",
      yAxis: "COUNT(Orders.id)",
      joins: [],
      filters: [],
    },
    share_uuid: "share-eee-005",
  },
];

// ---------------------------------------------------------------------------
// 6. SEED FUNCTION
// ---------------------------------------------------------------------------
async function seedDatabase() {
  console.log("🌱 Starting fixture seed...\n");

  const db = await sqlite.open({ filename: DB_PATH, driver: sqlite3.Database });
  const NOW = new Date().toISOString().replace("T", " ").slice(0, 19);

  // Disable FK checks so we can upsert in any order safely
  await db.run("PRAGMA foreign_keys = OFF");

  // --- Users ----------------------------------------------------------------
  console.log("⏭  Skipping users — table pending Sprint 2 (Recep)");

  // --- Addresses ------------------------------------------------------------
  console.log("\n📍 Inserting test addresses...");
  for (const addr of TEST_ADDRESSES) {
    await db.run(
      `INSERT OR REPLACE INTO Addresses
         (id, firstName, lastName, address1, city, province, postalCode, country, email, phone, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [addr.id, addr.firstName, addr.lastName, addr.address1,
       addr.city, addr.province, addr.postalCode, addr.country,
       addr.email, addr.phone, NOW, NOW]
    );
    console.log(`   ✅ Address #${addr.id} — ${addr.city}, ${addr.province}`);
  }

  // --- Orders ---------------------------------------------------------------
  console.log("\n🛒 Inserting test orders...");
  for (const order of TEST_ORDERS) {
    await db.run(
      `INSERT OR REPLACE INTO Orders
         (id, status, tax, subtotal, total, addressId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [order.id, order.status, order.tax, order.subtotal,
       order.total, order.addressId, order.createdAt, order.createdAt]
    );
    console.log(`   ✅ Order #${order.id} — ${order.status} — CA$${order.subtotal}`);
  }

  // --- OrderItems -----------------------------------------------------------
  console.log("\n👟 Inserting test order items...");
  for (const item of TEST_ORDER_ITEMS) {
    await db.run(
      `INSERT OR REPLACE INTO OrderItems
         (id, price, quantity, orderId, productId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [item.id, item.price, item.quantity, item.orderId, item.productId, NOW, NOW]
    );
    console.log(`   ✅ Item #${item.id} — product ${item.productId} — CA$${item.price}`);
  }

  // --- Chart configs --------------------------------------------------------
  console.log("\n⏭  Skipping chart_configs — table pending Sprint 2");

  await db.run("PRAGMA foreign_keys = ON");
  await db.close();

  console.log("\n✅ Seed complete!");
  console.log("   Addresses:", TEST_ADDRESSES.length);
  console.log("   Orders:   ", TEST_ORDERS.length);
  console.log("   Items:    ", TEST_ORDER_ITEMS.length);
}

seedDatabase().catch((err) => {
  console.error("🔴 Seed failed:", err);
  process.exit(1);
});

module.exports = { TEST_USERS, TEST_ADDRESSES, TEST_ORDERS, TEST_ORDER_ITEMS, CHART_CONFIGS };
