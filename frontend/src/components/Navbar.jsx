import React from 'react';
import { useAuth } from '../App';
import { LogOut, LayoutDashboard, HeartPulse } from 'lucide-react';

export default function Navbar({ currentHash }) {
  const { user, logout } = useAuth();
  const cleanHash = currentHash.split('?')[0];

  // Fix double Dr. prefix printing
  const getDisplayName = () => {
    if (!user) return '';
    if (user.role === 'doctor') {
      const nameLower = user.name.toLowerCase();
      if (nameLower.startsWith('dr.') || nameLower.startsWith('dr ')) {
        return user.name;
      }
      return `Dr. ${user.name}`;
    }
    return user.name;
  };

  // Get name initials for avatar fallback
  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ').filter(p => p.trim() !== '');
    const cleanParts = parts.filter(p => !p.toLowerCase().startsWith('dr.')); // avoid Dr. in initials
    if (cleanParts.length === 0) return 'U';
    if (cleanParts.length === 1) return cleanParts[0][0].toUpperCase();
    return (cleanParts[0][0] + cleanParts[cleanParts.length - 1][0]).toUpperCase();
  };

  return (
    <nav className="navbar animate-fade-in">
      <a href="#/home" className="nav-logo">
        <HeartPulse size={22} style={{ color: 'var(--primary)' }} />
        <span>MedConnect</span>
      </a>

      <div className="nav-links">
        <a href="#/home" className={`nav-link ${(cleanHash === '#/' || cleanHash === '#/home') ? 'active' : ''}`}>
          Home
        </a>
        
        {user ? (
          <>
            <a href="#/dashboard" className={`nav-link ${cleanHash === '#/dashboard' ? 'active' : ''}`}>
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </a>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginLeft: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600 }}>
                {user.profilePic ? (
                  <img src={user.profilePic} alt={user.name} className="user-avatar-nav" />
                ) : (
                  <div className="user-avatar-initials">{getInitials(user.name)}</div>
                )}
                <span className="user-name-span">{getDisplayName()}</span>
              </div>
              
              <button onClick={logout} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                <LogOut size={14} />
                <span className="btn-text">Sign Out</span>
              </button>
            </div>
          </>
        ) : (
          <a href="#/login" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.9rem' }}>
            Get Started
          </a>
        )}
      </div>
    </nav>
  );
}
