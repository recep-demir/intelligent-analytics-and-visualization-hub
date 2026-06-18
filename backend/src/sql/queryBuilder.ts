import { ResolvedQuery } from '../ai/normalizer'
import { Filter } from '../../../shared/types/chart'
import { buildAggregateExpression } from '../analytics/aggregation'

// ---------------------------------------------------------------------------
// Field → SQL expression mapping.
// Filters reference logical field names; this maps them to real SQL.
// ---------------------------------------------------------------------------
const FIELD_SQL: Record<string, string> = {
  year:     "strftime('%Y', o.createdAt)",
  month:    "strftime('%m', o.createdAt)",
  province: 'a.province',
  // LOWER() matches the dashboard's equivalent filter (LOWER(a.country) = 'ca') — the
  // injected default value is always lowercase, but this guards against mixed-case data
  // ever causing the AI Assistant and dashboard to silently diverge again.
  country:  'LOWER(a.country)',
  status:   'o.status',
  tax:      'o.tax',
  subtotal: 'o.subtotal',
}

const MONTH_CASE = `CASE strftime('%m', o.createdAt)
  WHEN '01' THEN 'Jan' WHEN '02' THEN 'Feb' WHEN '03' THEN 'Mar'
  WHEN '04' THEN 'Apr' WHEN '05' THEN 'May' WHEN '06' THEN 'Jun'
  WHEN '07' THEN 'Jul' WHEN '08' THEN 'Aug' WHEN '09' THEN 'Sep'
  WHEN '10' THEN 'Oct' WHEN '11' THEN 'Nov' WHEN '12' THEN 'Dec'
END`

export interface BuiltQuery {
  sql:          string
  replacements: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// buildWhereClause — translates filters[] into SQL WHERE + replacements.
// Requires the Orders+Addresses JOIN to already be in the FROM clause.
// ---------------------------------------------------------------------------
function buildWhereClause(filters: Filter[]): { where: string; replacements: Record<string, unknown> } {
  const conditions: string[] = []
  const replacements: Record<string, unknown> = {}

  // Group eq filters by field — multiple values on the same field become IN (…)
  // instead of field = A AND field = B which always returns empty.
  const eqGroups: Record<string, string[]> = {}
  const nonEq: Filter[] = []

  filters.forEach(f => {
    if (f.operator === 'eq') {
      if (!eqGroups[f.field]) eqGroups[f.field] = []
      eqGroups[f.field].push(f.value)
    } else {
      nonEq.push(f)
    }
  })

  Object.entries(eqGroups).forEach(([field, values]) => {
    const col = FIELD_SQL[field]
    if (!col) return
    if (values.length === 1) {
      const key = `eq_${field}_0`
      conditions.push(`${col} = :${key}`)
      replacements[key] = values[0]
    } else {
      values.forEach((v, i) => { replacements[`eq_${field}_${i}`] = v })
      const keys = values.map((_, i) => `:eq_${field}_${i}`).join(', ')
      conditions.push(`${col} IN (${keys})`)
    }
  })

  nonEq.forEach((f, i) => {
    const col = FIELD_SQL[f.field]
    if (!col) return
    const key = `f${i}`
    switch (f.operator) {
      case 'gt':       conditions.push(`${col} > :${key}`);    replacements[key] = f.value; break
      case 'lt':       conditions.push(`${col} < :${key}`);    replacements[key] = f.value; break
      case 'gte':      conditions.push(`${col} >= :${key}`);   replacements[key] = f.value; break
      case 'lte':      conditions.push(`${col} <= :${key}`);   replacements[key] = f.value; break
      case 'contains': conditions.push(`${col} LIKE :${key}`); replacements[key] = `%${f.value}%`; break
    }
  })

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    replacements,
  }
}

// ---------------------------------------------------------------------------
// orderMetricExpr — maps q.metric to the correct Orders SQL column.
// Item-level queries (product / category) use oi.price * oi.quantity regardless.
// ---------------------------------------------------------------------------
// Schema note: o.tax = tax RATE (e.g. 0.15), o.total = tax AMOUNT in dollars (subtotal × rate).
// "total" metric = grand total charged = subtotal + tax amount.
const METRIC_SQL: Record<string, string> = {
  subtotal: 'o.subtotal',
  revenue:  'o.subtotal',
  tax:      'o.total',               // tax amount in dollars
  total:    'o.subtotal + o.total',  // grand total charged to customer
}

