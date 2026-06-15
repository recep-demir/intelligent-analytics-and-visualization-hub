import { useState, useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Line, Doughnut } from "react-chartjs-2";
import { KpiCard } from "./KpiCard";
import { CanadaMap } from "./CanadaMap";
import { useDashboardStats, type DashboardFilters } from "../hooks/useDashboardStats";
import type { KpiData, ChartDataShape, LineDataset, BarDataset, DoughnutDataset } from "../types/dashboard";
import { CHART_COLORS, DOUGHNUT_COLORS } from "../constants/chartTheme";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
);

function baseChartOptions(title: string) {
  return {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: true, text: title, color: "#e2e8f0", font: { size: 14 } },
    },
    scales: {
      x: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
      y: { ticks: { color: "#94a3b8" }, grid: { color: "#1e293b" } },
    },
  };
}

function horizontalBarOptions(title: string) {
  return { ...baseChartOptions(title), indexAxis: "y" as const };
}

function computeKpis(stats: ReturnType<typeof useDashboardStats>["data"]): KpiData {
  if (!stats) return { totalRevenue: 0, completedOrders: 0, avgOrderValue: 0, conversionRate: 0 };

  const totalRevenue = stats.monthlyRevenue.reduce((s, r) => s + r.revenue, 0);
  const completedOrders = stats.ordersByStatus
    .filter(s => s.status === "paid" || s.status === "shipped")
    .reduce((s, r) => s + r.count, 0);
  const totalOrders = stats.ordersByStatus.reduce((s, r) => s + r.count, 0);

  return {
    totalRevenue,
    completedOrders,
    avgOrderValue:  completedOrders > 0 ? totalRevenue / completedOrders : 0,
    conversionRate: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
  };
}

function formatCurrency(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : `${value.toFixed(0)}`;
}

const YEARS      = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];
const PROVINCES  = ["Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador","Nova Scotia","Ontario","Prince Edward Island","Quebec","Saskatchewan"];
const STATUSES   = ["pending","paid","shipped","cancelled","refunded"];
const CATEGORIES = ["shoes","apparel"];

const SELECT_CLS = "bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer";

