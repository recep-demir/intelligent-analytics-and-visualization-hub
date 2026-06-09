/**
 * fixtures/verify.js
 * ------------------
 * QA Sprint 1 — Heba
 *
 * Checks all fixtures are valid before Sprint 2 tests run.
 * Run AFTER seed.js.
 *
 * HOW TO RUN:
 *   node fixtures/verify.js
 */

const { TEST_USERS, TEST_ADDRESSES, TEST_ORDERS, TEST_ORDER_ITEMS, CHART_CONFIGS } = require("./seed");

let passed = 0;
let failed = 0;

function check(description, condition, helpText = "") {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${description}`);
    if (helpText) console.log(`     → ${helpText}`);
    failed++;
  }
}

// -------------------------------------------------------------------
// VERIFY: Users
// -------------------------------------------------------------------
console.log("\n👤 Verifying test users...");
const roles = TEST_USERS.map((u) => u.role);
check("Exactly 3 test users", TEST_USERS.length === 3);
check("One admin user", roles.filter((r) => r === "admin").length === 1);
check("One analyst user", roles.filter((r) => r === "analyst").length === 1);
check("One viewer user", roles.filter((r) => r === "viewer").length === 1);
for (const u of TEST_USERS) {
  check(`"${u.username}" has valid email`, !!u.email && u.email.includes("@"));
  check(`"${u.username}" has password`, !!u.password && u.password.length >= 6);
  check(`"${u.username}" is active`, u.active === true);
}

// -------------------------------------------------------------------
// VERIFY: Addresses
// -------------------------------------------------------------------
console.log("\n📍 Verifying test addresses...");
check("At least 3 addresses", TEST_ADDRESSES.length >= 3);
const provinces = [...new Set(TEST_ADDRESSES.map((a) => a.province))];
check("Addresses span at least 2 provinces", provinces.length >= 2, `Got: ${provinces.join(", ")}`);
for (const a of TEST_ADDRESSES) {
  check(`Address ${a.id} has province`, !!a.province);
  check(`Address ${a.id} country is 'ca'`, a.country === "ca", "All test addresses must be Canadian (country: 'ca')");
}

// -------------------------------------------------------------------
// VERIFY: Orders
// -------------------------------------------------------------------
console.log("\n🛒 Verifying test orders...");
const validStatuses = ["cart", "paid", "payment", "shipped", "shipping"];
check("At least 3 test orders", TEST_ORDERS.length >= 3);
for (const o of TEST_ORDERS) {
  check(
    `Order #${o.id} has valid status`,
    validStatuses.includes(o.status),
    `Status must be one of: ${validStatuses.join(", ")}`
  );
  check(`Order #${o.id} subtotal > 0`, typeof o.subtotal === "number" && o.subtotal > 0);
  check(`Order #${o.id} tax is 0.15`, o.tax === 0.15, "Real DB always uses 0.15 (15%) tax");
  check(`Order #${o.id} links to an address`, !!TEST_ADDRESSES.find((a) => a.id === o.addressId),
    `No test address found with id ${o.addressId}`);
}

// -------------------------------------------------------------------
// VERIFY: Order Items
// -------------------------------------------------------------------
console.log("\n👟 Verifying test order items...");
check("At least 4 order items", TEST_ORDER_ITEMS.length >= 4);
for (const item of TEST_ORDER_ITEMS) {
  check(
    `Item #${item.id} price in real range ($50–$400)`,
    item.price >= 50 && item.price <= 400,
    "Real DB price range is $50.18–$399.75"
  );
  check(`Item #${item.id} quantity > 0`, item.quantity > 0);
  check(
    `Item #${item.id} links to a test order`,
    !!TEST_ORDERS.find((o) => o.id === item.orderId),
    `No test order found with id ${item.orderId}`
  );
  check(
    `Item #${item.id} productId in real range (1–259)`,
    item.productId >= 1 && item.productId <= 259,
    "Real DB has 259 products"
  );
}

// -------------------------------------------------------------------
// VERIFY: Chart configurations
// -------------------------------------------------------------------
console.log("\n📊 Verifying saved chart configurations...");
const chartTypes = CHART_CONFIGS.map((c) => c.spec.chartType);
check("At least 5 chart configs", CHART_CONFIGS.length >= 5);
check("At least one bar chart", chartTypes.includes("bar"));
check("At least one line chart", chartTypes.includes("line"));
check("At least one pie chart", chartTypes.includes("pie"));

for (const chart of CHART_CONFIGS) {
  check(`Chart "${chart.id}" has a question`, !!chart.question && chart.question.length > 5);
  check(`Chart "${chart.id}" has a share UUID`, !!chart.share_uuid);
  check(
    `Chart "${chart.id}" spec has chartType + xAxis + yAxis`,
    !!chart.spec.chartType && !!chart.spec.xAxis && !!chart.spec.yAxis
  );
  check(
    `Chart "${chart.id}" uses real DB columns`,
    chart.spec.xAxis.includes("province") ||
    chart.spec.xAxis.includes("Orders") ||
    chart.spec.xAxis.includes("ProductCategories") ||
    chart.spec.xAxis.includes("ProductGroups") ||
    chart.spec.xAxis.includes("status"),
    "xAxis must reference real DB table columns"
  );
}

// -------------------------------------------------------------------
// SUMMARY
// -------------------------------------------------------------------
console.log("\n" + "─".repeat(50));
console.log(`📋 Verification complete`);
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);

if (failed === 0) {
  console.log("\n🎉 All fixtures valid. Sprint 1 QA is DONE — database ready for Sprint 2.\n");
} else {
  console.log(`\n⚠️  Fix the ${failed} issue(s) in fixtures/seed.js, then re-run.\n`);
  process.exit(1);
}
