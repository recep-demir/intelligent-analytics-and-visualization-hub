import {
  buildAggregateExpression,
  detectAggregation,
  isAggregation,
} from "../src/analytics/aggregation";

describe("aggregation helpers", () => {
  it("detects average aggregation", () => {
    expect(detectAggregation("Show me average revenue by province")).toBe("avg");
  });

  it("detects count aggregation", () => {
    expect(detectAggregation("How many orders by province")).toBe("count");
  });

  it("detects minimum aggregation", () => {
    expect(detectAggregation("Show me minimum revenue by province")).toBe("min");
  });

  it("detects maximum aggregation", () => {
    expect(detectAggregation("Show me maximum revenue by province")).toBe("max");
  });

  it("defaults to sum aggregation", () => {
    expect(detectAggregation("Show me revenue by province")).toBe("sum");
  });

  it("uses requested aggregation when valid", () => {
    expect(detectAggregation("Show me revenue by province", "avg")).toBe("avg");
  });

  it("rejects unsupported aggregation values", () => {
    expect(isAggregation("ratio")).toBe(false);
  });

  it("builds SUM expression", () => {
    expect(buildAggregateExpression("sum", "subtotal")).toBe(
      "ROUND(SUM(subtotal), 2)",
    );
  });

  it("builds AVG expression", () => {
    expect(buildAggregateExpression("avg", "subtotal")).toBe(
      "ROUND(AVG(subtotal), 2)",
    );
  });

  it("builds COUNT expression", () => {
    expect(buildAggregateExpression("count", "subtotal", "id")).toBe(
      "COUNT(id)",
    );
  });
});
