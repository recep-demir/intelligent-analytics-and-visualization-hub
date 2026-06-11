import { ChartConfig, ChartType, GroupByValue, Filter } from '../../../shared/types/chart'
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
  filters:         Filter[]
  aggregation:     Aggregation
  limit:           number
  limitIsExplicit: boolean                  // true = user asked for top/bottom N; map/treemap respect it only then
  sortAsc:         boolean                  // true = ORDER BY ASC (lowest/worst queries)
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
// normalize — the single entry point.
// Transforms raw AI ChartConfig + original question into a ResolvedQuery
// the SQL builder can trust completely.
// ---------------------------------------------------------------------------
export function normalize(config: ChartConfig, question: string): ResolvedQuery {
  const rawGroupBy = config.groupBy as GroupByValue | undefined
  const { chartType, groupBy } = coerce(config.chartType, rawGroupBy)

  const resolved: ResolvedQuery = {
    chartType,
    groupBy,
    filters: config.filters ?? [],
    aggregation:     detectAggregation(question, config.aggregation),
    limit:           config.limit ?? 10,
    limitIsExplicit: config.limit !== undefined,
    sortAsc:         /\b(lowest|least|smallest|fewest|worst)\b/i.test(question),
  }

  if (chartType === 'heatmap') {
    resolved.groupBy2 = inferGroupBy2(question)
  }

  return resolved
}
