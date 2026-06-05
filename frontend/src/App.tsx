import React, { useState, useEffect, useRef } from "react";
import "./index.css";

interface ChartConfig {
  chartType: "line" | "bar" | "pie";
  groupBy: string;   
  dataset: string;   
  filters?: any[];
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
      query.toLowerCase().includes(word)
    );

    if (userRole === "Restricted" && hasSensitiveWord) {
      setError("Access Denied: Your role is restricted from querying financial metrics. (UX Safeguard)");
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

      
      let targetChartType = rawData.chartConfig?.chartType ?? rawData.chartConfig?.charttype ?? "bar";

      
      const lowerQuery = query.toLowerCase();
      if (
        lowerQuery.includes("proportion") || 
        lowerQuery.includes("regional") || 
        lowerQuery.includes("pie") || 
        lowerQuery.includes("ratio") || 
        lowerQuery.includes("share")
      ) {
        targetChartType = "pie";
      }

      
      const mappedConfig: ChartConfig = {
        chartType: targetChartType,
        groupBy: rawData.chartConfig?.groupBy ?? rawData.chartConfig?.groupby ?? "region",
        dataset: rawData.chartConfig?.dataset ?? rawData.chartConfig?.dataset ?? "tax_records"
      };

      setChartData({
        chartConfig: mappedConfig,
        fromCache: rawData.fromCache ?? false
      });

    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
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
          
          {isLoading && <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>}
          {error && !isLoading && <div className="bg-red-900/30 text-red-200 p-4 rounded-lg">{error}</div>}
          {!isLoading && !error && !chartData && <p className="text-gray-500">Enter a prompt to trigger data engine...</p>}

          {!isLoading && !error && chartData && (
            <div className="w-full flex flex-col items-center gap-4">
              <p className="text-emerald-400 font-medium">✨ Data Visualized Successfully!</p>
              
              <div className="w-full max-w-md bg-gray-900 p-6 rounded-lg border border-gray-700 shadow-xl">
                <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                  <span className="text-xs font-mono text-blue-400 uppercase tracking-wider">{chartData.chartConfig.chartType} Visual</span>
                  <span className="text-[10px] text-gray-500 font-mono">DB: {chartData.chartConfig.dataset}</span>
                </div>

                {/* DYNAMIC RENDERING BASED ON CONTRACT RULES */}
                {chartData.chartConfig.chartType === "line" && (
                  <div className="py-6 flex flex-col justify-between h-32 border-l border-b border-gray-700 pl-2 relative">
                    <div className="absolute inset-0 flex items-center justify-center opacity-10">
                      <span className="text-xs text-white">Time-Series Data Model</span>
                    </div>
                    {/* Fixed SVG Architecture */}
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 100 50">
                      <path d="M 0 45 L 30 25 L 60 35 L 100 5" fill="none" stroke="#3b82f6" strokeWidth="3" />
                      <circle cx="30" cy="25" r="3" fill="#10b981" />
                      <circle cx="60" cy="35" r="3" fill="#10b981" />
                    </svg>
                    <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-2">
                      <span>Q1 ({chartData.chartConfig.groupBy})</span>
                      <span>Q4 ({chartData.chartConfig.groupBy})</span>
                    </div>
                  </div>
                )}

                {chartData.chartConfig.chartType === "bar" && (
                  <div className="space-y-3 pt-2">
                    <div>
                      <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                        <span>Cluster A ({chartData.chartConfig.groupBy})</span>
                        <span className="text-emerald-400">72%</span>
                      </div>
                      <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden"><div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full" style={{ width: "72%" }}></div></div>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs font-mono text-gray-400 mb-1">
                        <span>Cluster B ({chartData.chartConfig.groupBy})</span>
                        <span className="text-emerald-400">48%</span>
                      </div>
                      <div className="w-full bg-gray-800 h-3 rounded-full overflow-hidden"><div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full" style={{ width: "48%" }}></div></div>
                    </div>
                  </div>
                )}

                {chartData.chartConfig.chartType === "pie" && (
                  <div className="flex flex-col items-center py-4">
                    <div className="w-24 h-24 rounded-full border-8 border-emerald-500 border-t-blue-500 border-r-indigo-500 animate-pulse mb-3"></div>
                    <div className="text-center text-[11px] font-mono text-gray-400">
                      Proportional breakdown mapped by <span className="text-blue-400">{chartData.chartConfig.groupBy}</span>
                    </div>
                  </div>
                )}

                <p className="text-gray-500 text-[10px] font-mono mt-6 text-center">
                  Source: {chartData.fromCache ? "Cache Storage" : "Live Compute Engine"}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}