import React, { useState } from 'react';
import { useAuth } from '../App';
import { Eye, EyeOff, KeyRound, Mail, User as UserIcon } from 'lucide-react';

export default function LoginRegister() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('patient'); // patient, doctor, admin
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Doctor Fields
  const [speciality, setSpeciality] = useState('General Physician');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [experience, setExperience] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  
  // Available Specialties
  const specialties = [
    'General Physician',
    'Cardiologist',
    'Dermatologist',
    'Pediatrician',
    'Gynecologist',
    'Orthopedic',
    'Neurologist'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await login(email, password);
        window.location.hash = '#/dashboard';
      } else {
        const userData = {
          name,
          email,
          password,
          role
        };

        if (role === 'doctor') {
          userData.speciality = speciality;
          userData.licenseNumber = licenseNumber;
          userData.experience = experience;
          userData.consultationFee = consultationFee;
        }

        await register(userData);
        window.location.hash = '#/dashboard';
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container animate-fade-in">
      {/* Illustration Column */}
      <div className="login-illustration-wrapper">
        <img 
          src="/login_hero.png" 
          alt="Secure Telehealth Portal Login" 
          className="login-illustration"
        />
      </div>

      {/* Form Card Column */}
      <div className="glass-panel" style={{ padding: '36px' }}>
        
        {/* Header Tabs (Login / Register) */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
          <button 
            type="button" 
            onClick={() => { setIsLogin(true); setError(''); }}
            style={{ 
              flex: 1, 
              padding: '12px', 
              background: 'none', 
              border: 'none', 
              color: isLogin ? 'var(--primary)' : 'var(--text-muted)', 
              fontFamily: 'inherit',
              fontWeight: 700, 
              cursor: 'pointer',
              borderBottom: isLogin ? '2px solid var(--primary)' : 'none'
            }}
          >
            Sign In
          </button>
          <button 
            type="button" 
            onClick={() => { setIsLogin(false); setError(''); }}
            style={{ 
              flex: 1, 
              padding: '12px', 
              background: 'none', 
              border: 'none', 
              color: !isLogin ? 'var(--primary)' : 'var(--text-muted)', 
              fontFamily: 'inherit',
              fontWeight: 700, 
              cursor: 'pointer',
              borderBottom: !isLogin ? '2px solid var(--primary)' : 'none'
            }}
          >
            Create Account
          </button>
        </div>

        <h2 style={{ fontSize: '1.75rem', marginBottom: '8px', textAlign: 'center' }}>
          {isLogin ? 'Welcome Back' : 'Join MedConnect'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', marginBottom: '24px' }}>
          {isLogin ? 'Access your telehealth consultation portal' : 'Register to get diagnostic & specialist access'}
        </p>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Role selector for registration */}
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Register As</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['patient', 'doctor', 'admin'].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`btn ${role === r ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, padding: '8px 12px', textTransform: 'capitalize', fontSize: '0.85rem' }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Full Name (Sign Up only) */}
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <div style={{ position: 'relative' }}>
                <UserIcon size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: '#64748b' }} />
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  required 
                  className="form-input" 
                  placeholder="John Doe" 
                  style={{ width: '100%', paddingLeft: '44px' }}
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: '#64748b' }} />
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                className="form-input" 
                placeholder="you@example.com" 
                style={{ width: '100%', paddingLeft: '44px' }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <KeyRound size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: '#64748b' }} />
              <input 
                type={showPassword ? 'text' : 'password'} 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                className="form-input" 
                placeholder="••••••••" 
                style={{ width: '100%', paddingLeft: '44px', paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '14px', top: '14px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Doctor specific fields */}
          {!isLogin && role === 'doctor' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '2px solid var(--primary)', paddingLeft: '16px', margin: '8px 0' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '-8px' }}>Medical Verification Details</h4>
              
              <div className="form-group">
                <label className="form-label">Speciality</label>
                <select 
                  value={speciality} 
                  onChange={(e) => setSpeciality(e.target.value)}
                  className="form-select"
                  style={{ width: '100%' }}
                >
                  {specialties.map(spec => (
                    <option key={spec} value={spec}>{spec}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">License Number</label>
                <input 
                  type="text" 
                  value={licenseNumber} 
                  onChange={(e) => setLicenseNumber(e.target.value)} 
                  required 
                  className="form-input" 
                  placeholder="MC-12345" 
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Experience (Years)</label>
                  <input 
                    type="number" 
                    value={experience} 
                    onChange={(e) => setExperience(e.target.value)} 
                    required 
                    min="1"
                    className="form-input" 
                    placeholder="5" 
                    style={{ width: '100%' }}
                  />
                </div>

                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Fee (INR)</label>
                  <input 
                    type="number" 
                    value={consultationFee} 
                    onChange={(e) => setConsultationFee(e.target.value)} 
                    required 
                    min="100"
                    className="form-input" 
                    placeholder="500" 
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '12px', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-dim)' }}>
          By continuing, you agree to MedConnect's terms of service and privacy policies.
        </div>
      </div>
    </div>
  );
}
