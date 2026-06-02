import { parse } from "graphql";
import { buildGraphQLQuery } from "../src/graphql/queryBuilder";

describe("buildGraphQLQuery", () => {
  it("generates a GraphQL query from chart config", () => {
    const query = buildGraphQLQuery({
      rootField: "products",
      fields: ["id", "name", "price"],
      args: {
        limit: 10,
      },
      operationName: "ProductsChart",
    });

    expect(query).toBe(`query ProductsChart {
  products(limit: 10) {
    id
    name
    price
  }
}`);
  });

  it("generates a syntactically valid GraphQL query", () => {
    const query = buildGraphQLQuery({
      rootField: "products",
      fields: ["id", "name", "price"],
      args: {
        limit: 10,
      },
      operationName: "ProductsChart",
    });

    expect(() => parse(query)).not.toThrow();
  });

  it("generates a query without arguments", () => {
    const query = buildGraphQLQuery({
      rootField: "products",
      fields: ["id", "name"],
    });

    expect(query).toBe(`query {
  products {
    id
    name
  }
}`);
  });

  it("throws an error when fields are empty", () => {
    expect(() =>
      buildGraphQLQuery({
        rootField: "products",
        fields: [],
      }),
    ).toThrow("At least one field is required.");
  });

  it("throws an error for invalid GraphQL names", () => {
    expect(() =>
      buildGraphQLQuery({
        rootField: "products-table",
        fields: ["id"],
      }),
    ).toThrow("Root field must be a valid GraphQL name.");
  });
});