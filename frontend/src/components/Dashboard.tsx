import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Bar, Line, Pie, Bubble } from "react-chartjs-2";
import { KpiCard } from "./KpiCard";
import { CanadaMap } from "./CanadaMap";
import { useDashboardStats, type DashboardFilters } from "../hooks/useDashboardStats";
import { useFilterOptions } from "../hooks/useFilterOptions";
import type { ChartDataShape, LineDataset, BarDataset } from "../types/dashboard";
import { CHART_COLORS, DOUGHNUT_COLORS } from "../constants/chartTheme";
import { baseChartOptions, horizontalBarOptions } from "../utils/chartOptions";

function fmtRev(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

const bubbleLabelPlugin = {
  id: "productBubbleLabels",
  afterDatasetsDraw(chart: any) {
    const ctx = chart.ctx as CanvasRenderingContext2D;
    ctx.save();
    chart.data.datasets.forEach((dataset: any, dsIdx: number) => {
      chart.getDatasetMeta(dsIdx).data.forEach((point: any, j: number) => {
        const raw = dataset.data[j] as any;
        const { x, y } = point;
        const r: number = point.options?.radius ?? 14;

        ctx.textAlign = "center";
        ctx.font = "8px sans-serif";
        ctx.fillStyle = "#9ca3af";
        ctx.fillText(fmtRev(Number(raw.y)), x, y + r + 10);
      });
    });
    ctx.restore();
  },
};

function formatCurrency(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : `${value.toFixed(0)}`;
}

const SELECT_CLS = "bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer";

export function Dashboard({ initialFilters, viewerMode = false , canShare = false}: {
  initialFilters?: DashboardFilters;
  viewerMode?: boolean;
  canShare?: boolean;
}) {
  const [filters, setFilters] = useState<DashboardFilters>(
    initialFilters ?? { yearFrom: null, yearTo: null, province: null, status: null, category: null }
  );
  useEffect(() => {
  if (initialFilters) {
    setFilters(initialFilters);
  }
}, [initialFilters]);
  const { data, loading, error } = useDashboardStats(filters);
  const { categories, provinces, statuses, years } = useFilterOptions();

  function set(key: keyof DashboardFilters, raw: string) {
    const isYear = key === "yearFrom" || key === "yearTo";
    const value = raw === "" ? null : isYear ? Number(raw) : raw;
    setShareUrl(null);   
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      if (next.yearFrom && next.yearTo && next.yearFrom > next.yearTo) {
        next.yearTo = next.yearFrom;
      }
      return next;
    });
  }

  function clearFilters() {
    setShareUrl(null);   
    setFilters({ yearFrom: null, yearTo: null, province: null, status: null, category: null });
  }

  const isFiltered = Object.values(filters).some(v => v != null);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    setSharing(true);
    setShareUrl(null);
    try {
      const token = sessionStorage.getItem("token");
      const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000";
      const res = await fetch(`${API_URL}/api/dashboard-shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ filtersJson: JSON.stringify(filters) }),
      });
      if (!res.ok) throw new Error("Failed to create share link");
      const { shareId } = await res.json();
      setShareUrl(`${window.location.origin}/share/${shareId}`);
    } catch {
      setShareUrl("error");
    } finally {
      setSharing(false);
    }
  }, [filters]);

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

  const ordersByStatusChart = useMemo(() => ({
    labels: data?.ordersByStatus.map(s => s.status) ?? [],
    datasets: [{
      data:            data?.ordersByStatus.map(s => s.count) ?? [],
      backgroundColor: CHART_COLORS,
      borderWidth:     2,
      borderColor:     "#1f2937",
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

  const bubbleTickLabels = useRef<Record<number, string>>({});

  const productBubbleChart = useMemo(() => {
    const topProds    = data?.topProducts    ?? [];
    const bottomProds = data?.bottomProducts ?? [];

    const labels: Record<number, string> = {};
    topProds.forEach((p, i)    => { labels[i]     = p.name; });
    bottomProds.forEach((p, i) => { labels[i + 6] = p.name; });
    bubbleTickLabels.current = labels;

    return {
      datasets: [
        {
          label: "Top 5 Products",
          data: topProds.map((p, i) => ({ x: i, y: Math.max(p.revenue, 1), r: 14, name: p.name })),
          backgroundColor: "rgba(34, 197, 94, 0.7)",
          borderColor: "rgba(34, 197, 94, 1)",
          borderWidth: 1.5,
        },
        {
          label: "Bottom 5 Products",
          data: bottomProds.map((p, i) => ({ x: i + 6, y: Math.max(p.revenue, 1), r: 14, name: p.name })),
          backgroundColor: "rgba(239, 68, 68, 0.7)",
          borderColor: "rgba(239, 68, 68, 1)",
          borderWidth: 1.5,
        },
      ],
    };
  }, [data?.topProducts, data?.bottomProducts]);

  const mapData = useMemo(
    () => data?.topProvinces.map(p => ({ name: p.province, value: p.revenue, orders: p.orders })) ?? [],
    [data?.topProvinces],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

   if (error) {
    return (
      <div className="bg-red-900/30 text-red-200 p-4 rounded-lg m-6">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            Analytics Dashboard
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {isFiltered && !viewerMode && (
            <button onClick={clearFilters} className="text-sm text-blue-400 hover:text-blue-300 underline">
              Clear filters
            </button>
          )}
          {canShare && (
            <button
              onClick={handleShare}
              disabled={sharing}
              className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              {sharing ? "Sharing…" : "Share"}
            </button>
          )}
        </div>
      </div>

      {shareUrl && shareUrl !== "error" && (
        <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm">
          <span className="text-gray-400 shrink-0">Share link:</span>
          <code className="text-blue-300 truncate flex-1">{shareUrl}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(shareUrl); }}
            className="text-xs text-gray-400 hover:text-white border border-gray-600 rounded px-2 py-1 shrink-0"
          >
            Copy
          </button>
        </div>
      )}
      {shareUrl === "error" && (
        <p className="text-red-400 text-sm">Failed to create share link. Please try again.</p>
      )}

      {/* Filter Bar */}
      {viewerMode ? (
        <div className="flex flex-wrap gap-2 bg-gray-800 border border-gray-700 rounded-xl p-3 text-xs text-gray-400 items-center">
          <span className="font-medium text-gray-500 uppercase tracking-wider mr-1">Filtered by:</span>
          {filters.yearFrom && <span className="bg-gray-700 px-2 py-1 rounded">Year from {filters.yearFrom}</span>}
          {filters.yearTo   && <span className="bg-gray-700 px-2 py-1 rounded">Year to {filters.yearTo}</span>}
          {filters.province && <span className="bg-gray-700 px-2 py-1 rounded">Province: {filters.province}</span>}
          {filters.status   && <span className="bg-gray-700 px-2 py-1 rounded">Status: {filters.status}</span>}
          {filters.category && <span className="bg-gray-700 px-2 py-1 rounded">Category: {filters.category}</span>}
          {!filters.yearFrom && !filters.yearTo && !filters.province && !filters.status && !filters.category && (
            <span className="italic">No filters — showing all data</span>
          )}
        </div>
      ) : (
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
      )}

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
        <CanadaMap data={mapData} legend="Revenue" />
      </div>

      {/* Row 1: Line + Order Status Bar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col justify-center">
          <div className="relative w-full h-64 md:h-96">
            <Line data={yearlyRevenueChart} options={{ ...baseChartOptions(revenueChartTitle, "Year", "Revenue"), maintainAspectRatio: false }} />
          </div>
        </div>
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-gray-400 mb-3 self-start">Order Volume by Status</p>
          <div className="relative h-64 md:h-80 w-full flex items-center justify-center">
            <Pie data={ordersByStatusChart} options={{ maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: "#d1d5db", padding: 16 } } } }} />
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

      {/* Row 3: Top vs Bottom products bubble */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <p className="text-sm font-medium text-gray-400 mb-3">Top 5 vs Bottom 5 Products by Revenue</p>
        <div className="relative h-80 md:h-[26rem]">
          <Bubble
            data={productBubbleChart}
            plugins={[bubbleLabelPlugin]}
            options={{
              maintainAspectRatio: false,
              layout: { padding: { top: 10, bottom: 8 } },
              plugins: {
                legend: { position: "top", labels: { color: "#d1d5db", padding: 16 } },
                tooltip: {
                  callbacks: {
                    label: ctx => {
                      const raw = ctx.raw as { x: number; y: number; name: string };
                      return `${raw.name}: ${fmtRev(raw.y)}`;
                    },
                  },
                },
              },
              scales: {
                x: {
                  min: -0.8,
                  max: 10.8,
                  ticks: {
                    color: "#9ca3af",
                    stepSize: 1,
                    font: { size: 9 },
                    maxRotation: 0,
                    callback: (val) => {
                      const label = bubbleTickLabels.current[val as number];
                      if (!label) return "";
                      return label.split(" ");
                    },
                  },
                  grid: { color: "#374151" },
                },
                y: {
                  type: "logarithmic",
                  title: { display: true, text: "Revenue (CAD) — log scale", color: "#9ca3af" },
                  ticks: {
                    color: "#9ca3af",
                    callback: (v) => fmtRev(Number(v)),
                  },
                  grid: { color: "#374151" },
                },
              },
            }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">Green = top 5 performers · Red = bottom 5 · Gap separates the two groups · Log scale makes both visible</p>
      </div>

    </div>
  );
}
