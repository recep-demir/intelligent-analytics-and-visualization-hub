import { useState, useEffect } from "react";
import type { DashboardStats } from "../types/dashboard";

const DASHBOARD_QUERY = `
  query {
    dashboardStats {
      monthlyRevenue   { month revenue }
      ordersByStatus   { status count }
      topProductGroups { name revenue }
      topProvinces     { province orders }
      categoryRevenue  { category revenue }
    }
  }
`;

interface UseDashboardStatsResult {
  data:    DashboardStats | null;
  loading: boolean;
  error:   string | null;
}

export function useDashboardStats(): UseDashboardStatsResult {
  const [data,    setData]    = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchStats() {
      try {
        const apiUrl = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000";
        const response = await fetch(`${apiUrl}/graphql`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          signal:  controller.signal,
          body:    JSON.stringify({ query: DASHBOARD_QUERY }),
        });

        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`);
        }

        const json = await response.json();

        if (json.errors?.length) {
          throw new Error(json.errors[0].message);
        }

        setData(json.data.dashboardStats as DashboardStats);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
    return () => controller.abort();
  }, []);

  return { data, loading, error };
}
