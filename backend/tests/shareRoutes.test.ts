import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { sequelize, SharedState, User } from "../models";
import { shareRouter } from "../src/share/shareRoutes";
import type { UserRole } from "../src/auth/types";

const TEST_SECRET = "test-secret-for-share-routes";

function createToken(role: UserRole, userId: number): string {
  return jwt.sign(
    {
      userId,
      email: `${role}.${userId}@example.com`,
      role,
    },
    TEST_SECRET,
    { expiresIn: "1h" },
  );
}

function createApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/share", shareRouter);
  return app;
}

async function createUser(role: UserRole, email: string) {
  return User.create({
    email,
    passwordHash: "hashed-password",
    role,
  });
}

describe("share routes", () => {
  const app = createApp();

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await SharedState.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterAll(async () => {
    delete process.env.JWT_SECRET;
  });

  it("returns 401 when creating share state without JWT", async () => {
    const response = await request(app)
      .post("/api/share")
      .send({
        state: {
          chartType: "bar",
        },
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Unauthorized",
      message: "Authentication required",
    });
  });

  it("returns 403 when viewer tries to create share state", async () => {
    const viewer = await createUser("viewer", "viewer@example.com");
    const token = createToken("viewer", viewer.id);

    const response = await request(app)
      .post("/api/share")
      .set("Authorization", `Bearer ${token}`)
      .send({
        state: {
          chartType: "bar",
        },
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Forbidden",
      message: "Admin or Analyst role required",
    });
  });

  it("allows analyst to create a secure share state", async () => {
    const analyst = await createUser("analyst", "analyst@example.com");
    const token = createToken("analyst", analyst.id);

    const response = await request(app)
      .post("/api/share")
      .set("Authorization", `Bearer ${token}`)
      .send({
        state: {
          chartType: "bar",
          groupBy: "province",
          filters: {
            year: 2023,
          },
          layout: {
            view: "dashboard",
          },
        },
      });

    expect(response.status).toBe(201);
    expect(response.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const savedState = await SharedState.findByPk(response.body.id);

    expect(savedState).not.toBeNull();
    expect(savedState?.createdByUserId).toBe(analyst.id);
  });

  it("rejects share state containing raw analytical data", async () => {
    const analyst = await createUser("analyst", "analyst@example.com");
    const token = createToken("analyst", analyst.id);

    const response = await request(app)
      .post("/api/share")
      .set("Authorization", `Bearer ${token}`)
      .send({
        state: {
          chartType: "bar",
          data: [
            {
              province: "Ontario",
              revenue: 1000,
            },
          ],
        },
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Bad Request",
      message: "Share state must not contain raw analytical data or metrics",
    });
  });

  it("allows viewer to fetch a shared state without raw data", async () => {
    const analyst = await createUser("analyst", "analyst@example.com");
    const viewer = await createUser("viewer", "viewer@example.com");
    const token = createToken("viewer", viewer.id);

    const sharedState = await SharedState.create({
      uuid: "550e8400-e29b-41d4-a716-446655440000",
      stateJson: JSON.stringify({
        chartType: "line",
        groupBy: "month",
        filters: {
          year: 2024,
        },
      }),
      createdByUserId: analyst.id,
    });

    const response = await request(app)
      .get(`/api/share/${sharedState.uuid}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: sharedState.uuid,
      state: {
        chartType: "line",
        groupBy: "month",
        filters: {
          year: 2024,
        },
      },
    });

    expect(response.body.state.data).toBeUndefined();
    expect(response.body.state.metrics).toBeUndefined();
  });

  it("returns 404 when shared state does not exist", async () => {
    const viewer = await createUser("viewer", "viewer@example.com");
    const token = createToken("viewer", viewer.id);

    const response = await request(app)
      .get("/api/share/550e8400-e29b-41d4-a716-446655440000")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "Not Found",
      message: "Shared state not found",
    });
  });

  it("returns 400 for invalid share id format", async () => {
    const viewer = await createUser("viewer", "viewer@example.com");
    const token = createToken("viewer", viewer.id);

    const response = await request(app)
      .get("/api/share/not-a-valid-uuid")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Bad Request",
      message: "Valid share id is required",
    });
  });
});