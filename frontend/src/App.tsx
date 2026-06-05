import React, { useState, useEffect, useRef } from "react";
import "./index.css";

// Types aligned with the shared project contract (shared/types/chart.ts)
interface ChartConfig {
  chartType: "line" | "bar" | "pie" | "grid" | "heatmap" | "donut" | "map";
  dataset: string;
  filters?: { field: string; operator: string; value: string }[];
  groupBy?: string;
  title?: string;
}

interface NLQueryResponse {
  chartConfig: ChartConfig;
  fromCache: boolean;
  data?: any[];
}

export default function App() {
  const [query, setQuery] = useState("");
  const [userRole, setUserRole] = useState("Admin");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<NLQueryResponse | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setError(null);
    setChartData(null);
    setIsLoading(true);

    const sensitiveKeywords = ["revenue", "salary", "profit", "commercial"];
    const hasSensitiveWord = sensitiveKeywords.some((word) =>
      query.toLowerCase().includes(word),
    );

    if (userRole === "Restricted" && hasSensitiveWord) {
      setError(
        "Access Denied: Your role is restricted from querying financial metrics. (UX Safeguard)",
      );
      setIsLoading(false);
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

      const response = await fetch(`${API_URL}/api/ai/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ nl: query }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const rawData = await response.json();

      if (!Array.isArray(rawData.data) || rawData.data.length === 0) {
        throw new Error("No data returned for this question. Try rephrasing.");
      }

      const mappedConfig: ChartConfig = {
        chartType: rawData.chartConfig?.chartType ?? rawData.chartConfig?.charttype ?? "bar",
        groupBy: rawData.chartConfig?.groupBy ?? rawData.chartConfig?.groupby ?? "",
        dataset: rawData.chartConfig?.dataset ?? rawData.chartConfig?.dataSet ?? "",
        filters: rawData.chartConfig?.filters ?? [],
      };

      setChartData({
        chartConfig: mappedConfig,
        fromCache: rawData.fromCache ?? false,
        data: rawData.data,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col p-6">
      <div className="mb-4 self-end bg-gray-800 p-2 rounded border border-gray-700">
        <label className="mr-2 text-sm text-gray-400">Current Role:</label>
        <select
          value={userRole}
          onChange={(e) => setUserRole(e.target.value)}
          className="bg-gray-700 text-white rounded px-2 py-1 text-sm outline-none cursor-pointer"
        >
          <option value="Admin">Admin User</option>
          <option value="Restricted">Restricted User</option>
        </select>
      </div>

      <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col justify-center items-center">
        <h1 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          Elio Tax AI Assistant
        </h1>

        <form onSubmit={handleSearch} className="w-full flex gap-3 mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask me to visualize tax data trends..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-lg min-w-[140px]"
          >
            {isLoading ? "Analyzing..." : "Ask Assistant"}
          </button>
        </form>

        <div className="w-full min-h-[380px] bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col justify-center items-center">
          {isLoading && (
            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          )}
          {error && !isLoading && (
            <div className="bg-red-900/30 text-red-200 p-4 rounded-lg">
              {error}
            </div>
          )}
          {!isLoading && !error && !chartData && (
            <p className="text-gray-500">
              Enter a prompt to trigger data engine...
            </p>
          )}

          {!isLoading && !error && chartData && (
            <div className="w-full flex flex-col items-center gap-4">
              <p className="text-emerald-400 font-medium">
                ✨ Data Visualized Successfully!
              </p>

              <div className="w-full max-w-md bg-gray-900 p-6 rounded-lg border border-gray-700 shadow-xl">
                <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                  <span className="text-xs font-mono text-blue-400 uppercase tracking-wider">
                    {chartData.chartConfig.chartType} Visual
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    DB: {chartData.chartConfig.dataset}
                  </span>
                </div>

                {chartData.chartConfig.chartType === "pie" && (
                  <div key="pie-chart-view" className="flex flex-col items-center py-2 w-full">
                    {(() => {
                      const records = chartData.data ?? [];
                      const colors = ["#3b82f6", "#10b981", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6"];
                      const total = records.reduce((sum: number, r: any) => sum + (r.percentage ?? r.value ?? 0), 0) || 1;

                      // Build dynamic conic-gradient from real data
                      let cumulative = 0;
                      const stops = records.map((r: any, i: number) => {
                        const pct = ((r.percentage ?? r.value ?? 0) / total) * 100;
                        const start = cumulative;
                        cumulative += pct;
                        return `${colors[i % colors.length]} ${start.toFixed(1)}% ${cumulative.toFixed(1)}%`;
                      }).join(", ");

                      const getLabel = (r: any, i: number) =>
                        r[chartData.chartConfig.groupBy ?? ""] ?? r.province ?? r.status ?? r.label ?? r.name ?? r.year ?? `Item ${i + 1}`;

                      const displayValue = (r: any) => {
                        const v = r.percentage ?? r.value ?? 0;
                        return v >= 1000 ? `CA$${(v / 1000).toFixed(1)}K` : `${v}%`;
                      };

                      return (
                        <>
                          <div className="relative w-32 h-32 mb-6 flex items-center justify-center filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)]">
                            <div
                              className="w-full h-full rounded-full transition-transform duration-300 hover:scale-105"
                              style={{
                                background: `conic-gradient(${stops})`,
                                WebkitMaskImage: "radial-gradient(circle 44px, transparent 44px, white 45px)",
                                maskImage: "radial-gradient(circle 44px, transparent 44px, white 45px)",
                              }}
                            />
                            <div className="absolute w-20 h-20 rounded-full bg-gray-900 border border-gray-800/80 shadow-inner" />
                          </div>

                          <div className="w-full space-y-2.5 max-w-sm">
                            {records.map((record: any, i: number) => (
                              <div
                                key={i}
                                className="flex justify-between items-center text-xs font-mono p-1.5 rounded-lg hover:bg-gray-950/30 border border-transparent hover:border-gray-800/30 transition-all"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="w-2.5 h-2.5 rounded-md shadow-sm shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                                  <span className="text-gray-300">{getLabel(record, i)}</span>
                                </div>
                                <span className="text-blue-400 font-bold bg-blue-950/20 px-2 py-0.5 rounded border border-blue-900/20">
                                  {displayValue(record)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
                {chartData.chartConfig.chartType === "bar" && (
                  <div key="bar-chart-view" className="w-full space-y-4 pt-1">
                    {(() => {
                      const records = chartData.data ?? [];
                      const maxValue = Math.max(...records.map((r: any) => r.percentage ?? r.value ?? 0), 1);
                      return records.map((record: any, index: number) => {
                        const currentGroupBy =
                          chartData.chartConfig.groupBy || "province";
                        const label =
                          record[currentGroupBy] ??
                          record["province"] ??
                          record["region"] ??
                          record["label"] ??
                          record["name"] ??
                          record["status"] ??
                          `Item ${index + 1}`;
                        const value = record.percentage ?? record.value ?? 0;
                        const barWidth = Math.min((value / maxValue) * 100, 100);
                        const displayValue =
                          value >= 1000
                            ? `CA$${(value / 1000).toFixed(1)}K`
                            : `${value}%`;

                        return (
                          <div
                            key={index}
                            className="w-full group p-2.5 rounded-xl bg-gray-950/20 hover:bg-gray-950/50 border border-transparent hover:border-gray-800/40 transition-all duration-200"
                          >
                            <div className="flex justify-between items-center text-xs font-mono mb-2">
                              <span className="text-gray-300 font-medium group-hover:text-white transition-colors">
                                {label}
                              </span>
                              <span className="text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded">
                                {displayValue}
                              </span>
                            </div>
                            <div className="w-full bg-gray-950 h-3 rounded-lg overflow-hidden p-[2px] border border-gray-800/60 shadow-inner">
                              <div
                                className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 h-full rounded-md shadow-[0_0_12px_rgba(59,130,246,0.3)] group-hover:brightness-110 transition-all duration-500 ease-out"
                                style={{ width: `${barWidth}%` }}
                              ></div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
                {chartData.chartConfig.chartType === "line" && (
                  <div key="line-chart-view" className="w-full pt-4">
                    {(() => {
                      const points = chartData.data ?? [];
                      if (points.length === 0) return null;

                      // Single year — show snapshot card instead of line chart
                      if (points.length === 1) {
                        const val = points[0].value ?? points[0].amount ?? 0;
                        const year = points[0].year ?? points[0].tax_year ?? "—";
                        return (
                          <div className="w-full bg-gray-950/50 border border-blue-900/40 rounded-xl p-5 text-center backdrop-blur-sm shadow-inner">
                            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500 block mb-1">
                              Year Snapshot
                            </span>
                            <h3 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-2">
                              {year}
                            </h3>
                            <div className="inline-flex items-center gap-4 bg-gray-900/80 px-4 py-2 rounded-lg border border-gray-800">
                              <div>
                                <span className="text-[10px] text-gray-500 font-mono block">REVENUE</span>
                                <span className="text-base font-bold text-white font-mono">
                                  CA${Number(val).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      const getValue = (d: any) => {
                        const val = d.amount ?? d.value ?? d.percentage ?? d.total;
                        return typeof val === "number" ? val : parseFloat(val) || 0;
                      };
                      const getLabel = (d: any, i: number) =>
                        d.year ?? d.tax_year ?? d.date ?? d.label ?? `Pt ${i + 1}`;

                      const rawValues = points.map(getValue);
                      const maxValue = Math.max(...rawValues, 1);
                      const minValue = Math.min(...rawValues, 0);
                      const midValue = (maxValue + minValue) / 2;
                      const valueRange = maxValue - minValue || 1;

                      const coords = points.map((d, i) => ({
                        x: points.length > 1 ? (i / (points.length - 1)) * 100 : 50,
                        y: 34 - ((getValue(d) - minValue) / valueRange) * 28,
                        label: getLabel(d, i),
                        val: getValue(d),
                      }));

                      const formatVal = (v: number) =>
                        v >= 1000 ? `CA$${(v / 1000).toFixed(0)}K` : `${v}`;

                      const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
                      const areaPath = `${linePath} L ${coords[coords.length - 1].x} 38 L ${coords[0].x} 38 Z`;

                      return (
                        <>
                          <div className="flex gap-1 items-stretch">
                            {/* Y axis labels */}
                            <div className="flex flex-col justify-between text-right text-[9px] font-mono text-gray-500 pr-1 py-1" style={{ width: "44px" }}>
                              <span>{formatVal(maxValue)}</span>
                              <span>{formatVal(midValue)}</span>
                              <span>{formatVal(minValue)}</span>
                            </div>

                            {/* Chart area */}
                            <div className="flex-1 relative h-36 bg-gray-950/40 rounded-xl border border-gray-800/80 p-4 overflow-visible backdrop-blur-sm">
                              <div className="absolute inset-x-0 top-1/4 border-b border-gray-800/40 border-dashed"></div>
                              <div className="absolute inset-x-0 top-2/4 border-b border-gray-800/40 border-dashed"></div>
                              <div className="absolute inset-x-0 top-3/4 border-b border-gray-800/40 border-dashed"></div>
                              <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                                <defs>
                                  <linearGradient id="line-glow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                                  </linearGradient>
                                  <linearGradient id="line-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#3b82f6" />
                                    <stop offset="50%" stopColor="#6366f1" />
                                    <stop offset="100%" stopColor="#10b981" />
                                  </linearGradient>
                                </defs>
                                <path d={areaPath} fill="url(#line-glow)" />
                                <path d={linePath} fill="none" stroke="url(#line-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                {coords.map((c, i) => (
                                  <circle key={i} cx={c.x} cy={c.y} r="2.5" className="fill-gray-900 stroke-indigo-400 stroke-[2] cursor-pointer">
                                    <title>{`${c.label}: ${formatVal(c.val)}`}</title>
                                  </circle>
                                ))}
                              </svg>
                            </div>
                          </div>

                          {/* X axis — year labels */}
                          <div className="flex justify-between text-[9px] font-mono text-gray-500 mt-1 pr-1" style={{ paddingLeft: "52px" }}>
                            {coords.map((c, i) => (
                              <span key={i}>{c.label}</span>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
                <p className="text-gray-500 text-[10px] font-mono mt-6 text-center">
                  Source:{" "}
                  {chartData.fromCache
                    ? "Cache Storage"
                    : "Live Compute Engine"}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
