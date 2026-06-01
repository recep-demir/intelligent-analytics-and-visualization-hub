import React from 'react';
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
            <div key={item.id} style={{ margin: '0.75rem 0', cursor: 'pointer' }}>
              {item.label}
            </div>
          ))}
        </nav>
      </aside>
      
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
};