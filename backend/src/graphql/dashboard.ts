import { sequelize } from "../../models";

export const dashboardTypeDefs = `#graphql
  type TaxSummary {
    grossRevenue:      Float!
    netSales:          Float!
    totalTaxCollected: Float!
  }

  type DashboardStats {
    taxSummary:       TaxSummary!
    yearlyRevenue:    [YearlyRevenue!]!
    monthlyRevenue:   [MonthlyRevenue!]!
    ordersByStatus:   [StatusCount!]!
    topProductGroups: [GroupRevenue!]!
    topProvinces:     [ProvinceCount!]!
    categoryRevenue:  [CategoryRevenue!]!
    bottomProducts:   [ProductRevenue!]!
  }

  type YearlyRevenue   { year: String!     revenue: Float! }
  type MonthlyRevenue  { month: String!    revenue: Float! }
  type StatusCount     { status: String!   count: Int!     }
  type GroupRevenue    { name: String!     revenue: Float! }
  type ProvinceCount   { province: String! orders: Int!    }
  type CategoryRevenue  { category: String! revenue: Float! }
  type ProductRevenue   { name: String!     revenue: Float! }

  extend type Query {
    categories: [String!]!

    dashboardStats(
      year: Int
      yearFrom: Int
      yearTo: Int
      province: String
      status: String
      category: String
    ): DashboardStats!
  }
`;

interface DashboardStatsArgs {
  year?: number | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  province?: string | null;
  status?: string | null;
  category?: string | null;
}

type SqlReplacements = Record<string, string | number>;

function hasText(value?: string | null): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasYear(value?: number | null): value is number {
  return typeof value === "number";
}

function buildReplacements(args: DashboardStatsArgs): SqlReplacements {
  const replacements: SqlReplacements = {};

  if (hasYear(args.year))     replacements.year     = args.year;
  if (hasYear(args.yearFrom)) replacements.yearFrom = args.yearFrom;
  if (hasYear(args.yearTo))   replacements.yearTo   = args.yearTo;

  if (hasText(args.province)) {
    replacements.province = args.province.trim();
  }

  if (hasText(args.status)) {
    replacements.status = args.status.trim();
  }

  if (hasText(args.category)) {
    replacements.category = args.category.trim();
  }

  return replacements;
}

function buildWhereClause(conditions: string[]): string {
  if (conditions.length === 0) return "";
  return `WHERE ${conditions.join("\n      AND ")}`;
}

function buildOrderLevelWhere(
  args: DashboardStatsArgs,
  options: { useMonthlyRevenueDefaults?: boolean } = {},
): { where: string; replacements: SqlReplacements } {
  const conditions: string[] = [];
  const replacements = buildReplacements(args);

  if (hasText(args.status)) {
    conditions.push("LOWER(o.status) = LOWER(:status)");
  } else if (options.useMonthlyRevenueDefaults) {
    conditions.push("o.status IN ('paid','shipped')");
  }

  if (hasYear(args.year)) {
    conditions.push("strftime('%Y', o.createdAt) = CAST(:year AS TEXT)");
  } else if (hasYear(args.yearFrom) || hasYear(args.yearTo)) {
    if (hasYear(args.yearFrom)) conditions.push("CAST(strftime('%Y', o.createdAt) AS INT) >= :yearFrom");
    if (hasYear(args.yearTo))   conditions.push("CAST(strftime('%Y', o.createdAt) AS INT) <= :yearTo");
  }

  if (hasText(args.province)) {
    conditions.push("LOWER(a.province) = LOWER(:province)");
  }

  if (hasText(args.category)) {
    conditions.push(`
        EXISTS (
          SELECT 1
          FROM OrderItems oi
          JOIN Products p ON oi.productId = p.id
          JOIN ProductGroupCategories pgc ON p.groupId = pgc.groupId
          JOIN ProductCategories pc ON pgc.categoryId = pc.id
          WHERE oi.orderId = o.id
            AND LOWER(pc.name) = LOWER(:category)
        )
      `);
  }

  return {
    where: buildWhereClause(conditions),
    replacements,
  };
}

function needsOrderJoin(args: DashboardStatsArgs): boolean {
  return hasYear(args.year) || hasYear(args.yearFrom) || hasYear(args.yearTo) || hasText(args.status) || hasText(args.province);
}

function buildItemOrderJoins(args: DashboardStatsArgs): string {
  if (!needsOrderJoin(args)) return "";

  return `
    JOIN Orders o ON oi.orderId = o.id
    LEFT JOIN Addresses a ON o.addressId = a.id
  `;
}