function orderMetricExpr(q: ResolvedQuery): string {
  return METRIC_SQL[q.metric ?? 'subtotal'] ?? 'o.subtotal'
}

// ---------------------------------------------------------------------------
// buildCount — returns COUNT(*) of orders matching the same filters.
// Always uses Orders+Addresses join so it counts orders, not items/rows.
// ---------------------------------------------------------------------------
export function buildCount(q: ResolvedQuery): BuiltQuery {
  const { where, replacements } = buildWhereClause(q.filters)
  return {
    sql: `SELECT COUNT(*) AS total FROM Orders o LEFT JOIN Addresses a ON o.addressId = a.id ${where}`.trim(),
    replacements,
  }
}

// ---------------------------------------------------------------------------
// appendWhere — combines an existing "WHERE ..." clause with an extra condition.
// ---------------------------------------------------------------------------
function appendWhere(base: string, extra: string): string {
  if (!extra) return base
  if (!base)  return `WHERE ${extra}`
  return `${base} AND ${extra}`
}

// ---------------------------------------------------------------------------
// buildRankQuery — Step 1 of top-N series line.
// Finds the top/bottom N items for the series dimension.
// ---------------------------------------------------------------------------
export function buildRankQuery(q: ResolvedQuery): BuiltQuery {
  const { where, replacements } = buildWhereClause(q.filters)
  const ord = q.sortAsc ? 'ASC' : 'DESC'
  const aggExpr = buildAggregateExpression(q.aggregation, orderMetricExpr(q))
  const aggExprItem = buildAggregateExpression(q.aggregation, 'oi.price * oi.quantity')

  switch (q.seriesKey) {
    case 'product':
      return {
        sql: `
          SELECT p.name AS name, ${aggExprItem} AS value
          FROM OrderItems oi
          JOIN Orders o ON oi.orderId = o.id
          LEFT JOIN Addresses a ON o.addressId = a.id
          JOIN Products p ON oi.productId = p.id
          ${where}
          GROUP BY p.name ORDER BY value ${ord} LIMIT :limit
        `.trim(),
        replacements: { ...replacements, limit: q.limit },
      }

    case 'productGroup':
      return {
        sql: `
          SELECT pg.name AS name, ${aggExprItem} AS value
          FROM OrderItems oi
          JOIN Orders o ON oi.orderId = o.id
          LEFT JOIN Addresses a ON o.addressId = a.id
          JOIN Products p ON oi.productId = p.id
          JOIN ProductGroups pg ON p.groupId = pg.id
          ${where}
          GROUP BY pg.name ORDER BY value ${ord} LIMIT :limit
        `.trim(),
        replacements: { ...replacements, limit: q.limit },
      }

    case 'category':
      return {
        sql: `
          SELECT pc.name AS name, ${aggExprItem} AS value
          FROM OrderItems oi
          JOIN Orders o ON oi.orderId = o.id
          LEFT JOIN Addresses a ON o.addressId = a.id
          JOIN Products p ON oi.productId = p.id
          JOIN ProductGroupCategories pgc ON p.groupId = pgc.groupId
          JOIN ProductCategories pc ON pgc.categoryId = pc.id
          ${where}
          GROUP BY pc.name ORDER BY value ${ord} LIMIT :limit
        `.trim(),
        replacements: { ...replacements, limit: q.limit },
      }

    case 'province':
      return {
        sql: `
          SELECT a.province AS name, ${aggExpr} AS value
          FROM Orders o
          LEFT JOIN Addresses a ON o.addressId = a.id
          ${where}
          GROUP BY a.province ORDER BY value ${ord} LIMIT :limit
        `.trim(),
        replacements: { ...replacements, limit: q.limit },
      }

    default: // status
      return {
        sql: `
          SELECT o.status AS name, ${aggExpr} AS value
          FROM Orders o
          LEFT JOIN Addresses a ON o.addressId = a.id
          ${where}
          GROUP BY o.status ORDER BY value ${ord} LIMIT :limit
        `.trim(),
        replacements: { ...replacements, limit: q.limit },
      }
  }
}

