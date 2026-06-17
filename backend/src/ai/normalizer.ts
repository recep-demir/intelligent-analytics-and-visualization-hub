import { ChartConfig, ChartType, GroupByValue, Filter, Metric } from '../../../shared/types/chart'
import { Aggregation, detectAggregation } from '../analytics/aggregation'

// ---------------------------------------------------------------------------
// ResolvedQuery — internal SQL contract.
// Never crosses the wire. Only the SQL builder accepts this type,
// which makes normalization structurally mandatory.
// ---------------------------------------------------------------------------
export interface ResolvedQuery {
  chartType:       ChartType
  groupBy:         GroupByValue | undefined
  groupBy2?:       GroupByValue              // heatmap second dimension only
  seriesKey?:      string                    // multi-series line: field to split into separate lines
  metric?:         Metric                    // which Orders money field to aggregate (undefined = subtotal)
  filters:         Filter[]
  aggregation:     Aggregation
  limit:           number
  limitIsExplicit: boolean
  sortAsc:         boolean
}

// ---------------------------------------------------------------------------
// Q1 — valid groupBy values per chartType.
// Any value outside this set is coerced before reaching the SQL builder.
// ---------------------------------------------------------------------------
const GROUPBY_RULES: Record<ChartType, GroupByValue[]> = {
  line:    ['year', 'month'],
  bar:     ['province', 'year', 'month', 'status', 'category', 'productGroup', 'product'],
  treemap: ['province', 'status', 'category', 'productGroup', 'product'],
  pie:     ['status', 'province', 'category', 'productGroup'],
  donut:   ['status', 'province', 'category', 'productGroup'],
  map:     ['province'],
  heatmap: ['province', 'status', 'category', 'productGroup'],
  stat:    ['total'],
  grid:    [],
}

function coerce(chartType: ChartType, groupBy: GroupByValue | undefined): {
  chartType: ChartType
  groupBy:   GroupByValue | undefined
} {
  // 'none' is a deliberate "unrecognised query" signal — propagate it untouched
  if (groupBy === 'none') return { chartType, groupBy: 'none' }

  if (groupBy === undefined) {
    if (chartType === 'stat')    return { chartType,                groupBy: 'total'    }
    if (chartType === 'grid')    return { chartType,                groupBy: undefined  }
    if (chartType === 'map')     return { chartType: 'map',         groupBy: 'province' }
    if (chartType === 'bar')     return { chartType: 'bar',         groupBy: 'province' }
    if (chartType === 'pie')     return { chartType: 'pie',         groupBy: 'status'   }
    if (chartType === 'donut')   return { chartType: 'donut',       groupBy: 'status'   }
    if (chartType === 'line')    return { chartType: 'line',        groupBy: 'month'    }
    if (chartType === 'heatmap') return { chartType: 'heatmap',     groupBy: 'province' }
    // treemap is the default fallback — no explicit chart type was requested
    return { chartType: 'treemap', groupBy: 'province' }
  }

  const valid = GROUPBY_RULES[chartType]

  if (valid.length === 0) return { chartType, groupBy: undefined }

  if (valid.includes(groupBy)) return { chartType, groupBy }

  // Special case: line with a non-temporal groupBy falls back to bar (keeps the groupBy)
  if (chartType === 'line') return { chartType: 'bar', groupBy }

  // General rule: keep the chartType, use its first valid groupBy
  return { chartType, groupBy: valid[0] }
}

// ---------------------------------------------------------------------------
// Q2 — heatmap second dimension inferred from the question.
// groupBy2 is not part of ChartConfig — it lives only in ResolvedQuery.
// ---------------------------------------------------------------------------
function inferGroupBy2(question: string): GroupByValue {
  const q = question.toLowerCase()
  if (/\b(year|yearly|annual|by year)\b/.test(q)) return 'year'
  // Two distinct years mentioned without a time-series keyword → columns should be years
  const years = [...new Set([...q.matchAll(/\b(20\d{2})\b/g)].map(m => m[1]))]
  if (years.length >= 2) return 'year'
  return 'month'
}

