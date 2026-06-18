import { normalize } from "../src/ai/normalizer";
import { ChartConfig } from "../../shared/types/chart";

function config(overrides: Partial<ChartConfig> = {}): ChartConfig {
  return {
    chartType: "bar",
    dataset: "Orders",
    filters: [],
    ...overrides,
  };
}

describe("normalize — explicit chart-type override", () => {
  it("forces stat even when the question also contains a comparison word", () => {
    const resolved = normalize(
      config({ chartType: "bar", metric: "both" }),
      "show me combined revenue vs tax collected as a stat",
    );
    expect(resolved.chartType).toBe("stat");
  });

  it("forces treemap when explicitly requested, even with metric=both", () => {
    const resolved = normalize(
      config({ chartType: "bar", groupBy: "category", metric: "both" }),
      "show me revenue and taxes by category as a treemap",
    );
    expect(resolved.chartType).toBe("treemap");
  });

  it("forces grid when the question says 'as a table'", () => {
    const resolved = normalize(
      config({ chartType: "bar" }),
      "list all orders from Ontario as a table",
    );
    expect(resolved.chartType).toBe("grid");
  });

  it("falls back to the AI-provided chartType when no explicit phrase is present", () => {
    const resolved = normalize(
      config({ chartType: "line", groupBy: "month" }),
      "show me monthly revenue trend",
    );
    expect(resolved.chartType).toBe("line");
  });
});

describe("normalize — detectMetric robustness", () => {
  it("does not classify 'tax year' as the tax metric, even if the AI said tax", () => {
    const resolved = normalize(
      config({ chartType: "line", groupBy: "year", metric: "tax" }),
      "show me revenue by tax year",
    );
    expect(resolved.metric).toBeUndefined();
  });

  it("does not classify 'tax year' as the total metric, even if the AI hallucinated total", () => {
    const resolved = normalize(
      config({ chartType: "line", groupBy: "year", metric: "total" }),
      "show me revenue by tax year",
    );
    expect(resolved.metric).toBeUndefined();
  });

  it("does not classify 'tax rate' as the tax metric", () => {
    const resolved = normalize(
      config({ chartType: "bar", groupBy: "province", metric: "tax" }),
      "show me revenue by tax rate",
    );
    expect(resolved.metric).toBeUndefined();
  });

  it("resolves metric=both when revenue and tax are explicitly joined", () => {
    const resolved = normalize(
      config({ chartType: "bar", groupBy: "province" }),
      "show me revenue and taxes by province",
    );
    expect(resolved.metric).toBe("both");
  });

  it("still resolves metric=tax for genuine tax-collected questions", () => {
    const resolved = normalize(
      config({ chartType: "bar", groupBy: "status", metric: "tax" }),
      "show me tax collected by status",
    );
    expect(resolved.metric).toBe("tax");
  });

  it("still resolves metric=total for genuine grand-total questions", () => {
    const resolved = normalize(
      config({ chartType: "bar", groupBy: "year", metric: "total" }),
      "show me grand total by year",
    );
    expect(resolved.metric).toBe("total");
  });

  it("defaults to revenue (undefined metric) for a plain revenue question", () => {
    const resolved = normalize(
      config({ chartType: "bar", groupBy: "province" }),
      "show me revenue by province",
    );
    expect(resolved.metric).toBeUndefined();
  });
});

describe("normalize — treemap+both no longer silently coerced to bar", () => {
  it("keeps chartType=treemap for metric=both so the server-side guard can handle it", () => {
    const resolved = normalize(
      config({ chartType: "treemap", groupBy: "category", metric: "both" }),
      "show me revenue and taxes by category as a treemap",
    );
    expect(resolved.chartType).toBe("treemap");
    expect(resolved.metric).toBe("both");
  });
});
