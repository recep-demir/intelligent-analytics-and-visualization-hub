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
  if (total === 0) return "N/A";
  return `${Math.round((part / total) * 100)}%`;
}

function metricLabel(q: ResolvedQuery): string {
  if (q.aggregation === "count") return "order count"
  if (q.metric === "tax")   return "tax"
  if (q.metric === "total") return "grand total"
  if (q.metric === "both")  return "revenue & tax"
  return "revenue"
}

// ---------------------------------------------------------------------------
// Rule-based generators — instant, no API cost
// ---------------------------------------------------------------------------
function statInsights(data: DataRow[], q: ResolvedQuery): string[] {
  // Dual-metric stat: two named rows from buildBothMetricsQuery
  if (q.metric === 'both') {
    const rev = Number(data.find(r => r.name === 'Revenue')?.value ?? 0)
    const tax = Number(data.find(r => r.name === 'Tax Collected')?.value ?? 0)
    const ratio = rev > 0 ? (tax / rev * 100).toFixed(1) : '0'
    return [
      `Revenue: ${fmt(rev, 'sum')} — Tax collected: ${fmt(tax, 'sum')}`,
      `Tax is ${ratio}% of pre-tax revenue`,
    ]
  }

  const val = Number(data[0]?.value ?? 0);
  const ml = metricLabel(q)
  switch (q.aggregation) {
    case "count": return [`Total order count: ${fmt(val, "count")}`];
    case "avg":   return [`Average ${ml}: ${fmt(val, "avg")}`];
    case "min":   return [`Minimum ${ml}: ${fmt(val, "min")}`];
    case "max":   return [`Maximum ${ml}: ${fmt(val, "max")}`];
    default:      return [`Total ${ml}: ${fmt(val, q.aggregation)}`];
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
    const label = metricLabel(q);
    out.push(`${rows[0].name} has the weakest ${label} at ${fmt(Number(rows[0].value), agg)}`);
    if (rows.length >= 2) {
      const base = Number(rows[0].value);
      if (base > 0) {
        const gap = ((Number(rows[1].value) / base - 1) * 100).toFixed(0);
        out.push(`${rows[1].name} is ${gap}% higher at ${fmt(Number(rows[1].value), agg)}`);
      } else {
        out.push(`${rows[1].name} is next at ${fmt(Number(rows[1].value), agg)}`);
      }
    }
    if (rows.length >= 3) {
      const last = rows[rows.length - 1];
      const base = Number(rows[0].value);
      if (base > 0) {
        const ratio = (Number(last.value) / base).toFixed(1);
        out.push(`${last.name} leads this group at ${fmt(Number(last.value), agg)} — ${ratio}× the weakest`);
      } else {
        out.push(`${last.name} leads this group at ${fmt(Number(last.value), agg)}`);
      }
    }
    return out;
  }

  // Top-performer framing
  if (rows.length >= 2) {
    const top = Number(rows[0].value);
    const second = Number(rows[1].value);
    const comparison = second > 0
      ? (() => {
          const pctAhead = Math.round((top / second - 1) * 100);
          return top / second >= 1.15
            ? ` — ${pctAhead}% higher than ${rows[1].name} (${fmt(second, agg)})`
            : ` — nearly tied with ${rows[1].name} at ${fmt(second, agg)}`;
        })()
      : ` — ${rows[1].name} has no recorded ${metricLabel(q)}`;
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
  if (total === 0) return [];
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
// Multi-series line insights — top-N products/categories shown as separate lines.
// Data shape: { series, name, value } — one row per (series × period).
// Groups by series, computes period totals, compares leaders.
// ---------------------------------------------------------------------------
function multiSeriesLineInsights(data: DataRow[], q: ResolvedQuery): string[] {
  const seriesTotals = new Map<string, number>()
  for (const row of data) {
    const s = String((row as any).series)
    seriesTotals.set(s, (seriesTotals.get(s) ?? 0) + Number(row.value))
  }
  const sorted = [...seriesTotals.entries()].sort((a, b) => b[1] - a[1])
  if (sorted.length === 0) return []

  const agg = q.aggregation
  const out: string[] = []

  if (sorted.length >= 2) {
    const [top, topVal] = sorted[0]
    const [second, secondVal] = sorted[1]
    const pctAhead = secondVal > 0 ? Math.round((topVal / secondVal - 1) * 100) : null
    out.push(pctAhead !== null
      ? `${top} leads over the period at ${fmt(topVal, agg)} — ${pctAhead}% ahead of ${second} (${fmt(secondVal, agg)})`
      : `${top} leads at ${fmt(topVal, agg)}`
    )
  } else {
    out.push(`${sorted[0][0]}: ${fmt(sorted[0][1], q.aggregation)}`)
  }

  if (sorted.length >= 3) {
    const [bot, botVal] = sorted[sorted.length - 1]
    out.push(`${bot} has the lowest total at ${fmt(botVal, agg)}`)
  }

  // 3rd bullet: leader's concentration share of combined total
  if (sorted.length >= 3) {
    const grandTotal = sorted.reduce((s, [, v]) => s + v, 0)
    const topShare   = grandTotal > 0 ? Math.round((sorted[0][1] / grandTotal) * 100) : 0
    out.push(`${sorted[0][0]} accounts for ${topShare}% of the combined total (${fmt(grandTotal, agg)})`)
  }

  return out
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
    const label = metricLabel(q);
    const dim1Plural: Record<string, string> = {
      category: "categories", status: "statuses",
      province: "provinces", productGroup: "product groups", product: "products",
    };
    const dim1Label = dim1Plural[dim1] ?? `${dim1}s`;
    if (v2 > 0) {
      const pctAhead = Math.round(((v1 / v2) - 1) * 100);
      out.push(`${n1} leads all ${dim1Label} in total ${label} — ${pctAhead}% ahead of ${n2}`);
    } else {
      out.push(`${n1} leads all ${dim1Label} in total ${label} at ${fmt(v1, agg)}`);
    }
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
// Gemini sometimes ignores the "call it tax/grand total" prompt instruction and
// reverts to "revenue" out of training bias — the same class of drift seen in
// chart-type/metric resolution elsewhere in this pipeline. Validate the
// generated text deterministically instead of trusting the prompt alone.
// ---------------------------------------------------------------------------
function mentionsWrongMetric(bullets: string[], metric: ResolvedQuery["metric"]): boolean {
  const text = bullets.join(" ").toLowerCase()
  if (metric === "tax")   return /\brevenue\b/.test(text)
  if (metric === "total") return /\brevenue\b/.test(text) && !/\bgrand total\b/.test(text)
  if (!metric)            return /\btax\b/.test(text)
  return false
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
      setTimeout(() => reject(new Error("Insights timeout")), 3500)
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
      case "treemap": {
        if (resolved.metric === 'both') {
          const revRows    = data.filter(r => (r as any).series === 'Revenue')
          const taxRows    = data.filter(r => (r as any).series === 'Tax Collected')
          const totalRev   = revRows.reduce((s, r) => s + Number(r.value), 0)
          const totalTax   = taxRows.reduce((s, r) => s + Number(r.value), 0)
          const ratio      = totalRev > 0 ? (totalTax / totalRev * 100).toFixed(1) : '0'
          const sortedRev  = [...revRows].sort((a, b) => Number(b.value) - Number(a.value))
          const topRev     = sortedRev[0]
          const lowestRev  = sortedRev[sortedRev.length - 1]
          const out = [`Tax collected is ${ratio}% of pre-tax revenue — ${fmt(totalTax, 'sum')} on ${fmt(totalRev, 'sum')}`]
          if (topRev) {
            const topTax = taxRows.find(r => r.name === topRev.name)
            const taxVal = topTax ? Number(topTax.value) : Number(topRev.value) * 0.15
            out.push(`${topRev.name} leads with ${fmt(Number(topRev.value), 'sum')} revenue and ${fmt(taxVal, 'sum')} tax`)
          }
          if (lowestRev && topRev && lowestRev.name !== topRev.name) {
            const lowestTax = taxRows.find(r => r.name === lowestRev.name)
            const lowestTaxVal = lowestTax ? Number(lowestTax.value) : 0
            out.push(`Lowest: ${lowestRev.name} at ${fmt(Number(lowestRev.value), 'sum')} revenue and ${fmt(lowestTaxVal, 'sum')} tax`)
          }
          return out
        }
        return barInsights(data, resolved, question);
      }

      case "pie":
      case "donut":
        return pieInsights(data, resolved);

      case "heatmap":
        if (geminiApiKey) {
          const ai = await geminiInsights(chartType, data, question, geminiApiKey, resolved).catch(() => []);
          if (ai.length > 0 && !mentionsWrongMetric(ai, resolved.metric)) return ai;
          return heatmapInsights(data, resolved);
        }
        return heatmapInsights(data, resolved);

      case "line": {
        // Dual-metric: separate Revenue and Tax Collected series from UNION query
        if (resolved.metric === 'both') {
          const revRows   = data.filter(r => (r as any).series === 'Revenue')
          const taxRows   = data.filter(r => (r as any).series === 'Tax Collected')
          const totalRev  = revRows.reduce((s, r) => s + Number(r.value), 0)
          const totalTax  = taxRows.reduce((s, r) => s + Number(r.value), 0)
          const peakRev   = [...revRows].sort((a, b) => Number(b.value) - Number(a.value))[0]
          const troughRev = [...revRows].sort((a, b) => Number(a.value) - Number(b.value))[0]
          const out: string[] = []
          if (peakRev && troughRev && peakRev.name !== troughRev.name) {
            const swing = Number(peakRev.value) - Number(troughRev.value)
            out.push(`Revenue peaks in ${peakRev.name} at ${fmt(Number(peakRev.value), 'sum')}, lowest in ${troughRev.name} at ${fmt(Number(troughRev.value), 'sum')} — ${fmt(swing, 'sum')} swing`)
          } else if (peakRev) {
            out.push(`Revenue peaks in ${peakRev.name} at ${fmt(Number(peakRev.value), 'sum')}`)
          }
          if (totalRev > 0) {
            out.push(`Period totals: ${fmt(totalRev, 'sum')} revenue — ${fmt(totalTax, 'sum')} tax collected`)
          }
          return out
        }

        // Multi-series top-N: { series, name, value } — group by series for total comparison
        const isMultiSeries = data.length > 0 && 'series' in data[0]
        if (isMultiSeries) {
          return multiSeriesLineInsights(data, resolved)
        }

        // Single-metric time-series: use Gemini for trend detection, barInsights as fallback
        const lineFallback = resolved.aggregation === "minmax"
          ? minmaxInsights(data)
          : barInsights(data, resolved, question);
        if (geminiApiKey) {
          const ai = await geminiInsights(chartType, data, question, geminiApiKey, resolved).catch(() => []);
          if (ai.length > 0 && !mentionsWrongMetric(ai, resolved.metric)) return ai;
          return lineFallback;
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
