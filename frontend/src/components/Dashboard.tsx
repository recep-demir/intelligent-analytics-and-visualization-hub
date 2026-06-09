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
import { useDashboardStats } from "../hooks/useDashboardStats";
import type { KpiData } from "../types/dashboard";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
);

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#6366f1", "#f59e0b",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

const DOUGHNUT_COLORS = ["#3b82f6", "#10b981", "#6366f1", "#f59e0b", "#ef4444"];

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
  return {
    ...baseChartOptions(title),
    indexAxis: "y" as const,
  };
}

function computeKpis(stats: ReturnType<typeof useDashboardStats>["data"]): KpiData {
  if (!stats) return { totalRevenue: 0, completedOrders: 0, avgOrderValue: 0, conversionRate: 0 };

  const totalRevenue = stats.monthlyRevenue.reduce((s, r) => s + r.revenue, 0);

  const completedOrders = stats.ordersByStatus
    .filter((s) => s.status === "paid" || s.status === "shipped")
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
  return value >= 1000
    ? `CA$${(value / 1000).toFixed(1)}K`
    : `CA$${value.toFixed(0)}`;
}

export function Dashboard() {
  const { data, loading, error } = useDashboardStats();

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

  const kpis = computeKpis(data);

  const monthlyRevenueChart = {
    labels: data.monthlyRevenue.map((r) => r.month),
    datasets: [{
      label: "Revenue (CA$)",
      data:  data.monthlyRevenue.map((r) => r.revenue),
      borderColor:     "#3b82f6",
      backgroundColor: "rgba(59,130,246,0.15)",
      fill:       true,
      tension:    0.4,
      pointRadius: 4,
    }],
  };

  const ordersByStatusChart = {
    labels: data.ordersByStatus.map((s) => s.status),
    datasets: [{
      data:            data.ordersByStatus.map((s) => s.count),
      backgroundColor: DOUGHNUT_COLORS,
      borderWidth:     2,
      borderColor:     "#1e293b",
    }],
  };

  const topProductGroupsChart = {
    labels: data.topProductGroups.map((g) => g.name),
    datasets: [{
      label: "Revenue (CA$)",
      data:  data.topProductGroups.map((g) => g.revenue),
      backgroundColor: CHART_COLORS,
      borderRadius:    4,
    }],
  };

  const topProvincesChart = {
    labels: data.topProvinces.map((p) => p.province),
    datasets: [{
      label: "Orders",
      data:  data.topProvinces.map((p) => p.orders),
      backgroundColor: CHART_COLORS,
      borderRadius:    4,
    }],
  };

  const categoryRevenueChart = {
    labels: data.categoryRevenue.map((c) => c.category),
    datasets: [{
      label: "Revenue (CA$)",
      data:  data.categoryRevenue.map((c) => c.revenue),
      backgroundColor: [CHART_COLORS[0], CHART_COLORS[1]],
      borderRadius:    6,
    }],
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Total Revenue (2023+)"  value={formatCurrency(kpis.totalRevenue)} subtitle="paid + shipped orders" />
        <KpiCard label="Completed Orders"        value={kpis.completedOrders.toLocaleString()} />
        <KpiCard label="Avg Order Value"         value={formatCurrency(kpis.avgOrderValue)} />
        <KpiCard label="Conversion Rate"         value={`${kpis.conversionRate.toFixed(1)}%`} subtitle="completed ÷ all orders" />
      </div>

      {/* Row 1: Line + Doughnut */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <Line data={monthlyRevenueChart} options={baseChartOptions("Monthly Revenue (2023)")} />
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

      {/* Row 3: Shoes vs Apparel */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <Bar data={categoryRevenueChart} options={baseChartOptions("Shoes vs Apparel — Revenue")} />
      </div>
    </div>
  );
}
