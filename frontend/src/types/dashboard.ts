export interface MonthlyRevenue  { month: string;    revenue: number }
export interface StatusCount     { status: string;   count: number  }
export interface GroupRevenue    { name: string;     revenue: number }
export interface ProvinceCount   { province: string; orders: number  }
export interface CategoryRevenue { category: string; revenue: number }

export interface DashboardStats {
  taxSummary:       TaxSummary;
  monthlyRevenue:   MonthlyRevenue[];
  ordersByStatus:   StatusCount[];
  topProductGroups: GroupRevenue[];
  topProvinces:     ProvinceCount[];
  categoryRevenue:  CategoryRevenue[];
}

export interface TaxSummary {
  grossRevenue:      number;
  netSales:          number;
  totalTaxCollected: number;
}

export interface KpiData {
  totalRevenue:    number;
  completedOrders: number;
  avgOrderValue:   number;
  conversionRate:  number;
}

export interface LineDataset {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor: string;
  fill: boolean;
  tension: number;
  pointRadius: number;
}

export interface BarDataset {
  label: string;
  data: number[];
  backgroundColor: string | string[];
  borderRadius?: number;
}

export interface DoughnutDataset {
  data: number[];
  backgroundColor: string[];
  borderWidth: number;
  borderColor: string;
}

export interface ChartDataShape<T> {
  labels: string[];
  datasets: T[];
}
