/**
 * tests/auth.test.js
 * ------------------
 * QA Sprint 2 — Heba
 * Owner: Dev B (Recep) — POST /auth/login, JWT, /users
 *
 * These tests will FAIL until Recep's auth endpoints are live.
 * That is expected — the tests define the contract.
 */

const { login, getToken, get } = require("../helpers/api");
const { TEST_USERS } = require("../fixtures/seed");

describe("Auth — POST /auth/login", () => {
  test("admin can log in and receives a JWT token", async () => {
    const { status, token, user } = await login("admin@eliotax-test.com", "Test123!");

    expect(status).toBe(200);
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(10);
    expect(user.role).toBe("admin");
    expect(user.email).toBe("admin@eliotax-test.com");
  });

  test("analyst can log in and receives a JWT token", async () => {
    const { status, token, user } = await login("analyst@eliotax-test.com", "Test123!");

    expect(status).toBe(200);
    expect(typeof token).toBe("string");
    expect(user.role).toBe("analyst");
  });

  test("viewer can log in and receives a JWT token", async () => {
    const { status, token, user } = await login("viewer@eliotax-test.com", "Test123!");

    expect(status).toBe(200);
    expect(typeof token).toBe("string");
    expect(user.role).toBe("viewer");
  });

  test("wrong password returns 401", async () => {
    const { status, body } = await login("admin@eliotax-test.com", "WrongPassword!");

    expect(status).toBe(401);
    expect(body.token).toBeUndefined();
  });

  test("unknown email returns 401", async () => {
    const { status, body } = await login("nobody@fake.com", "Test123!");

    expect(status).toBe(401);
    expect(body.token).toBeUndefined();
  });

  test("missing password returns 400", async () => {
    const { status } = await login("admin@eliotax-test.com", "");

    expect(status).toBe(400);
  });
});

describe("Auth — JWT token payload", () => {
  test("JWT contains correct role for admin", async () => {
    const { token } = await login("admin@eliotax-test.com", "Test123!");

    // Decode the middle part of the JWT (payload)
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());

    expect(payload.role).toBe("admin");
    expect(payload.email).toBe("admin@eliotax-test.com");
    expect(payload.userId).toBeDefined();
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000); // not expired
  });

  test("JWT contains correct role for viewer", async () => {
    const { token } = await login("viewer@eliotax-test.com", "Test123!");

    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());

    expect(payload.role).toBe("viewer");
  });
});

describe("Auth — Protected routes", () => {
  test("request without token to protected route returns 403", async () => {
    const { status } = await get("/charts", null);

    expect(status).toBe(403);
  });

  test("request with fake token returns 401", async () => {
    const { status } = await get("/charts", "fake.token.here");

    expect(status).toBe(401);
  });

  test("request with valid admin token can access protected route", async () => {
    const token = await getToken("admin");
    const { status } = await get("/charts", token);

    expect(status).toBe(200);
  });
});
