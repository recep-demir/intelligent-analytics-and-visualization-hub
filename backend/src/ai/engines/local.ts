import { AIEngine } from "../../../../shared/types/ai";
import { ChartConfig, ChartType, GroupByValue, Metric } from "../../../../shared/types/chart";

// Rule-based fallback engine — no external API, no cost, works offline
// Handles predictable patterns only. Use GeminiEngine for complex queries.
export class LocalEngine implements AIEngine {
  async resolve(nl: string, _schemaSdl: string): Promise<ChartConfig> {
    const q = nl.toLowerCase();

    const metric = this.detectMetric(q);
    return {
      chartType: this.detectChartType(q),
      dataset: this.detectDataset(q),
      filters: this.detectFilters(q),
      groupBy: this.detectGroupBy(q),
      title: nl,
      limit: this.detectLimit(q),
      ...(metric ? { metric } : {}),
    };
  }

  private detectChartType(q: string): ChartType {
    // Explicit chart type keywords take priority over semantic ones
    if (q.includes("heatmap"))                             return "heatmap";
    if (q.includes("bar chart") || q.includes("bar graph")) return "bar";
    if (q.includes("line chart") || q.includes("line graph")) return "line";
    if (q.includes("pie chart"))                           return "pie";
    if (q.includes("donut chart") || q.includes("donut")) return "donut";
    if (q.includes("treemap") || q.includes("tree chart")) return "treemap";
    if (q.includes("table") || q.includes("list"))         return "grid";
    if (q.includes("map"))                                 return "map";
    if (q.includes("stat chart") || /\bstat\b/.test(q))  return "stat";

    // Stat: single aggregate KPI — no groupBy dimension in the question
    const hasDimension =
      / (by|per) (province|year|month|status|category|product)/i.test(q) ||
      /\b(monthly|yearly|annually|each year|each month|by year|by month|per province|per month|per year)\b/.test(q);
    // breakdown/distribution/split/share always imply a dimensional chart — never stat
    const isComparative = /\b(breakdown|distribution|split|proportion|share|percentage|percent)\b/.test(q);
    if (!hasDimension && !isComparative && (
      /\b(what is|how much|overall|how many)\b/.test(q) ||
      /\btotal (revenue|tax|orders?|sales|amount)\b/.test(q) ||
      /\bsum of (?:all )?orders?\b(?!\s*(?:amount|value|revenue|price|cost|subtotal))/.test(q) ||
      /\b(average|avg) (order|revenue|tax)\b/.test(q)
    )) return "stat";

    // Semantic fallbacks
    // "split" / "breakdown" → pie (test contract); "distribution/share/%" → donut
    if (q.includes("pie") || q.includes("split") || q.includes("breakdown")) return "pie";
    if (
      q.includes("distribution") ||
      q.includes("share")        ||
      q.includes("percentage")   ||
      q.includes("proportion")
    ) return "donut";
    if (
      q.includes("line")           ||
      q.includes("trend")          ||
      q.includes("over time")      ||
      q.includes("over the years") ||
      q.includes("changed")        ||
      q.includes("monthly")        ||
      q.includes("by year")        ||
      q.includes("by month")       ||
      q.includes("yearly")         ||
      q.includes("each month")     ||
      q.includes("each year")
    ) return "line";

    // Status has few distinct values — donut shows proportions better than bar
    if (/ by status\b/i.test(q)) return "donut";

    // Explicit comparison keywords always imply bar. Dimension-based routing
    // (category/productGroup/product/province/status) is left to the more specific,
    // superlative-aware blocks below — matching this here would short-circuit them
    // (e.g. "by category" or "by product group" with no ranking should fall through to treemap).
    if (/\b(compare|comparison|ranking|rank)\b/.test(q)) return "bar";

    // Province queries: ranking/superlative → bar; geographic overview → map
    if (/\bprovince[s]?\b/i.test(q)) {
      if (/ by province\b/i.test(q) ||
          /\b(top|bottom|best|worst|highest|lowest|most|least|largest|smallest)\b/.test(q))
        return "bar";
      return "map";
    }

    // Category / product group: superlative/ranking → bar; hierarchy overview → treemap
    if (q.includes("categor") || q.includes("product group")) {
      if (/\b(top|bottom|best|worst|highest|lowest|most|least|largest|smallest)\b/.test(q))
        return "bar";
      return "treemap";
    }

    // Non-geographic dimensions → bar
    if (q.includes("status") || (q.includes("product") && !q.includes("product group"))) return "bar";

    // Default → map (geographic overview is the natural fallback for a Canadian tax platform)
    return "map";
  }

  private detectDataset(q: string): string {
    if (q.includes("town") || q.includes("city")) return "towns";
    return "Orders";
  }

