import 'dotenv/config';
import './patch'; 
import express from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { sequelize, Product } from './models';
import { generateSchema } from 'graphql-gene';
import { print } from 'graphql';

import { AIAdapter } from './src/ai/adapter';
import { GeminiEngine } from './src/ai/engines/gemini';
import { LocalEngine } from './src/ai/engines/local';

export async function createApolloServer() {
  await sequelize.authenticate();
  console.log('✅ Database connection established via Sequelize.');
  
  await sequelize.query('PRAGMA foreign_keys = OFF;');
  await sequelize.sync();
  await sequelize.query('PRAGMA foreign_keys = ON;');
  console.log('✅ Database schemas synchronized.');


  const { pluginSequelize } = await import('@graphql-gene/plugin-sequelize');

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

    // AI ADAPTER ROUTE
        app.post('/api/ai/query', async (req, res) => {
  try {
    const rawQuestion = req.body?.question ?? req.body?.nl;

    if (typeof rawQuestion !== 'string' || rawQuestion.trim().length === 0) {
      return res.status(400).json({
        error: 'Missing question in request body',
      });
    }

    const question = rawQuestion.trim();

    console.log(`🤖 Incoming AI Query: "${question}"`);

    const schemaSdl = print(typeDefs);
    const result = await adapter.resolve({ nl: question }, schemaSdl);

    return res.status(200).json(result);
  } catch (error) {
    console.error('🔴 AI Error:', error);

    return res.status(500).json({
      error: 'An error occurred while processing the AI request',
    });
  }
});

    app.use('/graphql', expressMiddleware(server));

    const PORT = 4000;
    app.listen(PORT, () => {
      console.log(`🚀 GraphQL Server ready at: http://localhost:${PORT}/graphql`);
      console.log(`🧠 AI Query Route ready at: http://localhost:${PORT}/api/ai/query (POST)`);
    });

  } catch (error) {
    console.error('🔴 Failed to start server:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}