// ---------------------------------------------------------------------------
// Province alias map — normalises any variant Gemini or LocalEngine might emit
// to the exact string stored in the Addresses table.
// ---------------------------------------------------------------------------
const PROVINCE_CANONICAL: Record<string, string> = {
  // Full names (lowercase) → exact DB value (Title Case).
  // Required because Gemini may return lowercase province names.
  "ontario":              "Ontario",
  "british columbia":     "British Columbia",
  "alberta":              "Alberta",
  "manitoba":             "Manitoba",
  "saskatchewan":         "Saskatchewan",
  "nova scotia":          "Nova Scotia",
  "new brunswick":        "New Brunswick",
  "prince edward island": "Prince Edward Island",
  "yukon":                "Yukon",
  "quebec":               "Quebec",
  // Abbreviations and postal codes
  "bc": "British Columbia", "b.c.": "British Columbia",
  "ab": "Alberta",
  "sk": "Saskatchewan",
  "mb": "Manitoba",
  "on": "Ontario",
  "qc": "Quebec", "québec": "Quebec", "pq": "Quebec",
  "nb": "New Brunswick",
  "ns": "Nova Scotia",
  "pei": "Prince Edward Island", "p.e.i.": "Prince Edward Island",
  // Newfoundland and Labrador — all common variants
  "newfoundland and labrador": "Newfoundland and Labrador",
  "newfoundland & labrador":   "Newfoundland and Labrador",
  "newfoundland":              "Newfoundland and Labrador",
  "labrador":                  "Newfoundland and Labrador",
  "nl":                        "Newfoundland and Labrador",
  // Yukon
  "yt": "Yukon",
  // Northwest Territories
  "northwest territories": "Northwest Territories",
  "nwt": "Northwest Territories", "n.w.t.": "Northwest Territories",
  "nt":  "Northwest Territories",
  // Nunavut — including common misspellings
  "nunavut": "Nunavut", "nuvanut": "Nunavut", "nunavit": "Nunavut", "nu": "Nunavut",
}

