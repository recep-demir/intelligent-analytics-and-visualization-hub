import { useState, useMemo } from "react";
import { Bar, Line } from "react-chartjs-2";
import { KpiCard } from "./KpiCard";
import { CanadaMap } from "./CanadaMap";
import { useDashboardStats, type DashboardFilters } from "../hooks/useDashboardStats";
import { useFilterOptions } from "../hooks/useFilterOptions";
import type { ChartDataShape, LineDataset, BarDataset } from "../types/dashboard";
import { CHART_COLORS, DOUGHNUT_COLORS } from "../constants/chartTheme";
import { baseChartOptions, horizontalBarOptions } from "../utils/chartOptions";


function formatCurrency(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : `${value.toFixed(0)}`;
}


const SELECT_CLS = "bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer";

export function Dashboard() {
  const [filters, setFilters] = useState<DashboardFilters>({
    yearFrom: null, yearTo: null, province: null, status: null, category: null,
  });
  const { data, loading, error } = useDashboardStats(filters);
  const { categories, provinces, statuses, years } = useFilterOptions();

  function set(key: keyof DashboardFilters, raw: string) {
    const isYear = key === "yearFrom" || key === "yearTo";
    const value = raw === "" ? null : isYear ? Number(raw) : raw;
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      if (next.yearFrom && next.yearTo && next.yearFrom > next.yearTo) {
        next.yearTo = next.yearFrom;
      }
      return next;
    });
  }

  function clearFilters() {
    setFilters({ yearFrom: null, yearTo: null, province: null, status: null, category: null });
  }

  const isFiltered = Object.values(filters).some(v => v != null);


  const revenueChartTitle = useMemo(() => {
    if (filters.yearFrom && filters.yearTo) return `Yearly Revenue (${filters.yearFrom} – ${filters.yearTo})`;
    if (filters.yearFrom) return `Yearly Revenue (from ${filters.yearFrom})`;
    if (filters.yearTo)   return `Yearly Revenue (up to ${filters.yearTo})`;
    return "Yearly Revenue (All Years)";
  }, [filters.yearFrom, filters.yearTo]);

  const yearlyRevenueChart = useMemo((): ChartDataShape<LineDataset> => ({
    labels: data?.yearlyRevenue.map(r => r.year) ?? [],
    datasets: [{
      label: "Revenue",
      data:  data?.yearlyRevenue.map(r => r.revenue) ?? [],
      borderColor:     "#3b82f6",
      backgroundColor: "rgba(59,130,246,0.15)",
      fill:       true,
      tension:    0.4,
      pointRadius: 4,
    }],
  }), [data?.yearlyRevenue]);

  const ordersByStatusChart = useMemo((): ChartDataShape<BarDataset> => ({
    labels: data?.ordersByStatus.map(s => s.status) ?? [],
    datasets: [{
      label:           "Order Count",
      data:            data?.ordersByStatus.map(s => s.count) ?? [],
      backgroundColor: CHART_COLORS,
      borderRadius:    4,
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

  const categoryBarChart = useMemo((): ChartDataShape<BarDataset> => ({
    labels: data?.categoryRevenue.map(c => c.category) ?? [],
    datasets: [{
      label: "Revenue",
      data:  data?.categoryRevenue.map(c => c.revenue) ?? [],
      backgroundColor: CHART_COLORS,
      borderRadius:    4,
    }],
  }), [data?.categoryRevenue]);

  const bottomProductsChart = useMemo((): ChartDataShape<BarDataset> => ({
    labels: data?.bottomProducts.map(p => p.name) ?? [],
    datasets: [{
      label: "Revenue",
      data:  data?.bottomProducts.map(p => p.revenue) ?? [],
      backgroundColor: CHART_COLORS,
      borderRadius:    4,
    }],
  }), [data?.bottomProducts]);

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
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-400">Analytics Dashboard</h1>
        {isFiltered && (
          <button onClick={clearFilters} className="text-sm text-blue-400 hover:text-blue-300 underline">
            Clear filters
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-2 sm:gap-3 bg-gray-800 border border-gray-700 rounded-xl p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Year</span>
          <select className={SELECT_CLS} value={filters.yearFrom ?? ""} onChange={e => set("yearFrom", e.target.value)}>
            <option value="">From</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <span className="text-gray-500 text-xs">–</span>
          <select className={SELECT_CLS} value={filters.yearTo ?? ""} onChange={e => set("yearTo", e.target.value)}>
            <option value="">To</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <select className={SELECT_CLS} value={filters.province ?? ""} onChange={e => set("province", e.target.value)}>
          <option value="">All provinces</option>
          {provinces.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select className={SELECT_CLS} value={filters.status ?? ""} onChange={e => set("status", e.target.value)}>
          <option value="">All statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select className={SELECT_CLS} value={filters.category ?? ""} onChange={e => set("category", e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Gross Revenue"
          value={formatCurrency(data.taxSummary.grossRevenue)}
          subtitle="net sales + tax collected"
        />
        <KpiCard
          label="Net Subtotal (Before Tax)"
          value={formatCurrency(data.taxSummary.netSales)}
          subtitle="pre-tax revenue"
        />
        <KpiCard
          label="Total Tax Collected"
          value={formatCurrency(data.taxSummary.totalTaxCollected)}
          subtitle="regulatory tax liability"
        />
      </div>

      {/* Province Map */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <p className="text-sm font-medium text-gray-400 mb-3">Orders by Province</p>
        <CanadaMap data={mapData} aggregation="count" legend="Order Count" />
      </div>

      {/* Row 1: Line + Order Status Bar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col justify-center">
          <div className="relative w-full h-64 md:h-96">
            <Line data={yearlyRevenueChart} options={{ ...baseChartOptions(revenueChartTitle, "Year", "Revenue"), maintainAspectRatio: false }} />
          </div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="relative h-64 md:h-96">
            <Bar data={ordersByStatusChart} options={{ ...baseChartOptions("Order Volume by Status", "Order Status", "Count"), maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Row 2: Horizontal bars */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="relative h-64 md:h-96">
            <Bar data={topProductGroupsChart} options={{ ...horizontalBarOptions("Top 8 Product Groups by Revenue", "Revenue", "Product Group"), maintainAspectRatio: false }} />
          </div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
          <div className="relative h-64 md:h-96">
            <Bar data={topProvincesChart} options={{ ...horizontalBarOptions("Top 8 Provinces by Orders", "Order Count", "Province"), maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      {/* Row 3: Tax & Sales Contribution by Product Category */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <Bar data={categoryBarChart} options={horizontalBarOptions("Tax & Sales Contribution by Product Category", "Revenue", "Category")} />
      </div>

      {/* Row 4: Top 5 Lowest-Performing Products */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <Bar data={bottomProductsChart} options={horizontalBarOptions("Top 5 Lowest-Performing Products by Revenue", "Revenue", "Product")} />
      </div>
    </div>
  );
}
