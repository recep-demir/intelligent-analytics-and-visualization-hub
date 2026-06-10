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
import { normalize } from "./src/ai/normalizer";
import { build } from "./src/sql/queryBuilder";
import { dashboardTypeDefs, dashboardResolvers } from "./src/graphql/dashboard";

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
      : null;

    const adapter = engine ? new AIAdapter(engine) : null;
    const engineName = engine ? "Gemini" : "Local";
    console.log(`🧠 AI Engine: ${engineName}`);

    const app = express();
    app.use(cors());
    app.use(express.json());

    app.post("/api/ai/query", async (req, res) => {
      try {
        const rawQuestion = req.body?.question ?? req.body?.nl;

        if (typeof rawQuestion !== "string" || rawQuestion.trim().length === 0) {
          return res.status(400).json({ error: "Missing question in request body" });
        }

        const question = rawQuestion.trim();
        console.log(`🤖 Incoming AI Query: "${question}"`);

        // Step 1 — AI resolution (Gemini primary, LocalEngine fallback inside adapter)
        const schemaSdl = print(typeDefs);
        const aiResult = adapter
          ? await Promise.race([
              adapter.resolve({ nl: question }, schemaSdl),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("Timeout")), 5000),
              ),
            ])
          : await (async () => {
              const config = await new LocalEngine().resolve(question, schemaSdl);
              return { chartConfig: config, fromCache: false };
            })();

        console.log(
          `✅ Resolved: chartType=${aiResult.chartConfig.chartType} groupBy=${aiResult.chartConfig.groupBy}`,
        );

        // Step 2 — Normalize: ChartConfig → ResolvedQuery
        const resolved = normalize(aiResult.chartConfig, question);

        // Step 3 — Reject unrecognized queries
        if (resolved.groupBy === "none") {
          return res.status(200).json({
            chartConfig: { chartType: "bar", filters: [], groupBy: "province", dataset: "Orders" },
            fromCache: false,
            data: [],
            message: "I don't have information about that. Try asking about revenue, taxes, products, categories, or provinces.",
          });
        }

        // Step 4 — Build SQL from ResolvedQuery
        const { sql, replacements } = build(resolved);

        // Step 5 — Execute
        let data: any[] = [];
        try {
          const [rows] = await sequelize.query(sql, { replacements });
          data = rows as any[];
        } catch (dbError) {
          console.error("⚠️ SQL error:", dbError);
        }

        return res.status(200).json({
          chartConfig: {
            chartType:   resolved.chartType,
            groupBy:     resolved.groupBy,
            filters:     resolved.filters,
            dataset:     "Orders",
            aggregation: resolved.aggregation,
          },
          fromCache: aiResult.fromCache,
          data,
        });
      } catch (error) {
        console.error("🔴 AI Error:", error);
        return res.status(500).json({ error: "An error occurred while processing the AI request" });
      }
    });

    app.use("/graphql", expressMiddleware(server));

    const PORT = 4000;
    app.listen(PORT, () => {
      console.log(`🚀 GraphQL Server ready at: http://localhost:${PORT}/graphql`);
      console.log(`🧠 AI Query Route ready at: http://localhost:${PORT}/api/ai/query (POST)`);
    });
  } catch (error) {
    console.error("🔴 Failed to start server:", error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
