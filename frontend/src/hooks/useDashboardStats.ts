import { useState, useEffect } from "react";
import type { DashboardStats } from "../types/dashboard";

export interface DashboardFilters {
  year?:     number | null;
  yearFrom?: number | null;
  yearTo?:   number | null;
  province?: string | null;
  status?:   string | null;
  category?: string | null;
}

interface UseDashboardStatsResult {
  data:    DashboardStats | null;
  loading: boolean;
  error:   string | null;
}

function buildQuery(filters: DashboardFilters): string {
  const args: string[] = [];

  if (filters.year)     args.push(`year: ${filters.year}`);
  if (filters.yearFrom) args.push(`yearFrom: ${filters.yearFrom}`);
  if (filters.yearTo)   args.push(`yearTo: ${filters.yearTo}`);
  if (filters.province) args.push(`province: "${filters.province}"`);
  if (filters.status)   args.push(`status: "${filters.status}"`);
  if (filters.category) args.push(`category: "${filters.category}"`);

  const argStr = args.length > 0 ? `(${args.join(", ")})` : "";

  return `
    query {
      dashboardStats${argStr} {
        taxSummary       { grossRevenue netSales totalTaxCollected }
        yearlyRevenue    { year revenue }
        ordersByStatus   { status count }
        topProductGroups { name revenue }
        topProvinces     { province orders revenue }
        topProducts      { name revenue }
        bottomProducts   { name revenue }
      }
    }
  `;
}

export function useDashboardStats(filters: DashboardFilters = {}): UseDashboardStatsResult {
  const [data,    setData]    = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchStats() {
      setLoading(true);
      setError(null);
      try {
        const apiUrl = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000";
        const response = await fetch(`${apiUrl}/graphql`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          signal:  controller.signal,
          body:    JSON.stringify({ query: buildQuery(filters) }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const json = await response.json();

        if (json.errors?.length) {
          throw new Error(json.errors[0].message);
        }

        const stats = json.data?.dashboardStats;
        const REQUIRED_FIELDS = ["ordersByStatus", "topProductGroups", "topProvinces", "topProducts", "bottomProducts"] as const;
        const missing = REQUIRED_FIELDS.filter(f => !Array.isArray(stats?.[f]));
        if (stats?.taxSummary == null) missing.push("taxSummary" as never);
        if (missing.length) {
          throw new Error(`Incomplete response from server: missing ${missing.join(", ")}`);
        }

        setData(stats as DashboardStats);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
    return () => controller.abort();
  }, [filters.year, filters.yearFrom, filters.yearTo, filters.province, filters.status, filters.category]);

  return { data, loading, error };
}
