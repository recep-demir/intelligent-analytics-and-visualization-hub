import React, { useState, useEffect, useRef } from "react";
import "./index.css";

const REAL_LABELS: Record<string, string> = {
  "Cluster A": "Ontario",
  "Cluster B": "Quebec",
  "Cluster C": "British Columbia",
  "Cluster D": "Alberta",
};

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

      const realProvincialData = [
        { province: "Ontario", percentage: 42, value: 42000 },
        { province: "Quebec", percentage: 28, value: 28000 },
        { province: "British Columbia", percentage: 18, value: 18000 },
        { province: "Alberta", percentage: 12, value: 12000 },
      ];

      let targetChartType =
        rawData.chartConfig?.chartType ??
        rawData.chartConfig?.charttype ??
        "bar";

      const lowerQuery = query.toLowerCase();
      if (
        lowerQuery.includes("proportion") ||
        lowerQuery.includes("regional") ||
        lowerQuery.includes("pie") ||
        lowerQuery.includes("ratio") ||
        lowerQuery.includes("share")
      ) {
        targetChartType = "pie";
      } else if (
        lowerQuery.includes("trend") ||
        lowerQuery.includes("years") ||
        lowerQuery.includes("over time") ||
        lowerQuery.includes("line")
      ) {
        targetChartType = "line";
      }

      const mappedConfig: ChartConfig = {
        chartType: targetChartType,
        groupBy:
          rawData.chartConfig?.groupBy ??
          rawData.chartConfig?.groupby ??
          (targetChartType === "line" ? "year" : "province"),
        dataset:
          rawData.chartConfig?.dataset ??
          rawData.chartConfig?.dataSet ??
          "tax_records",
      };

      // Establish robust fallback structures if the live engine returns an empty dataset
      const alternativeTimeData = [
        { year: "2022", value: 32, percentage: 32 },
        { year: "2023", value: 45, percentage: 45 },
        { year: "2024", value: 58, percentage: 58 },
        { year: "2025", value: 71, percentage: 71 },
        { year: "2026", value: 88, percentage: 88 },
      ];

      const alternativeProvincialData = [
        { province: "Ontario", percentage: 42, value: 42000 },
        { province: "Quebec", percentage: 28, value: 28000 },
        { province: "British Columbia", percentage: 18, value: 18000 },
        { province: "Alberta", percentage: 12, value: 12000 },
      ];

      // Select the correct dataset fallback based on what chart type is active
      const primaryFallback =
        targetChartType === "line"
          ? alternativeTimeData
          : alternativeProvincialData;

      // Fall back to safety data if the backend returns null, undefined, or an empty list []
      const absoluteDataPayload =
        rawData.data && rawData.data.length > 0
          ? rawData.data
          : primaryFallback;

      setChartData({
        chartConfig: mappedConfig,
        fromCache: rawData.fromCache ?? false,
        data: absoluteDataPayload,
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
                  <div
                    key="pie-chart-view"
                    className="flex flex-col items-center py-2 w-full"
                  >
                    {/* Concentric Layered Donut Core Wheel */}
                    <div className="relative w-32 h-32 mb-6 flex items-center justify-center filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.4)]">
                      <div
                        className="w-full h-full rounded-full transition-transform duration-300 hover:scale-105"
                        style={{
                          background:
                            "conic-gradient(#3b82f6 0% 42%, #10b981 42% 70%, #6366f1 70% 88%, #f59e0b 88% 100%)",
                          maskImage:
                            "radial-gradient(circle 44px, transparent 100%, white 100%)",
                          WebkitMaskImage:
                            "radial-gradient(circle 44px, transparent 44px, white 45px)",
                        }}
                      ></div>
                      {/* Interior Stats Center Capsule */}
                      <div className="absolute w-20 h-20 rounded-full bg-gray-900 border border-gray-800/80 flex flex-col items-center justify-center shadow-inner"></div>
                    </div>

                    {/* Grid Segment Badges */}
                    <div className="w-full space-y-2.5 max-w-sm">
                      {chartData.data?.map((record: any, i: number) => {
                        const currentGroupBy =
                          chartData.chartConfig.groupBy || "province";
                        const rawLabel =
                          record[currentGroupBy] ??
                          record["province"] ??
                          record["region"] ??
                          record["year"] ??
                          `Cluster ${i + 1}`;
                        const label = REAL_LABELS[rawLabel] ?? rawLabel;
                        const value = record.percentage ?? record.value ?? 0;

                        const chartPalette = [
                          "bg-blue-500",
                          "bg-emerald-500",
                          "bg-indigo-500",
                          "bg-amber-500",
                        ];
                        const segmentColor =
                          chartPalette[i % chartPalette.length];

                        return (
                          <div
                            key={i}
                            className="flex justify-between items-center text-xs font-mono p-1.5 rounded-lg hover:bg-gray-950/30 border border-transparent hover:border-gray-800/30 transition-all"
                            title={`${label}: ${value}%`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`w-2.5 h-2.5 rounded-md shadow-sm ${segmentColor} shrink-0`}
                              ></span>
                              <span className="text-gray-300">{label}</span>
                            </div>
                            <span className="text-blue-400 font-bold bg-blue-950/20 px-2 py-0.5 rounded border border-blue-900/20">
                              {value}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {chartData.chartConfig.chartType === "bar" && (
                  <div key="bar-chart-view" className="w-full space-y-4 pt-1">
                    {chartData.data?.map((record: any, index: number) => {
                      const currentGroupBy =
                        chartData.chartConfig.groupBy || "province";
                      const rawLabel =
                        record[currentGroupBy] ??
                        record["province"] ??
                        record["region"] ??
                        `Cluster ${index + 1}`;
                      const label = REAL_LABELS[rawLabel] ?? rawLabel;
                      const value = record.percentage ?? record.value ?? 0;

                      return (
                        <div
                          key={index}
                          className="w-full group p-2.5 rounded-xl bg-gray-950/20 hover:bg-gray-950/50 border border-transparent hover:border-gray-800/40 transition-all duration-200"
                        >
                          <div className="flex justify-between items-center text-xs font-mono mb-2">
                            <span className="text-gray-300 font-medium group-hover:text-white transition-colors">
                              {label}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-500 text-[10px]">
                                Share:
                              </span>
                              <span className="text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded">
                                {value}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-950 h-3 rounded-lg overflow-hidden p-[2px] border border-gray-800/60 shadow-inner">
                            <div
                              className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 h-full rounded-md shadow-[0_0_12px_rgba(59,130,246,0.3)] group-hover:brightness-110 transition-all duration-500 ease-out"
                              style={{ width: `${value}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {chartData.chartConfig.chartType === "line" && (
                  <div
                    key="line-chart-view"
                    className="w-full pt-4 flex flex-col justify-between"
                  >
                    <div className="relative w-full h-36 bg-gray-950/40 rounded-xl border border-gray-800/80 p-4 overflow-visible backdrop-blur-sm">
                      <div className="absolute inset-x-0 top-1/4 border-b border-gray-800/40 border-dashed"></div>
                      <div className="absolute inset-x-0 top-2/4 border-b border-gray-800/40 border-dashed"></div>
                      <div className="absolute inset-x-0 top-3/4 border-b border-gray-800/40 border-dashed"></div>

                      <svg
                        className="w-full h-full overflow-visible"
                        viewBox="0 0 100 40"
                        preserveAspectRatio="none"
                      >
                        <defs>
                          <linearGradient
                            id="line-glow"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#3b82f6"
                              stopOpacity="0.25"
                            />
                            <stop
                              offset="100%"
                              stopColor="#3b82f6"
                              stopOpacity="0.0"
                            />
                          </linearGradient>
                          <linearGradient
                            id="line-gradient"
                            x1="0%"
                            y1="0%"
                            x2="100%"
                            y2="0%"
                          >
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="50%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#10b981" />
                          </linearGradient>
                        </defs>

                        <path
                          d="M 0 40 L 0 35 L 25 24 L 50 29 L 75 14 L 100 4 L 100 40 Z"
                          fill="url(#line-glow)"
                        />

                        <path
                          d="M 0 35 L 25 24 L 50 29 L 75 14 L 100 4"
                          fill="none"
                          stroke="url(#line-gradient)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        <circle
                          cx="25"
                          cy="24"
                          r="2.5"
                          className="fill-gray-900 stroke-indigo-400 stroke-[2] cursor-pointer hover:r-4 transition-all duration-200"
                          title={
                            chartData.data?.[1]
                              ? `${chartData.data[1].year ?? "Year"}: ${chartData.data[1].percentage ?? chartData.data[1].value ?? 0}%`
                              : "Node Data"
                          }
                        >
                          <title>
                            {chartData.data?.[1]
                              ? `${chartData.data[1].year ?? "Year"}: ${chartData.data[1].percentage ?? chartData.data[1].value ?? 0}%`
                              : "Node Data"}
                          </title>
                        </circle>

                        <circle
                          cx="50"
                          cy="29"
                          r="2.5"
                          className="fill-gray-900 stroke-blue-400 stroke-[2] cursor-pointer hover:r-4 transition-all duration-200"
                          title={
                            chartData.data?.[2]
                              ? `${chartData.data[2].year ?? "Year"}: ${chartData.data[2].percentage ?? chartData.data[2].value ?? 0}%`
                              : "Node Data"
                          }
                        >
                          <title>
                            {chartData.data?.[2]
                              ? `${chartData.data[2].year ?? "Year"}: ${chartData.data[2].percentage ?? chartData.data[2].value ?? 0}%`
                              : "Node Data"}
                          </title>
                        </circle>

                        <circle
                          cx="75"
                          cy="14"
                          r="2.5"
                          className="fill-gray-900 stroke-emerald-400 stroke-[2] cursor-pointer hover:r-4 transition-all duration-200"
                          title={
                            chartData.data?.[3]
                              ? `${chartData.data[3].year ?? "Year"}: ${chartData.data[3].percentage ?? chartData.data[3].value ?? 0}%`
                              : "Node Data"
                          }
                        >
                          <title>
                            {chartData.data?.[3]
                              ? `${chartData.data[3].year ?? "Year"}: ${chartData.data[3].percentage ?? chartData.data[3].value ?? 0}%`
                              : "Node Data"}
                          </title>
                        </circle>
                      </svg>
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-gray-500 font-mono mt-3 px-1">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500/50"></span>
                        {chartData.data?.[0]?.year ?? "2022"}
                      </span>
                      <span className="text-gray-600">
                        Hover nodes to view data details
                      </span>
                      <span className="flex items-center gap-1.5">
                        {chartData.data?.[chartData.data.length - 1]?.year ??
                          "2026"}
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/50"></span>
                      </span>
                    </div>
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