export function Dashboard() {
  const [filters, setFilters] = useState<DashboardFilters>({
    yearFrom: null, yearTo: null, province: null, status: null, category: null,
  });
  const { data, loading, error } = useDashboardStats(filters);

  function set(key: keyof DashboardFilters, raw: string) {
    const isYear = key === "yearFrom" || key === "yearTo";
    const value = raw === "" ? null : isYear ? Number(raw) : raw;
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters({ yearFrom: null, yearTo: null, province: null, status: null, category: null });
  }

  const isFiltered = Object.values(filters).some(v => v != null);

  const kpis = useMemo(() => computeKpis(data), [data]);

  const revenueChartTitle = useMemo(() => {
    if (filters.yearFrom && filters.yearTo) return `Monthly Revenue (${filters.yearFrom} – ${filters.yearTo})`;
    if (filters.yearFrom) return `Monthly Revenue (from ${filters.yearFrom})`;
    if (filters.yearTo)   return `Monthly Revenue (up to ${filters.yearTo})`;
    return "Monthly Revenue (All Years)";
  }, [filters.yearFrom, filters.yearTo]);

  const monthlyRevenueChart = useMemo((): ChartDataShape<LineDataset> => ({
    labels: data?.monthlyRevenue.map(r => r.month) ?? [],
    datasets: [{
      label: "Revenue",
      data:  data?.monthlyRevenue.map(r => r.revenue) ?? [],
      borderColor:     "#3b82f6",
      backgroundColor: "rgba(59,130,246,0.15)",
      fill:       true,
      tension:    0.4,
      pointRadius: 4,
    }],
  }), [data?.monthlyRevenue]);

  const ordersByStatusChart = useMemo((): ChartDataShape<DoughnutDataset> => ({
    labels: data?.ordersByStatus.map(s => s.status) ?? [],
    datasets: [{
      data:            data?.ordersByStatus.map(s => s.count) ?? [],
      backgroundColor: DOUGHNUT_COLORS,
      borderWidth:     2,
      borderColor:     "#1e293b",
    }],
  }), [data?.ordersByStatus]);

  const topProductGroupsChart = useMemo((): ChartDataShape<BarDataset> => ({
    labels: data?.topProductGroups.map(g => g.name) ?? [],
    datasets: [{
      label: "Revenue",
      data:  data?.topProductGroups.map(g => g.revenue) ?? [],
      backgroundColor: CHART_COLORS,
      borderRadius:    4,
    }],
  }), [data?.topProductGroups]);

  const topProvincesChart = useMemo((): ChartDataShape<BarDataset> => ({
    labels: data?.topProvinces.map(p => p.province) ?? [],
    datasets: [{
      label: "Orders",
      data:  data?.topProvinces.map(p => p.orders) ?? [],
      backgroundColor: CHART_COLORS,
      borderRadius:    4,
    }],
  }), [data?.topProvinces]);

  const categoryRevenueChart = useMemo((): ChartDataShape<BarDataset> => ({
    labels: data?.categoryRevenue.map(c => c.category) ?? [],
    datasets: [{
      label: "Revenue",
      data:  data?.categoryRevenue.map(c => c.revenue) ?? [],
      backgroundColor: [CHART_COLORS[0], CHART_COLORS[1]],
      borderRadius:    6,
    }],
  }), [data?.categoryRevenue]);

  const mapData = useMemo(
    () => data?.topProvinces.map(p => ({ name: p.province, value: p.orders })) ?? [],
    [data?.topProvinces],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-900/30 text-red-200 p-4 rounded-lg m-6">
        {error ?? "Failed to load dashboard data."}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-400">Analytics Dashboard</h1>
        {isFiltered && (
          <button onClick={clearFilters} className="text-sm text-blue-400 hover:text-blue-300 underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 bg-gray-800 border border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Year</span>
          <select className={SELECT_CLS} value={filters.yearFrom ?? ""} onChange={e => set("yearFrom", e.target.value)}>
            <option value="">From</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-gray-500 text-xs">–</span>
          <select className={SELECT_CLS} value={filters.yearTo ?? ""} onChange={e => set("yearTo", e.target.value)}>
            <option value="">To</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <select className={SELECT_CLS} value={filters.province ?? ""} onChange={e => set("province", e.target.value)}>
          <option value="">All provinces</option>
          {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select className={SELECT_CLS} value={filters.status ?? ""} onChange={e => set("status", e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className={SELECT_CLS} value={filters.category ?? ""} onChange={e => set("category", e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={isFiltered ? "Total Revenue (filtered)" : "Total Revenue"} value={formatCurrency(kpis.totalRevenue)} subtitle="paid + shipped orders" />
        <KpiCard label="Completed Orders"  value={kpis.completedOrders.toLocaleString()} />
        <KpiCard label="Avg Order Value"   value={formatCurrency(kpis.avgOrderValue)} />
        <KpiCard label="Conversion Rate"   value={`${kpis.conversionRate.toFixed(1)}%`} subtitle="completed ÷ all orders" />
      </div>

      {/* Province Map */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <p className="text-sm font-medium text-gray-400 mb-3">Orders by Province</p>
        <CanadaMap data={mapData} aggregation="count" />
      </div>

      {/* Row 1: Line + Doughnut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col justify-center">
          <div className="relative w-full h-64">
            <Line data={monthlyRevenueChart} options={{ ...baseChartOptions(revenueChartTitle), maintainAspectRatio: false }} />
          </div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <Doughnut
            data={ordersByStatusChart}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "right", labels: { color: "#94a3b8" } },
                title:  { display: true, text: "Orders by Status", color: "#e2e8f0", font: { size: 14 } },
              },
            }}
          />
        </div>
      </div>

      {/* Row 2: Horizontal bars */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <Bar data={topProductGroupsChart} options={horizontalBarOptions("Top 8 Product Groups by Revenue")} />
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <Bar data={topProvincesChart} options={horizontalBarOptions("Top 8 Provinces by Orders")} />
        </div>
      </div>

      {/* Row 3: Category Revenue */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <Bar data={categoryRevenueChart} options={baseChartOptions("Shoes vs Apparel — Revenue")} />
      </div>
    </div>
  );
}
