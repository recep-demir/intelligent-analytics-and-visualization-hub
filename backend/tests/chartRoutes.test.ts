import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import {
  sequelize,
  SavedChart,
  SharedChartLink,
  User,
} from "../models";
import { chartRouter, sharedChartRouter } from "../src/charts/chartRoutes";
import type { UserRole } from "../src/auth/types";

const TEST_SECRET = "test-secret-for-chart-routes";

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
  app.use("/api/charts", chartRouter);
  app.use("/api/shared-charts", sharedChartRouter);
  return app;
}

async function createUser(role: UserRole, email: string) {
  return User.create({
    email,
    passwordHash: "hashed-password",
    role,
  });
}

describe("chart routes", () => {
  const app = createApp();

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    await SharedChartLink.destroy({ where: {} });
    await SavedChart.destroy({ where: {} });
    await User.destroy({ where: {} });
  });

  afterAll(async () => {
    delete process.env.JWT_SECRET;
  });

  it("returns 401 when saving chart without JWT", async () => {
    const response = await request(app).post("/api/charts").send({
      chartConfig: {
        chartType: "bar",
        groupBy: "province",
      },
      data: [],
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: "Unauthorized",
      message: "Authentication required",
    });
  });

  it("returns 403 when viewer tries to save chart", async () => {
    const viewer = await createUser("viewer", "viewer@example.com");
    const token = createToken("viewer", viewer.id);

    const response = await request(app)
      .post("/api/charts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        chartConfig: {
          chartType: "bar",
          groupBy: "province",
        },
        data: [],
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Forbidden",
      message: "Admin or Analyst role required",
    });
  });

  it("allows analyst to save a chart", async () => {
    const analyst = await createUser("analyst", "analyst@example.com");
    const token = createToken("analyst", analyst.id);

    const response = await request(app)
      .post("/api/charts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Revenue by province",
        question: "Show revenue by province",
        chartConfig: {
          chartType: "bar",
          groupBy: "province",
          dataset: "Orders",
        },
        data: [
          {
            name: "Ontario",
            value: 1000,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.chart).toMatchObject({
      title: "Revenue by province",
      question: "Show revenue by province",
      createdByUserId: analyst.id,
    });
    expect(response.body.chart.chartConfig).toMatchObject({
      chartType: "bar",
      groupBy: "province",
      dataset: "Orders",
    });
    expect(response.body.chart.data).toEqual([
      {
        name: "Ontario",
        value: 1000,
      },
    ]);
  });

  it("returns 400 when chartConfig is missing", async () => {
    const analyst = await createUser("analyst", "analyst@example.com");
    const token = createToken("analyst", analyst.id);

    const response = await request(app)
      .post("/api/charts")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Invalid chart",
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "Bad Request",
      message: "chartConfig is required",
    });
  });

  it("lists only analyst's own charts", async () => {
    const analystOne = await createUser("analyst", "analyst.one@example.com");
    const analystTwo = await createUser("analyst", "analyst.two@example.com");

    await SavedChart.create({
      title: "Own chart",
      question: "Own question",
      chartConfigJson: JSON.stringify({ chartType: "bar" }),
      dataJson: JSON.stringify([]),
      createdByUserId: analystOne.id,
    });

    await SavedChart.create({
      title: "Other chart",
      question: "Other question",
      chartConfigJson: JSON.stringify({ chartType: "line" }),
      dataJson: JSON.stringify([]),
      createdByUserId: analystTwo.id,
    });

    const token = createToken("analyst", analystOne.id);

    const response = await request(app)
      .get("/api/charts")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.charts).toHaveLength(1);
    expect(response.body.charts[0]).toMatchObject({
      title: "Own chart",
      createdByUserId: analystOne.id,
    });
  });

  it("allows admin to list all charts", async () => {
    const admin = await createUser("admin", "admin@example.com");
    const analystOne = await createUser("analyst", "analyst.one@example.com");
    const analystTwo = await createUser("analyst", "analyst.two@example.com");

    await SavedChart.create({
      title: "Chart one",
      question: null,
      chartConfigJson: JSON.stringify({ chartType: "bar" }),
      dataJson: JSON.stringify([]),
      createdByUserId: analystOne.id,
    });

    await SavedChart.create({
      title: "Chart two",
      question: null,
      chartConfigJson: JSON.stringify({ chartType: "line" }),
      dataJson: JSON.stringify([]),
      createdByUserId: analystTwo.id,
    });

    const token = createToken("admin", admin.id);

    const response = await request(app)
      .get("/api/charts")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.charts).toHaveLength(2);
  });

  it("allows analyst to create a share link for own chart", async () => {
    const analyst = await createUser("analyst", "analyst@example.com");

    const chart = await SavedChart.create({
      title: "Shareable chart",
      question: null,
      chartConfigJson: JSON.stringify({ chartType: "pie" }),
      dataJson: JSON.stringify([{ name: "Paid", value: 70 }]),
      createdByUserId: analyst.id,
    });

    const token = createToken("analyst", analyst.id);

    const response = await request(app)
      .post(`/api/charts/${chart.id}/share`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(201);
    expect(response.body.share).toMatchObject({
      savedChartId: chart.id,
      createdByUserId: analyst.id,
    });
    expect(response.body.share.shareToken).toBeDefined();
    expect(response.body.share.shareUrl).toContain("/api/shared-charts/");
  });

  it("allows viewer to open a shared chart", async () => {
    const analyst = await createUser("analyst", "analyst@example.com");
    const viewer = await createUser("viewer", "viewer@example.com");

    const chart = await SavedChart.create({
      title: "Shared chart",
      question: "Show status split",
      chartConfigJson: JSON.stringify({ chartType: "pie" }),
      dataJson: JSON.stringify([{ name: "Paid", value: 70 }]),
      createdByUserId: analyst.id,
    });

    const shareLink = await SharedChartLink.create({
      savedChartId: chart.id,
      shareToken: "test-share-token",
      createdByUserId: analyst.id,
    });

    const token = createToken("viewer", viewer.id);

    const response = await request(app)
      .get(`/api/shared-charts/${shareLink.shareToken}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.chart).toMatchObject({
      id: chart.id,
      title: "Shared chart",
      question: "Show status split",
    });
    expect(response.body.share).toMatchObject({
      shareToken: "test-share-token",
    });
  });

    it("returns 403 when viewer tries to create a share link", async () => {
    const analyst = await createUser("analyst", "analyst@example.com");
    const viewer = await createUser("viewer", "viewer@example.com");

    const chart = await SavedChart.create({
      title: "Viewer restricted chart",
      question: "Show revenue by province",
      chartConfigJson: JSON.stringify({ chartType: "bar" }),
      dataJson: JSON.stringify([{ name: "Ontario", value: 1000 }]),
      createdByUserId: analyst.id,
    });

    const token = createToken("viewer", viewer.id);

    const response = await request(app)
      .post(`/api/charts/${chart.id}/share`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: "Forbidden",
      message: "Admin or Analyst role required",
    });
  });

  it("returns 404 when viewer opens a missing shared chart link", async () => {
    const viewer = await createUser("viewer", "viewer@example.com");
    const token = createToken("viewer", viewer.id);

    const response = await request(app)
      .get("/api/shared-charts/missing-share-token")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "Not Found",
      message: "Shared chart not found",
    });
  });
});

