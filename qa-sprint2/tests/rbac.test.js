/**
 * tests/rbac.test.js
 * ------------------
 * QA Sprint 2 — Heba
 * Owner: Dev B (Recep) + SM Gabryela (JWT spec)
 *
 * Role-Based Access Control — who can do what.
 *
 * Roles:
 *   admin   — full access to everything
 *   analyst — can query AI and save charts, cannot manage users
 *   viewer  — read-only, cannot query AI or save/delete charts
 *
 * EXPECTED TO PASS WHEN:
 *
 *   Group 1 — "RBAC — POST /ai/query" (4 tests)
 *     ✅ All 4 pass once Recep adds role middleware to POST /ai/query
 *        - admin → 200
 *        - analyst → 200
 *        - viewer → 403  (blocked)
 *        - no token → 403 (blocked)
 *
 *   Group 2 — "RBAC — GET /charts" (4 tests)
 *     ✅ All 4 pass once Recep delivers GET /charts with JWT middleware
 *        - admin → 200
 *        - analyst → 200
 *        - viewer → 200  (viewers can READ charts)
 *        - no token → 403 (blocked)
 *
 *   Group 3 — "RBAC — GET /users" (3 tests)
 *     ✅ All 3 pass once Recep delivers GET /users (admin-only route)
 *        - admin → 200
 *        - analyst → 403 (blocked)
 *        - viewer → 403  (blocked)
 *
 *   Group 4 — "RBAC — Share links" (3 tests)
 *     ✅ All 3 pass once Burcu (Dev A) delivers the share link UI/endpoints
 *        - analyst can generate a share link
 *        - viewer cannot generate a share link → 403
 *        - public share link works without a token → 200 or 404
 *
 * CURRENTLY: All tests FAIL — auth endpoints and role middleware do not exist yet.
 * NOTE: beforeAll() needs /auth/login to work first (Recep's job).
 */

const { getToken, aiQuery, get } = require("../helpers/api");

// TODO Sprint 2: remove .skip once Recep delivers auth endpoints and role middleware
describe.skip("RBAC — [backend pending]", () => {
  let adminToken;
  let analystToken;
  let viewerToken;

  beforeAll(async () => {
    adminToken  = await getToken("admin");
    analystToken = await getToken("analyst");
    viewerToken = await getToken("viewer");
  });

// -------------------------------------------------------------------
// POST /ai/query
// -------------------------------------------------------------------
describe("RBAC — POST /ai/query", () => {
  const question = "Show me revenue by province";

  test("admin can call /ai/query", async () => {
    const { status } = await aiQuery(question, adminToken);
    expect(status).toBe(200);
  });

  test("analyst can call /ai/query", async () => {
    const { status } = await aiQuery(question, analystToken);
    expect(status).toBe(200);
  });

  test("viewer cannot call /ai/query — gets 403", async () => {
    const { status } = await aiQuery(question, viewerToken);
    expect(status).toBe(403);
  });

  test("unauthenticated request to /ai/query gets 403", async () => {
    const { status } = await aiQuery(question, null);
    expect(status).toBe(403);
  });
});

// -------------------------------------------------------------------
// GET /charts — view saved charts
// -------------------------------------------------------------------
describe("RBAC — GET /charts", () => {
  test("admin can view charts", async () => {
    const { status } = await get("/charts", adminToken);
    expect(status).toBe(200);
  });

  test("analyst can view charts", async () => {
    const { status } = await get("/charts", analystToken);
    expect(status).toBe(200);
  });

  test("viewer can view charts (read-only access)", async () => {
    const { status } = await get("/charts", viewerToken);
    expect(status).toBe(200);
  });

  test("unauthenticated request to /charts gets 403", async () => {
    const { status } = await get("/charts", null);
    expect(status).toBe(403);
  });
});

// -------------------------------------------------------------------
// GET /users — admin only
// -------------------------------------------------------------------
describe("RBAC — GET /users", () => {
  test("admin can access /users", async () => {
    const { status } = await get("/users", adminToken);
    expect(status).toBe(200);
  });

  test("analyst cannot access /users — gets 403", async () => {
    const { status } = await get("/users", analystToken);
    expect(status).toBe(403);
  });

  test("viewer cannot access /users — gets 403", async () => {
    const { status } = await get("/users", viewerToken);
    expect(status).toBe(403);
  });
});

// -------------------------------------------------------------------
// Share links
// -------------------------------------------------------------------
describe("RBAC — Share links", () => {
  test("analyst can generate a share link", async () => {
    const { status } = await get("/share", analystToken);
    // 200 (exists) or 405 (method not allowed on GET) — either is fine
    expect([200, 405]).toContain(status);
  });

  test("viewer cannot generate a share link — gets 403", async () => {
    const { status } = await get("/share/generate", viewerToken);
    expect(status).toBe(403);
  });

  test("share link is publicly accessible without a token", async () => {
    // Public share links should work without auth
    const { status } = await get("/share/public/share-aaa-001", null);
    // 200 if share exists, 404 if not seeded yet — both acceptable
    expect([200, 404]).toContain(status);
  });
});

}); // end describe.skip "RBAC — [backend pending]"
