import { AIEngine } from "../../../../shared/types/ai";
import { ChartConfig, ChartType, GroupByValue } from "../../../../shared/types/chart";

// Rule-based fallback engine — no external API, no cost, works offline
// Handles predictable patterns only. Use GeminiEngine for complex queries.
export class LocalEngine implements AIEngine {
  async resolve(nl: string, _schemaSdl: string): Promise<ChartConfig> {
    const q = nl.toLowerCase();

    return {
      chartType: this.detectChartType(q),
      dataset: this.detectDataset(q),
      filters: this.detectFilters(q),
      groupBy: this.detectGroupBy(q),
      title: nl,
      limit: this.detectLimit(q),
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

    // Stat: single aggregate KPI — no groupBy dimension in the question
    const hasDimension =
      / by (province|year|month|status|category|product)/i.test(q) ||
      /\b(monthly|yearly|annually|each year|each month|by year|by month)\b/.test(q);
    if (!hasDimension && (
      /\b(what is|how much|overall)\b/.test(q) ||
      /\btotal (revenue|tax|orders?|sales|amount)\b/.test(q) ||
      /\b(average|avg) (order|revenue|tax)\b/.test(q)
    )) return "stat";

    // Semantic fallbacks
    if (
      q.includes("pie") ||
      q.includes("split") ||
      q.includes("breakdown") ||
      q.includes("distribution")
    ) return "pie";
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

    return "treemap";
  }

  private detectDataset(q: string): string {
    if (q.includes("town") || q.includes("city")) return "towns";
    return "tax_records";
  }

  private detectGroupBy(q: string): GroupByValue | undefined {
    if (q.includes("product group")) return "productGroup";
    if (q.includes("province"))      return "province";
    if (q.includes("year"))          return "year";
    if (q.includes("month"))         return "month";
    if (q.includes("categor"))       return "category";
    if (q.includes("product"))       return "product";
    if (q.includes("status"))        return "status";
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

    // Numbered — "top 5", "bottom 10", "5 best", "3 worst"
    const prefixPattern = /\b(?:top|bottom|largest|smallest)\s+(\d+)\b/;
    const suffixPattern = /\b(\d+)\s+(?:best|worst|top|bottom|largest|smallest)\b/;

    // Bare superlative — "the highest province" → limit 1
    if (/\b(highest|most|largest|biggest|best)\b/.test(q))  return 1;
    if (/\b(lowest|least|smallest|fewest|worst)\b/.test(q)) return 1;

    const prefixMatch = q.match(prefixPattern);
    if (prefixMatch) return parseInt(prefixMatch[1], 10);

    const suffixMatch = q.match(suffixPattern);
    if (suffixMatch) return parseInt(suffixMatch[1], 10);

    return undefined;
  }

  private toTitleCase(str: string): string {
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
