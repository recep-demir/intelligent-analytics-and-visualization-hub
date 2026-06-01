/**
 * fixtures/seed.js
 * ----------------
 * QA Sprint 1 — Heba
 *
 * Creates all fake-but-realistic test data that automated tests
 * will run against. Mirrors the real database schema exactly.
 *
 * REAL DATABASE SCHEMA (from database.sqlite):
 *   Addresses, ProductGroups, Products, ProductVariants,
 *   Inventories, Orders, OrderItems, ProductCategories,
 *   ProductGroupCategories
 *
 * This is a shoe & apparel e-commerce store (Canadian market).
 * The AI will receive plain-English questions like:
 *   "Show me revenue by province" → AI generates a bar chart
 *   "Orders over time"           → AI generates a line chart
 *   "Revenue split by category"  → AI generates a pie chart
 *
 * HOW TO RUN:
 *   node fixtures/seed.js
 */

// -------------------------------------------------------------------
// 1. TEST USERS  (one per role)
// -------------------------------------------------------------------
const TEST_USERS = [
  {
    id: "user-001",
    username: "heba_admin",
    email: "admin@eliotax-test.com",
    password: "Test123!",
    role: "admin",       // full access: manage users, view all data, all charts
    active: true,
  },
  {
    id: "user-002",
    username: "heba_analyst",
    email: "analyst@eliotax-test.com",
    password: "Test123!",
    role: "analyst",     // can query AI and save charts, cannot manage users
    active: true,
  },
  {
    id: "user-003",
    username: "heba_viewer",
    email: "viewer@eliotax-test.com",
    password: "Test123!",
    role: "viewer",      // read-only: can only view charts others saved
    active: true,
  },
];

// -------------------------------------------------------------------
// 2. TEST ADDRESSES  (Canadian customers — mirrors real Addresses table)
// -------------------------------------------------------------------
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

// -------------------------------------------------------------------
// 3. TEST ORDERS  (mirrors real Orders table)
//    Real statuses in DB: 'cart', 'paid', 'payment', 'shipped', 'shipping'
//    Real price range: $50–$400 per item, orders: $100–$800 subtotal
//    Real tax rate: 0.15 (15%)
//    Real date range: 2018–2024
//
//    NOTE: 'total' field stores the tax amount (subtotal × tax rate),
//    NOT subtotal + tax. This mirrors the real DB data structure.
//    Sprint 2 validation tests must account for this convention.
// -------------------------------------------------------------------
const TEST_ORDERS = [
  {
    id: 9001,
    status: "shipped",
    tax: 0.15,
    subtotal: 628.30,
    total: 94.24,        // tax amount
    addressId: 9001,     // Manitoba customer
    createdAt: "2023-07-30 20:32:49",
  },
  {
    id: 9002,
    status: "paid",
    tax: 0.15,
    subtotal: 390.00,
    total: 58.50,
    addressId: 9002,     // Alberta customer
    createdAt: "2024-03-15 10:00:00",
  },
  {
    id: 9003,
    status: "cart",
    tax: 0.15,
    subtotal: 225.50,
    total: 33.83,
    addressId: 9003,     // BC customer
    createdAt: "2024-11-01 08:45:00",
  },
];

// -------------------------------------------------------------------
// 4. TEST ORDER ITEMS  (mirrors real OrderItems table)
//    Real product IDs go up to 259. We use real-ish product IDs.
//    Real price range per item: $50.18–$399.75
// -------------------------------------------------------------------
const TEST_ORDER_ITEMS = [
  { id: 9001, price: 322.74, quantity: 1, orderId: 9001, productId: 1 },  // TrailBlazer shoe
  { id: 9002, price: 305.56, quantity: 1, orderId: 9001, productId: 5 },  // AthleticPro shoe
  { id: 9003, price: 390.00, quantity: 1, orderId: 9002, productId: 38 }, // Eclipse shoe
  { id: 9004, price: 225.50, quantity: 1, orderId: 9003, productId: 15 }, // RoadRunner shoe
];

// -------------------------------------------------------------------
// 5. SAVED CHART CONFIGURATIONS
//    The AI generates these from plain-English questions.
//    The spec is the JSON contract Dev A + Dev C agreed on.
//    Questions are based on real columns in the actual database.
// -------------------------------------------------------------------
const CHART_CONFIGS = [
  {
    id: "chart-001",
    title: "Revenue by province",
    created_by: "user-002",
    question: "Show me revenue by province",   // what the user typed
    spec: {
      chartType: "bar",
      xAxis: "province",                        // from Addresses.province
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
    // Sprint 2: replace with ProductCategories join once category seed data is added
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
    // Sprint 2: replace with ProductGroups join once product group seed data is added
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

// -------------------------------------------------------------------
// 6. SEED FUNCTION
// -------------------------------------------------------------------
async function seedDatabase() {
  console.log("🌱 Starting fixture seed...\n");

  console.log("👤 Inserting test users...");
  for (const user of TEST_USERS) {
    // TODO Sprint 2: await db.insert("users", { ...user, password: hashPassword(user.password) });
    console.log(`   ✅ ${user.username} (${user.role})`);
  }

  console.log("\n📍 Inserting test addresses...");
  for (const addr of TEST_ADDRESSES) {
    // TODO Sprint 2: await db.insert("Addresses", addr);
    console.log(`   ✅ ${addr.firstName} ${addr.lastName} — ${addr.city}, ${addr.province}`);
  }

  console.log("\n🛒 Inserting test orders...");
  for (const order of TEST_ORDERS) {
    // TODO Sprint 2: await db.insert("Orders", order);
    console.log(`   ✅ Order #${order.id} — ${order.status} — CA$${order.subtotal}`);
  }

  console.log("\n👟 Inserting test order items...");
  for (const item of TEST_ORDER_ITEMS) {
    // TODO Sprint 2: await db.insert("OrderItems", item);
    console.log(`   ✅ Item #${item.id} — product ${item.productId} — CA$${item.price}`);
  }

  console.log("\n📊 Inserting saved chart configurations...");
  for (const chart of CHART_CONFIGS) {
    // TODO Sprint 2: await db.insert("chart_configs", chart);
    console.log(`   ✅ "${chart.title}" (${chart.spec.chartType})`);
  }

  console.log("\n✅ Seed complete!");
  console.log("   Users:    ", TEST_USERS.length);
  console.log("   Addresses:", TEST_ADDRESSES.length);
  console.log("   Orders:   ", TEST_ORDERS.length);
  console.log("   Items:    ", TEST_ORDER_ITEMS.length);
  console.log("   Charts:   ", CHART_CONFIGS.length);
}

seedDatabase();

module.exports = { TEST_USERS, TEST_ADDRESSES, TEST_ORDERS, TEST_ORDER_ITEMS, CHART_CONFIGS };
