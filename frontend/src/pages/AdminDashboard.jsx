import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import { UserCheck, Users, ShieldAlert, Award, FileText, BadgeCent, Stethoscope, RefreshCw, BarChart2 } from 'lucide-react';

export default function AdminDashboard({ API_URL }) {
  const { token } = useAuth();
  
  // Pending Doctors
  const [doctors, setDoctors] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Global Bookings
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Refund State
  const [refundLoading, setRefundLoading] = useState(false);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = () => {
    fetchDoctors();
    fetchBookings();
  };

  // Fetch all doctor profiles for approval
  const fetchDoctors = async () => {
    setLoadingDocs(true);
    try {
      const res = await fetch(`${API_URL}/doctors/admin/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDoctors(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Fetch all platform bookings
  const fetchBookings = async () => {
    setLoadingBookings(true);
    try {
      const res = await fetch(`${API_URL}/appointments/admin/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Approve Doctor License
  const handleApproveDoctor = async (docId, approveStatus) => {
    const action = approveStatus ? 'APPROVE' : 'REJECT';
    if (!window.confirm(`Are you sure you want to ${action} this doctor profile?`)) return;

    try {
      const res = await fetch(`${API_URL}/doctors/${docId}/approve`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isApproved: approveStatus })
      });

      if (res.ok) {
        alert(`Doctor has been ${approveStatus ? 'approved' : 'disabled'} successfully.`);
        fetchDoctors();
      } else {
        const data = await res.json();
        alert(data.message || 'Error updating doctor profile');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Process Refund for Cancelled Appointment
  const handleProcessRefund = async (apptId) => {
    if (!window.confirm('Process refund for this cancelled appointment? This will call the Razorpay refund simulation.')) return;

    setRefundLoading(true);
    try {
      const res = await fetch(`${API_URL}/payments/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ appointmentId: apptId })
      });

      const data = await res.json();
      if (res.ok) {
        alert('Refund processed successfully. Patient has been notified.');
        fetchBookings();
      } else {
        alert(data.message || 'Refund failed');
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to refund endpoint.');
    } finally {
      setRefundLoading(false);
    }
  };

  // Metrics calculations
  const totalVolume = bookings
    .filter(b => b.paymentStatus === 'paid' || b.paymentStatus === 'refunded')
    .reduce((sum, b) => sum + (b.doctorId?.consultationFee || 500), 0);

  const pendingApprovals = doctors.filter(d => !d.isApproved);
  const activeBookings = bookings.filter(b => b.status === 'accepted');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '36px' }} className="animate-fade-in">
      
      {/* Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Admin Dashboard</h2>
          <p style={{ color: 'var(--text-muted)' }}>Moderate users, verify doctor credentials, and coordinate refunds.</p>
        </div>
        <button onClick={fetchAdminData} className="btn btn-secondary" style={{ display: 'flex', gap: '6px' }}>
          <RefreshCw size={16} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Analytics widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(15, 118, 110, 0.08)', display: 'flex' }}>
            <UserCheck size={24} style={{ color: 'var(--primary)' }} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending Approvals</span>
            <h3 style={{ fontSize: '1.75rem', margin: 0 }}>{pendingApprovals.length}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(14, 165, 233, 0.08)', display: 'flex' }}>
            <Users size={24} style={{ color: '#38bdf8' }} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Bookings</span>
            <h3 style={{ fontSize: '1.75rem', margin: 0 }}>{bookings.length}</h3>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.08)', display: 'flex' }}>
            <BadgeCent size={24} style={{ color: '#10b981' }} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Volume Channeled</span>
            <h3 style={{ fontSize: '1.75rem', margin: 0, color: '#10b981' }}>₹{totalVolume}</h3>
          </div>
        </div>
      </div>

      {/* Main Grid: Pending approvals on Left, Global bookings on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '36px' }}>
        
        {/* Doctor Approvals Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <ShieldAlert size={18} style={{ color: '#fbbf24' }} />
            <span>Doctor License Verification Portal</span>
          </h3>

          {loadingDocs ? (
            <div>Loading profiles...</div>
          ) : pendingApprovals.length === 0 ? (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              All doctor registrations verified and approved. No pending items.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {pendingApprovals.map(doc => (
                <div key={doc._id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', margin: 0 }}>Dr. {doc.name}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <Stethoscope size={14} style={{ color: 'var(--primary)' }} /> {doc.speciality}
                    </p>
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)', padding: '10px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div><strong>License Number:</strong> <code style={{ color: '#38bdf8', fontSize: '0.85rem' }}>{doc.licenseNumber}</code></div>
                    <div><strong>Experience:</strong> {doc.experience} Years</div>
                    <div><strong>Proposed Fee:</strong> ₹{doc.consultationFee}</div>
                    <div><strong>Languages:</strong> {doc.languages?.join(', ')}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                    <button 
                      onClick={() => handleApproveDoctor(doc._id, false)} 
                      className="btn btn-secondary" 
                      style={{ flex: 1, padding: '8px', fontSize: '0.8rem', color: '#ef4444' }}
                    >
                      Reject License
                    </button>
                    <button 
                      onClick={() => handleApproveDoctor(doc._id, true)} 
                      className="btn btn-primary" 
                      style={{ flex: 1, padding: '8px', fontSize: '0.8rem' }}
                    >
                      Approve Profile
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global Bookings Directory Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <BarChart2 size={18} style={{ color: '#38bdf8' }} />
            <span>Global Consultation Directory</span>
          </h3>

          {loadingBookings ? (
            <div>Loading bookings logs...</div>
          ) : bookings.length === 0 ? (
            <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No bookings logged on platform.
            </div>
          ) : (
            <div className="glass-panel" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.02)' }}>
                    <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Patient</th>
                    <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Doctor</th>
                    <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Date/Time</th>
                    <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Payment</th>
                    <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
                    <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map(b => (
                    <tr key={b._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ fontWeight: 600 }}>{b.patientId?.name || 'Deleted'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.patientId?.email}</div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div>Dr. {b.doctorId?.name || 'Deleted'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{b.doctorId?.speciality}</div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div>{b.date}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.startTime} - {b.endTime}</div>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span className={`badge ${b.paymentStatus === 'paid' ? 'badge-success' : b.paymentStatus === 'refunded' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                          {b.paymentStatus}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span className={`badge ${b.status === 'completed' ? 'badge-success' : b.status === 'cancelled' || b.status === 'rejected' ? 'badge-danger' : 'badge-primary'}`} style={{ fontSize: '0.65rem', textTransform: 'capitalize' }}>
                          {b.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                        {/* Process refund if cancelled by patient/doctor and paid */}
                        {b.status === 'cancelled' && b.paymentStatus === 'paid' && (
                          <button
                            onClick={() => handleProcessRefund(b._id)}
                            className="btn btn-danger"
                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            disabled={refundLoading}
                          >
                            Process Refund
                          </button>
                        )}
                        {b.paymentStatus === 'refunded' && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Refunded ✓</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
