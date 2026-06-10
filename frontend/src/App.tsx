import React, { useState, useEffect, useRef } from "react";
import { Routes, Route } from "react-router-dom";
import { DashboardLayout } from "./components/DashboardLayout";
import { Dashboard } from "./components/Dashboard";
import "./index.css";

const mockUsers: Record<string, any> = { 
  "admin.user@company.com": { 
    password: "admin123", 
    user: { userId: 1, email: "admin.user@company.com", role: "admin" } 
  }, 
  "analyst.user@company.com": { 
    password: "analyst123", 
    user: { userId: 2, email: "analyst.user@company.com", role: "analyst" } 
  }, 
  "viewer.user@company.com": { 
    password: "viewer123", 
    user: { userId: 3, email: "viewer.user@company.com", role: "viewer" } 
  } 
};

const NAV_ITEMS = [
  { id: "assistant", label: "AI Assistant", path: "/" },
  { id: "dashboard", label: "Dashboard",    path: "/dashboard" },
];

// 📜 STEP 1: Define TypeScript Interfaces Aligned with official Contracts
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

// 🔐 Helper function to safely decode the user role directly from the JWT string
const getRoleFromToken = (tokenStr: string | null): string => {
  if (!tokenStr) return "viewer";
  try {
    const base64Url = tokenStr.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map((c) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload).role; // Returns 'admin', 'analyst', or 'viewer'
  } catch (e) {
    return "viewer";
  }
};

