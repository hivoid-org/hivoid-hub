import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Radio, Settings, Server, Sun, Moon, LogOut, Menu, X, Monitor, Shield, History, SlidersHorizontal } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/nodes', label: 'Nodes', icon: Server },
  { path: '/users', label: 'Users', icon: Users },
  { path: '/connected-users', label: 'Online', icon: Radio },
  { path: '/security', label: 'Audit Logs', icon: History },
  { path: '/network-settings', label: 'Network', icon: SlidersHorizontal },
  { path: '/settings', label: 'Settings', icon: Settings },
  { path: '/sub-page-settings', label: 'Sub Page', icon: Monitor },
];

export default function Sidebar({ user, onLogout }) {
  const location = useLocation();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isOpen, setIsOpen] = useState(false);
  const logoSrc = theme === 'light' ? '/logo-dark.png' : '/logo-light.png';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="mobile-header">
        <div className="mobile-header-brand">
          <img src={logoSrc} alt="HiVoid" className="brand-logo-sm" />
          <span className="brand-text">HiVoid</span>
        </div>
        <button
          className="mobile-menu-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Overlay */}
      {isOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <nav className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Close button (mobile) */}
        <button
          className="sidebar-close-btn"
          onClick={() => setIsOpen(false)}
          aria-label="Close menu"
        >
          <X size={24} />
        </button>

        {/* Brand */}
        <div className="sidebar-brand">
          <img src={logoSrc} alt="HiVoid" className="brand-logo-lg" />
          <div className="brand-info">
            <h2 className="brand-title">HiVoid</h2>
            <span className="brand-subtitle">Hub v1.0.2</span>
          </div>
        </div>

        {/* Nav Items */}
        <div className="sidebar-nav">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item-active' : ''}`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span>{item.label}</span>
                {isActive && <div className="nav-item-indicator" />}
              </Link>
            );
          })}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Logged-in user */}
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">
              {user?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <span className="sidebar-user-name">{user || 'Admin'}</span>
          </div>

          <button onClick={toggleTheme} className="sidebar-footer-btn">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>

          <button onClick={onLogout} className="sidebar-footer-btn sidebar-logout-btn">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </nav>
    </>
  );
}
