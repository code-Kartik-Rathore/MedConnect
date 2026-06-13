import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import ChatRoom from '../components/ChatRoom';
import Modal from '../components/Modal';
import { Calendar, Clock, Plus, Trash2, Check, X, FileSpreadsheet, PlusCircle, Sparkles, Send, Stethoscope, Star, BadgePercent, User, Upload, AlertTriangle, FileText, ArrowRight } from 'lucide-react';

export default function DoctorDashboard({ API_URL }) {
  const { user, setUser, token } = useAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState('overview'); // overview, profile

  // Profile Form States
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileSpeciality, setProfileSpeciality] = useState(user?.speciality || '');
  const [profileLanguages, setProfileLanguages] = useState(user?.languages?.join(', ') || '');
  const [profileExperience, setProfileExperience] = useState(user?.experience || 0);
  const [profileFee, setProfileFee] = useState(user?.consultationFee || 0);
  const [profilePic, setProfilePic] = useState(user?.profilePic || '');
  const [profilePicPreview, setProfilePicPreview] = useState(user?.profilePic || '');
  const [profileSaveLoading, setProfileSaveLoading] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');

  // Handle local image file uploads and convert to Base64
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileErrorMsg('Image size should be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfilePic(reader.result); // Base64 string
      setProfilePicPreview(reader.result); // Base64 string for preview
    };
    reader.onerror = () => {
      setProfileErrorMsg('Error reading file');
    };
    reader.readAsDataURL(file);
  };

  // Submit profile updates to backend
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSaveLoading(true);
    setProfileSuccessMsg('');
    setProfileErrorMsg('');

    try {
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: profileName,
          email: profileEmail,
          speciality: profileSpeciality,
          languages: profileLanguages,
          experience: profileExperience,
          consultationFee: profileFee,
          profilePic
        })
      });

      let data;
      try {
        data = await res.json();
      } catch (e) {
        data = { message: `Server error (${res.status}). Failed to parse response.` };
      }
      if (res.ok) {
        setProfileSuccessMsg('Profile updated successfully!');
        setUser(data); // update context state
      } else {
        setProfileErrorMsg(data.message || 'Failed to update profile.');
      }
    } catch (err) {
      console.error(err);
      setProfileErrorMsg('Network error. Failed to update profile.');
    } finally {
      setProfileSaveLoading(false);
    }
  };
  
  // Slots State
  const [slots, setSlots] = useState([]);
  const [slotDate, setSlotDate] = useState(new Date().toISOString().split('T')[0]);
  const [slotTime, setSlotTime] = useState('09:00');
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Appointments State
  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(false);

  // Active Consult State
  const [activeConsult, setActiveConsult] = useState(null);

  // Patient Medical Reports State for current consultation
  const [patientReports, setPatientReports] = useState([]);
  const [loadingPatientReports, setLoadingPatientReports] = useState(false);
  const [selectedPatientReport, setSelectedPatientReport] = useState(null);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('prescription'); // prescription, reports
  const [reportDetailTab, setReportDetailTab] = useState('insights'); // insights, findings

  // Prescription Builder State
  const [diagnosis, setDiagnosis] = useState('');
  const [medicines, setMedicines] = useState([{ name: '', dosage: '', frequency: '', duration: '' }]);
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [submittingPrescription, setSubmittingPrescription] = useState(false);

  useEffect(() => {
    fetchSlots();
    fetchAppointments();
  }, []);

  useEffect(() => {
    if (activeConsult && activeConsult.patientId) {
      fetchPatientReports(activeConsult.patientId._id);
    } else {
      setPatientReports([]);
      setActiveWorkspaceTab('prescription');
    }
  }, [activeConsult]);

  const fetchPatientReports = async (patientId) => {
    setLoadingPatientReports(true);
    try {
      const res = await fetch(`${API_URL}/reports?patientId=${patientId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setPatientReports(data);
      }
    } catch (err) {
      console.error('Error fetching patient reports:', err);
    } finally {
      setLoadingPatientReports(false);
    }
  };

  // Fetch Slots
  const fetchSlots = async () => {
    setLoadingSlots(true);
    try {
      const res = await fetch(`${API_URL}/slots/doctor/${user._id}?all=true`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSlots(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSlots(false);
    }
  };

  // Fetch Appointments
  const fetchAppointments = async () => {
    setLoadingAppts(true);
    try {
      const res = await fetch(`${API_URL}/appointments/my-bookings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAppts(false);
    }
  };

  // Add Availability Slot
  const handleAddSlot = async (e) => {
    e.preventDefault();
    if (!slotDate || !slotTime) return;

    // Calculate end time (+30 minutes)
    const [hours, minutes] = slotTime.split(':').map(Number);
    const endMinutes = (minutes + 30) % 60;
    const endHours = hours + Math.floor((minutes + 30) / 60);
    const formattedEndTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

    try {
      const res = await fetch(`${API_URL}/slots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          slots: [{
            date: slotDate,
            startTime: slotTime,
            endTime: formattedEndTime
          }]
        })
      });

      const data = await res.json();
      if (res.ok) {
        fetchSlots();
      } else {
        alert(data.message || 'Failed to create slot.');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating slot.');
    }
  };

  // Delete Slot
  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Delete this available slot?')) return;

    try {
      const res = await fetch(`${API_URL}/slots/${slotId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        fetchSlots();
      } else {
        const data = await res.json();
        alert(data.message || 'Cannot delete slot.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Update Booking Status (Accept/Reject)
  const handleUpdateStatus = async (apptId, newStatus) => {
    const confirmMsg = newStatus === 'rejected' ? 'Are you sure you want to REJECT this appointment? This triggers a refund if they paid.' : 'Accept this consultation appointment?';
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`${API_URL}/appointments/${apptId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        fetchAppointments();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to update status.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Prescription Medicines Builder helpers
  const handleMedChange = (index, field, value) => {
    const updated = [...medicines];
    updated[index][field] = value;
    setMedicines(updated);
  };

  const addMedRow = () => {
    setMedicines([...medicines, { name: '', dosage: '', frequency: '', duration: '' }]);
  };

  const removeMedRow = (index) => {
    if (medicines.length === 1) return;
    setMedicines(medicines.filter((_, idx) => idx !== index));
  };

  // Submit digital prescription
  const handlePrescribeSubmit = async (e) => {
    e.preventDefault();
    if (!diagnosis.trim()) {
      alert('Please fill out a diagnosis.');
      return;
    }

    const invalidMed = medicines.some(m => !m.name.trim() || !m.dosage.trim() || !m.frequency.trim() || !m.duration.trim());
    if (invalidMed) {
      alert('Please fill out all fields for each prescribed medicine.');
      return;
    }

    setSubmittingPrescription(true);
    try {
      const res = await fetch(`${API_URL}/appointments/${activeConsult._id}/prescription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          diagnosis,
          medicines,
          notes: prescriptionNotes
        })
      });

      if (res.ok) {
        alert('Digital prescription saved! MedConnect AI has compiled consultation summaries.');
        setActiveConsult(null);
        setDiagnosis('');
        setMedicines([{ name: '', dosage: '', frequency: '', duration: '' }]);
        setPrescriptionNotes('');
        fetchAppointments();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to submit prescription');
      }
    } catch (err) {
      console.error(err);
      alert('Server error saving prescription.');
    } finally {
      setSubmittingPrescription(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">
      
      {/* Header & Earnings */}
      <div className="dashboard-banner glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', boxSizing: 'border-box' }}>
        <div>
          <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Doctor Dashboard</h2>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Status: {user.isApproved ? (
              <span className="badge badge-success">Approved & Verified</span>
            ) : (
              <span className="badge badge-warning">Pending License Verification</span>
            )}
          </p>
        </div>

        {/* Analytics stats */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="glass-panel" style={{ padding: '12px 20px', textAlign: 'center', minWidth: '120px', background: 'rgba(255, 255, 255, 0.7)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Consult Rating</span>
            <h4 style={{ fontSize: '1.5rem', color: '#fbbf24', display: 'flex', alignItems: 'center', justify: 'center', gap: '4px', margin: 0 }}>
              <Star size={18} style={{ fill: '#fbbf24' }} />
              {user.rating ? user.rating.toFixed(1) : '5.0'}
            </h4>
          </div>
          
          <div className="glass-panel" style={{ padding: '12px 20px', textAlign: 'center', minWidth: '150px', background: 'rgba(255, 255, 255, 0.7)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Earnings</span>
            <h4 style={{ fontSize: '1.5rem', color: '#10b981', margin: 0 }}>₹{user.earnings || 0}</h4>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      {!activeConsult && (
        <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginTop: '-12px' }}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '10px' }}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '10px' }}
          >
            My Profile
          </button>
        </div>
      )}

      {/* Main Grid Layout */}
      {activeConsult ? (
        // Active Consultation Workspace (Chat + Prescription Panel side-by-side)
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.4rem' }}>
              Consulting: <span style={{ color: 'var(--primary)' }}>{activeConsult.patientId?.name}</span>
            </h3>
            <button 
              onClick={() => setActiveConsult(null)} 
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              Exit consultation panel
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }}>
            {/* Left: Chat */}
            <ChatRoom 
              appointmentId={activeConsult._id}
              currentUser={user}
              partnerName={activeConsult.patientId?.name}
            />

            {/* Right Side Consultation Workspace Panel */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Secondary Tabs */}
              <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab('prescription')}
                  className={`btn ${activeWorkspaceTab === 'prescription' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px' }}
                >
                  <Stethoscope size={13} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
                  <span style={{ verticalAlign: 'middle' }}>Write Digital Rx</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkspaceTab('reports')}
                  className={`btn ${activeWorkspaceTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px' }}
                >
                  <Sparkles size={13} style={{ marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
                  <span style={{ verticalAlign: 'middle' }}>Patient Medical Reports ({patientReports.length})</span>
                </button>
              </div>

              {activeWorkspaceTab === 'prescription' ? (
                /* PRESCRIPTION WRITER FORM */
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Stethoscope size={20} style={{ color: 'var(--primary)' }} />
                    <h4 style={{ margin: 0, fontSize: '1.15rem' }}>Write Digital Prescription (Rx)</h4>
                  </div>

                  <form onSubmit={handlePrescribeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Diagnosis */}
                    <div className="form-group">
                      <label className="form-label">Diagnosis</label>
                      <input
                        type="text"
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        required
                        className="form-input"
                        placeholder="e.g. Acute Dermatitis, Upper Respiratory Infection"
                      />
                    </div>

                    {/* Medicines List Builder */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <label className="form-label" style={{ margin: 0 }}>Prescribed Medicines</label>
                        <button 
                          type="button" 
                          onClick={addMedRow} 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', gap: '4px' }}
                        >
                          <PlusCircle size={12} /> Add Medicine
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {medicines.map((med, index) => (
                          <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(15, 23, 42, 0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1.5 }}>
                              <input 
                                type="text" 
                                value={med.name} 
                                onChange={(e) => handleMedChange(index, 'name', e.target.value)} 
                                placeholder="Name (e.g. Paracetamol)" 
                                className="form-input" 
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                              <input 
                                type="text" 
                                value={med.dosage} 
                                onChange={(e) => handleMedChange(index, 'dosage', e.target.value)} 
                                placeholder="Dosage (e.g. 500mg)" 
                                className="form-input" 
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                              <input 
                                type="text" 
                                value={med.frequency} 
                                onChange={(e) => handleMedChange(index, 'frequency', e.target.value)} 
                                placeholder="Freq (e.g. 1-0-1)" 
                                className="form-input" 
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                              <input 
                                type="text" 
                                value={med.duration} 
                                onChange={(e) => handleMedChange(index, 'duration', e.target.value)} 
                                placeholder="Dur (e.g. 5 days)" 
                                className="form-input" 
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                              />
                            </div>
                            <button 
                              type="button" 
                              onClick={() => removeMedRow(index)}
                              className="btn btn-danger"
                              style={{ padding: '8px', borderRadius: '6px' }}
                              disabled={medicines.length === 1}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Additional Notes */}
                    <div className="form-group">
                      <label className="form-label">Additional Instructions / Notes</label>
                      <textarea
                        value={prescriptionNotes}
                        onChange={(e) => setPrescriptionNotes(e.target.value)}
                        rows="3"
                        className="form-textarea"
                        placeholder="Take medicine after meals. Complete bed rest for 2 days. Drink plenty of warm fluids."
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '12px' }}
                      disabled={submittingPrescription}
                    >
                      {submittingPrescription ? 'Submitting & generating summaries...' : 'Submit Rx & Close Consultation'}
                    </button>
                  </form>
                </>
              ) : (
                /* PATIENT REPORTS LISTING FOR DOCTORS */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={20} style={{ color: 'var(--primary)' }} />
                    <h4 style={{ margin: 0, fontSize: '1.15rem' }}>Patient's Health Records</h4>
                  </div>
                  
                  {loadingPatientReports ? (
                    <div style={{ textAlign: 'center', padding: '40px' }}>
                      <div style={{ width: '24px', height: '24px', border: '2px solid rgba(15, 118, 110, 0.15)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                    </div>
                  ) : patientReports.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                      <FileText size={32} style={{ color: '#64748b', marginBottom: '8px', opacity: 0.6 }} />
                      <p style={{ fontSize: '0.9rem', margin: 0 }}>No medical reports uploaded by this patient.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                      {patientReports.map(report => (
                        <div 
                          key={report._id} 
                          style={{ 
                            padding: '14px', 
                            background: 'rgba(15, 23, 42, 0.02)', 
                            border: '1px solid var(--border-color)', 
                            borderRadius: '10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px'
                          }}
                        >
                          <div style={{ overflow: 'hidden' }}>
                            <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', display: 'block', marginBottom: '2px' }}>
                              {report.analysis?.report_type || "Lab Report"}
                            </span>
                            <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {report.fileName}
                            </strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginTop: '2px' }}>
                              Severity: <strong style={{ color: ['high', 'critical'].includes(report.analysis?.severity) ? '#ef4444' : 'inherit' }}>{report.analysis?.severity || "low"}</strong> | {new Date(report.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              setSelectedPatientReport(report);
                              setReportDetailTab('insights');
                            }}
                            className="btn btn-primary"
                            style={{ padding: '4px 12px', fontSize: '0.75rem', flexShrink: 0 }}
                          >
                            Review
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      ) : activeTab === 'profile' ? (
        // Render Profile Editor View
        <div className="glass-panel animate-fade-in" style={{ padding: '36px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={22} style={{ color: 'var(--primary)' }} />
            <span>Edit Doctor Profile</span>
          </h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            Update your public listing details, speciality, languages, consultation fee, and upload a profile photo.
          </p>

          {profileSuccessMsg && (
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
              {profileSuccessMsg}
            </div>
          )}

          {profileErrorMsg && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
              {profileErrorMsg}
            </div>
          )}

          <form onSubmit={handleProfileSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Profile Picture Upload Section */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', background: 'rgba(15, 23, 42, 0.02)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                {profilePicPreview ? (
                  <img src={profilePicPreview} alt="Profile preview" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary)' }} />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem', fontWeight: 700, border: '1px solid var(--border-color)' }}>
                    {profileName ? profileName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0,2).toUpperCase() : 'DR'}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '200px' }}>
                <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>Profile Photo</label>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <label className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
                    <Upload size={14} />
                    <span>Upload Image</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                  </label>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Max 2MB. Supports PNG, JPG, JPEG.</span>
                </div>
                <input
                  type="text"
                  value={profilePic}
                  onChange={(e) => { setProfilePic(e.target.value); setProfilePicPreview(e.target.value); }}
                  placeholder="Or paste profile image URL directly..."
                  className="form-input"
                  style={{ padding: '6px 10px', fontSize: '0.8rem', marginTop: '4px' }}
                />
              </div>
            </div>

            {/* General Fields Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                  required
                  className="form-input"
                />
              </div>
            </div>

            {/* Specialty & Languages */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="form-group">
                <label className="form-label">Speciality</label>
                <select
                  value={profileSpeciality}
                  onChange={(e) => setProfileSpeciality(e.target.value)}
                  required
                  className="form-input"
                  style={{ height: '42px' }}
                >
                  <option value="General Physician">General Physician</option>
                  <option value="Cardiologist">Cardiologist</option>
                  <option value="Dermatologist">Dermatologist</option>
                  <option value="Pediatrician">Pediatrician</option>
                  <option value="Gynecologist">Gynecologist</option>
                  <option value="Orthopedic">Orthopedic</option>
                  <option value="Neurologist">Neurologist</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Languages (comma separated)</label>
                <input
                  type="text"
                  value={profileLanguages}
                  onChange={(e) => setProfileLanguages(e.target.value)}
                  placeholder="e.g. English, Hindi, Spanish"
                  required
                  className="form-input"
                />
              </div>
            </div>

            {/* Experience & Fee */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
               <div className="form-group">
                 <label className="form-label">Experience (years)</label>
                 <input
                   type="number"
                   min="0"
                   value={profileExperience}
                   onChange={(e) => setProfileExperience(e.target.value)}
                   required
                   className="form-input"
                 />
               </div>

               <div className="form-group">
                 <label className="form-label">Consultation Fee (₹)</label>
                 <input
                   type="number"
                   min="0"
                   value={profileFee}
                   onChange={(e) => setProfileFee(e.target.value)}
                   required
                   className="form-input"
                 />
               </div>
            </div>

            {/* License details indicator */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--primary-glow)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color-glow)' }}>
              <Sparkles size={16} style={{ color: 'var(--primary)' }} />
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                License Number: <strong>{user?.licenseNumber}</strong>. To update registration licensing details, please contact system support.
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '12px', fontSize: '0.95rem', fontWeight: 700, marginTop: '8px' }}
              disabled={profileSaveLoading}
            >
              {profileSaveLoading ? 'Saving changes...' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      ) : (
        // Standard View (Slots Manager on Left, Appointments Queue on Right)
        <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: '32px', alignItems: 'start' }}>
          
          {/* Slots Manager Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--primary)' }} />
                <span>Publish availability Slot</span>
              </h3>

              <form onSubmit={handleAddSlot} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    value={slotDate}
                    onChange={(e) => setSlotDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Start Time</label>
                  <input
                    type="time"
                    value={slotTime}
                    onChange={(e) => setSlotTime(e.target.value)}
                    required
                    className="form-input"
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={!user.isApproved}
                >
                  <Plus size={16} />
                  <span>Publish 30-min Slot</span>
                </button>
              </form>
            </div>

            {/* Slots List */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '16px' }}>Your Slots Schedule</h3>
              {loadingSlots ? (
                <div style={{ textAlign: 'center', padding: '10px' }}>Loading...</div>
              ) : slots.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No slots published.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                  {slots.map(slot => (
                    <div key={slot._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(15, 23, 42, 0.02)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>{slot.date}</strong> @ {slot.startTime} - {slot.endTime}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {slot.status === 'booked' ? (
                          <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Booked</span>
                        ) : (
                          <>
                            <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>Available</span>
                            <button 
                              onClick={() => handleDeleteSlot(slot._id)} 
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Appointments Queue Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Consultation Booking Requests</h3>

            {loadingAppts ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>Loading queue...</div>
            ) : appointments.length === 0 ? (
              <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Clock size={32} style={{ color: '#64748b', marginBottom: '12px' }} />
                <p>No active booking requests in queue.</p>
              </div>
            ) : (
              appointments.map(appt => (
                <div key={appt._id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <h4 style={{ fontSize: '1.1rem', margin: 0 }}>{appt.patientId?.name || 'Patient'}</h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{appt.patientId?.email}</p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginBottom: '4px' }}>
                        <span className="badge badge-primary">{appt.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}</span>
                        <span className="badge badge-warning" style={{ textTransform: 'capitalize' }}>{appt.status}</span>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{appt.date} @ {appt.startTime}</span>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(15, 23, 42, 0.02)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem' }}>
                    <strong>Symptoms reported:</strong> {appt.symptomsDescription}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                    {appt.status === 'pending' && (
                      <>
                        <button 
                          onClick={() => handleUpdateStatus(appt._id, 'rejected')} 
                          className="btn btn-secondary" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#ef4444' }}
                        >
                          <X size={14} /> Reject
                        </button>
                        <button 
                          onClick={() => handleUpdateStatus(appt._id, 'accepted')} 
                          className="btn btn-primary" 
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          <Check size={14} /> Accept
                        </button>
                      </>
                    )}

                    {appt.status === 'accepted' && appt.paymentStatus === 'paid' && (
                      <button 
                        onClick={() => setActiveConsult(appt)} 
                        className="btn btn-primary" 
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        <Clock size={14} />
                        <span>Enter Consultation Panel</span>
                      </button>
                    )}

                    {appt.status === 'completed' && (
                      <span className="badge badge-success" style={{ padding: '6px 12px' }}>Consultation Finished</span>
                    )}

                    {appt.status === 'cancelled' && (
                      <span className="badge badge-danger" style={{ padding: '6px 12px' }}>Appointment Cancelled</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      )}

      {/* PATIENT REPORT REVIEW MODAL FOR DOCTOR */}
      {selectedPatientReport && (
        <Modal
          isOpen={selectedPatientReport !== null}
          onClose={() => setSelectedPatientReport(null)}
          title={`Clinical Review: ${selectedPatientReport.fileName}`}
          maxWidth="850px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '78vh', overflowY: 'auto', paddingRight: '4px', boxSizing: 'border-box' }}>
            
            {/* Severity Warning Alert Box */}
            {selectedPatientReport.analysis?.requires_urgent_attention && (
              <div style={{ background: 'rgba(239, 68, 68, 0.07)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '14px', borderRadius: '12px', display: 'flex', gap: '10px' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.92rem', display: 'block', marginBottom: '2px' }}>Urgent Clinical Concern</strong>
                  <span style={{ fontSize: '0.85rem' }}>{selectedPatientReport.analysis?.urgent_reason}</span>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <button 
                type="button"
                onClick={() => setReportDetailTab('insights')} 
                className={`btn ${reportDetailTab === 'insights' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px' }}
              >
                AI Insights & Summary
              </button>
              <button 
                type="button"
                onClick={() => setReportDetailTab('findings')} 
                className={`btn ${reportDetailTab === 'findings' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px' }}
              >
                Abnormal Lab Values ({selectedPatientReport.analysis?.abnormal_findings?.length || 0})
              </button>
            </div>

            {reportDetailTab === 'insights' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'rgba(15, 118, 110, 0.03)', border: '1px solid rgba(15, 118, 110, 0.1)', padding: '16px', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem', color: 'var(--primary)' }}>Patient Friendly Explanation</h4>
                  <p style={{ fontSize: '0.88rem', margin: 0, lineHeight: '1.5', color: 'var(--text-main)' }}>
                    {selectedPatientReport.analysis?.patient_friendly_explanation}
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '16px' }}>
                  <div className="glass-panel" style={{ padding: '16px' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Clinical Summary</h4>
                    <p style={{ fontSize: '0.85rem', margin: 0, lineHeight: '1.4', color: 'var(--text-muted)' }}>
                      {selectedPatientReport.analysis?.summary}
                    </p>
                  </div>
                  <div className="glass-panel" style={{ padding: '16px' }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>AI Potential Concerns</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.84rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {selectedPatientReport.analysis?.potential_concerns?.map((c, i) => (
                        <li key={i}>{c}</li>
                      )) || <li>No concerns flagged.</li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {reportDetailTab === 'findings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedPatientReport.analysis?.abnormal_findings?.length > 0 ? (
                  selectedPatientReport.analysis.abnormal_findings.map((f, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        background: 'rgba(245, 158, 11, 0.03)', 
                        border: '1px solid rgba(245, 158, 11, 0.15)', 
                        borderLeft: '4px solid #f59e0b', 
                        padding: '12px', 
                        borderRadius: '8px',
                        display: 'grid',
                        gridTemplateColumns: '1.5fr 1fr 1fr 2fr',
                        gap: '10px',
                        alignItems: 'start'
                      }}
                    >
                      <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Finding</span>
                        <strong style={{ fontSize: '0.84rem' }}>{f.finding}</strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Value</span>
                        <span style={{ fontSize: '0.84rem', color: '#ef4444', fontWeight: 700 }}>{f.value}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Ref Range</span>
                        <span style={{ fontSize: '0.84rem' }}>{f.reference_range}</span>
                      </div>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Clinical Note</span>
                        <p style={{ fontSize: '0.8rem', margin: 0, color: 'var(--text-muted)', lineHeight: '1.3' }}>{f.explanation}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: '0.88rem', color: '#10b981', textAlign: 'center' }}>All parameters reported within healthy ranges.</p>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '6px' }}>
              <div>
                {selectedPatientReport.fileUrl && (
                  <a 
                    href={selectedPatientReport.fileUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-secondary" 
                    style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                  >
                    Download Original PDF
                  </a>
                )}
              </div>
              <button 
                type="button"
                onClick={() => setSelectedPatientReport(null)} 
                className="btn btn-primary"
              >
                Close Review
              </button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
