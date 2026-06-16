import { QueryTypes } from 'sequelize';
import { sequelize } from '../../models';
import { ChartConfig, ChartData } from '../../../shared/types/chart';

interface RawRow {
  label: string;
  value: number;
}

// Whitelist of allowed filter fields to prevent SQL injection via field names
const FILTER_FIELD_MAP: Record<string, string> = {
  status:    'o.status',
  province:  'a.province',
  year:      "strftime('%Y', o.createdAt)",
  createdat: 'o.createdAt',
  category:  'pc.name',
};

function buildWhereClause(filters: ChartConfig['filters'], params: unknown[]): string {
  if (!filters || filters.length === 0) return '';
  const clauses: string[] = [];
  for (const f of filters) {
    const col = FILTER_FIELD_MAP[f.field.toLowerCase()];
    if (!col) continue;
    if (f.operator === 'eq') {
      clauses.push(`${col} = ?`);
      params.push(f.value);
    } else if (f.operator === 'gt') {
      clauses.push(`${col} > ?`);
      params.push(f.value);
    } else if (f.operator === 'lt') {
      clauses.push(`${col} < ?`);
      params.push(f.value);
    } else if (f.operator === 'contains') {
      clauses.push(`${col} LIKE ?`);
      params.push(`%${f.value}%`);
    }
  }
  return clauses.length > 0 ? `AND ${clauses.join(' AND ')}` : '';
}

export async function fetchChartData(config: ChartConfig): Promise<ChartData> {
  const params: unknown[] = [];
  const where = buildWhereClause(config.filters, params);
  const groupBy = (config.groupBy ?? '').toLowerCase();

  let sql: string;

  if (groupBy === 'province') {
    sql = `
      SELECT a.province AS label, ROUND(SUM(o.subtotal), 2) AS value
      FROM Orders o
      JOIN Addresses a ON o.addressId = a.id
      WHERE 1=1 ${where}
      GROUP BY a.province
      ORDER BY value DESC
      LIMIT 20
    `;
  } else if (groupBy === 'status') {
    sql = `
      SELECT o.status AS label, COUNT(*) AS value
      FROM Orders o
      WHERE 1=1 ${where}
      GROUP BY o.status
      ORDER BY value DESC
    `;
  } else if (groupBy === 'year') {
    sql = `
      SELECT strftime('%Y', o.createdAt) AS label, COUNT(*) AS value
      FROM Orders o
      WHERE 1=1 ${where}
      GROUP BY strftime('%Y', o.createdAt)
      ORDER BY label ASC
    `;
  } else if (groupBy === 'productgroup' || groupBy === 'group') {
    sql = `
      SELECT pg.name AS label, ROUND(SUM(oi.price * oi.quantity), 2) AS value
      FROM Orders o
      JOIN OrderItems oi ON oi.orderId = o.id
      JOIN Products p ON p.id = oi.productId
      JOIN ProductGroups pg ON pg.id = p.productGroupId
      WHERE 1=1 ${where}
      GROUP BY pg.name
      ORDER BY value DESC
      LIMIT 15
    `;
  } else if (groupBy === 'category') {
    sql = `
      SELECT pc.name AS label, ROUND(SUM(oi.price * oi.quantity), 2) AS value
      FROM Orders o
      JOIN OrderItems oi ON oi.orderId = o.id
      JOIN Products p ON p.id = oi.productId
      JOIN ProductGroups pg ON pg.id = p.productGroupId
      JOIN ProductGroupCategories pgc ON pgc.productGroupId = pg.id
      JOIN ProductCategories pc ON pc.id = pgc.categoryId
      WHERE 1=1 ${where}
      GROUP BY pc.name
      ORDER BY value DESC
    `;
  } else {
    // Fallback: order count by status
    sql = `
      SELECT o.status AS label, COUNT(*) AS value
      FROM Orders o
      GROUP BY o.status
      ORDER BY value DESC
    `;
  }

  const rows = await sequelize.query<RawRow>(sql, {
    replacements: params,
    type: QueryTypes.SELECT,
  });

  return {
    labels: rows.map(r => String(r.label)),
    datasets: [{
      label: config.title ?? config.dataset,
      data: rows.map(r => Number(r.value)),
      chartType: config.chartType,
    }],
  };
}