// ---------------------------------------------------------------------------
// buildTopNSeriesQuery — Step 2 of top-N series line.
// Returns monthly or yearly data per ranked item.
// topNames is the result of buildRankQuery — the items to show as separate lines.
// ---------------------------------------------------------------------------
export function buildTopNSeriesQuery(q: ResolvedQuery, topNames: string[]): BuiltQuery {
  const byMonth  = q.groupBy !== 'year'
  const timeExpr = byMonth ? `strftime('%m', o.createdAt)` : `strftime('%Y', o.createdAt)`
  const timeAlias = byMonth ? 'month' : 'year'
  const nameExpr  = byMonth ? MONTH_CASE : `strftime('%Y', o.createdAt)`

  const { where: baseWhere, replacements: baseReplacements } = buildWhereClause(q.filters)

  const nameReplacements: Record<string, unknown> = {}
  topNames.forEach((n, i) => { nameReplacements[`topN_${i}`] = n })
  const inList = topNames.map((_, i) => `:topN_${i}`).join(', ')

  switch (q.seriesKey) {
    case 'product': {
      const nameFilter = topNames.length ? `p.name IN (${inList})` : ''
      return {
        sql: `
          SELECT p.name AS series,
                 ${timeExpr} AS ${timeAlias},
                 ${nameExpr} AS name,
                 ${buildAggregateExpression(q.aggregation, 'oi.price * oi.quantity')} AS value
          FROM OrderItems oi
          JOIN Orders o ON oi.orderId = o.id
          LEFT JOIN Addresses a ON o.addressId = a.id
          JOIN Products p ON oi.productId = p.id
          ${appendWhere(baseWhere, nameFilter)}
          GROUP BY series, ${timeAlias} ORDER BY series, ${timeAlias}
        `.trim(),
        replacements: { ...baseReplacements, ...nameReplacements },
      }
    }

    case 'productGroup': {
      const nameFilter = topNames.length ? `pg.name IN (${inList})` : ''
      return {
        sql: `
          SELECT pg.name AS series,
                 ${timeExpr} AS ${timeAlias},
                 ${nameExpr} AS name,
                 ${buildAggregateExpression(q.aggregation, 'oi.price * oi.quantity')} AS value
          FROM OrderItems oi
          JOIN Orders o ON oi.orderId = o.id
          LEFT JOIN Addresses a ON o.addressId = a.id
          JOIN Products p ON oi.productId = p.id
          JOIN ProductGroups pg ON p.groupId = pg.id
          ${appendWhere(baseWhere, nameFilter)}
          GROUP BY series, ${timeAlias} ORDER BY series, ${timeAlias}
        `.trim(),
        replacements: { ...baseReplacements, ...nameReplacements },
      }
    }

    case 'category': {
      const nameFilter = topNames.length ? `pc.name IN (${inList})` : ''
      return {
        sql: `
          SELECT pc.name AS series,
                 ${timeExpr} AS ${timeAlias},
                 ${nameExpr} AS name,
                 ${buildAggregateExpression(q.aggregation, 'oi.price * oi.quantity')} AS value
          FROM OrderItems oi
          JOIN Orders o ON oi.orderId = o.id
          LEFT JOIN Addresses a ON o.addressId = a.id
          JOIN Products p ON oi.productId = p.id
          JOIN ProductGroupCategories pgc ON p.groupId = pgc.groupId
          JOIN ProductCategories pc ON pgc.categoryId = pc.id
          ${appendWhere(baseWhere, nameFilter)}
          GROUP BY series, ${timeAlias} ORDER BY series, ${timeAlias}
        `.trim(),
        replacements: { ...baseReplacements, ...nameReplacements },
      }
    }

    case 'province': {
      const nameFilter = topNames.length ? `a.province IN (${inList})` : ''
      return {
        sql: `
          SELECT a.province AS series,
                 ${timeExpr} AS ${timeAlias},
                 ${nameExpr} AS name,
                 ${buildAggregateExpression(q.aggregation, orderMetricExpr(q))} AS value
          FROM Orders o
          LEFT JOIN Addresses a ON o.addressId = a.id
          ${appendWhere(baseWhere, nameFilter)}
          GROUP BY series, ${timeAlias} ORDER BY series, ${timeAlias}
        `.trim(),
        replacements: { ...baseReplacements, ...nameReplacements },
      }
    }

    default: { // status
      const nameFilter = topNames.length ? `o.status IN (${inList})` : ''
      return {
        sql: `
          SELECT o.status AS series,
                 ${timeExpr} AS ${timeAlias},
                 ${nameExpr} AS name,
                 ${buildAggregateExpression(q.aggregation, orderMetricExpr(q))} AS value
          FROM Orders o
          LEFT JOIN Addresses a ON o.addressId = a.id
          ${appendWhere(baseWhere, nameFilter)}
          GROUP BY series, ${timeAlias} ORDER BY series, ${timeAlias}
        `.trim(),
        replacements: { ...baseReplacements, ...nameReplacements },
      }
    }
  }
}

