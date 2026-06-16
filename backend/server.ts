import "dotenv/config";
import "./patch";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { sequelize, Product } from "./models";
import { generateSchema } from "graphql-gene";
import { print } from "graphql";
import { requireAdminOrAnalystJWT } from "./src/auth/rbacMiddleware";
import { chartRouter, sharedChartRouter } from "./src/charts/chartRoutes";
import { AIAdapter } from "./src/ai/adapter";
import { GeminiEngine } from "./src/ai/engines/gemini";
import { LocalEngine } from "./src/ai/engines/local";
import { normalize } from "./src/ai/normalizer";
import { build, buildCount } from "./src/sql/queryBuilder";
import { generateInsights } from "./src/ai/insights";
import { dashboardTypeDefs, dashboardResolvers } from "./src/graphql/dashboard";
import { authRouter } from "./src/auth/authRoutes";
import { adminUserRouter } from "./src/admin/userRoutes";
import { shareRouter } from "./src/share/shareRoutes";

async function ensureAnalyticsTables() {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS Addresses (
      id INTEGER PRIMARY KEY,
      firstName TEXT,
      lastName TEXT,
      address1 TEXT,
      city TEXT,
      province TEXT,
      postalCode TEXT,
      country TEXT,
      email TEXT,
      phone TEXT,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS Orders (
      id INTEGER PRIMARY KEY,
      status TEXT,
      tax REAL,
      subtotal REAL,
      total REAL,
      addressId INTEGER,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS OrderItems (
      id INTEGER PRIMARY KEY,
      price REAL,
      quantity INTEGER,
      orderId INTEGER,
      productId INTEGER,
      createdAt TEXT,
      updatedAt TEXT
    )
  `);
}

export async function createApolloServer() {
  await sequelize.authenticate();
  console.log("✅ Database connection established via Sequelize.");

  await sequelize.query("PRAGMA foreign_keys = OFF;");
  await sequelize.sync();
  await ensureAnalyticsTables();
  await sequelize.query("PRAGMA foreign_keys = ON;");
  console.log("✅ Database schemas synchronized.");

  const { pluginSequelize } = await import("@graphql-gene/plugin-sequelize");

  const { typeDefs, resolvers } = generateSchema({
    plugins: [pluginSequelize()],
    types: { Product },
  });

  const server = new ApolloServer({
    typeDefs: [typeDefs, dashboardTypeDefs],
    resolvers: [resolvers, dashboardResolvers],
  });

  return { server, typeDefs };
}

export async function startServer(): Promise<void> {
  try {
    const { server, typeDefs } = await createApolloServer();
    await server.start();

    const engine = process.env.GEMINI_API_KEY
      ? new GeminiEngine(process.env.GEMINI_API_KEY)
      : new LocalEngine();

    const primaryEngineName = process.env.GEMINI_API_KEY ? "gemini" : "local" as const
    const adapter = new AIAdapter(engine, primaryEngineName);
    const engineName = process.env.GEMINI_API_KEY ? "Gemini" : "Local";
    console.log(`🧠 AI Engine: ${engineName}`);

    const app = express();

    app.use(cors());
    app.use(express.json());
    app.use("/api/auth", authRouter);
    app.use("/api/admin/users", adminUserRouter);
    app.use("/api/charts", chartRouter);
    app.use("/api/shared-charts", sharedChartRouter);
    app.use("/api/share", shareRouter);
    // Insights are deterministic for the same question — cache them in memory
    const insightsCache = new Map<string, string[]>();

    app.post("/api/ai/query", requireAdminOrAnalystJWT, async (req, res) => {
      try {
        const rawQuestion = req.body?.question ?? req.body?.nl;

        if (
          typeof rawQuestion !== "string" ||
          rawQuestion.trim().length === 0
        ) {
          return res.status(400).json({
            error: "Missing question in request body",
          });
        }

        const question = rawQuestion.trim();
        console.log(`🤖 Incoming AI Query: "${question}"`);

        // Step 1 — AI resolution
        const schemaSdl = print(typeDefs);
        // Timeout + LocalEngine fallback are handled inside AIAdapter.resolveWithFallback
        const aiResult = await adapter.resolve({ nl: question }, schemaSdl);

        console.log(
          `✅ Resolved: chartType=${aiResult.chartConfig.chartType} groupBy=${aiResult.chartConfig.groupBy}`,
        );

        // Step 2 — Reject non-geographic map queries before normalization coerces the groupBy
        const NON_GEO = ["status", "category", "productGroup", "product", "year", "month"];
        const rawGroupBy = aiResult.chartConfig.groupBy as string | undefined;
        if (aiResult.chartConfig.chartType === "map" && rawGroupBy && NON_GEO.includes(rawGroupBy)) {
          const suggestion: Record<string, string> = {
            status:       "show me order status breakdown",
            category:     "show me revenue by product category",
            productGroup: "show me revenue by product group",
            product:      "show me top 10 products by revenue",
            year:         "show me revenue trend over the years",
            month:        "show me monthly revenue for 2023",
          };
          return res.status(200).json({
            chartConfig: { chartType: "bar", filters: [], groupBy: "province", dataset: "Orders" },
            fromCache: false,
            data: [],
            message: `Maps only show geographic (province-level) data — "${rawGroupBy}" can't be plotted on a map. Try: "${suggestion[rawGroupBy] ?? "show me revenue by province"}"`,
          });
        }

        // Step 3 — Normalize chart config into a resolved query
        const resolved = normalize(aiResult.chartConfig, question);

        // Step 4 — Reject unrecognized queries
        if (resolved.groupBy === "none") {
          return res.status(200).json({
            chartConfig: { chartType: "bar", filters: [], groupBy: "province", dataset: "Orders" },
            fromCache: false,
            data: [],
            message: "I don't have information about that. Try asking about revenue, taxes, products, categories, or provinces.",
          });
        }

        // Step 4 — Build SQL from the resolved query
        const { sql, replacements } = build(resolved);
        const { sql: countSql, replacements: countReplacements } = buildCount(resolved);

        // Step 5 — Execute SQL (main query + order count in parallel)
        let data: any[] = [];
        let totalOrders = 0;

        try {
          const [[rows], [countRows]] = await Promise.all([
            sequelize.query(sql, { replacements }),
            sequelize.query(countSql, { replacements: countReplacements }),
          ]);
          data = rows as any[];
          totalOrders = (countRows as any[])[0]?.total ?? 0;
        } catch (dbError) {
          console.error("⚠️ SQL error:", dbError);
        }

        // Step 6 — Generate insights (cached by question + data signature to avoid stale results)
        const insightsCacheKey = `${question}::${totalOrders}::${data.length}`;
        const cachedInsights = insightsCache.get(insightsCacheKey);
        const insights = cachedInsights ?? await generateInsights(
          resolved.chartType,
          data,
          resolved,
          question,
          process.env.GEMINI_API_KEY,
        );
        if (!cachedInsights) insightsCache.set(insightsCacheKey, insights);

        return res.status(200).json({
          chartConfig: {
            chartType: resolved.chartType,
            groupBy: resolved.groupBy,
            groupBy2: resolved.groupBy2,
            filters: resolved.filters,
            dataset: "Orders",
            aggregation: resolved.aggregation,
          },
          fromCache: aiResult.fromCache,
          engine: aiResult.engine,
          data,
          insights,
          totalOrders,
        });
      } catch (error) {
        console.error("🔴 AI Error:", error);

        return res.status(500).json({
          error: "An error occurred while processing the AI request",
        });
      }
    });

    app.use("/graphql", expressMiddleware(server));

    const PORT = 4000;

    app.listen(PORT, () => {
      console.log(
        `🚀 GraphQL Server ready at: http://localhost:${PORT}/graphql`,
      );
      console.log(
        `🧠 AI Query Route ready at: http://localhost:${PORT}/api/ai/query (POST)`,
      );
      console.log(
        `🔐 Auth Login ready at: http://localhost:${PORT}/api/auth/login`,
      );
      console.log(
        `👤 Admin User Management ready at: http://localhost:${PORT}/api/admin/users`,
      );
      console.log(
        `📊 Chart Management ready at: http://localhost:${PORT}/api/charts`,
      );
      console.log(
        `🔗 Shared Chart Links ready at: http://localhost:${PORT}/api/shared-charts`,
      );
      console.log(
        `🔒 Secure Share State ready at: http://localhost:${PORT}/api/share`,
      );
    });
  } catch (error) {
    console.error("🔴 Failed to start server:", error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
