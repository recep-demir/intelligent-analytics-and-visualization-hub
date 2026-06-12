import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import request from "supertest";
import { sequelize, User } from "../models";
import { authRouter } from "../src/auth/authRoutes";

const TEST_SECRET = "test-secret-for-auth-login-routes";

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", authRouter);
  return app;
}

describe("auth login routes", () => {
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
  });

  it("returns 200 and a JWT for valid credentials", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);

    await User.create({
      email: "analyst.user@example.com",
      passwordHash,
      role: "analyst",
    });

    const response = await request(app).post("/api/auth/login").send({
      username: "analyst.user@example.com",
      password: "password123",
    });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
    expect(response.body.user).toMatchObject({
      email: "analyst.user@example.com",
      role: "analyst",
    });
    expect(response.body.user.passwordHash).toBeUndefined();

    const decoded = jwt.verify(response.body.token, TEST_SECRET) as {
      userId: number;
      email: string;
      role: string;
    };

    expect(decoded.email).toBe("analyst.user@example.com");
    expect(decoded.role).toBe("analyst");
  });

  it("returns 401 for invalid username", async () => {
    const response = await request(app).post("/api/auth/login").send({
      username: "missing.user@example.com",
      password: "password123",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Unauthorized",
      message: "Invalid credentials",
    });
  });

  it("returns 401 for invalid password", async () => {
    const passwordHash = await bcrypt.hash("password123", 10);

    await User.create({
      email: "viewer.user@example.com",
      passwordHash,
      role: "viewer",
    });

    const response = await request(app).post("/api/auth/login").send({
      username: "viewer.user@example.com",
      password: "wrong-password",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Unauthorized",
      message: "Invalid credentials",
    });
  });

  it("returns 400 when username is missing", async () => {
    const response = await request(app).post("/api/auth/login").send({
      password: "password123",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Bad Request",
      message: "Username and password are required",
    });
  });

  it("returns 400 when password is missing", async () => {
    const response = await request(app).post("/api/auth/login").send({
      username: "viewer.user@example.com",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Bad Request",
      message: "Username and password are required",
    });
  });
});