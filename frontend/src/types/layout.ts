export interface SidebarNavItem {
  id: string;
  label: string;
  path: string;
}

export interface DashboardUser {
  name: string;
  role: 'admin' | 'analyst' | 'viewer';
}