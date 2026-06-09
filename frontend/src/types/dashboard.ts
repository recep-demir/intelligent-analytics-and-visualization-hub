export interface MonthlyRevenue  { month: string;    revenue: number }
export interface StatusCount     { status: string;   count: number  }
export interface GroupRevenue    { name: string;     revenue: number }
export interface ProvinceCount   { province: string; orders: number  }
export interface CategoryRevenue { category: string; revenue: number }

export interface DashboardStats {
  monthlyRevenue:   MonthlyRevenue[];
  ordersByStatus:   StatusCount[];
  topProductGroups: GroupRevenue[];
  topProvinces:     ProvinceCount[];
  categoryRevenue:  CategoryRevenue[];
}

export interface KpiData {
  totalRevenue:    number;
  completedOrders: number;
  avgOrderValue:   number;
  conversionRate:  number;
}