  private detectGroupBy(q: string): GroupByValue | undefined {
    // No analytics keywords → unrecognised query; server returns the "I don't know" message
    const hasAnalyticsKeyword = /\b(revenue|sales|tax|orders?|amount|province|categor|product|status|year|month|total|average|avg|count|heatmap|map|chart|bar|pie|treemap|line|trend|breakdown|distribution)\b/.test(q);
    if (!hasAnalyticsKeyword) return 'none';

    if (q.includes("product group")) return "productGroup";
    if (q.includes("categor"))       return "category";
    if (q.includes("province"))      return "province";
    if (q.includes("status"))        return "status";
    if (q.includes("product"))       return "product";
    // year/month last — they are heatmap column dims, not row dims
    if (q.includes("year"))          return "year";
    if (q.includes("month"))         return "month";
    return undefined;
  }

  private detectFilters(q: string): ChartConfig["filters"] {
    const filters: ChartConfig["filters"] = [];

    // Default to Canada — this is a Canadian tax analytics platform.
    // DB stores country codes lowercase ("ca", "us").
    // Only override when user explicitly asks for another country.
    if (q.includes("united states") || q.includes(" us ") || q.includes("mexico"))
      filters.push({ field: "country", operator: "eq", value: "us" });
    else
      filters.push({ field: "country", operator: "eq", value: "ca" });

    // Province filter
    const provinces = [
      "ontario",
      "quebec",
      "british columbia",
      "alberta",
      "manitoba",
      "saskatchewan",
      "nova scotia",
      "new brunswick",
      "newfoundland",
      "prince edward island",
      "yukon",
      "northwest territories",
      "nunavut",
    ];
    for (const p of provinces) {
      if (q.includes(p)) {
        filters.push({
          field: "province",
          operator: "eq",
          value: this.toTitleCase(p),
        });
        // no break — collect all mentioned provinces
      }
    }

    // Status filter
    const orderStatuses = ['shipped', 'paid', 'cart', 'pending', 'cancelled', 'refunded'];
    for (const s of orderStatuses) {
      if (q.includes(s)) {
        filters.push({ field: 'status', operator: 'eq', value: s });
      }
    }

    // Year filter — single year, explicit range, or discrete years ("for 2022 and 2024")
    const yearMatches = [...new Set([...q.matchAll(/\b(20\d{2})\b/g)].map(m => m[1]))].sort();
    if (yearMatches.length >= 2) {
      const isRange = /\bfrom\s+20\d{2}\s+to\b|\b20\d{2}\s*[-–]\s*20\d{2}\b|\bbetween\b/.test(q);
      if (isRange) {
        filters.push({ field: "year", operator: "gte", value: yearMatches[0] });
        filters.push({ field: "year", operator: "lte", value: yearMatches[yearMatches.length - 1] });
      } else {
        for (const y of yearMatches) {
          filters.push({ field: "year", operator: "eq", value: y });
        }
      }
    } else if (yearMatches.length === 1) {
      filters.push({ field: "year", operator: "eq", value: yearMatches[0] });
    }

    return filters;
  }

  private detectLimit(q: string): number | undefined {
    // Numbered superlative — "lowest 3", "highest 5", "best 10" — number wins over bare superlative
    const supNumPattern = /\b(?:lowest|least|smallest|fewest|worst|highest|most|largest|biggest|best)\s+(\d+)\b/;
    const numSupPattern = /\b(\d+)\s+(?:lowest|least|smallest|fewest|worst|highest|most|largest|biggest|best)\b/;
    const supNumMatch = q.match(supNumPattern);
    if (supNumMatch) return parseInt(supNumMatch[1], 10);
    const numSupMatch = q.match(numSupPattern);
    if (numSupMatch) return parseInt(numSupMatch[1], 10);

    // Numbered prefix/suffix — "top 5", "bottom 10", "5 best", "3 worst"
    // Must run before bare-superlative so "largest 5" / "top 5" aren't shadowed
    const prefixPattern = /\b(?:top|bottom|largest|smallest)\s+(\d+)\b/;
    const suffixPattern = /\b(\d+)\s+(?:best|worst|top|bottom|largest|smallest)\b/;
    const prefixMatch = q.match(prefixPattern);
    if (prefixMatch) return parseInt(prefixMatch[1], 10);
    const suffixMatch = q.match(suffixPattern);
    if (suffixMatch) return parseInt(suffixMatch[1], 10);

    // Bare superlative — "the highest province" → limit 1
    if (/\b(highest|most|largest|biggest|best)\b/.test(q))  return 1;
    if (/\b(lowest|least|smallest|fewest|worst)\b/.test(q)) return 1;

    return undefined;
  }

  private detectMetric(q: string): Metric | undefined {
    const hasRevenue = /\b(revenue|subtotal|sales)\b/.test(q)
    const hasTax     = /\b(taxes|tax\s+(?:amount|collected|paid|revenue))\b/.test(q) ||
                       (/\btax\b/.test(q) && !/\btax\s+(?:year|rate|code|bracket)\b/.test(q))
    const hasJoin    = /\b(vs\.?|versus|alongside|compare|both|and)\b/.test(q)
    if (hasRevenue && hasTax && hasJoin) return 'both'
    if (hasTax) return 'tax'
    if (/\b(grand total|total amount|total charged|total bill|total paid|gross total)\b/.test(q)) return 'total'
    return undefined
  }

  private toTitleCase(str: string): string {
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
