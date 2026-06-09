import { sequelize } from "../../models";

export const dashboardTypeDefs = `#graphql
  type DashboardStats {
    monthlyRevenue:   [MonthlyRevenue!]!
    ordersByStatus:   [StatusCount!]!
    topProductGroups: [GroupRevenue!]!
    topProvinces:     [ProvinceCount!]!
    categoryRevenue:  [CategoryRevenue!]!
  }

  type MonthlyRevenue  { month: String!    revenue: Float! }
  type StatusCount     { status: String!   count: Int!     }
  type GroupRevenue    { name: String!     revenue: Float! }
  type ProvinceCount   { province: String! orders: Int!    }
  type CategoryRevenue { category: String! revenue: Float! }

  extend type Query {
    dashboardStats: DashboardStats!
  }
`;

async function fetchMonthlyRevenue(): Promise<{ month: string; revenue: number }[]> {
  const [rows] = await sequelize.query(`
    SELECT strftime('%Y-%m', createdAt) as month, ROUND(SUM(subtotal), 2) as revenue
    FROM Orders
    WHERE status IN ('paid','shipped') AND createdAt >= '2023-01-01'
    GROUP BY month
    ORDER BY month
  `);
  return rows as { month: string; revenue: number }[];
}

async function fetchOrdersByStatus(): Promise<{ status: string; count: number }[]> {
  const [rows] = await sequelize.query(`
    SELECT status, COUNT(*) as count
    FROM Orders
    GROUP BY status
  `);
  return rows as { status: string; count: number }[];
}

async function fetchTopProductGroups(): Promise<{ name: string; revenue: number }[]> {
  const [rows] = await sequelize.query(`
    SELECT pg.name, ROUND(SUM(oi.price * oi.quantity), 2) as revenue
    FROM OrderItems oi
    JOIN Products p  ON oi.productId = p.id
    JOIN ProductGroups pg ON p.groupId = pg.id
    GROUP BY pg.id
    ORDER BY revenue DESC
    LIMIT 8
  `);
  return rows as { name: string; revenue: number }[];
}

async function fetchTopProvinces(): Promise<{ province: string; orders: number }[]> {
  const [rows] = await sequelize.query(`
    SELECT a.province, COUNT(o.id) as orders
    FROM Orders o
    JOIN Addresses a ON o.addressId = a.id
    GROUP BY a.province
    ORDER BY orders DESC
    LIMIT 8
  `);
  return rows as { province: string; orders: number }[];
}

async function fetchCategoryRevenue(): Promise<{ category: string; revenue: number }[]> {
  const [rows] = await sequelize.query(`
    SELECT pc.name as category, ROUND(SUM(oi.price * oi.quantity), 2) as revenue
    FROM OrderItems oi
    JOIN Products p               ON oi.productId = p.id
    JOIN ProductGroupCategories pgc ON p.groupId = pgc.groupId
    JOIN ProductCategories pc     ON pgc.categoryId = pc.id
    WHERE pc.name IN ('shoes','apparel')
    GROUP BY pc.name
  `);
  return rows as { category: string; revenue: number }[];
}

export const dashboardResolvers = {
  Query: {
    dashboardStats: async () => {
      const [
        monthlyRevenue,
        ordersByStatus,
        topProductGroups,
        topProvinces,
        categoryRevenue,
      ] = await Promise.all([
        fetchMonthlyRevenue(),
        fetchOrdersByStatus(),
        fetchTopProductGroups(),
        fetchTopProvinces(),
        fetchCategoryRevenue(),
      ]);

      return {
        monthlyRevenue,
        ordersByStatus,
        topProductGroups,
        topProvinces,
        categoryRevenue,
      };
    },
  },
};