function normalizeProvince(value: string): string {
  const key = value.toLowerCase().trim()
  return PROVINCE_CANONICAL[key] ?? value
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// detectMetric — resolves which Orders money field to aggregate.
// AI-provided value takes precedence; falls back to question-text scanning.
// ---------------------------------------------------------------------------
function detectMetric(question: string, configMetric?: string): Metric | undefined {
  const q = question.toLowerCase()

  // 'both' is checked from question text FIRST — Gemini consistently conflates
  // "revenue and taxes" with "grand total", so we override before trusting configMetric.
  // hasTax excludes compound nouns like "tax year" / "tax rate" to avoid false positives.
  const hasRevenue = /\b(revenue|subtotal|sales)\b/.test(q)
  const hasTax     = /\b(taxes|tax\s+(?:amount|collected|paid|revenue))\b/.test(q) ||
                     (/\btax\b/.test(q) && !/\btax\s+(?:year|rate|code|bracket)\b/.test(q))
  const hasJoin    = /\b(vs\.?|versus|alongside|compare|both|and)\b/.test(q)
  if (hasRevenue && hasTax && hasJoin) return 'both'

  // For 'tax': cross-check — if question explicitly says "revenue" but has no clear tax-metric
  // phrase, Gemini likely misread a compound like "tax year" as the metric. Override to default.
  if (configMetric === 'tax') {
    const explicitRevenue = /\b(revenue|subtotal|sales)\b/.test(q)
    const explicitTax     = /\b(taxes|tax\s+(?:amount|collected|paid|revenue))\b/.test(q)
    if (explicitRevenue && !explicitTax) return undefined
    return 'tax'
  }

  // For all other AI-provided metrics, trust them
  if (configMetric === 'total' || configMetric === 'subtotal' || configMetric === 'both') {
    return configMetric as Metric
  }

  if (hasTax) return 'tax'
  if (/\b(grand total|total amount|total charged|total bill|total paid|gross total)\b/.test(q)) return 'total'
  return undefined  // undefined → SQL builder defaults to o.subtotal
}

// Dimensions with a known small number of distinct values — no default LIMIT needed
const LOW_CARDINALITY: GroupByValue[] = ['province', 'status', 'month', 'year', 'total']

// normalize — the single entry point.
// Transforms raw AI ChartConfig + original question into a ResolvedQuery
// the SQL builder can trust completely.
// ---------------------------------------------------------------------------
export function normalize(config: ChartConfig, question: string): ResolvedQuery {
  const rawGroupBy = config.groupBy as GroupByValue | undefined

  // Normalize province filter values before multi-series detection
  const normalizedFilters = (config.filters ?? []).map(f =>
    f.field === 'province' ? { ...f, value: normalizeProvince(f.value) } : f
  )

  // Multi-series line detection — must run BEFORE coerce() so "line + province groupBy"
  // from Gemini doesn't get converted to bar when the intent is comparison over time.
  let seriesKey: string | undefined
  let adjustedGroupBy = rawGroupBy
  let overrideLimit: number | undefined   // set when question text implies top-N that AI missed

  if (config.chartType === 'line') {
    const eqByField: Record<string, string[]> = {}
    for (const f of normalizedFilters) {
      if (f.operator === 'eq' && f.field !== 'country') {
        eqByField[f.field] = eqByField[f.field] ?? []
        eqByField[f.field].push(f.value)
      }
    }

    const multiEntry = Object.entries(eqByField).find(([, vals]) => vals.length >= 2)
    if (multiEntry) {
      seriesKey = multiEntry[0]
      if (adjustedGroupBy && !['year', 'month'].includes(adjustedGroupBy)) {
        adjustedGroupBy = undefined
      }
    }

    // Top-N series detection — two paths depending on what the AI emitted:
    // Path A: AI correctly set groupBy to categorical dim + explicit limit
    //         e.g. Gemini → { groupBy: 'product', limit: 3 }
    // Path B: AI set groupBy to time dim (month) or omitted limit — fall back to question text
    //         e.g. Gemini → { groupBy: 'month' } for "top 3 products as a line monthly"
    const CATEGORICAL_SERIES_DIMS = ['product', 'productGroup', 'category', 'province', 'status']
    const hasYearHint = /\b(by year|yearly|annual|over the years|each year)\b/i.test(question)

    if (!seriesKey) {
      if (rawGroupBy && CATEGORICAL_SERIES_DIMS.includes(rawGroupBy) && config.limit != null) {
        // Path A
        seriesKey = rawGroupBy
        adjustedGroupBy = hasYearHint ? 'year' : undefined
      } else {
        // Path B — scan question for "top/best/highest N <dimension>"
        const m = question.match(
          /\b(?:top|best|highest|leading)\s+(\d+)\s+(products?\s+groups?|product\s+groups?|products?|categor(?:y|ies)|provinces?|statuses?)\b/i
        )
        if (m) {
          const n       = parseInt(m[1], 10)
          const dimWord = m[2].toLowerCase()
          if      (dimWord.includes('group'))     seriesKey = 'productGroup'
          else if (dimWord.startsWith('product')) seriesKey = 'product'
          else if (dimWord.startsWith('catego'))  seriesKey = 'category'
          else if (dimWord.startsWith('province')) seriesKey = 'province'
          else                                    seriesKey = 'status'
          overrideLimit = n
          // If Gemini set groupBy to the categorical dim, clear it so coerce gives 'month'
          if (adjustedGroupBy && CATEGORICAL_SERIES_DIMS.includes(adjustedGroupBy)) {
            adjustedGroupBy = hasYearHint ? 'year' : undefined
          }
        }
      }
    }
  }

  const { chartType, groupBy } = coerce(config.chartType, adjustedGroupBy)

  const filters = (() => {
    const hasCountry = normalizedFilters.some(f => f.field === 'country')
    return hasCountry
      ? normalizedFilters
      : [{ field: 'country' as const, operator: 'eq' as const, value: 'ca' }, ...normalizedFilters]
  })()

  const resolved: ResolvedQuery = {
    chartType,
    groupBy,
    filters,
    aggregation:     detectAggregation(question, config.aggregation),
    limit:           overrideLimit ?? config.limit ?? (chartType === 'grid' ? 100 : LOW_CARDINALITY.includes(groupBy as GroupByValue) ? 9999 : 10),
    limitIsExplicit: config.limit !== undefined || overrideLimit !== undefined,
    sortAsc:         /\b(lowest|least|smallest|fewest|worst)\b/i.test(question),
  }

  if (seriesKey) resolved.seriesKey = seriesKey

  const metric = detectMetric(question, config.metric)
  if (metric) {
    resolved.metric = metric

    if (metric === 'tax' || metric === 'both') {
      // Remove false status='paid' filter when "paid" modifies the tax noun, not an order status
      if (/\b(paid\s+tax(?:es)?|tax(?:es)?\s+paid)\b/i.test(question)) {
        resolved.filters = resolved.filters.filter(f => !(f.field === 'status' && f.value === 'paid'))
      }

      // Tax is only meaningful on completed orders (paid + shipped) — matches dashboard logic.
      // Only inject when the user hasn't explicitly filtered by status.
      const hasExplicitStatusFilter = resolved.filters.some(f => f.field === 'status')
      if (!hasExplicitStatusFilter) {
        resolved.filters = [
          ...resolved.filters,
          { field: 'status' as const, operator: 'eq' as const, value: 'paid' },
          { field: 'status' as const, operator: 'eq' as const, value: 'shipped' },
        ]
      }
    }
  }

  if (chartType === 'heatmap') {
    resolved.groupBy2 = inferGroupBy2(question)
  }

  // Treemap can't render dual-metric series — silently promote to bar
  if (resolved.metric === 'both' && resolved.chartType === 'treemap') {
    resolved.chartType = 'bar'
  }

  return resolved
}
