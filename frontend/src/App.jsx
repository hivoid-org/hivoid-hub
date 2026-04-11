import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import SettingsPage from './pages/Settings';
import ConnectedUsers from './pages/ConnectedUsers';
import NodesPage from './pages/Nodes';
import Login from './pages/Login';
import SecurityPage from './pages/Security';
import AdminSettings from './pages/AdminSettings';
import SubInfo from './pages/SubInfo';
import SubPageSettings from './pages/SubPageSettings';
import Sidebar from './components/layout/Sidebar';
import AutoLock from './components/layout/AutoLock';
import API from './services/api';

// ─── Auth Helpers ──────────────────────────────────────────────────────────────
function getStoredAuth() {
  const token = localStorage.getItem('hivoid_token');
  const user = localStorage.getItem('hivoid_user');
  return token ? { token, user } : null;
}

// ─── Protected Route Guard ─────────────────────────────────────────────────────
function ProtectedRoute({ auth, loginPath, children }) {
  if (!auth) {
    const fullPath = loginPath.startsWith('/') ? loginPath : `/${loginPath}`;
    return <Navigate to={fullPath} replace />;
  }
  return children;
}

// ─── Not Found Page (Stealth Mode: Mimics default Nginx) ──────────────────────
function NotFound() {
  return (
    <div style={{ 
      background: '#fff', 
      color: '#000', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      paddingTop: '60px',
      alignItems: 'center'
    }}>
      <div style={{ width: '100%', maxWidth: '600px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 500, margin: '0 0 10px 0' }}>404 Not Found</h1>
        <hr style={{ border: '0', borderTop: '1px solid #ccc', margin: '15px 0' }} />
        <p style={{ fontSize: '14px', margin: '0', color: '#000' }}>nginx</p>
      </div>
    </div>
  );
}

// ─── App Shell ─────────────────────────────────────────────────────────────────
function AppShell({ auth, onLogout }) {
  return (
    <AutoLock>
      <div className="app-container">
        <Sidebar user={auth?.user} onLogout={onLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/nodes" element={<NodesPage />} />
            <Route path="/users" element={<UserManagement />} />
            <Route path="/network-settings" element={<SettingsPage />} />
            <Route path="/settings" element={<AdminSettings />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/sub-page-settings" element={<SubPageSettings />} />
            <Route path="/connected-users" element={<ConnectedUsers />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </AutoLock>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────────
function App() {
  const [auth, setAuth] = useState(getStoredAuth);
  const [loginPath, setLoginPath] = useState('login');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const init = async () => {
      try {
        const res = await API.getLoginPath();
        if (alive) setLoginPath(res.login_path || 'login');
      } catch (err) {
        console.error("Failed to load login path", err);
      } finally {
        if (alive) setLoading(false);
      }
    };
    init();
    return () => { alive = false; };
  }, []);

  const handleLoginSuccess = (username) => {
    setAuth({ token: localStorage.getItem('hivoid_token'), user: username });
  };

  const handleLogout = () => {
    // Fire and forget logout to clear session in Redis
    API.logout().catch(() => {});
    
    localStorage.removeItem('hivoid_token');
    localStorage.removeItem('hivoid_user');
    localStorage.removeItem('hub_locked');
    localStorage.removeItem('hub_last_activity');
    localStorage.removeItem('hub_timeout_current');
    setAuth(null);
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spin" style={{ width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%' }} />
      </div>
    );
  }

  const normalizedLoginPath = loginPath.startsWith('/') ? loginPath : `/${loginPath}`;

  return (
    <Router>
      <Routes>
        {/*
           The only way to reach the login page is via the custom secret path.
           Any other path accessed while not logged in will render a 404 (NotFound).
        */}
        <Route path={normalizedLoginPath} element={
          auth ? <Navigate to="/" replace /> : <Login onLoginSuccess={handleLoginSuccess} />
        } />
        
        {/* Public routes (e.g. sharing sub info) */}
        <Route path="/sub/:uuid" element={<SubInfo />} />

        {/* 
           Catch-all: 
           If logged in -> AppShell (Dashboard + Admin areas)
           If not logged in -> NotFound (Stealth Mode)
        */}
        <Route path="/*" element={
          auth ? (
            <AppShell auth={auth} onLogout={handleLogout} />
          ) : (
            <NotFound />
          )
        } />
      </Routes>
    </Router>
  );
}

export default App;
