import React, { useState, useEffect, useRef } from "react";
import "./index.css";

// Types aligned with the shared project contract (shared/types/ai.ts)
interface ChartConfig {
  chartType: "line" | "bar" | "pie";
  xAxis: string;
  yAxis: string;
  filters?: any;
  joins?: any;
}

interface NLQueryResponse {
  chartConfig: ChartConfig;
  fromCache: boolean;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [userRole, setUserRole] = useState("Admin"); // Role management simulator
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<NLQueryResponse | null>(null);
  
  // Ref to keep track of the AbortController for fetch cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cancel any pending request on component unmount to prevent memory leaks
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

    // Abort the previous ongoing request if a new one is submitted
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Reset UI states before a new request
    setError(null);
    setChartData(null);
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
      // Hardcoded port fixed to 4000 via fallback, utilizing environment variable structure
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
      
      const response = await fetch(`${API_URL}/ai/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal, // Link abort signal to fetch
        body: JSON.stringify({ nl: query }), // Aligned field payload: contract expects 'nl' instead of 'input'
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data: NLQueryResponse = await response.json();
      setChartData(data);
    } catch (err) {
      // Gracefully ignore state updates if the request was deliberately aborted by the user/system
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      
      // Strict TypeScript mode compliance (instead of err: any)
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
      {/* Role Selector Simulator (Useful for Testing QA paths) */}
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

        {/* Query Input Form */}
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

        {/* Dynamic Display Panel representing 4 clean UI states */}
        <div className="w-full min-h-[250px] bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col justify-center items-center">
          
          {/* State 1: Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-400 text-sm">AI is generating your visualization...</p>
            </div>
          )}

          {/* State 2: Error Feedback UI */}
          {error && !isLoading && (
            <div className="w-full max-w-md bg-red-900/30 border border-red-500/40 text-red-200 p-4 rounded-lg text-center">
              <p className="font-semibold mb-1">An Error Occurred</p>
              <p className="text-sm text-red-300/90">{error}</p>
            </div>
          )}

          {/* State 3: Empty Default State */}
          {!isLoading && !error && !chartData && (
            <p className="text-gray-500 text-center">
              Enter a prompt above to see analytical tax charts generated in real-time.
            </p>
          )}

          {/* State 4: Success Visualization State matching the contract response */}
          {!isLoading && !error && chartData && (
            <div className="w-full text-center">
              <p className="text-emerald-400 font-medium mb-2">✨ Data Visualized Successfully!</p>
              <div className="bg-gray-900 p-4 rounded border border-gray-700 inline-block text-left font-mono text-xs text-gray-300">
                <p><strong>Chart Type:</strong> {chartData.chartConfig.chartType}</p>
                <p><strong>X Axis:</strong> {chartData.chartConfig.xAxis}</p>
                <p><strong>Y Axis:</strong> {chartData.chartConfig.yAxis}</p>
                <p className="text-gray-500 mt-2 text-[10px]">Source: {chartData.fromCache ? "Cache Storage" : "Live Compute Engine"}</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}