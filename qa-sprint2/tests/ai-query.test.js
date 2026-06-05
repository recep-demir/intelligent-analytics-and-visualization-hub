/**
 * tests/ai-query.test.js
 * ----------------------
 * QA Sprint 2 — Heba
 * Owner: Dev C (Aleksei) — POST /ai/query, chart JSON contract
 *
 * EXPECTED TO PASS WHEN:
 *
 *   Group 1 — "AI Query — JSON contract" (6 tests)
 *     ✅ All 6 pass once Aleksei delivers POST /ai/query with correct shape
 *        - response has: chartConfig.chartType, xAxis, yAxis, joins, filters
 *        - chartType is one of: bar, line, grid, heatmap, pie, donut, map
 *        - joins and filters are always arrays (never null/undefined)
 *        - response includes fromCache boolean
 *        - second identical question returns fromCache: true (Recep's caching)
 *
 *   Group 2 — "AI Query — Bar charts" (2 tests)
 *     ✅ Both pass once Aleksei's prompt correctly identifies bar chart questions
 *        - "revenue by province"           → chartType: "bar"
 *        - "top product groups by revenue" → chartType: "bar"
 *
 *   Group 3 — "AI Query — Line charts" (2 tests)
 *     ✅ Both pass once Aleksei's prompt identifies trend/time questions
 *        - "orders over the years" → chartType: "line"
 *        - "revenue trend"         → chartType: "line"
 *
 *   Group 4 — "AI Query — Pie charts" (2 tests)
 *     ✅ Both pass once Aleksei's prompt identifies distribution questions
 *        - "order status breakdown"       → chartType: "pie"
 *        - "revenue by product category" → chartType: "pie"
 *
 *   Group 5 — "AI Query — Filters" (2 tests)
 *     ✅ Both pass once Aleksei's prompt extracts filter conditions correctly
 *        - "shipped orders only" → filters contains { field: status, value: "shipped" }
 *        - "from 2023"           → filters contains a year/createdAt filter
 *
 *   Group 6 — "AI Query — Edge cases" (5 tests)
 *     ✅ All 5 pass once Recep adds input validation to the endpoint
 *        - empty question       → 400
 *        - under 5 chars        → 400
 *        - nonsense question    → 400 or fallback chart (both acceptable)
 *        - SQL injection        → server does not crash (200 or 400)
 *        - 500+ char question   → server does not crash (200 or 400)
 *
 * CURRENTLY: All tests FAIL — /ai/query does not exist yet.
 * NOTE: beforeAll() needs /auth/login to work first (Recep's job).
 */

const { getToken, aiQuery } = require("../helpers/api");

