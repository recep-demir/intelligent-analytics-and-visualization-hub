import React from 'react';
import { NavLink } from 'react-router-dom';
import styles from '../styles/Layout.module.css';
import type { SidebarNavItem } from '../types/layout';

const NAV_ICONS: Record<string, string> = {
  dashboard: '▤',
  assistant: '✦',
  admin: '⚙',
};

interface DashboardLayoutProps {
  children: React.ReactNode;
  navItems: SidebarNavItem[];
  userRole: string;
  onLogout: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, navItems, userRole, onLogout }) => {
  return (
    <div className={styles.dashboardContainer}>
      <aside className={styles.sidebar} style={{
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, #080d14 0%, #0d1520 100%)',
        borderRight: '1px solid #1e2d3d',
      }}>
        {/* Brand */}
        {/* Brand */}
        <div style={{ padding: '1.25rem 1.25rem 1rem', borderBottom: '1px solid #1a2540' }}>
          <svg width="148" height="42" viewBox="0 0 148 42" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* "elio" in green */}
            <text
              x="0" y="28"
              fontFamily="Georgia, 'Times New Roman', serif"
              fontSize="35"
              fill="#6abf70"
              fontWeight="400"
              letterSpacing="-0.5"
            >elio</text>
            {/* "TAX" in white bold */}
            <text
              x="60" y="28"
              fontFamily="'Arial Black', Arial, sans-serif"
              fontSize="35"
              fill="#ffffff"
              fontWeight="900"
            >TAX</text>
          </svg>
        </div>
        {/* Nav */}
        <nav style={{ flex: 1, padding: '1rem 0.75rem' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                margin: '0.2rem 0', padding: '0.6rem 0.75rem',
                borderRadius: '0.5rem', textDecoration: 'none',
                fontSize: '0.875rem', fontWeight: isActive ? 600 : 400,
                color: isActive ? '#38bdf8' : '#64748b',
                background: isActive ? 'rgba(56,189,248,0.08)' : 'transparent',
                borderLeft: `2px solid ${isActive ? '#38bdf8' : 'transparent'}`,
                transition: 'all 0.15s',
              })}
            >
              <span style={{ fontSize: '0.9rem' }}>{NAV_ICONS[item.id] ?? '○'}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer label */}
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #1a2540' }}>
          <p style={{
            fontSize: '0.6rem', color: '#1f2937', fontWeight: 500,
            textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center',
          }}>Elio Tax Intelligence</p>
        </div>
      </aside>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
          gap: '0.625rem', padding: '0.6rem 1.5rem',
          background: '#080d14', borderBottom: '1px solid #1a2540',
        }}>
          <span style={{
            fontSize: '0.7rem', fontFamily: 'monospace',
            background: '#0d1520', border: '1px solid #1e2d3d',
            padding: '0.35rem 0.75rem', borderRadius: '0.5rem', color: '#64748b',
          }}>
            Role: <strong style={{ color: '#38bdf8', textTransform: 'uppercase' }}>{userRole}</strong>
          </span>
          <button
            onClick={onLogout}
            style={{
              fontSize: '0.7rem', fontFamily: 'monospace',
              color: '#f87171', background: '#0d1520',
              border: '1px solid #1e2d3d', borderRadius: '0.5rem',
              padding: '0.35rem 0.875rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '0.375rem',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#ef4444')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e2d3d')}
          >
            ➔ Log Out
          </button>
        </div>

        <main className={styles.mainContent} style={{ flex: 1, overflow: 'auto' }}>
          {children}
        </main>
      </div>
    </div>
  );
};