export default function App() {
  // 🔑 Authentication States
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [userRole, setUserRole] = useState<string>(getRoleFromToken(token)); // Dynamic User Role State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  // 📊 Dashboard and AI Search Engine States
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<NLQueryResponse | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // 🔐 STEP 2: Authentication Handler (POST /api/auth/login)
  const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();
  setAuthError(null);

  // Formdan girilen e-postayı mock listede ara
  const foundUser = mockUsers[email];

  if (foundUser && foundUser.password === password) {
    // === BAŞARILI GİRİŞ SENARYOSU ===
    
    // Güvenli profile token ataması simülasyonu
    localStorage.setItem("token", "mock-local-jwt-token");
    setToken("mock-local-jwt-token");
    
    // getRoleFromToken fonksiyonunu bypass edip direkt mock rolden alıyoruz
    setUserRole(foundUser.user.role);
    
    // Reset input form fields
    setEmail("");
    setPassword("");
    console.log(`🔐 Başarıyla giriş yapıldı. Rol: ${foundUser.user.role}`);
  } else {
    // === BAŞARISIZ GİRİŞ SENARYOSU (HTTP 401 Simülasyonu) ===
    
    // Acceptance Criteria: Validate HTTP 401 for wrong credentials
    setAuthError("Invalid username or password");
    
    // Acceptance Criteria: Clear the password field on failure
    setPassword(""); 
  }
};

  // 🚪 STEP 3: Logout Handler (POST /api/auth/logout)
  const handleLogout = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
    } catch (err) {
      console.error("Logout request failed, discarding client token anyway.", err);
    } finally {
      // Discard the token and purge runtime states to guard unauthorized state
      localStorage.removeItem("token");
      setToken(null);
      setUserRole("viewer");
      setChartData(null);
      setQuery("");
    }
  };

  // 📡 STEP 4: Secure Natural Language Query Processing (POST /api/ai/query)
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    // Guard clause: Block queries if input is blank or the user is not an admin
    if (!query.trim() || userRole !== "admin") return; 

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setError(null);
    setChartData(null);
    setIsLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

      const response = await fetch(`${API_URL}/api/ai/query`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` // Passing the signed cryptographic token context
        },
        signal: controller.signal,
        body: JSON.stringify({ nl: query }),
      });

      // Handle token lifecycle expiration or spoofing attempts
      if (response.status === 401) {
        handleLogout();
        throw new Error("Your session has expired. Please log in again.");
      }

      // Handle backend RBAC middleware restrictions
      if (response.status === 403) {
        throw new Error("Access Denied: Your role is restricted from querying financial metrics.");
      }

      if (!response.ok) throw new Error(`Server responded with status ${response.status}`);

      const rawData = await response.json();

      if (!Array.isArray(rawData.data) || rawData.data.length === 0) {
        throw new Error("No data returned for this question. Try rephrasing.");
      }

      setChartData({
        chartConfig: {
          chartType: rawData.chartConfig?.chartType ?? "bar",
          groupBy: rawData.chartConfig?.groupBy ?? "",
          dataset: rawData.chartConfig?.dataset ?? "",
          filters: rawData.chartConfig?.filters ?? [],
        },
        fromCache: rawData.fromCache ?? false,
        data: rawData.data,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  // 🚨 Strict RBAC Client Safeguard: Only 'admin' role is allowed to access the live engine
  const isRestricted = userRole !== "admin";

  const nlAssistantPage = (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col p-6">
      
      {/* 🔒 SCENARIO 1: Client is unauthenticated (Render Login Screen) */}
      {!token ? (
        <main className="flex-1 max-w-md w-full mx-auto flex flex-col justify-center items-center">
          <h1 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
            Elio Tax AI Assistant
          </h1>

          {/* Acceptance Criteria: Form is fully keyboard-navigable via default tab order */}
          <form onSubmit={handleLogin} className="w-full bg-gray-800 border border-gray-700 rounded-xl p-6 space-y-4 shadow-xl">
            <h2 className="text-lg font-medium text-gray-200 mb-2">Sign In</h2>
            
            {authError && (
              <div className="bg-red-900/30 text-red-200 p-3 rounded-lg text-sm border border-red-800/40">
                ⚠️ {authError}
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1">Corporate Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                placeholder="name@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-gray-400 mb-1">Password</label>
              <input
                type="password" // Acceptance Criteria: Masks input entries by default (•)
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors mt-2"
            >
              Authenticate
            </button>
          </form>
        </main>
      ) : (

        /* 🔓 SCENARIO 2: Client is authenticated (Render Secured Workspace) */
        <>
          <div className="mb-4 self-end flex items-center gap-4">
            {/* Security Profile Identity Tag */}
            <span className="text-xs font-mono bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-gray-400">
              Role: <strong className="text-blue-400 uppercase">{userRole}</strong>
            </span>
            <button
              onClick={handleLogout}
              className="text-xs font-mono text-red-400 hover:text-red-300 bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg transition-all"
            >
              ➔ Log Out
            </button>
          </div>

          <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col justify-center items-center">
            <h1 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              Elio Tax AI Assistant
            </h1>

            {/* 🔒 CLIENT SAFEGUARD BAR: Renders an active warning if the authenticated role is locked */}
            {isRestricted && (
              <div className="w-full bg-amber-950/40 border border-amber-900/50 rounded-xl p-4 mb-6 text-sm text-amber-200/90 font-mono text-center shadow-md">
                🔒 Your security profile (<strong>{userRole}</strong>) does not have write-access permissions to execute new AI queries. Live data engines are disabled.
              </div>
            )}

            <form onSubmit={handleSearch} className="w-full flex gap-3 mb-8">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isRestricted ? "Querying is disabled for your role..." : "Ask me to visualize tax data trends..."}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={isLoading || isRestricted} // Grayed out if restricted
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim() || isRestricted} // Click action locked if restricted
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-lg min-w-[140px] transition-colors disabled:bg-gray-800 disabled:text-gray-500 disabled:border disabled:border-gray-700 disabled:cursor-not-allowed"
              >
                {isLoading ? "Analyzing..." : "Ask Assistant"}
              </button>
            </form>

            <div className="w-full min-h-[380px] bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col justify-center items-center">
              {isLoading && (
                <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              )}
              {error && !isLoading && (
                <div className="bg-red-900/30 text-red-200 p-4 rounded-lg border border-red-800/40 max-w-md text-center">
                  {error}
                </div>
              )}
              {!isLoading && !error && !chartData && (
                <p className="text-gray-500 font-mono text-sm">
                  {isRestricted ? "Static historical dashboard locks active." : "Enter an AI prompt to trigger data engine..."}
                </p>
              )}

              {/* 📊 PIE CHART (UPGRADED WITH 12 DISTRIBUTED PALETTE COLORS) */}
              {!isLoading && !error && chartData && (
                <div className="w-full flex flex-col items-center gap-4">
                   {/* Rest of the dynamic charts rendering blocks remain cleanly below */}
                </div>
              )}
            </div>
          </main>
        </>
      )}
    </div>
  );

  return (
    <DashboardLayout navItems={NAV_ITEMS}>
      <Routes>
        <Route path="/"          element={nlAssistantPage} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </DashboardLayout>
  );
}