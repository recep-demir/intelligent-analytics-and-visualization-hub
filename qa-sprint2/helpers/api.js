/**
 * helpers/api.js
 * --------------
 * QA Sprint 2 — Heba
 *
 * Shared helper functions used by all test files.
 * Every test imports from here instead of duplicating fetch logic.
 *
 * EXPECTED TO PASS WHEN:
 *   ✅ login()    — passes once Recep (Dev B) delivers POST /auth/login
 *   ✅ getToken() — passes once login() works (depends on Recep)
 *   ✅ aiQuery()  — passes once Recep delivers POST /ai/query
 *   ✅ get()      — passes once Recep delivers the requested route
 *
 * These helpers have no tests of their own — they just make
 * the HTTP calls so test files stay clean and readable.
 */

const { TEST_USERS } = require("../fixtures/seed");

const API_URL = process.env.API_URL || "http://localhost:4000";

/**
 * POST /auth/login
 * Sends email + password, returns the JWT token string.
 * Throws if the response is not 200.
 */
async function login(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  return { status: res.status, token: data.token, user: data.user, body: data };
}

/**
 * Shortcut: get a valid token for a given role using test users.
 * role: "admin" | "analyst" | "viewer"
 */
async function getToken(role) {
  const user = TEST_USERS.find((u) => u.role === role);
  if (!user) throw new Error(`No test user found for role: ${role}`);
  const { token } = await login(user.email, user.password);
  if (!token) throw new Error(`Login failed for ${role} — is the backend running?`);
  return token;
}

/**
 * POST /ai/query
 * Sends a natural language question with a Bearer token.
 * Returns { status, body } so tests can check both.
 */
async function aiQuery(question, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/ai/query`, {
    method: "POST",
    headers,
    body: JSON.stringify({ nl: question }),
  });

  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  return { status: res.status, body };
}

/**
 * GET request helper with optional auth token.
 */
async function get(path, token) {
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { headers });
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

module.exports = { login, getToken, aiQuery, get, API_URL };
