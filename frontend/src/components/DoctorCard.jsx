import React from 'react';
import { Star, DollarSign, Languages, Award, Stethoscope } from 'lucide-react';

export default function DoctorCard({ doctor, onBookClick }) {
  const getInitials = (name) => {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="doctor-card glass-panel animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
        <div className="doctor-avatar-square">
          {doctor.profilePic ? (
            <img 
              src={doctor.profilePic} 
              alt={doctor.name} 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            getInitials(doctor.name)
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <h4 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>Dr. {doctor.name}</h4>
          <span className="badge badge-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-start' }}>
            <Stethoscope size={11} />
            {doctor.speciality}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
            <Star size={14} style={{ color: '#fbbf24', fill: '#fbbf24' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
              {doctor.rating ? doctor.rating.toFixed(1) : '5.0'}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>/ 5.0</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={16} style={{ color: 'var(--primary)' }} />
            Experience
          </span>
          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{doctor.experience} Years</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Languages size={16} style={{ color: '#38bdf8' }} />
            Languages
          </span>
          <span style={{ fontWeight: 700, color: 'var(--text-main)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
            {doctor.languages ? doctor.languages.join(', ') : 'English'}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--border-color)', paddingTop: '10px', marginTop: '4px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: 'var(--text-main)' }}>
            <DollarSign size={18} style={{ color: '#10b981' }} />
            Consultation Fee
          </span>
          <span style={{ fontSize: '1.2rem', fontWeight: '800', color: '#10b981' }}>₹{doctor.consultationFee}</span>
        </div>
      </div>

      <button 
        onClick={() => onBookClick(doctor)} 
        className="btn btn-primary"
        style={{ width: '100%', marginTop: 'auto', padding: '12px', borderRadius: '12px', fontSize: '0.95rem' }}
      >
        Book Appointment
      </button>
    </div>
  );
}