function buildItemConditions(args: DashboardStatsArgs): string[] {
  const conditions: string[] = [];

  if (hasText(args.status)) {
    conditions.push("LOWER(o.status) = LOWER(:status)");
  }

  if (hasYear(args.year)) {
    conditions.push("strftime('%Y', o.createdAt) = CAST(:year AS TEXT)");
  } else if (hasYear(args.yearFrom) || hasYear(args.yearTo)) {
    if (hasYear(args.yearFrom)) conditions.push("CAST(strftime('%Y', o.createdAt) AS INT) >= :yearFrom");
    if (hasYear(args.yearTo))   conditions.push("CAST(strftime('%Y', o.createdAt) AS INT) <= :yearTo");
  }

  if (hasText(args.province)) {
    conditions.push("LOWER(a.province) = LOWER(:province)");
  }

  return conditions;
}

async function fetchTaxSummary(
  args: DashboardStatsArgs,
): Promise<{ grossRevenue: number; netSales: number; totalTaxCollected: number }> {
  const { where, replacements } = buildOrderLevelWhere(args, { useMonthlyRevenueDefaults: true });

  const [rows] = await sequelize.query(
    `
    SELECT
      ROUND(SUM(o.subtotal + o.total), 2) as grossRevenue,
      ROUND(SUM(o.subtotal), 2)           as netSales,
      ROUND(SUM(o.total), 2)              as totalTaxCollected
    FROM Orders o
    LEFT JOIN Addresses a ON o.addressId = a.id
    ${where}
  `,
    { replacements },
  );

  const row = (rows as any[])[0] ?? {};
  return {
    grossRevenue:      row.grossRevenue      ?? 0,
    netSales:          row.netSales          ?? 0,
    totalTaxCollected: row.totalTaxCollected ?? 0,
  };
}

async function fetchYearlyRevenue(
  args: DashboardStatsArgs,
): Promise<{ year: string; revenue: number }[]> {
  const { where, replacements } = buildOrderLevelWhere(args, { useMonthlyRevenueDefaults: true });

  const [rows] = await sequelize.query(
    `
    SELECT strftime('%Y', o.createdAt) as year, ROUND(SUM(o.subtotal), 2) as revenue
    FROM Orders o
    LEFT JOIN Addresses a ON o.addressId = a.id
    ${where}
    GROUP BY year
    ORDER BY year
    `,
    { replacements },
  );

  return rows as { year: string; revenue: number }[];
}

async function fetchMonthlyRevenue(
  args: DashboardStatsArgs,
): Promise<{ month: string; revenue: number }[]> {
  if (hasText(args.category)) {
    const conditions = buildItemConditions(args);
    const replacements = buildReplacements(args);

    conditions.push("LOWER(pc.name) = LOWER(:category)");

    if (!hasText(args.status)) {
      conditions.push("o.status IN ('paid','shipped')");
    }


    const where = buildWhereClause(conditions);

    const [rows] = await sequelize.query(
      `
      SELECT strftime('%Y-%m', o.createdAt) as month,
             ROUND(SUM(oi.price * oi.quantity), 2) as revenue
      FROM OrderItems oi
      JOIN Orders o ON oi.orderId = o.id
      LEFT JOIN Addresses a ON o.addressId = a.id
      JOIN Products p ON oi.productId = p.id
      JOIN ProductGroupCategories pgc ON p.groupId = pgc.groupId
      JOIN ProductCategories pc ON pgc.categoryId = pc.id
      ${where}
      GROUP BY month
      ORDER BY month
    `,
      { replacements },
    );

    return rows as { month: string; revenue: number }[];
  }

  const { where, replacements } = buildOrderLevelWhere(args, {
    useMonthlyRevenueDefaults: true,
  });

  const [rows] = await sequelize.query(
    `
    SELECT strftime('%Y-%m', o.createdAt) as month, ROUND(SUM(o.subtotal), 2) as revenue
    FROM Orders o
    LEFT JOIN Addresses a ON o.addressId = a.id
    ${where}
    GROUP BY month
    ORDER BY month
  `,
    { replacements },
  );

  return rows as { month: string; revenue: number }[];
}

async function fetchOrdersByStatus(
  args: DashboardStatsArgs,
): Promise<{ status: string; count: number }[]> {
  const { where, replacements } = buildOrderLevelWhere(args);

  const [rows] = await sequelize.query(
    `
    SELECT o.status, COUNT(*) as count
    FROM Orders o
    LEFT JOIN Addresses a ON o.addressId = a.id
    ${where}
    GROUP BY o.status
  `,
    { replacements },
  );

  return rows as { status: string; count: number }[];
}

