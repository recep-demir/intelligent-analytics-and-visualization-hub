import React from 'react';
import { NavLink } from 'react-router-dom';
import styles from '../styles/Layout.module.css';
import type { SidebarNavItem } from '../types/layout';

interface DashboardLayoutProps {
  children: React.ReactNode;
  navItems: SidebarNavItem[];
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, navItems }) => {
  return (
    <div className={styles.dashboardContainer}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTitle}>Playground Hub</div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              style={({ isActive }) => ({
                display: 'block',
                margin: '0.75rem 0',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.375rem',
                color: isActive ? '#38bdf8' : '#cbd5e1',
                background: isActive ? 'rgba(56,189,248,0.1)' : 'transparent',
                textDecoration: 'none',
                fontWeight: isActive ? 600 : 400,
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
};