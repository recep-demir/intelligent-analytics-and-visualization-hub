import React, { useState, useEffect, useRef } from "react";
import "./index.css";
import { ChartRenderer, ChartRenderData } from "./components/ChartRenderer";

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
}

export default function App() {
  const [query, setQuery] = useState("");
  const [userRole, setUserRole] = useState("Admin");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<NLQueryResponse | null>(null);
  const [renderData, setRenderData] = useState<ChartRenderData | null>(null);

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
    setRenderData(null);
    setIsLoading(true);

    // UX Safeguard: Client-side keyword check (US-03)
    const sensitiveKeywords = ["revenue", "salary", "profit", "commercial"];
    const hasSensitiveWord = sensitiveKeywords.some((word) =>
      query.toLowerCase().includes(word)
    );

    if (userRole === "Restricted" && hasSensitiveWord) {
      setError("Access Denied: Your role is restricted from querying financial metrics. (UX Safeguard)");
      setIsLoading(false);
      return;
    }

    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

      // Step 1: get ChartConfig from AI
      const aiResponse = await fetch(`${API_URL}/api/ai/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ nl: query }),
      });

      if (!aiResponse.ok) {
        throw new Error(`Server responded with status ${aiResponse.status}`);
      }

      const aiData: NLQueryResponse = await aiResponse.json();
      setChartData(aiData);

      // Step 2: fetch real data for rendering
      const dataResponse = await fetch(`${API_URL}/api/charts/data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(aiData.chartConfig),
      });

      if (dataResponse.ok) {
        const chartRenderData: ChartRenderData = await dataResponse.json();
        setRenderData(chartRenderData);
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      if (err instanceof Error) {
        setError(err.message || "An error occurred while fetching analytics data.");
      } else {
        setError("An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col p-6">
      {/* Role Selector Simulator */}
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
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-400 text-white font-medium px-6 py-3 rounded-lg transition-colors flex items-center justify-center min-w-[140px]"
          >
            {isLoading ? "Analyzing..." : "Ask Assistant"}
          </button>
        </form>

        <div className="w-full bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col justify-center items-center min-h-[250px]">
          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400 text-sm">AI is generating your visualization...</p>
            </div>
          )}

          {/* Error */}
          {error && !isLoading && (
            <div className="w-full max-w-md bg-red-900/30 border border-red-500/40 text-red-200 p-4 rounded-lg text-center">
              <p className="font-semibold mb-1">An Error Occurred</p>
              <p className="text-sm text-red-300/90">{error}</p>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !error && !chartData && (
            <p className="text-gray-500 text-center">
              Enter a prompt above to see analytical tax charts generated in real-time.
            </p>
          )}

          {/* Success */}
          {!isLoading && !error && chartData && (
            <div className="w-full">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <p className="text-emerald-400 font-medium">
                  {chartData.chartConfig.title ?? chartData.chartConfig.dataset}
                </p>
                <div className="flex gap-3 text-xs text-gray-500 font-mono">
                  <span>type: {chartData.chartConfig.chartType}</span>
                  {chartData.chartConfig.groupBy && (
                    <span>group: {chartData.chartConfig.groupBy}</span>
                  )}
                  <span>{chartData.fromCache ? "cache" : "live"}</span>
                </div>
              </div>

              {renderData ? (
                <ChartRenderer config={chartData.chartConfig} data={renderData} />
              ) : (
                <p className="text-gray-500 text-center text-sm">Loading chart data...</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