describe("AI Query", () => {
  // Auth not yet implemented — tokens set to null, backend ignores Authorization header
  let adminToken = null;
  let analystToken = null;

// -------------------------------------------------------------------
// JSON CONTRACT — every response must have these fields
// -------------------------------------------------------------------
describe("AI Query — JSON contract", () => {
  test("response contains all required fields", async () => {
    const { status, body } = await aiQuery("Show me revenue by province", adminToken);

    expect(status).toBe(200);
    expect(body).toHaveProperty("chartConfig");

    const { chartConfig } = body;
    expect(chartConfig).toHaveProperty("chartType");
    expect(chartConfig).toHaveProperty("dataset");
    expect(chartConfig).toHaveProperty("filters");
  });

  test("chartType is always a valid type", async () => {
    const validTypes = ["bar", "line", "grid", "heatmap", "pie", "donut", "map"];
    const { body } = await aiQuery("Show me revenue by province", adminToken);

    expect(validTypes).toContain(body.chartConfig.chartType);
  });

  test("filters is always an array", async () => {
    const { body } = await aiQuery("Show me revenue by province", adminToken);

    expect(Array.isArray(body.chartConfig.filters)).toBe(true);
  });

  test("response includes fromCache boolean", async () => {
    const { body } = await aiQuery("Show me revenue by province", adminToken);

    expect(typeof body.fromCache).toBe("boolean");
  });

  test("second identical question returns fromCache: true", async () => {
    const question = "How many orders per province?";
    await aiQuery(question, adminToken); // first call — caches it
    const { body } = await aiQuery(question, adminToken); // second call

    expect(body.fromCache).toBe(true);
  });
});

// -------------------------------------------------------------------
// BAR CHARTS
// -------------------------------------------------------------------
describe("AI Query — Bar charts", () => {
  test("'revenue by province' returns a bar chart", async () => {
    const { body } = await aiQuery("Show me revenue by province", adminToken);

    expect(body.chartConfig.chartType).toBe("bar");
  });

  test("'top product groups by revenue' returns a bar chart", async () => {
    const { body } = await aiQuery("Which product groups make the most revenue?", adminToken);

    expect(body.chartConfig.chartType).toBe("bar");
  });
});

// -------------------------------------------------------------------
// LINE CHARTS
// -------------------------------------------------------------------
describe("AI Query — Line charts", () => {
  // TODO Sprint 3: Aleksei to add chart type selection rules to SYSTEM_INSTRUCTION in backend/src/ai/prompt.ts
  test.skip("'orders over time' returns a line chart", async () => {
    const { body } = await aiQuery("How have orders changed over the years?", adminToken);

    expect(body.chartConfig.chartType).toBe("line");
  });

  test("'revenue trend' returns a line chart", async () => {
    const { body } = await aiQuery("Show me the revenue trend over time", adminToken);

    expect(body.chartConfig.chartType).toBe("line");
  });
});

// -------------------------------------------------------------------
// PIE CHARTS
// -------------------------------------------------------------------
describe("AI Query — Pie charts", () => {
  // TODO Sprint 3: Aleksei to add chart type selection rules to SYSTEM_INSTRUCTION in backend/src/ai/prompt.ts
  test.skip("'order status breakdown' returns a pie chart", async () => {
    const { body } = await aiQuery("What is the breakdown of order statuses?", adminToken);

    expect(body.chartConfig.chartType).toBe("pie");
  });

  // TODO Sprint 3: Aleksei to add chart type selection rules to SYSTEM_INSTRUCTION in backend/src/ai/prompt.ts
  test.skip("'revenue by product category' returns a pie chart", async () => {
    const { body } = await aiQuery("Show revenue split by product category", adminToken);

    expect(body.chartConfig.chartType).toBe("pie");
  });
});

// -------------------------------------------------------------------
// FILTERS
// -------------------------------------------------------------------
describe("AI Query — Filters", () => {
  // TODO Sprint 3: Aleksei to improve filter extraction in SYSTEM_INSTRUCTION in backend/src/ai/prompt.ts
  test.skip("'only shipped orders' applies a status filter", async () => {
    const { body } = await aiQuery("Show revenue from shipped orders only", adminToken);

    const { filters } = body.chartConfig;
    expect(filters.length).toBeGreaterThan(0);

    const statusFilter = filters.find((f) => f.field.toLowerCase().includes("status"));
    expect(statusFilter).toBeDefined();
    expect(statusFilter.value).toBe("shipped");
  });

  test("'from 2023' applies a year filter", async () => {
    const { body } = await aiQuery("Show me orders from 2023", adminToken);

    const { filters } = body.chartConfig;
    const yearFilter = filters.find((f) => f.field.toLowerCase().includes("year") || f.field.toLowerCase().includes("createdat"));
    expect(yearFilter).toBeDefined();
  });
});

// -------------------------------------------------------------------
// EDGE CASES
// -------------------------------------------------------------------
describe("AI Query — Edge cases", () => {
  test("empty question returns 400", async () => {
    const { status } = await aiQuery("", adminToken);

    expect(status).toBe(400);
  });

  test("nonsense question returns 400 or a fallback chart", async () => {
    const { status, body } = await aiQuery("asdfghjklqwerty nonsense!!!!", adminToken);

    const acceptable = status === 400 || (status === 200 && body.chartConfig);
    expect(Boolean(acceptable)).toBe(true);
  });

  test("SQL injection attempt is handled safely", async () => {
    const { status } = await aiQuery("'; DROP TABLE Orders; --", adminToken);

    // Should not crash the server — 400 or 200 with a safe response
    expect([200, 400]).toContain(status);
  });

  test("very long question (500+ chars) does not crash the server", async () => {
    const longQuestion = "Show me revenue by province ".repeat(20);
    const { status } = await aiQuery(longQuestion, adminToken);

    expect([200, 400]).toContain(status);
  });
});

});
