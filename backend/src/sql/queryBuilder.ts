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
  country:  'a.country',
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
// build — the single public entry point.
// Accepts only ResolvedQuery — normalization is structurally mandatory.
// ---------------------------------------------------------------------------
export function build(q: ResolvedQuery): BuiltQuery {
  const aggExpr = buildAggregateExpression(q.aggregation, 'o.subtotal')
  const { where, replacements } = buildWhereClause(q.filters)
  const limit = q.limit
  const ord = q.sortAsc ? 'ASC' : 'DESC'

  switch (q.chartType) {

    // ── line ──────────────────────────────────────────────────────────────
    case 'line': {
      const byMonth = q.groupBy === 'month'

      // Dual-series: return both MIN and MAX columns
      if (q.aggregation === 'minmax') {
        const groupExpr = byMonth ? "strftime('%m', o.createdAt)" : "strftime('%Y', o.createdAt)"
        const groupAlias = byMonth ? 'month' : 'year'
        const nameExpr   = byMonth ? MONTH_CASE : "strftime('%Y', o.createdAt)"
        return {
          sql: `
            SELECT ${groupExpr} AS ${groupAlias},
                   ${nameExpr} AS name,
                   ROUND(MIN(o.subtotal), 2) AS min,
                   ROUND(MAX(o.subtotal), 2) AS max
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
