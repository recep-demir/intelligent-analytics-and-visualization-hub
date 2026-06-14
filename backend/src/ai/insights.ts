import { GoogleGenerativeAI } from "@google/generative-ai";
import { ResolvedQuery } from "./normalizer";
import { buildInsightsPrompt } from "./prompt";

type DataRow = Record<string, number | string>;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function fmt(v: number, agg: string): string {
  if (agg === "count") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000)     return `${Math.round(v / 1_000)}K`;
    return String(Math.round(v));
  }
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(2)}`;
}

function pct(part: number, total: number): string {
  return `${Math.round((part / total) * 100)}%`;
}

// ---------------------------------------------------------------------------
// Rule-based generators — instant, no API cost
// ---------------------------------------------------------------------------
function statInsights(data: DataRow[], q: ResolvedQuery): string[] {
  const val = Number(data[0]?.value ?? 0);
  switch (q.aggregation) {
    case "count": return [`Total order count: ${fmt(val, "count")}`];
    case "avg":   return [`Average order value: ${fmt(val, "avg")}`];
    case "min":   return [`Minimum order value: ${fmt(val, "min")}`];
    case "max":   return [`Maximum order value: ${fmt(val, "max")}`];
    default:      return [`Total value: ${fmt(val, q.aggregation)}`];
  }
}

const BOTTOM_INTENT = /\b(bad|worst|lowest|bottom|least|smallest|fewest|poor|weakest|underperform|low)\b/i;

function barInsights(data: DataRow[], q: ResolvedQuery, question: string): string[] {
  if (data.length === 0) return [];

  const isBottom = BOTTOM_INTENT.test(question);
  const rows = isBottom
    ? [...data].sort((a, b) => Number(a.value) - Number(b.value))
    : [...data].sort((a, b) => Number(b.value) - Number(a.value));
  const total = rows.reduce((s, r) => s + Number(r.value), 0);
  const agg   = q.aggregation;
  const out: string[] = [];

  if (isBottom) {
    const label = agg === "count" ? "order count" : "revenue";
    out.push(`${rows[0].name} has the weakest ${label} at ${fmt(Number(rows[0].value), agg)}`);
    if (rows.length >= 2) {
      const gap = ((Number(rows[1].value) / Number(rows[0].value) - 1) * 100).toFixed(0);
      out.push(`${rows[1].name} is ${gap}% higher at ${fmt(Number(rows[1].value), agg)}`);
    }
    if (rows.length >= 3) {
      const last = rows[rows.length - 1];
      const ratio = (Number(last.value) / Number(rows[0].value)).toFixed(1);
      out.push(`${last.name} leads this group at ${fmt(Number(last.value), agg)} — ${ratio}× the weakest`);
    }
    return out;
  }

  // Top-performer framing
  if (rows.length >= 2) {
    const top = Number(rows[0].value);
    const second = Number(rows[1].value);
    const ratio = top / second;
    const pctAhead = Math.round((ratio - 1) * 100);
    const comparison = ratio >= 1.15
      ? ` — ${pctAhead}% higher than ${rows[1].name} (${fmt(second, agg)})`
      : ` — nearly tied with ${rows[1].name} at ${fmt(second, agg)}`;
    out.push(`${rows[0].name} leads at ${fmt(top, agg)}${comparison}`);
  } else if (rows.length === 1) {
    out.push(`${rows[0].name}: ${fmt(Number(rows[0].value), agg)}`);
  }

  // Top-2 combined share — only meaningful for larger sets
  if (rows.length >= 4) {
    const top2 = Number(rows[0].value) + Number(rows[1].value);
    out.push(`${rows[0].name} + ${rows[1].name} together account for ${pct(top2, total)} of shown results`);
  }

  // Lowest — show for any set of 3+ rows
  if (rows.length >= 3) {
    const bot = rows[rows.length - 1];
    out.push(`Lowest: ${bot.name} at ${fmt(Number(bot.value), agg)} (${pct(Number(bot.value), total)} of total)`);
  }

  return out;
}

function pieInsights(data: DataRow[], q: ResolvedQuery): string[] {
  if (data.length === 0) return [];

  const rows  = [...data].sort((a, b) => Number(b.value) - Number(a.value));
  const total = rows.reduce((s, r) => s + Number(r.value), 0);
  const agg   = q.aggregation;
  const out: string[] = [];

  out.push(
    `${rows[0].name} dominates at ${pct(Number(rows[0].value), total)} (${fmt(Number(rows[0].value), agg)})`
  );

  if (rows.length >= 2) {
    const top2 = Number(rows[0].value) + Number(rows[1].value);
    out.push(
      `${rows[0].name} + ${rows[1].name} represent ${pct(top2, total)} combined`
    );
  }

  if (rows.length >= 3) {
    const bot = rows[rows.length - 1];
    out.push(`Smallest share: ${bot.name} at ${pct(Number(bot.value), total)}`);
  }

  return out;
}

// ---------------------------------------------------------------------------
// MinMax insights — line chart with both min and max columns per period.
// ---------------------------------------------------------------------------
function minmaxInsights(data: DataRow[]): string[] {
  if (data.length === 0) return [];

  const peakMax  = data.reduce((b, r) => Number(r.max) > Number(b.max) ? r : b, data[0]);
  const lowMin   = data.reduce((b, r) => Number(r.min) < Number(b.min) ? r : b, data[0]);
  const avgSpread = data.reduce((s, r) => s + (Number(r.max) - Number(r.min)), 0) / data.length;

  return [
    `Highest max: ${peakMax.name} at ${fmt(Number(peakMax.max), "sum")}`,
    `Lowest min: ${lowMin.name} at ${fmt(Number(lowMin.min), "sum")}`,
    `Average monthly spread between min and max: ${fmt(avgSpread, "sum")}`,
  ];
}

// ---------------------------------------------------------------------------
// Heatmap insights — 2D data (dim1 × dim2) so barInsights can't apply.
// Reads dim1/dim2 field names from ResolvedQuery.groupBy / groupBy2.
// ---------------------------------------------------------------------------
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function labelDim(val: string, dim: string): string {
  if (dim !== "month") return val;
  const idx = parseInt(val, 10) - 1;
  return MONTH_NAMES[idx] ?? val;
}

function heatmapInsights(data: DataRow[], q: ResolvedQuery): string[] {
  if (data.length === 0) return [];

  const dim1 = (q.groupBy  as string) ?? "row";
  const dim2 = (q.groupBy2 as string) ?? "month";
  const agg  = q.aggregation;
  const out: string[] = [];

  // Peak cell
  const peak = data.reduce((best, row) =>
    Number(row.value) > Number(best.value) ? row : best, data[0]);
  out.push(
    `Peak: ${peak[dim1]} · ${labelDim(String(peak[dim2]), dim2)} at ${fmt(Number(peak.value), agg)}`
  );

  // Best dim1 (row dimension) — sum across all columns
  const byDim1: Record<string, number> = {};
  for (const row of data) byDim1[String(row[dim1])] = (byDim1[String(row[dim1])] ?? 0) + Number(row.value);
  const topDim1 = Object.entries(byDim1).sort((a, b) => b[1] - a[1]);
  if (topDim1.length >= 2) {
    const [n1, v1] = topDim1[0];
    const [n2, v2] = topDim1[1];
    const pctAhead = Math.round(((v1 / v2) - 1) * 100);
    const label = agg === "count" ? "orders" : "revenue";
    out.push(
      `${n1} leads all ${dim1}s in total ${label} — ${pctAhead}% ahead of ${n2}`
    );
  }

  // Best dim2 (column dimension) — sum across all rows
  const byDim2: Record<string, number> = {};
  for (const row of data) byDim2[String(row[dim2])] = (byDim2[String(row[dim2])] ?? 0) + Number(row.value);
  const topDim2 = Object.entries(byDim2).sort((a, b) => b[1] - a[1]);
  if (topDim2.length >= 1) {
    out.push(
      `Strongest ${dim2} overall: ${labelDim(topDim2[0][0], dim2)} at ${fmt(topDim2[0][1], agg)}`
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Gemini-based generator — used for line & heatmap where trend detection
// matters. Hard timeout at 4 s so it never blocks the chart response.
// Falls back to [] silently on any failure.
// ---------------------------------------------------------------------------
async function geminiInsights(
  chartType: string,
  data: DataRow[],
  question: string,
  apiKey: string,
  resolved?: ResolvedQuery
): Promise<string[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const prompt = buildInsightsPrompt(chartType, question, data, resolved);

  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Insights timeout")), 2000)
    ),
  ]);

  return result.response
    .text()
    .trim()
    .split("\n")
    .map((l) => l.replace(/^[\s•\-*\d.]+/, "").trim())
    .filter((l) => l.length > 10)
    .slice(0, 3);
}

// ---------------------------------------------------------------------------
// Public entry point
// Strategy:
//   stat / bar / map / treemap / pie / donut  → rule-based (instant)
//   line / heatmap                            → Gemini if key present,
//                                               rule-based fallback otherwise
//   grid                                      → no insights (tabular view)
//
// Never throws — returns [] on any failure so the chart always renders.
// ---------------------------------------------------------------------------
export async function generateInsights(
  chartType: string,
  data: DataRow[],
  resolved: ResolvedQuery,
  question: string,
  geminiApiKey?: string
): Promise<string[]> {
  try {
    switch (chartType) {
      case "stat":
        return statInsights(data, resolved);

      case "bar":
      case "map":
      case "treemap":
        return barInsights(data, resolved, question);

      case "pie":
      case "donut":
        return pieInsights(data, resolved);

      case "heatmap":
        if (geminiApiKey) {
          const ai = await geminiInsights(chartType, data, question, geminiApiKey, resolved).catch(() => []);
          return ai.length > 0 ? ai : heatmapInsights(data, resolved);
        }
        return heatmapInsights(data, resolved);

      case "line": {
        const lineFallback = resolved.aggregation === "minmax"
          ? minmaxInsights(data)
          : barInsights(data, resolved, question);
        if (geminiApiKey) {
          const ai = await geminiInsights(chartType, data, question, geminiApiKey, resolved).catch(() => []);
          return ai.length > 0 ? ai : lineFallback;
        }
        return lineFallback;
      }

      case "grid":
        return [];

      default:
        return [];
    }
  } catch {
    return [];
  }
}
