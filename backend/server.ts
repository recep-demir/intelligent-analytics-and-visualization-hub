import './patch'; // 🛡️ DİKKAT: BU SATIR KESİNLİKLE EN ÜSTTE OLMALI!

import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { sequelize, Product } from './models';
import { generateSchema } from 'graphql-gene';
import { pluginSequelize } from '@graphql-gene/plugin-sequelize';

async function startGraphQLServer(): Promise<void> {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established via Sequelize.');

    const { typeDefs, resolvers } = generateSchema({
      plugins: [pluginSequelize()],
      types: { Product }, 
    });

    const server = new ApolloServer({
      typeDefs,
      resolvers,
    });

    const { url } = await startStandaloneServer(server, {
      listen: { port: 4000 },
    });

    console.log(`🚀 GraphQL Server ready at: ${url}`);
  } catch (error) {
    console.error('🔴 Failed to start GraphQL server:', error);
    process.exit(1);
  }
}

startGraphQLServer();