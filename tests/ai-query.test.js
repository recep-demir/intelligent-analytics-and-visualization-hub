/**
 * tests/ai-query.test.js
 * ----------------------
 * QA — Heba
 * Sprint 1: Structure ready ✅  |  Sprint 2: fill in TODO bodies
 *
 * The AI receives a plain-English question from the user
 * and returns a JSON spec. The frontend (Dev A) uses this
 * spec to render a chart — it does NOT get raw SQL or data rows.
 *
 * AGREED JSON CONTRACT (from PO sign-off):
 * {
 *   chartType: "bar" | "line" | "pie",
 *   xAxis:     string,   // what goes on the X axis / slices
 *   yAxis:     string,   // what is measured
 *   joins:     string[], // which tables to join
 *   filters:   { field, value }[],
 *   limit?:    number
 * }
 *
 * REAL DATABASE TABLES AVAILABLE TO THE AI:
 *   Orders         — id, status, tax, subtotal, total, addressId, createdAt
 *   OrderItems     — id, price, quantity, orderId, productId
 *   Products       — id, name, color, isPublished, groupId
 *   ProductGroups  — id, name
 *   ProductVariants— id, size, productId
 *   Inventories    — id, stock, variantId
 *   Addresses      — id, firstName, lastName, city, province, country, email
 *   ProductCategories       — id, name
 *   ProductGroupCategories  — groupId, categoryId
 */

const { TEST_USERS } = require("../fixtures/seed");

const API_URL = process.env.API_URL || "http://localhost:4000";

async function getToken(role) {
  const user = TEST_USERS.find((u) => u.role === role);
  // TODO Sprint 2:
  // const res = await fetch(`${API_URL}/auth/login`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ username: user.username, password: user.password }),
  // });
  // return (await res.json()).token;
  return "mock-token";
}

async function aiQuery(question, token) {
  // TODO Sprint 2:
  // return fetch(`${API_URL}/ai/query`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  //   body: JSON.stringify({ question }),
  // });
}

// ─── TEST SUITE ────────────────────────────────────────────────────
describe("AI Query — POST /ai/query", () => {

  let analystToken;
  beforeAll(async () => { analystToken = await getToken("analyst"); });

  // ── JSON CONTRACT ──────────────────────────────────────────────

  test("response always contains all required contract fields", async () => {
    // TODO Sprint 2:
    // const res = await aiQuery("show me all orders", analystToken);
    // const body = await res.json();
    // expect(body).toHaveProperty("chartType");
    // expect(body).toHaveProperty("xAxis");
    // expect(body).toHaveProperty("yAxis");
    // expect(body).toHaveProperty("joins");
    // expect(body).toHaveProperty("filters");
    // expect(["bar","line","pie"]).toContain(body.chartType);
    expect(true).toBe(true);
  });

  // ── BAR CHART QUESTIONS ────────────────────────────────────────

  test('"show me revenue by province" → bar chart on province', async () => {
    // TODO Sprint 2:
    // const body = await (await aiQuery("show me revenue by province", analystToken)).json();
    // expect(body.chartType).toBe("bar");
    // expect(body.xAxis).toMatch(/province/i);
    // expect(body.yAxis).toMatch(/subtotal|revenue/i);
    expect(true).toBe(true);
  });

  test('"top product groups by revenue" → bar chart on ProductGroups.name', async () => {
    // TODO Sprint 2:
    // const body = await (await aiQuery("which product groups make the most revenue", analystToken)).json();
    // expect(body.chartType).toBe("bar");
    // expect(body.xAxis).toMatch(/productgroup|group/i);
    expect(true).toBe(true);
  });

  // ── LINE CHART QUESTIONS ───────────────────────────────────────

  test('"orders over time" → line chart grouped by year', async () => {
    // TODO Sprint 2:
    // const body = await (await aiQuery("how have orders changed over the years", analystToken)).json();
    // expect(body.chartType).toBe("line");
    // expect(body.xAxis).toMatch(/year|createdAt/i);
    expect(true).toBe(true);
  });

  // ── PIE CHART QUESTIONS ────────────────────────────────────────

  test('"revenue split by product category" → pie chart', async () => {
    // TODO Sprint 2:
    // const body = await (await aiQuery("show revenue split by product category", analystToken)).json();
    // expect(body.chartType).toBe("pie");
    // expect(body.xAxis).toMatch(/category/i);
    expect(true).toBe(true);
  });

  test('"order status breakdown" → pie chart on Orders.status', async () => {
    // TODO Sprint 2:
    // const body = await (await aiQuery("what is the breakdown of order statuses", analystToken)).json();
    // expect(body.chartType).toBe("pie");
    // expect(body.xAxis).toMatch(/status/i);
    expect(true).toBe(true);
  });

  // ── FILTER QUESTIONS ───────────────────────────────────────────

  test('"only shipped orders" → filters include status=shipped', async () => {
    // TODO Sprint 2:
    // const body = await (await aiQuery("show only shipped orders by province", analystToken)).json();
    // const statusFilter = body.filters.find(f => f.field.match(/status/i));
    // expect(statusFilter).toBeDefined();
    // expect(statusFilter.value).toBe("shipped");
    expect(true).toBe(true);
  });

  // ── EDGE CASES ─────────────────────────────────────────────────

  test("empty question → 400 error, not a crash", async () => {
    // TODO Sprint 2:
    // const res = await aiQuery("", analystToken);
    // expect(res.status).toBe(400);
    // expect((await res.json()).error).toBeDefined();
    expect(true).toBe(true);
  });

  test("nonsense question → graceful error response", async () => {
    // TODO Sprint 2:
    // const res = await aiQuery("purple banana flying saucer", analystToken);
    // expect(res.status).toBe(422); // or 400 — agree with Dev C
    expect(true).toBe(true);
  });

  // ── ROLE ACCESS ────────────────────────────────────────────────

  test("viewer role cannot call /ai/query → 403", async () => {
    // TODO Sprint 2:
    // const viewerToken = await getToken("viewer");
    // const res = await aiQuery("show revenue by province", viewerToken);
    // expect(res.status).toBe(403);
    expect(true).toBe(true);
  });

});