async function fetchTopProductGroups(
  args: DashboardStatsArgs,
): Promise<{ name: string; revenue: number }[]> {
  const conditions = buildItemConditions(args);
  const replacements = buildReplacements(args);
  const orderJoins = buildItemOrderJoins(args);

  if (hasText(args.category)) {
    conditions.push(`
        EXISTS (
          SELECT 1
          FROM ProductGroupCategories pgc
          JOIN ProductCategories pc ON pgc.categoryId = pc.id
          WHERE pgc.groupId = p.groupId
            AND LOWER(pc.name) = LOWER(:category)
        )
      `);
  }

  const where = buildWhereClause(conditions);

  const [rows] = await sequelize.query(
    `
    SELECT pg.name, ROUND(SUM(oi.price * oi.quantity), 2) as revenue
    FROM OrderItems oi
    JOIN Products p ON oi.productId = p.id
    JOIN ProductGroups pg ON p.groupId = pg.id
    ${orderJoins}
    ${where}
    GROUP BY pg.id, pg.name
    ORDER BY revenue DESC
    LIMIT 8
  `,
    { replacements },
  );

  return rows as { name: string; revenue: number }[];
}

async function fetchTopProvinces(
  args: DashboardStatsArgs,
): Promise<{ province: string; orders: number }[]> {
  const { where, replacements } = buildOrderLevelWhere(args);

  const [rows] = await sequelize.query(
    `
    SELECT a.province, COUNT(o.id) as orders
    FROM Orders o
    JOIN Addresses a ON o.addressId = a.id
    ${where}
    GROUP BY a.province
    ORDER BY orders DESC
    LIMIT 8
  `,
    { replacements },
  );

  return rows as { province: string; orders: number }[];
}

async function fetchCategoryRevenue(
  args: DashboardStatsArgs,
): Promise<{ category: string; revenue: number }[]> {
  const conditions = buildItemConditions(args);
  const replacements = buildReplacements(args);
  const orderJoins = buildItemOrderJoins(args);

  if (hasText(args.category)) {
    conditions.push("LOWER(pc.name) = LOWER(:category)");
  }

  const where = buildWhereClause(conditions);

  const [rows] = await sequelize.query(
    `
    SELECT pc.name as category, ROUND(SUM(oi.price * oi.quantity), 2) as revenue
    FROM OrderItems oi
    JOIN Products p ON oi.productId = p.id
    JOIN ProductGroupCategories pgc ON p.groupId = pgc.groupId
    JOIN ProductCategories pc ON pgc.categoryId = pc.id
    ${orderJoins}
    ${where}
    GROUP BY pc.id, pc.name
    ORDER BY revenue DESC
  `,
    { replacements },
  );

  return rows as { category: string; revenue: number }[];
}

async function fetchBottomProducts(
  args: DashboardStatsArgs,
): Promise<{ name: string; revenue: number }[]> {
  const conditions = buildItemConditions(args);
  const replacements = buildReplacements(args);
  const orderJoins = buildItemOrderJoins(args);
  const where = buildWhereClause(conditions);

  const [rows] = await sequelize.query(
    `
    SELECT p.name, ROUND(SUM(oi.price * oi.quantity), 2) as revenue
    FROM OrderItems oi
    JOIN Products p ON oi.productId = p.id
    ${orderJoins}
    ${where}
    GROUP BY p.id, p.name
    ORDER BY revenue ASC
    LIMIT 5
    `,
    { replacements },
  );

  return rows as { name: string; revenue: number }[];
}

export const dashboardResolvers = {
  Query: {
    categories: async () => {
      const [rows] = await sequelize.query(
        `SELECT name FROM ProductCategories ORDER BY name`,
      );
      return (rows as { name: string }[]).map(r => r.name);
    },

    dashboardStats: async (_parent: unknown, args: DashboardStatsArgs) => {
      const [
        taxSummary,
        yearlyRevenue,
        monthlyRevenue,
        ordersByStatus,
        topProductGroups,
        topProvinces,
        categoryRevenue,
        bottomProducts,
      ] = await Promise.all([
        fetchTaxSummary(args),
        fetchYearlyRevenue(args),
        fetchMonthlyRevenue(args),
        fetchOrdersByStatus(args),
        fetchTopProductGroups(args),
        fetchTopProvinces(args),
        fetchCategoryRevenue(args),
        fetchBottomProducts(args),
      ]);

      return {
        taxSummary,
        yearlyRevenue,
        monthlyRevenue,
        ordersByStatus,
        topProductGroups,
        topProvinces,
        categoryRevenue,
        bottomProducts,
      };
    },
  },
};