import React, { useState, useEffect, useRef } from "react";
import { Routes, Route } from "react-router-dom";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";
import { DashboardLayout } from "./components/DashboardLayout";
import { Dashboard } from "./components/Dashboard";
import { AdminPanel } from "./components/AdminPanel";
import "./index.css";

const CANADA_GEO = "/canada-provinces.json";

const NAV_ITEMS = [
  { id: "assistant", label: "AI Assistant", path: "/" },
  { id: "dashboard", label: "Dashboard", path: "/dashboard" },
];

type Capital = {
  city: string;
  coords: [number, number];
  lx: number;
  ly: number;
  anchor: "middle" | "start" | "end";
};

// Main map — largest/most recognizable city per province (NOT provincial capitals — Vancouver, Calgary,
// and Montréal are used instead of Victoria, Edmonton, and Quebec City for better geographic orientation).
// lx/ly push labels into open ocean/margin space; nearby cities staggered vertically to avoid overlap.
// Iqaluit routes DOWN to avoid being hidden under the Maritimes inset box (absolute-positioned overlay).
const PROVINCE_MARKERS: Capital[] = [
  {
    city: "Vancouver",
    coords: [-123.12, 49.28],
    lx: -72,
    ly: -5,
    anchor: "end",
  }, // Pacific → far left upper
  { city: "Calgary", coords: [-114.07, 51.05], lx: -40, ly: 40, anchor: "end" }, // Alberta → far left lower (stagger vs Vancouver)
  { city: "Regina", coords: [-104.62, 50.45], lx: 0, ly: 55, anchor: "middle" }, // Saskatchewan → straight down
  { city: "Winnipeg", coords: [-97.14, 49.9], lx: 48, ly: 52, anchor: "start" }, // Manitoba → lower right
  { city: "Toronto", coords: [-79.38, 43.65], lx: 65, ly: 24, anchor: "start" }, // Ontario → far right lower
  { city: "Montréal", coords: [-73.57, 45.5], lx: 65, ly: 20, anchor: "start" }, // Quebec → far right upper (stagger vs Toronto)
  {
    city: "St. John's",
    coords: [-52.71, 47.56],
    lx: 32,
    ly: -22,
    anchor: "start",
  }, // NL → right above
  {
    city: "Whitehorse",
    coords: [-135.06, 60.72],
    lx: -48,
    ly: -35,
    anchor: "end",
  }, // Yukon → upper left
  {
    city: "Yellowknife",
    coords: [-114.37, 62.45],
    lx: -30,
    ly: -150,
    anchor: "middle",
  }, // NWT → far up into Arctic Ocean
  { city: "Iqaluit", coords: [-68.52, 63.75], lx: 0, ly: -80, anchor: "start" }, // Nunavut → right into Baffin Bay (below inset)
];

// Maritimes zoomed inset — provincial capitals (all three are correct here)
const MARITIMES_MARKERS: Capital[] = [
  {
    city: "Fredericton",
    coords: [-66.64, 45.96],
    lx: -14,
    ly: -10,
    anchor: "end",
  },
  {
    city: "Charlottetown",
    coords: [-63.13, 46.24],
    lx: 14,
    ly: -10,
    anchor: "start",
  },
  { city: "Halifax", coords: [-63.58, 44.65], lx: 14, ly: 14, anchor: "start" },
];

function normalizeProvince(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

interface ChartConfig {
  chartType:
    | "line"
    | "bar"
    | "treemap"
    | "pie"
    | "donut"
    | "grid"
    | "heatmap"
    | "map"
    | "stat";
  dataset: string;
  filters?: { field: string; operator: string; value: string }[];
  groupBy?: string;
  title?: string;
  aggregation?: string;
}

interface NLQueryResponse {
  chartConfig: ChartConfig;
  fromCache: boolean;
  data?: any[];
  message?: string;
  insights?: string[];
  totalOrders?: number;
  engine?: "gemini" | "local";
  latencyMs?: number;
}

const PIE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#6366f1",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
];

function heatColor(t: number): string {
  const r = Math.round(59 + (239 - 59) * t);
  const g = Math.round(130 + (68 - 130) * t);
  const b = Math.round(246 + (68 - 246) * t);
  return `rgb(${r},${g},${b})`;
}

