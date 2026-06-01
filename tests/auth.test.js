/**
 * tests/auth.test.js
 * ------------------
 * QA — Heba
 * Sprint 1: Structure written ✅  |  Sprint 2: Implement test bodies
 *
 * Tests for: POST /auth/login, JWT token validation
 *
 * HOW TO RUN (Sprint 2):
 *   npx jest tests/auth.test.js
 */

const { TEST_USERS } = require("../fixtures/seed");

// The base URL of the backend API (set in .env)
const API_URL = process.env.API_URL || "http://localhost:4000";

// Helper: make a login request
async function login(username, password) {
  // TODO Sprint 2: replace with real fetch/axios call
  // const res = await fetch(`${API_URL}/auth/login`, {
  //   method: "POST",
  //   headers: { "Content-Type": "application/json" },
  //   body: JSON.stringify({ username, password }),
  // });
  // return res;
}

// ─── TEST SUITE ────────────────────────────────────────────────────
describe("Authentication — POST /auth/login", () => {

  // ✅ Happy path: correct credentials
  test("valid credentials return a JWT token", async () => {
    const admin = TEST_USERS.find((u) => u.role === "admin");

    // TODO Sprint 2: uncomment and implement
    // const res = await login(admin.username, admin.password);
    // expect(res.status).toBe(200);
    // const body = await res.json();
    // expect(body.token).toBeDefined();
    // expect(typeof body.token).toBe("string");

    expect(true).toBe(true); // placeholder — remove in Sprint 2
  });

  // ❌ Wrong password
  test("wrong password returns 401", async () => {
    const admin = TEST_USERS.find((u) => u.role === "admin");

    // TODO Sprint 2:
    // const res = await login(admin.username, "WRONG_PASSWORD");
    // expect(res.status).toBe(401);

    expect(true).toBe(true);
  });

  // ❌ Unknown username
  test("unknown username returns 401", async () => {
    // TODO Sprint 2:
    // const res = await login("nobody", "Test123!");
    // expect(res.status).toBe(401);

    expect(true).toBe(true);
  });

  // ❌ Request without JWT
  test("accessing protected route without token returns 403", async () => {
    // TODO Sprint 2:
    // const res = await fetch(`${API_URL}/ai/query`, { method: "POST" });
    // expect(res.status).toBe(403);

    expect(true).toBe(true);
  });

});