// ---------------------------------------------------------------------------
// buildBothMetricsQuery — UNION ALL of revenue + tax collected.
// Used when metric === 'both'. Returns {series, name, value} rows.
// Item-level groupBy (product/productGroup/category) falls back to province.
// ---------------------------------------------------------------------------
function buildBothMetricsQuery(q: ResolvedQuery): BuiltQuery {
  const { where, replacements } = buildWhereClause(q.filters)
  const aggRev = buildAggregateExpression(q.aggregation, 'o.subtotal')
  const aggTax = buildAggregateExpression(q.aggregation, 'o.total')
  const from   = 'FROM Orders o LEFT JOIN Addresses a ON o.addressId = a.id'

  // Stat / pie / donut — two named summary rows, no grouping dimension
  // Pie/donut renders them as two proportional slices (Revenue vs Tax share of gross).
  if (q.chartType === 'stat' || q.chartType === 'pie' || q.chartType === 'donut' || q.groupBy === 'total') {
    return {
      sql: `
        SELECT 'Revenue' AS name, ${aggRev} AS value ${from} ${where}
        UNION ALL
        SELECT 'Tax Collected' AS name, ${aggTax} AS value ${from} ${where}
      `.trim(),
      replacements,
    }
  }

  // Line — time series with sort key for correct chronological ordering
  if (q.chartType === 'line') {
    const byMonth  = q.groupBy !== 'year'
    const sortExpr = byMonth ? "strftime('%m', o.createdAt)" : "strftime('%Y', o.createdAt)"
    const nameExpr = byMonth ? MONTH_CASE : "strftime('%Y', o.createdAt)"
    return {
      sql: `
        SELECT 'Revenue' AS series, ${sortExpr} AS sort_key, ${nameExpr} AS name, ${aggRev} AS value
        ${from} ${where} GROUP BY sort_key
        UNION ALL
        SELECT 'Tax Collected' AS series, ${sortExpr} AS sort_key, ${nameExpr} AS name, ${aggTax} AS value
        ${from} ${where} GROUP BY sort_key
        ORDER BY sort_key, series
      `.trim(),
      replacements,
    }
  }

  // Item-level dimensions (category / productGroup / product) require OrderItems JOIN.
  // Revenue = item price × qty; tax = item price × qty × tax rate (o.tax = rate, always 0.15).
  const itemBase = `FROM OrderItems oi JOIN Orders o ON oi.orderId = o.id LEFT JOIN Addresses a ON o.addressId = a.id JOIN Products p ON oi.productId = p.id`
  const aggRevItem = buildAggregateExpression(q.aggregation, 'oi.price * oi.quantity')
  const aggTaxItem = buildAggregateExpression(q.aggregation, 'oi.price * oi.quantity * o.tax')

  if (q.groupBy === 'category') {
    const catFrom = `${itemBase} JOIN ProductGroupCategories pgc ON p.groupId = pgc.groupId JOIN ProductCategories pc ON pgc.categoryId = pc.id`
    if (q.limitIsExplicit) {
      const ord = q.sortAsc ? 'ASC' : 'DESC'
      const whereRanked = appendWhere(where, `pc.name IN (SELECT name FROM ranked)`)
      return {
        sql: `
          WITH ranked AS (
            SELECT pc.name AS name ${catFrom} ${where} GROUP BY pc.name ORDER BY ${aggRevItem} ${ord} LIMIT ${q.limit}
          )
          SELECT 'Revenue' AS series, pc.name AS name, ${aggRevItem} AS value ${catFrom} ${whereRanked} GROUP BY pc.name
          UNION ALL
          SELECT 'Tax Collected' AS series, pc.name AS name, ${aggTaxItem} AS value ${catFrom} ${whereRanked} GROUP BY pc.name
          ORDER BY name, series
        `.trim(),
        replacements,
      }
    }
    return {
      sql: `
        SELECT 'Revenue' AS series, pc.name AS name, ${aggRevItem} AS value ${catFrom} ${where} GROUP BY pc.name
        UNION ALL
        SELECT 'Tax Collected' AS series, pc.name AS name, ${aggTaxItem} AS value ${catFrom} ${where} GROUP BY pc.name
        ORDER BY name, series
      `.trim(),
      replacements,
    }
  }

  if (q.groupBy === 'productGroup') {
    const pgFrom = `${itemBase} JOIN ProductGroups pg ON p.groupId = pg.id`
    if (q.limitIsExplicit) {
      const ord = q.sortAsc ? 'ASC' : 'DESC'
      const whereRanked = appendWhere(where, `pg.name IN (SELECT name FROM ranked)`)
      return {
        sql: `
          WITH ranked AS (
            SELECT pg.name AS name ${pgFrom} ${where} GROUP BY pg.name ORDER BY ${aggRevItem} ${ord} LIMIT ${q.limit}
          )
          SELECT 'Revenue' AS series, pg.name AS name, ${aggRevItem} AS value ${pgFrom} ${whereRanked} GROUP BY pg.name
          UNION ALL
          SELECT 'Tax Collected' AS series, pg.name AS name, ${aggTaxItem} AS value ${pgFrom} ${whereRanked} GROUP BY pg.name
          ORDER BY name, series
        `.trim(),
        replacements,
      }
    }
    return {
      sql: `
        SELECT 'Revenue' AS series, pg.name AS name, ${aggRevItem} AS value ${pgFrom} ${where} GROUP BY pg.name
        UNION ALL
        SELECT 'Tax Collected' AS series, pg.name AS name, ${aggTaxItem} AS value ${pgFrom} ${where} GROUP BY pg.name
        ORDER BY name, series
      `.trim(),
      replacements,
    }
  }

  if (q.groupBy === 'product') {
    if (q.limitIsExplicit) {
      const ord = q.sortAsc ? 'ASC' : 'DESC'
      const whereRanked = appendWhere(where, `p.name IN (SELECT name FROM ranked)`)
      return {
        sql: `
          WITH ranked AS (
            SELECT p.name AS name ${itemBase} ${where} GROUP BY p.name ORDER BY ${aggRevItem} ${ord} LIMIT ${q.limit}
          )
          SELECT 'Revenue' AS series, p.name AS name, ${aggRevItem} AS value ${itemBase} ${whereRanked} GROUP BY p.name
          UNION ALL
          SELECT 'Tax Collected' AS series, p.name AS name, ${aggTaxItem} AS value ${itemBase} ${whereRanked} GROUP BY p.name
          ORDER BY name, series
        `.trim(),
        replacements,
      }
    }
    return {
      sql: `
        SELECT 'Revenue' AS series, p.name AS name, ${aggRevItem} AS value ${itemBase} ${where} GROUP BY p.name
        UNION ALL
        SELECT 'Tax Collected' AS series, p.name AS name, ${aggTaxItem} AS value ${itemBase} ${where} GROUP BY p.name
        ORDER BY name, series
      `.trim(),
      replacements,
    }
  }

  // Order-level categorical groupBy (status, year, month, province)
  let nameExpr: string
  let groupExpr: string
  let joinExpr: string | undefined
  switch (q.groupBy) {
    case 'status':
      nameExpr = 'o.status'; groupExpr = 'o.status'; joinExpr = 'o.status'; break
    case 'year':
      nameExpr = "strftime('%Y', o.createdAt)"; groupExpr = nameExpr; joinExpr = nameExpr; break
    case 'month':
      nameExpr = MONTH_CASE; groupExpr = "strftime('%m', o.createdAt)"; joinExpr = undefined; break
    default:
      nameExpr = 'a.province'; groupExpr = 'a.province'; joinExpr = 'a.province'
  }

  // When an explicit top/bottom N is requested, use a CTE to rank names by revenue first,
  // then show both metrics only for those N names.
  if (q.limitIsExplicit && joinExpr) {
    const ord = q.sortAsc ? 'ASC' : 'DESC'
    const whereRanked = appendWhere(where, `${joinExpr} IN (SELECT name FROM ranked)`)
    return {
      sql: `
        WITH ranked AS (
          SELECT ${nameExpr} AS name
          ${from} ${where}
          GROUP BY ${groupExpr}
          ORDER BY ${aggRev} ${ord}
          LIMIT ${q.limit}
        )
        SELECT 'Revenue' AS series, ${nameExpr} AS name, ${aggRev} AS value
        ${from} ${whereRanked} GROUP BY ${groupExpr}
        UNION ALL
        SELECT 'Tax Collected' AS series, ${nameExpr} AS name, ${aggTax} AS value
        ${from} ${whereRanked} GROUP BY ${groupExpr}
        ORDER BY name, series
      `.trim(),
      replacements,
    }
  }

  return {
    sql: `
      SELECT 'Revenue' AS series, ${nameExpr} AS name, ${aggRev} AS value
      ${from} ${where} GROUP BY ${groupExpr}
      UNION ALL
      SELECT 'Tax Collected' AS series, ${nameExpr} AS name, ${aggTax} AS value
      ${from} ${where} GROUP BY ${groupExpr}
      ORDER BY name, series
    `.trim(),
    replacements,
  }
}

