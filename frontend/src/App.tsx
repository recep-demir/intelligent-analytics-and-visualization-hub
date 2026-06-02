import React, { useState } from "react";
import "./index.css";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Line, Pie } from "react-chartjs-2";

// Registering Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  ChartTitle,
  Tooltip,
  Legend
);

interface ChartPayload {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }>;
}

interface ApiResponse {
  type: "line" | "bar" | "pie";
  title: string;
  payload: ChartPayload;
}

export default function App() {
  const [query, setQuery] = useState<string>("");
  const [userRole, setUserRole] = useState<"Admin" | "Restricted">("Admin");
  
  // State management for live API processes
  const [chartData, setChartData] = useState<ApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleAskAssistant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Reset previous states and start loading for every new query
    setIsLoading(true);
    setError(null);
    setChartData(null);

    // US-03 Security Criterion: Block sensitive queries before hitting the API if the user is restricted
    const sensitiveKeywords = ["revenue", "salary", "profit", "commercial"];
    const isSensitive = sensitiveKeywords.some((keyword) =>
      query.toLowerCase().includes(keyword)
    );

    if (userRole === "Restricted" && isSensitive) {
      setIsLoading(false);
      setError(
        "Access Denied: You are not authorized to view this data. Please contact your system administrator."
      );
      return;
    }

    try {
      // 🚀 Live API Call: POST /ai/query (Does not block the main UI thread)
      const response = await fetch("http://localhost:5000/ai/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ input: query }),
      });

      // ⚠️ Graceful Error Handling: Catches 4xx or 5xx server status codes
      if (!response.ok) {
        throw new Error(
          `Server error (${response.status}): Failed to fetch analytics data. Please try a different query.`
        );
      }

      const data: ApiResponse = await response.json();
      
      // Update state with live JSON payload to render real charts
      setChartData(data);

    } catch (err: any) {
      // Prevents page crashes by catching errors gracefully
      setError(
        err.message || "An unexpected error occurred while connecting to the AI Assistant."
      );
    } finally {
      // Always stop the loading spinner regardless of success or failure
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-gray-800 bg-gray-950 p-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📊</span>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            Intelligent Analytics Hub
          </h1>
        </div>
        <div className="flex items-center gap-2 bg-gray-900 px-3 py-1.5 rounded-lg border border-gray-800 text-sm">
          <span className="text-gray-400">User Role (Mock Auth):</span>
          <button
            onClick={() => setUserRole("Admin")}
            className={`px-2.5 py-1 rounded font-medium transition-all ${
              userRole === "Admin"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Admin
          </button>
          <button
            onClick={() => setUserRole("Restricted")}
            className={`px-2.5 py-1 rounded font-medium transition-all ${
              userRole === "Restricted"
                ? "bg-red-600/90 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Restricted User
          </button>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Panel: Query Input Form */}
        <section className="bg-gray-950 p-6 rounded-xl border border-gray-800 shadow-xl flex flex-col gap-4 h-fit">
          <h2 className="text-lg font-semibold text-gray-200">Elio Tax AI Assistant</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            Ask natural language questions about operational or commercial data trends.
          </p>
          
          <form onSubmit={handleAskAssistant} className="flex flex-col gap-3 mt-2">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Show monthly trends for 2026..."
              className="w-full min-h-[100px] p-3 rounded-lg bg-gray-900 border border-gray-700 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none text-sm"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-medium py-2.5 px-4 rounded-lg transition-all flex justify-center items-center gap-2 text-sm shadow-lg shadow-blue-600/10"
            >
              {isLoading ? "Analyzing..." : "Ask Assistant"}
            </button>
          </form>
        </section>

        {/* Right Panel: Visualization & Feedback Display */}
        <section className="md:col-span-2 bg-gray-950 p-6 rounded-xl border border-gray-800 shadow-xl flex flex-col justify-center items-center min-h-[400px] relative overflow-hidden">
          
          {/* STATE 1: LOADING SPINNER */}
          {isLoading && (
            <div className="flex flex-col items-center gap-4 animate-fade-in">
              <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
              <p className="text-sm text-gray-400 font-medium animate-pulse">
                AI is generating your visualization...
              </p>
            </div>
          )}

          {/* STATE 2: GRACEFUL ERROR MESSAGE */}
          {error && !isLoading && (
            <div className="w-full max-w-md bg-red-950/40 border border-red-800/60 p-4 rounded-lg flex items-start gap-3 animate-fade-in">
              <span className="text-xl text-red-400 mt-0.5">⚠️</span>
              <div>
                <h4 className="text-sm font-semibold text-red-400">An Error Occurred</h4>
                <p className="text-xs text-red-300/90 mt-1 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {/* STATE 3: INITIAL WELCOME SCREEN (No Data Fetched Yet) */}
          {!isLoading && !error && !chartData && (
            <div className="text-center max-w-sm flex flex-col items-center gap-3 text-gray-500">
              <span className="text-4xl filter grayscale opacity-40">📈</span>
              <h3 className="text-base font-medium text-gray-400">Intelligent Analytics Hub</h3>
              <p className="text-xs leading-relaxed">
                Your visual insight reports, dynamic charts, and trends will be rendered here dynamically based on your natural language queries.
              </p>
            </div>
          )}

          {/* STATE 4: LIVE REAL CHART RENDERING AREA */}
          {!isLoading && !error && chartData && (
            <div className="w-full h-full flex flex-col gap-4 animate-fade-in">
              <div className="border-b border-gray-800 pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                  Result For Query
                </span>
                <h3 className="text-lg font-bold text-gray-100 mt-0.5">
                  {chartData.title || query}
                </h3>
              </div>
              
              <div className="flex-1 min-h-[300px] w-full flex items-center justify-center p-2">
                {chartData.type === "line" && (
                  <Line
                    data={chartData.payload}
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                )}
                {chartData.type === "bar" && (
                  <Bar
                    data={chartData.payload}
                    options={{ responsive: true, maintainAspectRatio: false }}
                  />
                )}
                {chartData.type === "pie" && (
                  <div className="max-h-[280px] flex justify-center w-full">
                    <Pie
                      data={chartData.payload}
                      options={{ responsive: true, maintainAspectRatio: false }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}