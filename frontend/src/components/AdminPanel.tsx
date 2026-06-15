import React, { useState, useEffect } from "react";

interface User {
  id: string;
  email: string;
  role: "admin" | "analyst" | "viewer";
}

export function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer"); 
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const API_URL = (import.meta as any).env?.VITE_API_URL ?? "http://localhost:4000";

  // 🔄 1. Fetch All Active System Users (GET /api/admin/users)
  const fetchUsers = async () => {
    try {
      // 🔑 Dynamically extract the latest token from storage on every request life-cycle
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/api/admin/users`, {
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch user list (401/403).");
      const data = await response.json();
      setUsers(data.users);
    } catch (err) {
      console.error("🔴 Admin fetch error:", err);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ➕ 2. Provision New Corporate Account (POST /api/admin/users)
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      // 🔑 Dynamically extract the latest token to prevent stale credentials
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/api/admin/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ email, password, role }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Account creation failed.");
      }

      setMessage({ type: "success", text: "✨ User account created successfully!" });
      setEmail("");
      setPassword("");
      setRole("viewer");
      fetchUsers(); 
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  // 🔄 3. Modify Existing User Security Role (PATCH /api/admin/users/:id/role)
  const handleRoleUpdate = async (userId: string, newRole: string) => {
    try {
      // 🔑 Dynamically extract authorization credentials
      const token = localStorage.getItem("token");

      const response = await fetch(`${API_URL}/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) throw new Error("Failed to update role.");
      
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole as any } : u));
    } catch (err) {
      alert("🔴 You do not have permission to update roles or an error occurred.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 space-y-8">
      <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
        🛡️ Admin Control Panel - User Access Management
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT SIDE: Create New User Form */}
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 h-fit">
          <h2 className="text-xl font-semibold mb-4 text-blue-400">Create New Account</h2>
          
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-mono">EMAIL ADDRESS</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="team.member@eliotax.com"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 font-mono">PASSWORD</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1 font-mono">ASSIGN SYSTEM ROLE</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none cursor-pointer"
              >
                <option value="viewer">Viewer (Read-Only)</option>
                <option value="analyst">Analyst (Write/Query Access)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-medium py-2 rounded-lg text-sm transition-all"
            >
              {loading ? "Creating Account..." : "Create User Account"}
            </button>
          </form>

          {message && (
            <div className={`mt-4 p-3 rounded-lg text-xs text-center font-medium ${
              message.type === "success" ? "bg-emerald-950/40 text-emerald-300 border border-emerald-900/50" : "bg-red-950/40 text-red-300 border border-red-900/50"
            }`}>
              {message.text}
            </div>
          )}
        </div>

        {/* RIGHT SIDE: Active Users List & Role Management */}
        <div className="lg:col-span-2 bg-gray-800 border border-gray-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4 text-emerald-400">Active System Users</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="bg-gray-900 text-gray-400 text-xs font-mono uppercase tracking-wider border-b border-gray-700">
                <tr>
                  <th className="p-3">User Email</th>
                  <th className="p-3">Current Role</th>
                  <th className="p-3 text-right">Quick Access Management</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-700/20 transition-all">
                    <td className="p-3 font-medium text-white">{user.email}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                        user.role === "admin" ? "bg-red-950 text-red-400 border border-red-900/30" :
                        user.role === "analyst" ? "bg-blue-950 text-blue-400 border border-blue-900/30" : "bg-gray-900 text-gray-400 border border-gray-700"
                      }`}>
                        {user.role.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {user.role === "admin" ? (
                        <span className="text-xs text-gray-500 italic font-mono">Primary Root Admin</span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleUpdate(user.id, e.target.value)}
                          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none cursor-pointer"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="analyst">Analyst</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}