import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { sequelize, User } from "../models";
import { adminUserRouter } from "../src/admin/userRoutes";
import type { UserRole } from "../src/auth/types";

const TEST_SECRET = "test-secret-for-admin-user-routes";

function createToken(role: UserRole, userId = 1): string {
  return jwt.sign(
    {
      userId,
      email: `${role}.user@example.com`,
      role,
    },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/admin/users", adminUserRouter);
  return app;
}

describe("admin user routes", () => {
  const app = createApp();

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await User.destroy({ where: {} });
  });

  afterAll(async () => {
    delete process.env.JWT_SECRET;
    await sequelize.close();
  });

  it("returns 401 when request has no JWT", async () => {
    const response = await request(app).get("/api/admin/users");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Unauthorized",
      message: "Authentication required",
    });
  });

  it("returns 403 when request has analyst JWT", async () => {
    const token = createToken("analyst");

    const response = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Forbidden",
      message: "Admin role required",
    });
  });

  it("allows admin to create a viewer user by default", async () => {
    const token = createToken("admin");

    const response = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "new.user@example.com",
        password: "password123",
      });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      email: "new.user@example.com",
      role: "viewer",
    });
    expect(response.body.user.passwordHash).toBeUndefined();

    const user = await User.findOne({
      where: { email: "new.user@example.com" },
    });

    expect(user).not.toBeNull();
    expect(user?.passwordHash).not.toBe("password123");
  });

  it("allows admin to create an analyst user", async () => {
    const token = createToken("admin");

    const response = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "analyst.user@example.com",
        password: "password123",
        role: "analyst",
      });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      email: "analyst.user@example.com",
      role: "analyst",
    });
  });

  it("rejects admin role assignment during account creation", async () => {
    const token = createToken("admin");

    const response = await request(app)
      .post("/api/admin/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "admin.user@example.com",
        password: "password123",
        role: "admin",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: "Bad Request",
      message: "Role must be analyst or viewer",
    });
  });

  it("allows admin to update another user's role to analyst", async () => {
    const token = createToken("admin", 999);

    const user = await User.create({
      email: "viewer.user@example.com",
      passwordHash: "hashed-password",
      role: "viewer",
    });

    const response = await request(app)
      .patch(`/api/admin/users/${user.id}/role`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        role: "analyst",
      });

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({
      id: user.id,
      email: "viewer.user@example.com",
      role: "analyst",
    });
  });

  it("rejects role update to admin", async () => {
    const token = createToken("admin", 999);

    const user = await User.create({
      email: "viewer.user@example.com",
      passwordHash: "hashed-password",
      role: "viewer",
    });

    const response = await request(app)
      .patch(`/api/admin/users/${user.id}/role`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        role: "admin",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: "Bad Request",
      message: "Role must be analyst or viewer",
    });
  });

  it("prevents admin from changing their own role", async () => {
    const user = await User.create({
      email: "admin.user@example.com",
      passwordHash: "hashed-password",
      role: "admin",
    });

    const token = createToken("admin", user.id);

    const response = await request(app)
      .patch(`/api/admin/users/${user.id}/role`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        role: "viewer",
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: "Bad Request",
      message: "Admin cannot change their own role",
    });
  });
});
