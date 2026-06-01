import './patch'; 

import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { sequelize, Product } from './models';
import { generateSchema } from 'graphql-gene';
import { pluginSequelize } from '@graphql-gene/plugin-sequelize';


export async function createApolloServer() {
  await sequelize.authenticate();
  
  await sequelize.query('PRAGMA foreign_keys = OFF;');
  await sequelize.sync();
  await sequelize.query('PRAGMA foreign_keys = ON;');

  const { typeDefs, resolvers } = generateSchema({
    plugins: [pluginSequelize()],
    types: { Product }, 
  });

  const server = new ApolloServer({
    typeDefs,
    resolvers,
  });

  return server;
}

export async function startGraphQLServer(): Promise<void> {
  try {
    const server = await createApolloServer();
    
    const { url } = await startStandaloneServer(server, {
      listen: { port: 4000 },
    });

    console.log(`✅ Database connection established and schemas synchronized.`);
    console.log(`🚀 GraphQL Server ready at: ${url}`);
  } catch (error) {
    console.error('🔴 Failed to start GraphQL server:', error);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  startGraphQLServer();
}