// ---------------------------------------------------------------------------
// build — the single public entry point.
// Accepts only ResolvedQuery — normalization is structurally mandatory.
// ---------------------------------------------------------------------------
export function build(q: ResolvedQuery): BuiltQuery {
  // Grid lists raw order rows and already includes subtotal (revenue) + total (tax) as
  // separate columns regardless of metric — it never aggregates, so 'both' doesn't apply.
  if (q.metric === 'both' && q.chartType !== 'grid') return buildBothMetricsQuery(q)

  const aggExpr = buildAggregateExpression(q.aggregation, orderMetricExpr(q))
  const { where, replacements } = buildWhereClause(q.filters)
  const limit = q.limit
  const ord = q.sortAsc ? 'ASC' : 'DESC'

  switch (q.chartType) {

    // ── line ──────────────────────────────────────────────────────────────
    case 'line': {
      const byMonth = q.groupBy === 'month'

      // Multi-series: 2+ values of the same dimension compared over time
      if (q.seriesKey) {
        const seriesSQL = q.seriesKey === 'status' ? 'o.status' : 'a.province'
        if (byMonth) {
          return {
            sql: `
              SELECT ${seriesSQL} AS series,
                     strftime('%m', o.createdAt) AS month,
                     ${MONTH_CASE} AS name,
                     ${aggExpr} AS value
              FROM Orders o
              LEFT JOIN Addresses a ON o.addressId = a.id
              ${where}
              GROUP BY series, month ORDER BY series, month
            `.trim(),
            replacements,
          }
        }
        return {
          sql: `
            SELECT ${seriesSQL} AS series,
                   strftime('%Y', o.createdAt) AS year,
                   strftime('%Y', o.createdAt) AS name,
                   ${aggExpr} AS value
            FROM Orders o
            LEFT JOIN Addresses a ON o.addressId = a.id
            ${where}
            GROUP BY series, year ORDER BY series, year
          `.trim(),
          replacements,
        }
      }

      // Dual-series: return both MIN and MAX columns
      if (q.aggregation === 'minmax') {
        const groupExpr = byMonth ? "strftime('%m', o.createdAt)" : "strftime('%Y', o.createdAt)"
        const groupAlias = byMonth ? 'month' : 'year'
        const nameExpr   = byMonth ? MONTH_CASE : "strftime('%Y', o.createdAt)"
        return {
          sql: `
            SELECT ${groupExpr} AS ${groupAlias},
                   ${nameExpr} AS name,
                   ROUND(MIN(${orderMetricExpr(q)}), 2) AS min,
                   ROUND(MAX(${orderMetricExpr(q)}), 2) AS max
            FROM Orders o
            LEFT JOIN Addresses a ON o.addressId = a.id
            ${where}
            GROUP BY ${groupAlias} ORDER BY ${groupAlias}
          `.trim(),
          replacements,
        }
      }

      if (byMonth) {
        return {
          sql: `
            SELECT strftime('%m', o.createdAt) AS month,
                   ${MONTH_CASE} AS name,
                   ${aggExpr} AS value
            FROM Orders o
            LEFT JOIN Addresses a ON o.addressId = a.id
            ${where}
            GROUP BY month ORDER BY month
          `.trim(),
          replacements,
        }
      }
      return {
        sql: `
          SELECT strftime('%Y', o.createdAt) AS year,
                 strftime('%Y', o.createdAt) AS name,
                 ${aggExpr} AS value
          FROM Orders o
          LEFT JOIN Addresses a ON o.addressId = a.id
          ${where}
          GROUP BY year ORDER BY year
        `.trim(),
        replacements,
      }
    }

    // ── stat ───────────────────────────────────────────────────────────────
    case 'stat': {
      return {
        sql: `
          SELECT ${aggExpr} AS value
          FROM Orders o
          LEFT JOIN Addresses a ON o.addressId = a.id
          ${where}
        `.trim(),
        replacements,
      }
    }

    // ── grid ───────────────────────────────────────────────────────────────
    case 'grid': {
      return {
        sql: `
          SELECT o.id, o.status, o.tax, o.subtotal, o.total,
                 o.createdAt, a.province, a.city
          FROM Orders o
          LEFT JOIN Addresses a ON o.addressId = a.id
          ${where}
          ORDER BY o.createdAt DESC
          LIMIT :limit
        `.trim(),
        replacements: { ...replacements, limit },
      }
    }

    // ── heatmap ────────────────────────────────────────────────────────────
    case 'heatmap': {
      const dim2Expr  = q.groupBy2 === 'year' ? "strftime('%Y', o.createdAt)" : "strftime('%m', o.createdAt)"
      const dim2Label = q.groupBy2 === 'year' ? 'year' : 'month'

      // First dimension: what are the rows?
      let dim1Expr: string
      let extraJoin  = ''
      let fromClause = `FROM Orders o LEFT JOIN Addresses a ON o.addressId = a.id`
      let heatAgg    = aggExpr

      switch (q.groupBy) {
        case 'category':
          dim1Expr   = 'pc.name AS category'
          fromClause = `FROM OrderItems oi JOIN Orders o ON oi.orderId = o.id LEFT JOIN Addresses a ON o.addressId = a.id JOIN Products p ON oi.productId = p.id JOIN ProductGroupCategories pgc ON p.groupId = pgc.groupId JOIN ProductCategories pc ON pgc.categoryId = pc.id`
          heatAgg    = buildAggregateExpression(q.aggregation, 'oi.price * oi.quantity')
          break
        case 'productGroup':
          dim1Expr   = 'pg.name AS productGroup'
          fromClause = `FROM OrderItems oi JOIN Orders o ON oi.orderId = o.id LEFT JOIN Addresses a ON o.addressId = a.id JOIN Products p ON oi.productId = p.id JOIN ProductGroups pg ON p.groupId = pg.id`
          heatAgg    = buildAggregateExpression(q.aggregation, 'oi.price * oi.quantity')
          break
        case 'status':
          dim1Expr = 'o.status AS status'
          break
        default: // province
          dim1Expr = 'a.province AS province'
      }

      const dim1Col = dim1Expr.split(' AS ')[1]  // the alias: province / category / status / productGroup
      return {
        sql: `
          SELECT ${dim1Expr},
                 ${dim2Expr} AS ${dim2Label},
                 ${heatAgg}  AS value
          ${fromClause}
          ${extraJoin}
          ${where}
          GROUP BY ${dim1Col}, ${dim2Expr}
          ORDER BY ${dim1Col}, ${dim2Expr}
        `.trim(),
        replacements,
      }
    }

    // ── map / bar / treemap / pie / donut — grouped queries ───────────────
    default: {
      switch (q.groupBy) {

        case 'month':
          return {
            sql: `
              SELECT strftime('%m', o.createdAt) AS month,
                     ${MONTH_CASE} AS name,
                     ${aggExpr} AS value
              FROM Orders o
              LEFT JOIN Addresses a ON o.addressId = a.id
              ${where}
              GROUP BY month ORDER BY month
            `.trim(),
            replacements,
          }

        case 'year':
          return {
            sql: `
              SELECT strftime('%Y', o.createdAt) AS year,
                     strftime('%Y', o.createdAt) AS name,
                     ${aggExpr} AS value
              FROM Orders o
              LEFT JOIN Addresses a ON o.addressId = a.id
              ${where}
              GROUP BY year ORDER BY value ${ord} LIMIT :limit
            `.trim(),
            replacements: { ...replacements, limit },
          }

        case 'status':
          return {
            sql: `
              SELECT o.status AS name, ${aggExpr} AS value
              FROM Orders o
              LEFT JOIN Addresses a ON o.addressId = a.id
              ${where}
              GROUP BY o.status ORDER BY value ${ord}
            `.trim(),
            replacements,
          }

        case 'category':
          return {
            sql: `
              SELECT pc.name AS name, ${buildAggregateExpression(q.aggregation, 'oi.price * oi.quantity')} AS value
              FROM OrderItems oi
              JOIN Orders o ON oi.orderId = o.id
              LEFT JOIN Addresses a ON o.addressId = a.id
              JOIN Products p ON oi.productId = p.id
              JOIN ProductGroupCategories pgc ON p.groupId = pgc.groupId
              JOIN ProductCategories pc ON pgc.categoryId = pc.id
              ${where}
              GROUP BY pc.name ORDER BY value ${ord} LIMIT :limit
            `.trim(),
            replacements: { ...replacements, limit },
          }

        case 'productGroup':
          return {
            sql: `
              SELECT pg.name AS name, ${buildAggregateExpression(q.aggregation, 'oi.price * oi.quantity')} AS value
              FROM OrderItems oi
              JOIN Orders o ON oi.orderId = o.id
              LEFT JOIN Addresses a ON o.addressId = a.id
              JOIN Products p ON oi.productId = p.id
              JOIN ProductGroups pg ON p.groupId = pg.id
              ${where}
              GROUP BY pg.name ORDER BY value ${ord} LIMIT :limit
            `.trim(),
            replacements: { ...replacements, limit },
          }

        case 'product':
          return {
            sql: `
              SELECT p.name AS name, ${buildAggregateExpression(q.aggregation, 'oi.price * oi.quantity')} AS value
              FROM OrderItems oi
              JOIN Orders o ON oi.orderId = o.id
              LEFT JOIN Addresses a ON o.addressId = a.id
              JOIN Products p ON oi.productId = p.id
              ${where}
              GROUP BY p.name ORDER BY value ${ord} LIMIT :limit
            `.trim(),
            replacements: { ...replacements, limit },
          }

        // province (default) — map/treemap return all provinces unless user asked for top N
        default: {
          const applyLimit = q.limitIsExplicit || (q.chartType !== 'map' && q.chartType !== 'treemap')
          return applyLimit
            ? {
                sql: `
                  SELECT a.province AS name, ${aggExpr} AS value
                  FROM Orders o
                  JOIN Addresses a ON o.addressId = a.id
                  ${where}
                  GROUP BY a.province ORDER BY value ${ord} LIMIT :limit
                `.trim(),
                replacements: { ...replacements, limit },
              }
            : {
                sql: `
                  SELECT a.province AS name, ${aggExpr} AS value
                  FROM Orders o
                  JOIN Addresses a ON o.addressId = a.id
                  ${where}
                  GROUP BY a.province ORDER BY value ${ord}
                `.trim(),
                replacements,
              }
        }
      }
    }
  }
}
