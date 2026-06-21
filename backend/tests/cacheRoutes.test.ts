import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { requireAdminJWT } from "../src/auth/rbacMiddleware";

const TEST_SECRET = "test-secret-for-cache-routes";

function createToken(role: "admin" | "analyst" | "viewer"): string {
  return jwt.sign(
    {
      userId: 1,
      email: `${role}.user@company.com`,
      role,
    },
    TEST_SECRET,
    { expiresIn: 3600 },
  );
}

function createApp(clearCache: jest.Mock) {
  const app = express();

  app.use(express.json());

  app.delete("/api/cache", requireAdminJWT, (_req, res) => {
    clearCache();

    return res.status(200).json({
      message: "AI query cache cleared",
    });
  });

  return app;
}

describe("cache clear route RBAC (R-2)", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it("allows admin users to clear the cache", async () => {
    const clearCache = jest.fn();
    const app = createApp(clearCache);
    const token = createToken("admin");

    const response = await request(app)
      .delete("/api/cache")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "AI query cache cleared",
    });
    expect(clearCache).toHaveBeenCalledTimes(1);
  });

  it("returns 403 for analyst users and does not clear the cache", async () => {
    const clearCache = jest.fn();
    const app = createApp(clearCache);
    const token = createToken("analyst");

    const response = await request(app)
      .delete("/api/cache")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Forbidden",
      message: "Admin role required",
    });
    expect(clearCache).not.toHaveBeenCalled();
  });

  it("returns 403 for viewer users and does not clear the cache", async () => {
    const clearCache = jest.fn();
    const app = createApp(clearCache);
    const token = createToken("viewer");

    const response = await request(app)
      .delete("/api/cache")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Forbidden",
      message: "Admin role required",
    });
    expect(clearCache).not.toHaveBeenCalled();
  });
});