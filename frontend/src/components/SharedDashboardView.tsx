import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Dashboard } from "./Dashboard";
import type { DashboardFilters } from "../hooks/useDashboardStats";
import type { DashboardShareGetResponse } from "../../../shared/types/share";

export function SharedDashboardView() {
  const { id } = useParams<{ id: string }>();

  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "ready"; data: DashboardShareGetResponse }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    const token = sessionStorage.getItem("token");

    if (!token) {
      // No token — redirect to the share URL so the login form appears
      // (App.tsx shows login when token is absent, keeping the URL intact)
      window.location.href = `/share/${id}`;
      return;
    }

    const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000";

    fetch(`${API_URL}/api/dashboard-shares/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async res => {
        if (res.status === 401 || res.status === 403) {
          // Token is expired — clear it so App.tsx shows the login form
          sessionStorage.removeItem("token");
          sessionStorage.removeItem("user");
          // Hard reload keeps the URL as /share/<id> so login redirects back here
          window.location.reload();
          return;
        }
        if (res.status === 404) {
          setState({ status: "error", message: "This share link does not exist or has been removed." });
          return;
        }
        if (!res.ok) {
          setState({ status: "error", message: "Failed to load shared dashboard." });
          return;
        }
        const data: DashboardShareGetResponse = await res.json();
        setState({ status: "ready", data });
      })
      .catch(() => setState({ status: "error", message: "Network error. Please try again." }));
  }, [id]);

  const handleSignOut = () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    window.location.href = "/";
  };

  const header = (
    <div className="flex items-center justify-between px-6 py-3 bg-gray-900 border-b border-gray-700">
      <span className="text-sm font-semibold text-slate-400 tracking-wide">
        Elio Tax — Shared Dashboard
      </span>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSignOut}
          className="text-xs font-mono text-red-400 hover:text-red-300 bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg"
        >
          ➔ Log Out
        </button>
      </div>
    </div>
  );

  if (state.status === "loading") {
    return (
      <div className="min-h-screen bg-gray-900">
        {header}
        <div className="flex items-center justify-center h-64 text-gray-400">
          Loading shared dashboard…
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col">
        {header}
        <div className="m-6 bg-red-900/30 text-red-200 p-4 rounded-lg border border-red-800/40">
          <p className="font-medium">{state.message}</p>
          <a
            href="/dashboard"
            className="inline-block mt-3 text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Go to your dashboard
          </a>
        </div>
      </div>
    );
  }

  const { data } = state;
  let initialFilters: DashboardFilters = {};
  try {
    initialFilters = JSON.parse(data.filtersJson);
  } catch {
    // falls back to no filters
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {header}
      {data.title && (
        <div className="px-6 pt-4 pb-0">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Shared Dashboard</p>
          <h2 className="text-xl font-semibold text-slate-300">{data.title}</h2>
        </div>
      )}
      <Dashboard initialFilters={initialFilters} viewerMode={true} />
    </div>
  );
}