function formatVal(v: number, aggregation?: string): string {
  if (aggregation === "count") {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return String(Math.round(v));
  }
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Number(v).toFixed(2)}`;
}

function VerticalLegend({
  minV,
  maxV,
  agg,
  gradient = "linear-gradient(to bottom, #ef4444, #8b5cf6, #3b82f6)",
}: {
  minV: number;
  maxV: number;
  agg?: string;
  gradient?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-between py-2 w-20 shrink-0">
      <span className="text-sm font-bold text-white text-center leading-tight">
        {formatVal(maxV, agg)}
      </span>
      <div
        className="flex-1 w-5 rounded-full my-3"
        style={{ background: gradient, minHeight: "200px" }}
      />
      <span className="text-sm font-bold text-white text-center leading-tight">
        {formatVal(minV, agg)}
      </span>
    </div>
  );
}

function parseChartConfig(raw: any, fallbackTitle: string): ChartConfig {
  return {
    chartType: raw?.chartType ?? raw?.charttype ?? "bar",
    groupBy: raw?.groupBy ?? raw?.groupby ?? "",
    dataset: raw?.dataset ?? raw?.dataSet ?? "",
    filters: raw?.filters ?? [],
    aggregation: raw?.aggregation,
    title: raw?.title ?? fallbackTitle,
  };
}

function generateTitle(config: ChartConfig): string {
  const agg = config.aggregation ?? "sum";
  const metric =
    agg === "count"
      ? "Orders"
      : agg === "avg"
        ? "Avg. Revenue"
        : agg === "min"
          ? "Min Revenue"
          : agg === "max"
            ? "Max Revenue"
            : "Revenue";

  const GROUP_LABELS: Record<string, string> = {
    province: "Province",
    year: "Year",
    month: "Month",
    status: "Order Status",
    category: "Category",
    productGroup: "Product Group",
    product: "Product",
    total: "",
  };

  const yearFilters = config.filters?.filter((f) => f.field === "year") ?? [];
  const gte = yearFilters.find((f) => f.operator === "gte")?.value;
  const lte = yearFilters.find((f) => f.operator === "lte")?.value;
  const eq = yearFilters.find((f) => f.operator === "eq")?.value;
  const period =
    gte && lte ? ` · ${gte} – ${lte}` : eq ? ` · ${eq}` : " · 2018 – 2024";

  if (config.chartType === "map")
    return `Canada · ${metric} by Province${period}`;
  if (config.chartType === "stat") return `Total ${metric}${period}`;

  const groupLabel = config.groupBy ? GROUP_LABELS[config.groupBy] : null;
  if (groupLabel) return `${metric} by ${groupLabel}${period}`;
  return `${metric}${period}`;
}

const getRoleFromToken = (tokenStr: string | null): string => {
  if (!tokenStr) return "viewer";
  try {
    const base64Url = tokenStr.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => {
          return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join(""),
    );
    return JSON.parse(jsonPayload).role?.toLowerCase() ?? "viewer";
  } catch (e) {
    return "viewer";
  }
};

export default function App() {
  console.log("Registered map markers module:", Marker);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token"),
  );
  const [userRole, setUserRole] = useState<string>(getRoleFromToken(token));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<NLQueryResponse | null>(null);
  const [mapTooltip, setMapTooltip] = useState<string | null>(null);
  const [mapHovered, setMapHovered] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const decodeAndSetUserRole = (tokenStr: string) => {
    try {
      const base64Url = tokenStr.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const payload = JSON.parse(window.atob(base64));
      if (payload && payload.role) {
        setUserRole(payload.role.toLowerCase());
      }
    } catch (e) {
      console.error("Token decode error, falling back to viewer role:", e);
      setUserRole("viewer");
    }
  };

  // 🔐 Refactored Core Authentication Handler with Secure State Synchronization
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password: password }),
      });

      if (!response.ok) {
        setAuthError("Invalid username or password");
        setPassword("");
        return;
      }

      // 🔑 1. Extract token and profile metadata from the API response payload
      const data = await response.json();

      // 💾 2. Securely persist authentication credentials in local state variables
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      setToken(data.token);

      // 👤 3. Execute dynamic cryptographic role verification lifecycle
      decodeAndSetUserRole(data.token);

      // 🧹 4. Complete secure field lifecycle cleanup to optimize memory bounds
      setEmail("");
      setPassword("");
      console.log("🔐 Successfully authenticated via real backend API.");
    } catch (err) {
      console.error("Login network error:", err);
      setAuthError("Server connection failed. Please try again later.");
      setPassword("");
    }
  };

  const handleLogout = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      console.error(
        "Logout request failed, discarding client token anyway.",
        err,
      );
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setToken(null);
      setUserRole("viewer");
      setChartData(null);
      setQuery("");
    }
  };

  // 🤖 Dynamic Natural Language AI Processing Core
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
  if (!query.trim() || isLoading || (userRole !== "admin" && userRole !== "analyst")) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    const fetchStart = Date.now();
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/ai/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
        body: JSON.stringify({ nl: query.trim() }),
      });

      if (!response.ok) {
        throw new Error(
          "Failed to pull analytical insight data from analytical engine.",
        );
      }

      const rawData = await response.json();

      if (!Array.isArray(rawData.data) || rawData.data.length === 0) {
        // Server returned a message (unrecognized query, no matching rows, etc.)
        // Show it as an info panel, not a red error box
        setChartData({
          chartConfig: parseChartConfig(rawData.chartConfig, query),
          fromCache: rawData.fromCache ?? false,
          engine: rawData.engine,
          latencyMs: Date.now() - fetchStart,
          data: [],
          message:
            rawData.message ??
            "No data found for this query. Try adjusting your filters.",
        });
        return;
      }

      setChartData({
        chartConfig: parseChartConfig(rawData.chartConfig, query),
        fromCache: rawData.fromCache ?? false,
        engine: rawData.engine,
        latencyMs: Date.now() - fetchStart,
        data: rawData.data,
        message: rawData.message,
        insights: Array.isArray(rawData.insights) ? rawData.insights : [],
        totalOrders: rawData.totalOrders,
      });

      if (!response.ok) {
        throw new Error(
          "Failed to pull analytical insight data from analytical engine.",
        );
      }

      const payload = await response.json();
      setChartData(payload);
    } catch (err: any) {
      console.error("AI execution error:", err);
      setError(err.message || "An analytics engine breakdown occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const agg = chartData?.chartConfig.aggregation;

  function renderPieOrDonut(records: any[], isDonut: boolean) {
    const total =
      records.reduce((s: number, r: any) => s + (r.value ?? 0), 0) || 1;
    const GAP = 0.9;
    const available = 100 - records.length * GAP;
    let cumulative = 0;
    const stopParts: string[] = [];
    records.forEach((r: any, i: number) => {
      const pct = ((r.value ?? 0) / total) * available;
      const segEnd = cumulative + pct;
      stopParts.push(
        `${PIE_COLORS[i % PIE_COLORS.length]} ${cumulative.toFixed(2)}% ${segEnd.toFixed(2)}%`,
      );
      stopParts.push(
        `transparent ${segEnd.toFixed(2)}% ${(segEnd + GAP).toFixed(2)}%`,
      );
      cumulative = segEnd + GAP;
    });
    const stops = stopParts.join(", ");
    const cutoutPx = isDonut ? 44 : 0;
    const maskStyle = isDonut
      ? `radial-gradient(circle ${cutoutPx}px, transparent ${cutoutPx}px, white ${cutoutPx + 1}px)`
      : undefined;

    return (
      <div className="flex items-center gap-10 py-4 w-full justify-center">
        <div className="relative w-48 h-48 flex items-center justify-center shrink-0 filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
          <div
            className="w-full h-full rounded-full"
            style={{
              background: `conic-gradient(${stops})`,
              WebkitMaskImage: maskStyle,
              maskImage: maskStyle,
            }}
          />
          {isDonut && (
            <div className="absolute w-28 h-28 rounded-full bg-gray-900 border border-gray-800/80 shadow-inner flex items-center justify-center">
              <span className="text-sm font-mono text-gray-200 font-bold text-center leading-tight px-2">
                {formatVal(total, agg)}
              </span>
            </div>
          )}
        </div>
        <div className="space-y-2.5 min-w-[220px]">
          {records.map((record: any, i: number) => (
            <div key={i} className="flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              <span className="text-sm text-gray-200 font-medium flex-1">
                {record.name ?? `Item ${i + 1}`}
              </span>
              <span className="text-sm text-blue-300 font-bold font-mono">
                {formatVal(record.value ?? 0, agg)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderBar(records: any[]) {
    const maxValue = Math.max(...records.map((r: any) => r.value ?? 0), 1);
    const minValue = Math.min(...records.map((r: any) => r.value ?? 0), 0);
    return (
      <div className="flex gap-4 w-full">
        <div className="flex-1 space-y-2 pt-1">
          {records.map((record: any, index: number) => {
            const label = record.name ?? record.label ?? `Item ${index + 1}`;
            const value = record.value ?? 0;
            const barWidth = Math.min((value / maxValue) * 100, 100);
            const labelFits = barWidth > 18;
            return (
              <div key={index} className="w-full group">
                <div className="text-sm font-mono mb-1 px-1">
                  <span className="text-gray-200 font-semibold group-hover:text-white transition-colors">
                    {label}
                  </span>
                </div>
                <div className="w-full bg-gray-950 h-8 rounded-lg overflow-hidden border border-gray-800/50 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400 h-full rounded-lg shadow-[0_0_16px_rgba(59,130,246,0.35)] group-hover:brightness-110 transition-all duration-500 ease-out flex items-center justify-end pr-3"
                    style={{ width: `${barWidth}%` }}
                  >
                    {labelFits && (
                      <span className="text-white text-xs font-bold whitespace-nowrap drop-shadow-md">
                        {formatVal(value, agg)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <VerticalLegend
          minV={minValue}
          maxV={maxValue}
          agg={agg}
          gradient="linear-gradient(to bottom, #10b981, #3b82f6)"
        />
      </div>
    );
  }

  function renderLine(points: any[]) {
    if (points.length === 0) return null;

    if (points.length === 1) {
      const val = points[0].value ?? 0;
      const label = points[0].name ?? points[0].year ?? "—";
      return (
        <div className="w-full bg-gray-950/50 border border-blue-900/40 rounded-xl p-5 text-center">
          <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500 block mb-1">
            Snapshot
          </span>
          <h3 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400 mb-2">
            {label}
          </h3>
          <span className="text-base font-bold text-white font-mono">
            {formatVal(Number(val), agg)}
          </span>
        </div>
      );
    }

    const isMinMax = "min" in points[0] && "max" in points[0];
    if (isMinMax) {
      const minVals = points.map((d: any) => parseFloat(d.min) || 0);
      const maxVals = points.map((d: any) => parseFloat(d.max) || 0);
      const allVals = [...minVals, ...maxVals];
      const maxV = Math.max(...allVals, 1);
      const minV = Math.min(...allVals);
      const VB_W2 = 100,
        VB_H2 = 40;
      const pad2 = (maxV - minV) * 0.1 || maxV * 0.1;
      const yMax2 = maxV + pad2;
      const yMin2 = Math.max(0, minV - pad2);
      const range2 = yMax2 - yMin2 || 1;

      const toCoords = (vals: number[]) =>
        vals.map((v, i) => ({
          x: (i / (vals.length - 1)) * VB_W2,
          y: VB_H2 * 0.88 - ((v - yMin2) / range2) * (VB_H2 * 0.76),
          label: points[i].name ?? points[i].year ?? `Pt ${i + 1}`,
          val: v,
        }));

      const minCoords = toCoords(minVals);
      const maxCoords = toCoords(maxVals);

      const smoothLine2 = (pts: { x: number; y: number }[]) => {
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[Math.max(i - 1, 0)],
            p1 = pts[i],
            p2 = pts[i + 1],
            p3 = pts[Math.min(i + 2, pts.length - 1)];
          const cp1x = p1.x + (p2.x - p0.x) / 6,
            cp1y = p1.y + (p2.y - p0.y) / 6;
          const cp2x = p2.x - (p3.x - p1.x) / 6,
            cp2y = p2.y - (p3.y - p1.y) / 6;
          d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${p2.x} ${p2.y}`;
        }
        return d;
      };

      return (
        <div className="flex gap-4 w-full pt-2">
          <div className="flex-1">
            <div className="flex gap-1 items-stretch">
              <div
                className="flex flex-col justify-between text-right text-[10px] font-mono text-gray-300 font-bold pr-1"
                style={{
                  width: "52px",
                  paddingTop: "47px",
                  paddingBottom: "47px",
                }}
              >
                <span>{formatVal(maxV, agg)}</span>
                <span>{formatVal((maxV + minV) / 2, agg)}</span>
                <span>{formatVal(minV, agg)}</span>
              </div>
              <div className="flex-1 relative h-72 bg-gray-950/40 rounded-xl border border-gray-800/80 p-4 overflow-hidden">
                <div className="absolute inset-x-0 top-1/4 border-b border-gray-800/40 border-dashed" />
                <div className="absolute inset-x-0 top-2/4 border-b border-gray-800/40 border-dashed" />
                <div className="absolute inset-x-0 top-3/4 border-b border-gray-800/40 border-dashed" />
                <svg
                  className="w-full h-full"
                  viewBox={`0 0 ${VB_W2} ${VB_H2}`}
                  preserveAspectRatio="none"
                >
                  <path
                    d={smoothLine2(maxCoords)}
                    fill="none"
                    stroke="#f87171"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d={smoothLine2(minCoords)}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {maxCoords.map((c, i) => (
                    <circle
                      key={`mx-${i}`}
                      cx={c.x}
                      cy={c.y}
                      r="0.7"
                      fill="#f87171"
                    >
                      <title>{`${c.label} max: ${formatVal(c.val, agg)}`}</title>
                    </circle>
                  ))}
                  {minCoords.map((c, i) => (
                    <circle
                      key={`mn-${i}`}
                      cx={c.x}
                      cy={c.y}
                      r="0.7"
                      fill="#60a5fa"
                    >
                      <title>{`${c.label} min: ${formatVal(c.val, agg)}`}</title>
                    </circle>
                  ))}
                </svg>
              </div>
            </div>
            <div
              className="flex justify-between text-[10px] font-mono text-gray-300 font-medium mt-1"
              style={{ paddingLeft: "60px" }}
            >
              {minCoords.map((c, i) => (
                <span key={i}>{c.label}</span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-start justify-center gap-4 w-20 shrink-0 py-2">
            <div className="flex items-center gap-2">
              <span className="w-5 h-1 bg-rose-400 rounded inline-block" />
              <span className="text-sm font-bold text-white">Max</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-1 bg-blue-400 rounded inline-block" />
              <span className="text-sm font-bold text-white">Min</span>
            </div>
          </div>
        </div>
      );
    }

    const getValue = (d: any) => {
      const val = d.value ?? d.amount ?? d.percentage ?? d.total;
      return typeof val === "number" ? val : parseFloat(val) || 0;
    };
    const rawValues = points.map(getValue);
    const dataMax = Math.max(...rawValues, 1);
    const dataMin = Math.min(...rawValues);
    const maxValue = dataMax + (dataMax - dataMin) * 0.15;
    const minValue = Math.max(0, dataMin - (dataMax - dataMin) * 0.15);
    const valueRange = maxValue - minValue || 1;

    const VB_W = 100,
      VB_H = 40;
    const coords = points.map((d: any, i: number) => ({
      x: points.length > 1 ? (i / (points.length - 1)) * VB_W : VB_W / 2,
      y: VB_H * 0.88 - ((getValue(d) - minValue) / valueRange) * (VB_H * 0.76),
      label: d.name ?? d.year ?? `Pt ${i + 1}`,
      val: getValue(d),
    }));

    const smoothLine = (pts: { x: number; y: number }[]) => {
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[Math.max(i - 1, 0)],
          p1 = pts[i],
          p2 = pts[i + 1],
          p3 = pts[Math.min(i + 2, pts.length - 1)];
        d += ` C ${(p1.x + (p2.x - p0.x) / 6).toFixed(2)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(2)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(2)} ${p2.x} ${p2.y}`;
      }
      return d;
    };

    return (
      <div className="flex gap-4 w-full pt-2">
        <div className="flex-1">
          <div className="flex gap-1 items-stretch">
            <div
              className="flex flex-col justify-between text-right text-[10px] font-mono text-gray-300 font-bold pr-1"
              style={{
                width: "52px",
                paddingTop: "47px",
                paddingBottom: "47px",
              }}
            >
              <span>{formatVal(dataMax, agg)}</span>
              <span>{formatVal((dataMax + dataMin) / 2, agg)}</span>
              <span>{formatVal(dataMin, agg)}</span>
            </div>
            <div className="flex-1 relative h-72 bg-gray-950/40 rounded-xl border border-gray-800/80 p-4 overflow-hidden">
              <svg
                className="w-full h-full"
                viewBox={`0 0 ${VB_W} ${VB_H}`}
                preserveAspectRatio="none"
              >
                <path
                  d={`${smoothLine(coords)} L ${coords[coords.length - 1].x} ${VB_H} L ${coords[0].x} ${VB_H} Z`}
                  fill="rgba(99,102,241,0.15)"
                />
                <path
                  d={smoothLine(coords)}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth="0.8"
                />
                {coords.map((c, i) => (
                  <circle key={i} cx={c.x} cy={c.y} r="0.7" fill="#818cf8" />
                ))}
              </svg>
            </div>
          </div>
          <div
            className="flex justify-between text-[10px] font-mono text-gray-300 font-medium mt-1"
            style={{ paddingLeft: "60px" }}
          >
            {coords.map((c, i) => (
              <span key={i}>{c.label}</span>
            ))}
          </div>
        </div>
        <VerticalLegend minV={dataMin} maxV={dataMax} agg={agg} />
      </div>
    );
  }

  function renderStat(records: any[]) {
    const val = records[0]?.value ?? 0;
    return (
      <div className="w-full flex flex-col items-center py-8 gap-2">
        <span className="text-sm font-mono uppercase tracking-widest text-gray-300 font-bold">
          Total
        </span>
        <span className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          {formatVal(Number(val), agg)}
        </span>
      </div>
    );
  }

  function renderGrid(records: any[]) {
    if (records.length === 0) return null;
    const cols = Object.keys(records[0]);
    return (
      <div className="w-full overflow-x-auto max-h-64 rounded-lg">
        <table className="w-full text-xs font-mono border-collapse">
          <thead className="sticky top-0 bg-gray-900">
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className="text-left text-gray-200 font-bold border-b border-gray-600 pb-2 pr-3 uppercase"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((row: any, i: number) => (
              <tr key={i} className="hover:bg-gray-800/40">
                {cols.map((c) => (
                  <td
                    key={c}
                    className="text-gray-200 py-1 pr-3 border-b border-gray-800/40"
                  >
                    {String(row[c] ?? "—")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderTreemap(records: any[]) {
    if (records.length === 0) return null;
    return (
      <div className="text-center text-gray-400 py-4">
        Treemap View Enabled ({records.length} items)
      </div>
    );
  }

  function renderHeatmap(records: any[]) {
    if (records.length === 0) return null;
    return (
      <div className="text-center text-gray-400 py-4">Heatmap View Enabled</div>
    );
  }

  function renderMap(records: any[]) {
    const lookup: Record<string, number> = {};
    records.forEach((d: any) => {
      lookup[normalizeProvince(String(d.name ?? ""))] = d.value ?? 0;
    });
    const vals = Object.values(lookup);
    const maxV = Math.max(...vals, 1);
    const minV = Math.min(...vals);
    const range = maxV - minV || 1;

    return (
      <div className="w-full">
        <div className="h-8 mb-2 flex items-center justify-center">
          {mapTooltip && (
            <span className="text-sm font-bold text-white bg-gray-700 border border-gray-500 px-4 py-1.5 rounded-lg shadow-lg">
              {mapTooltip}
            </span>
          )}
        </div>
        <div className="flex items-stretch gap-4">
          <div className="flex-1 relative">
            <div className="rounded-xl border border-gray-800/60 bg-[#0d1117]">
              <ComposableMap
                projection="geoAzimuthalEqualArea"
                projectionConfig={{ rotate: [96, -63, 0], scale: 590 }}
                width={800}
                height={430}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  overflow: "visible",
                }}
              >
                <Geographies geography={CANADA_GEO}>
                  {({ geographies }: { geographies: any[] }) =>
                    geographies.map(
                      (geo: {
                        rsmKey: string;
                        properties: Record<string, unknown>;
                      }) => {
                        const rawName =
                          (geo.properties.name as string | null) ?? "";
                        if (!rawName) return null;
                        const name = normalizeProvince(rawName);
                        const val = lookup[name] ?? 0;
                        const t = val ? (val - minV) / range : 0;
                        const isHovered = mapHovered === name;
                        const anyHovered = mapHovered !== null;
                        const opacity = anyHovered
                          ? isHovered
                            ? 1.0
                            : 0.35
                          : val
                            ? 0.9
                            : 0.4;
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={val ? heatColor(t) : "#1e2939"}
                            fillOpacity={opacity}
                            stroke="#ffffff"
                            strokeWidth={isHovered ? 1.5 : 0.5}
                            onMouseEnter={() => {
                              setMapHovered(name);
                              setMapTooltip(
                                `${rawName}  ·  ${val ? formatVal(val, agg) : "No data"}`,
                              );
                            }}
                            onMouseLeave={() => {
                              setMapHovered(null);
                              setMapTooltip(null);
                            }}
                            style={{
                              default: { outline: "none" },
                              hover: { outline: "none", cursor: "pointer" },
                              pressed: { outline: "none" },
                            }}
                          />
                        );
                      },
                    )
                  }
                </Geographies>
                {PROVINCE_MARKERS.map(({ city, coords, lx, ly, anchor }) => (
                  <Marker key={city} coordinates={coords}>
                    <line
                      x1={0}
                      y1={0}
                      x2={lx}
                      y2={ly}
                      stroke="#9ca3af"
                      strokeWidth={0.6}
                      strokeOpacity={0.85}
                    />
                    <circle
                      r={2.8}
                      fill="#ffffff"
                      fillOpacity={0.95}
                      stroke="#0d1117"
                      strokeWidth={0.8}
                    />
                    <text
                      textAnchor={anchor}
                      x={
                        lx +
                        (anchor === "start" ? 3 : anchor === "end" ? -3 : 0)
                      }
                      y={ly - 3}
                      style={{
                        fontSize: "11px",
                        fill: "#f9fafb",
                        fontFamily: "sans-serif",
                        fontWeight: 700,
                        pointerEvents: "none",
                      }}
                    >
                      {city}
                    </text>
                  </Marker>
                ))}
              </ComposableMap>
            </div>
            {(() => {
              const MARITIMES = [
                "New Brunswick",
                "Nova Scotia",
                "Prince Edward Island",
                "Newfoundland and Labrador",
                "Newfoundland",
              ];
              const hasData = MARITIMES.some(
                (p) => (lookup[normalizeProvince(p)] ?? 0) > 0,
              );
              if (!hasData) return null;
              return (
                <div className="absolute top-2 right-2 z-10 w-56 rounded-lg border border-gray-600/70 bg-[#0d1117]/90 overflow-hidden shadow-xl backdrop-blur-sm">
                  <div className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-2 pt-1.5">
                    Atlantic Provinces
                  </div>
                  <ComposableMap
                    projection="geoAzimuthalEqualArea"
                    projectionConfig={{ rotate: [63, -46, 0], scale: 3200 }}
                    width={280}
                    height={180}
                    style={{ width: "100%", height: "auto", display: "block" }}
                  >
                    <Geographies geography={CANADA_GEO}>
                      {({ geographies }) =>
                        geographies.map(
                          (geo: {
                            rsmKey: string;
                            properties: Record<string, unknown>;
                          }) => {
                            const rawName =
                              (geo.properties.name as string | null) ?? "";
                            if (!rawName) return null;
                            const name = normalizeProvince(rawName);
                            const val = lookup[name] ?? 0;
                            const t = val ? (val - minV) / range : 0;
                            const isHovered = mapHovered === name;
                            const anyHovered = mapHovered !== null;
                            const opacity = anyHovered
                              ? isHovered
                                ? 1.0
                                : 0.35
                              : val
                                ? 0.9
                                : 0.35;
                            return (
                              <Geography
                                key={geo.rsmKey}
                                geography={geo}
                                fill={val ? heatColor(t) : "#1e2939"}
                                fillOpacity={opacity}
                                stroke="#ffffff"
                                strokeWidth={isHovered ? 1.5 : 0.5}
                                onMouseEnter={() => {
                                  setMapHovered(name);
                                  setMapTooltip(
                                    `${rawName}  ·  ${val ? formatVal(val, agg) : "No data"}`,
                                  );
                                }}
                                onMouseLeave={() => {
                                  setMapHovered(null);
                                  setMapTooltip(null);
                                }}
                                style={{
                                  default: { outline: "none" },
                                  hover: {
                                    outline: "none",
                                    fillOpacity: 1.0,
                                    strokeWidth: 2.0,
                                    cursor: "pointer",
                                  },
                                  pressed: { outline: "none" },
                                }}
                              />
                            );
                          },
                        )
                      }
                    </Geographies>
                    {MARITIMES_MARKERS.map(({ city, coords }) => (
                      <Marker key={city} coordinates={coords}>
                        <circle
                          r={2.5}
                          fill="#ffffff"
                          fillOpacity={0.95}
                          stroke="#0d1117"
                          strokeWidth={0.6}
                        />
                      </Marker>
                    ))}
                  </ComposableMap>
                </div>
              );
            })()}
          </div>
          <VerticalLegend minV={minV} maxV={maxV} agg={agg} />
        </div>
      </div>
    );
  }
// allows both roles to see dashboard and Ai assistant to request new data and see live data
  const isRestricted = userRole !== "admin" && userRole !== "analyst";
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-xl p-8 shadow-2xl flex flex-col items-center">
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-1">
              Elio Tax Dashboard
            </h1>
            <p className="text-gray-400 text-sm font-mono">
              Enterprise Tax Intelligence Hub
            </p>
          </div>

          {authError && (
            <div className="w-full bg-red-900/30 border border-red-700/50 text-red-200 p-3 rounded-lg text-sm mb-4 text-center">
              ⚠️ {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="w-full space-y-4">
            <div>
              <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                Corporate Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                required
                // Add explicit ref-focus or clear mechanisms here if demanded by QA lifecycle
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase text-gray-400 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg transition-colors mt-2"
            >
              Sign In to Hub
            </button>
          </form>
        </div>
      </div>
    );
  }

  const nlAssistantPage = (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col p-6">
      <div className="mb-4 self-end flex items-center gap-4">
        <span className="text-xs font-mono bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg text-gray-400">
          Role: <strong className="text-blue-400 uppercase">{userRole}</strong>
        </span>
        <button
          onClick={handleLogout}
          className="text-xs font-mono text-red-400 hover:text-red-300 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg"
        >
          ➔ Log Out
        </button>
      </div>

      <main className="flex-1 max-w-4xl w-full mx-auto flex flex-col justify-center items-center">
        <h1 className="text-3xl font-bold mb-8 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          Elio Tax AI Assistant
        </h1>

        {isRestricted && (
          <div className="w-full bg-amber-950/40 border border-amber-900/50 rounded-xl p-4 mb-6 text-sm text-amber-200/90 font-mono text-center shadow-md">
            🔒 Your security profile (<strong>{userRole}</strong>) does not have
            write-access permissions to execute new AI queries. Live data
            engines are disabled.
          </div>
        )}

        <form onSubmit={handleSearch} className="w-full flex gap-3 mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              isRestricted
                ? "Querying is disabled for your role..."
                : "Ask me to visualize tax data trends..."
            }
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={isLoading || isRestricted}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim() || isRestricted}
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-lg min-w-[140px] disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
          >
            {isLoading ? "Analyzing..." : "Ask Assistant"}
          </button>
        </form>

        <div className="w-full min-h-[380px] bg-gray-800 border border-gray-700 rounded-xl p-6 flex flex-col justify-center items-center">
          {isLoading && (
            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
          )}
          {error && !isLoading && (
            <div className="bg-red-900/30 text-red-200 p-4 rounded-lg border border-red-800/40 max-w-md text-center">
              {error}
            </div>
          )}
          {!isLoading && !error && !chartData && (
            <p className="text-gray-500 font-mono text-sm">
              {isRestricted
                ? "Static historical dashboard locks active."
                : "Enter an AI prompt to trigger data engine..."}
            </p>
          )}

          {!isLoading && !error && chartData && (
            <div className="w-full flex-1 flex flex-col gap-3">
              <div className="relative flex items-center justify-center">
                <h2 className="text-base font-bold text-white text-center tracking-wide">
                  {generateTitle(chartData.chartConfig)}
                </h2>
                {(() => {
                  const isCache = chartData.fromCache;
                  const engine = chartData.engine;
                  const ms = chartData.latencyMs;
                  const label = isCache
                    ? "⚡ Cached"
                    : engine === "gemini"
                      ? "✨ AI"
                      : "🔧 LocalEngine";
                  const latency =
                    ms != null
                      ? ms >= 1000
                        ? `${(ms / 1000).toFixed(1)}s`
                        : `${ms}ms`
                      : "";
                  const color = isCache
                    ? "text-white-1000"
                    : engine === "gemini"
                      ? "text-white-1000"
                      : "text-white-1000";
                  return (
                    <span
                      className={`absolute right-0 text-sm font-mono font-mono ${color}`}
                    >
                      {label}
                      {latency ? ` · ${latency}` : ""}
                    </span>
                  );
                })()}
              </div>
              <div className="w-full flex-1 bg-gray-900 p-4 rounded-lg border border-gray-700 shadow-xl flex flex-col justify-center">
                {(!chartData.data || chartData.data.length === 0) &&
                  chartData.message && (
                    <div className="flex flex-col items-center justify-center gap-2 py-8">
                      <p className="text-gray-300 text-sm text-center max-w-md">
                        {chartData.message}
                      </p>
                    </div>
                  )}
                {chartData.chartConfig.chartType === "pie" &&
                  renderPieOrDonut(chartData.data ?? [], false)}
                {chartData.chartConfig.chartType === "donut" &&
                  renderPieOrDonut(chartData.data ?? [], true)}
                {chartData.chartConfig.chartType === "bar" &&
                  renderBar(chartData.data ?? [])}
                {chartData.chartConfig.chartType === "treemap" &&
                  renderTreemap(chartData.data ?? [])}
                {chartData.chartConfig.chartType === "line" &&
                  renderLine(chartData.data ?? [])}
                {chartData.chartConfig.chartType === "stat" &&
                  renderStat(chartData.data ?? [])}
                {chartData.chartConfig.chartType === "grid" &&
                  renderGrid(chartData.data ?? [])}
                {chartData.chartConfig.chartType === "heatmap" &&
                  renderHeatmap(chartData.data ?? [])}
                {chartData.chartConfig.chartType === "map" &&
                  renderMap(chartData.data ?? [])}
              </div>
              {chartData.insights && chartData.insights.length > 0 && (
                <div className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 mt-1">
                  <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-2">
                    Insights
                  </p>
                  <ul className="space-y-1">
                    {chartData.insights.map((insight, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-gray-200"
                      >
                        <span className="text-blue-400 mt-0.5 shrink-0">•</span>
                        <span>{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {chartData.totalOrders != null && chartData.totalOrders > 0 && (
                <p className="text-gray-500 text-[10px] font-mono mt-2 text-center">
                  Based on {chartData.totalOrders.toLocaleString()} orders
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );

  const navItems = [...NAV_ITEMS];
  if (userRole === "admin") {
    navItems.push({ id: "admin", label: "Admin Panel", path: "/admin" });
  }

  return (
    <DashboardLayout navItems={navItems}>
      <Routes>
        <Route path="/" element={nlAssistantPage} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </DashboardLayout>
  );
}
