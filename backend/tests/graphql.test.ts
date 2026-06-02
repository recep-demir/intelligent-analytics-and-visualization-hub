import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { ApolloServer } from '@apollo/server';
import { createApolloServer } from '../server'; 
import { sequelize, Product } from '../models'; 
import assert from 'assert';

describe('GraphQL API Tests (US-08)', () => {
  let server: ApolloServer;

  beforeAll(async () => {
    await sequelize.sync({ force: true }); 
    await Product.bulkCreate([
      { name: 'Test Macbook' },
      { name: 'Test iPhone' }
    ]);

    server = await createApolloServer();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('1. Main Query & Data Shape: Should fetch products successfully without errors', async () => {
    const GET_PRODUCTS = `
      query {
        products {
          id
          name
        }
      }
    `;

    const response = await server.executeOperation({ query: GET_PRODUCTS });

    assert(response.body.kind === 'single');
    expect(response.body.singleResult.errors).toBeUndefined();

    const data = response.body.singleResult.data;
    
    expect(data).toBeDefined();
    expect(data?.products).toBeDefined();
    expect(Array.isArray(data?.products)).toBe(true); 
    
    const products = data?.products as any[];
    expect(products).toHaveLength(2);
    expect(products[0].name).toBe('Test Macbook');
  });

  it('2. Edge Case (Bad Input): Should return an error when querying invalid fields', async () => {
    const BAD_QUERY = `
      query {
        products {
          non_existent_field
        }
      }
    `;

    const response = await server.executeOperation({ query: BAD_QUERY });

    assert(response.body.kind === 'single');
    
    expect(response.body.singleResult.errors).toBeDefined();
    expect(response.body.singleResult.errors?.[0].message).toContain('Cannot query field');
  });
});