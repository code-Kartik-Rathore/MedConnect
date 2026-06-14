import React, { createContext, useState, useEffect, useContext } from 'react';
import Home from './pages/Home';
import LoginRegister from './pages/LoginRegister';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Navbar from './components/Navbar';

// Create Authentication Context
export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);
  const [currentHash, setCurrentHash] = useState(window.location.hash || '#/');
  const [viewParams, setViewParams] = useState({});

  let rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5050/api';
  if (rawApiUrl.endsWith('/')) {
    rawApiUrl = rawApiUrl.slice(0, -1);
  }
  if (!rawApiUrl.endsWith('/api')) {
    rawApiUrl = `${rawApiUrl}/api`;
  }
  const API_URL = rawApiUrl;

  // Listen to hash changes for routing
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash || '#/';
      setCurrentHash(hash);
      
      // Parse parameters (e.g., #/consultation?id=123)
      if (hash.includes('?')) {
        const queryStr = hash.split('?')[1];
        const params = {};
        new URLSearchParams(queryStr).forEach((val, key) => {
          params[key] = val;
        });
        setViewParams(params);
      } else {
        setViewParams({});
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange(); // Run on initial render

    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Fetch current user details on load
  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      // If user is already set (e.g. via login/register), don't reload
      if (user) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          // Token expired or invalid
          logout();
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [token, user]);

  // Auth Operations
  const login = async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Login failed');
    }

    localStorage.setItem('token', data.token);
    setToken(data.token);

    // Fetch full user details immediately to prevent navigation race conditions
    try {
      const meRes = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${data.token}`
        }
      });
      if (meRes.ok) {
        const userData = await meRes.json();
        setUser(userData);
      } else {
        setUser(data);
      }
    } catch (err) {
      console.error('Failed to fetch user profile after login:', err);
      setUser(data);
    }

    return data;
  };

  const register = async (userData) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || 'Registration failed');
    }

    localStorage.setItem('token', data.token);
    setToken(data.token);

    // Fetch full user details immediately to prevent navigation race conditions
    try {
      const meRes = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${data.token}`
        }
      });
      if (meRes.ok) {
        const fullUserData = await meRes.json();
        setUser(fullUserData);
      } else {
        setUser(data);
      }
    } catch (err) {
      console.error('Failed to fetch user profile after registration:', err);
      setUser(data);
    }

    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    window.location.hash = '#/login';
  };

  // Simple view routing logic
  const renderView = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
          <div style={{ width: '40px', height: '40px', border: '3px solid rgba(13, 255, 210, 0.1)', borderTopColor: '#0dffd2', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Restoring secure session...</p>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
      );
    }

    const cleanHash = currentHash.split('?')[0];

    switch (cleanHash) {
      case '#/':
      case '#/home':
        return <Home API_URL={API_URL} />;
      case '#/login':
        if (user) {
          window.location.hash = '#/dashboard';
          return null;
        }
        return <LoginRegister API_URL={API_URL} />;
      case '#/dashboard':
        if (!user) {
          window.location.hash = '#/login';
          return null;
        }
        if (user.role === 'patient') return <PatientDashboard API_URL={API_URL} params={viewParams} />;
        if (user.role === 'doctor') return <DoctorDashboard API_URL={API_URL} params={viewParams} />;
        if (user.role === 'admin') return <AdminDashboard API_URL={API_URL} params={viewParams} />;
        return <Home API_URL={API_URL} />;
      default:
        return <Home API_URL={API_URL} />;
    }
  };

  return (
    <AuthContext.Provider value={{ user, setUser, token, login, register, logout, API_URL }}>
      <Navbar currentHash={currentHash} />
      <div className="app-container">
        {renderView()}
      </div>
    </AuthContext.Provider>
  );
}
