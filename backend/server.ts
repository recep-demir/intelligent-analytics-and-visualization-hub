import "dotenv/config";
import "./patch";
import express from "express";
import cors from "cors";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";
import { sequelize, Product } from "./models";
import { generateSchema } from "graphql-gene";
import { print } from "graphql";

import { AIAdapter } from "./src/ai/adapter";
import { GeminiEngine } from "./src/ai/engines/gemini";
import { LocalEngine } from "./src/ai/engines/local";

export async function createApolloServer() {
  await sequelize.authenticate();
  console.log("✅ Database connection established via Sequelize.");

  await sequelize.query("PRAGMA foreign_keys = OFF;");
  await sequelize.sync();
  await sequelize.query("PRAGMA foreign_keys = ON;");
  console.log("✅ Database schemas synchronized.");

  const { pluginSequelize } = await import("@graphql-gene/plugin-sequelize");

  const { typeDefs, resolvers } = generateSchema({
    plugins: [pluginSequelize()],
    types: { Product },
  });

  const server = new ApolloServer({
    typeDefs,
    resolvers,
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

    const adapter = new AIAdapter(engine);

    const app = express();
    app.use(cors());
    app.use(express.json());

    app.post("/api/ai/query", async (req, res) => {
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

        const schemaSdl = print(typeDefs);

        const aiResult = (await adapter.resolve(
          { nl: question },
          schemaSdl,
        )) as any;
        console.log("🧠 Generated AI Metadata & Query:", aiResult);

        const chartConfig = aiResult?.chartConfig ?? {};
        const filters: any[] = chartConfig.filters ?? [];
        const groupBy: string = (chartConfig.groupBy ?? "").toLowerCase();
        const lowerQuestion = question.toLowerCase();

        // Extract year from filters or question
        const yearFilter = filters.find((f: any) =>
          f.field?.toLowerCase().includes("year") ||
          f.field?.toLowerCase().includes("createdat")
        );
        const yearFromQuestion = question.match(/\b(20\d{2})\b/)?.[1];
        const targetYear: string | null = yearFilter?.value
          ? String(yearFilter.value).trim()
          : yearFromQuestion ?? null;

        let finalDataPayload: any[] = [];

        // Revenue by year — line / trend questions
        if (
          groupBy.includes("year") ||
          lowerQuestion.includes("trend") ||
          lowerQuestion.includes("over time") ||
          lowerQuestion.includes("over the years") ||
          lowerQuestion.includes("years")
        ) {
          let sql = `SELECT strftime('%Y', createdAt) as year, ROUND(SUM(subtotal), 2) as value FROM Orders`;
          if (targetYear) sql += ` WHERE strftime('%Y', createdAt) = '${targetYear}'`;
          sql += ` GROUP BY year ORDER BY year`;
          const [rows] = await sequelize.query(sql);
          finalDataPayload = rows as any[];
          console.log(`📊 Revenue by year (${finalDataPayload.length} rows)`);

        // Orders by status — breakdown / pie questions
        } else if (
          lowerQuestion.includes("status") ||
          lowerQuestion.includes("breakdown") ||
          lowerQuestion.includes("distribution")
        ) {
          const [rows] = await sequelize.query(
            `SELECT status as province,
                    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM Orders), 1) as value
             FROM Orders GROUP BY status ORDER BY value DESC`
          );
          finalDataPayload = rows as any[];
          console.log(`📊 Orders by status (${finalDataPayload.length} rows)`);

        // Revenue by product group
        } else if (
          lowerQuestion.includes("product group") ||
          lowerQuestion.includes("product groups") ||
          groupBy.includes("group")
        ) {
          const [rows] = await sequelize.query(
            `SELECT pg.name as label, ROUND(SUM(oi.price * oi.quantity), 2) as value
             FROM OrderItems oi
             JOIN Products p ON oi.productId = p.id
             JOIN ProductGroups pg ON p.groupId = pg.id
             GROUP BY pg.name ORDER BY value DESC LIMIT 10`
          );
          finalDataPayload = rows as any[];
          console.log(`📊 Revenue by product group (${finalDataPayload.length} rows)`);

        // Revenue by province — default bar chart
        } else {
          let sql = `SELECT a.province, ROUND(SUM(o.subtotal), 2) as value
                     FROM Orders o JOIN Addresses a ON o.addressId = a.id`;
          if (targetYear) sql += ` WHERE strftime('%Y', o.createdAt) = '${targetYear}'`;
          sql += ` GROUP BY a.province ORDER BY value DESC LIMIT 10`;
          const [rows] = await sequelize.query(sql);
          finalDataPayload = rows as any[];
          console.log(`📊 Revenue by province (${finalDataPayload.length} rows)`);
        }

        return res.status(200).json({
          chartConfig: aiResult?.chartConfig ?? {
            chartType: chartConfig.chartType ?? "bar",
            filters,
          },
          fromCache: aiResult?.fromCache ?? false,
          data: finalDataPayload,
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
    });
  } catch (error) {
    console.error("🔴 Failed to start server:", error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
