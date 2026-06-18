import { build } from "../src/sql/queryBuilder";
import { ResolvedQuery } from "../src/ai/normalizer";

function resolved(overrides: Partial<ResolvedQuery> = {}): ResolvedQuery {
  return {
    chartType: "bar",
    groupBy: "province",
    filters: [{ field: "country", operator: "eq", value: "ca" }],
    aggregation: "sum",
    limit: 10,
    limitIsExplicit: false,
    sortAsc: false,
    ...overrides,
  };
}

describe("build — metric=both item-level dimensions", () => {
  it("joins ProductCategories for groupBy=category instead of falling back to province", () => {
    const { sql } = build(resolved({ groupBy: "category", metric: "both" }));
    expect(sql).toContain("ProductCategories");
    expect(sql).toContain("OrderItems");
    expect(sql).not.toContain("a.province AS name");
  });

  it("joins ProductGroups for groupBy=productGroup instead of falling back to province", () => {
    const { sql } = build(resolved({ groupBy: "productGroup", metric: "both" }));
    expect(sql).toContain("ProductGroups");
    expect(sql).toContain("OrderItems");
    expect(sql).not.toContain("a.province AS name");
  });

  it("uses Products directly for groupBy=product without category/group joins", () => {
    const { sql } = build(resolved({ groupBy: "product", metric: "both" }));
    expect(sql).toContain("JOIN Products p");
    expect(sql).not.toContain("ProductGroups");
    expect(sql).not.toContain("ProductCategories");
  });

  it("still falls back to province for the default groupBy", () => {
    const { sql } = build(resolved({ groupBy: "province", metric: "both" }));
    expect(sql).toContain("a.province AS name");
  });
});

describe("build — metric=both grid bypass", () => {
  it("ignores the both-metric reroute for grid and returns the normal row-level query", () => {
    const { sql } = build(resolved({ chartType: "grid", groupBy: undefined, metric: "both" }));
    expect(sql).toContain("o.subtotal");
    expect(sql).toContain("o.total");
    expect(sql).not.toContain("UNION ALL");
    expect(sql).not.toContain("AS series");
  });
});

describe("build — metric=both stat/line shapes", () => {
  it("returns two named rows for stat", () => {
    const { sql } = build(resolved({ chartType: "stat", groupBy: "total", metric: "both" }));
    expect(sql).toContain("'Revenue' AS name");
    expect(sql).toContain("'Tax Collected' AS name");
    expect(sql).toContain("UNION ALL");
  });

  it("returns a sort_key for chronological ordering on line charts", () => {
    const { sql } = build(resolved({ chartType: "line", groupBy: "month", metric: "both" }));
    expect(sql).toContain("AS sort_key");
    expect(sql).toContain("'Revenue' AS series");
    expect(sql).toContain("'Tax Collected' AS series");
  });
});

describe("build — metric=both CTE limit", () => {
  it("wraps both UNION arms in a ranked CTE when an explicit limit is requested", () => {
    const { sql } = build(
      resolved({ chartType: "bar", groupBy: "province", metric: "both", limit: 3, limitIsExplicit: true, sortAsc: true }),
    );
    expect(sql).toContain("WITH ranked AS");
    expect(sql).toContain("ORDER BY");
    expect(sql).toContain("ASC");
    expect(sql).toContain("LIMIT 3");
  });
});
