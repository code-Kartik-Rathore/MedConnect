import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import ChatRoom from '../components/ChatRoom';
import Modal from '../components/Modal';
import { Calendar, CreditCard, MessageSquare, FileText, XCircle, Sparkles, Download, Stethoscope, AlertTriangle, Upload, Trash2, ArrowRight } from 'lucide-react';

export default function PatientDashboard({ API_URL }) {
  const { user, token } = useAuth();
  
  // Bookings list
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected Chat Session
  const [activeConsultation, setActiveConsultation] = useState(null);

  // Selected AI Summary / Notes
  const [selectedAIReview, setSelectedAIReview] = useState(null);

  // Payment State
  const [payingAppt, setPayingAppt] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [isMockPayment, setIsMockPayment] = useState(true);
  const [orderData, setOrderData] = useState(null);

  // Medical Reports State
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Tabs: 'appointments' or 'reports'
  const [activeTab, setActiveTab] = useState('appointments');
  const [detailTab, setDetailTab] = useState('insights'); // insights, findings, chat

  useEffect(() => {
    fetchMyBookings();
    fetchMyReports();
  }, []);

  const fetchMyReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch(`${API_URL}/reports`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data);
      }
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoadingReports(false);
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Only PDF medical reports are supported.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds the 5MB limit.');
      return;
    }

    setUploading(true);
    setUploadProgress('Reading PDF file...');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setUploadProgress('AI is extracting text and analyzing report findings...');
        const base64 = reader.result;
        
        const res = await fetch(`${API_URL}/reports/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            fileBase64: base64,
            fileName: file.name
          })
        });

        const data = await res.json();
        if (res.ok) {
          fetchMyReports();
          alert('Report analyzed successfully! View clinical details in the reports list.');
        } else {
          alert(data.message || 'Failed to analyze report.');
        }
      } catch (err) {
        console.error(err);
        alert('Network error occurred during report upload.');
      } finally {
        setUploading(false);
        setUploadProgress('');
      }
    };
    reader.onerror = () => {
      alert('Error reading PDF file.');
      setUploading(false);
      setUploadProgress('');
    };
    reader.readAsDataURL(file);
  };

  const handleSendChat = async (reportId) => {
    if (!chatMessage.trim()) return;

    setChatLoading(true);
    try {
      const res = await fetch(`${API_URL}/reports/${reportId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: chatMessage })
      });

      if (res.ok) {
        const data = await res.json();
        // Update selectedReport state
        setSelectedReport(prev => ({
          ...prev,
          chatHistory: data.chatHistory
        }));
        // Update in reports list
        setReports(prev => prev.map(r => r._id === reportId ? { ...r, chatHistory: data.chatHistory } : r));
        setChatMessage('');
      } else {
        const data = await res.json();
        alert(data.message || 'AI chat helper failed.');
      }
    } catch (err) {
      console.error(err);
      alert('Network error communicating with AI.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Delete this report and its AI analysis? This action is permanent.')) return;

    try {
      const res = await fetch(`${API_URL}/reports/${reportId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchMyReports();
        if (selectedReport?._id === reportId) {
          setSelectedReport(null);
        }
      } else {
        alert('Failed to delete report.');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const fetchMyBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/appointments/my-bookings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      } else {
        const data = await res.ok ? {} : await res.json();
        setError(data.message || 'Failed to retrieve bookings.');
      }
    } catch (err) {
      console.error(err);
      setError('Connection failure. Could not reload dashboard.');
    } finally {
      setLoading(false);
    }
  };

  // Cancel Appointment
  const handleCancelAppointment = async (apptId) => {
    if (!window.confirm('Are you sure you want to cancel this appointment? If paid, a refund request will be filed.')) return;

    try {
      const res = await fetch(`${API_URL}/appointments/${apptId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'cancelled',
          cancellationReason: 'Cancelled by patient from portal.'
        })
      });

      if (res.ok) {
        fetchMyBookings();
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to cancel appointment.');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating status.');
    }
  };

  // Complete Payment (Razorpay sandbox simulator or real checkout setup)
  const handleStartPayment = async (appt) => {
    setPayingAppt(appt);
    setPaymentSuccess(false);
    setPaymentLoading(true);
    setOrderData(null);
    try {
      const orderRes = await fetch(`${API_URL}/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ appointmentId: appt._id })
      });

      const data = await orderRes.json();
      if (orderRes.ok) {
        setOrderData(data);
        setIsMockPayment(data.isMock);
      } else {
        alert(data.message || 'Failed to initialize payment.');
        setPayingAppt(null);
      }
    } catch (err) {
      console.error(err);
      alert('Error connecting to payment gateway.');
      setPayingAppt(null);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!orderData) {
      alert('Payment order details not loaded yet. Please try again.');
      return;
    }
    setPaymentLoading(true);
    try {
      if (orderData.isMock) {
        console.log('Using simulated mock payment flow...');
        const verifyRes = await fetch(`${API_URL}/payments/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            appointmentId: payingAppt._id,
            simulateSuccess: true
          })
        });

        if (verifyRes.ok) {
          setPaymentSuccess(true);
          setTimeout(() => {
            setPayingAppt(null);
            fetchMyBookings();
          }, 1500);
        } else {
          const verifyData = await verifyRes.json();
          throw new Error(verifyData.message || 'Payment verification failed');
        }
      } else {
        // Real/Test Razorpay Checkout Flow
        const options = {
          key: orderData.keyId,
          name: 'MedConnect Telehealth',
          description: `Consultation Fee - Ref: ${payingAppt._id.slice(-6)}`,
          order_id: orderData.orderId,
          handler: async function (response) {
            setPaymentLoading(true);
            try {
              const verifyRes = await fetch(`${API_URL}/payments/verify`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  appointmentId: payingAppt._id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature
                })
              });

              if (verifyRes.ok) {
                setPaymentSuccess(true);
                setTimeout(() => {
                  setPayingAppt(null);
                  fetchMyBookings();
                }, 1500);
              } else {
                const verifyData = await verifyRes.json();
                alert(`Verification failed: ${verifyData.message || 'Signature check failed'}`);
              }
            } catch (err) {
              console.error(err);
              alert('Error during payment verification.');
            } finally {
              setPaymentLoading(false);
            }
          },
          prefill: {
            name: user?.name || '',
            email: user?.email || ''
          },
          theme: {
            color: '#0f766e'
          },
          modal: {
            ondismiss: function () {
              setPaymentLoading(false);
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      }
    } catch (err) {
      console.error(err);
      alert(`Payment failed: ${err.message}`);
      setPaymentLoading(false);
    }
  };

  // Download PDF
  const handleDownloadPDF = (apptId) => {
    window.open(`${API_URL}/appointments/${apptId}/prescription/pdf?token=${token}`, '_blank');
    
    // Fallback: If opening in new tab requires query param auth, let's trigger native download:
    fetch(`${API_URL}/appointments/${apptId}/prescription/pdf`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to download');
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prescription_${apptId.slice(-6)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(err => console.error('Silent download fallback failed:', err));
  };

  // Download Invoice PDF
  const handleDownloadInvoice = (apptId) => {
    window.open(`${API_URL}/appointments/${apptId}/invoice/pdf?token=${token}`, '_blank');
    
    // Fallback: If opening in new tab requires query param auth, trigger native download:
    fetch(`${API_URL}/appointments/${apptId}/invoice/pdf`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to download');
        return res.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice_${apptId.slice(-6)}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch(err => console.error('Silent download fallback failed:', err));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <span className="badge badge-warning">Pending Payment</span>;
      case 'accepted': return <span className="badge badge-primary">Approved</span>;
      case 'rejected': return <span className="badge badge-danger">Rejected</span>;
      case 'completed': return <span className="badge badge-success">Completed</span>;
      case 'cancelled': return <span className="badge badge-danger">Cancelled</span>;
      default: return <span className="badge badge-secondary">{status}</span>;
    }
  };

  const getPaymentStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <span className="badge badge-warning" style={{ opacity: 0.8 }}>Unpaid</span>;
      case 'paid': return <span className="badge badge-success" style={{ opacity: 0.8 }}>Paid</span>;
      case 'refunded': return <span className="badge badge-danger" style={{ opacity: 0.8 }}>Refunded</span>;
      default: return null;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in">
      
      <div className="dashboard-banner glass-panel">
        <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>Patient Dashboard</h2>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage your consultations, join active rooms, and upload reports for AI analysis.</p>
      </div>

      {/* Primary Dashboard Navigation Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginTop: '-12px' }}>
        <button
          onClick={() => setActiveTab('appointments')}
          className={`btn ${activeTab === 'appointments' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '10px' }}
        >
          <Calendar size={14} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
          <span style={{ verticalAlign: 'middle' }}>My Consultations</span>
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.9rem', borderRadius: '10px' }}
        >
          <Sparkles size={14} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} />
          <span style={{ verticalAlign: 'middle' }}>Medical Reports</span>
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '12px', borderRadius: '8px', fontSize: '0.88rem' }}>
          {error}
        </div>
      )}

      {activeTab === 'appointments' ? (
        /* CONSULTATIONS TAB VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: activeConsultation ? '1.1fr 0.9fr' : '1fr', gap: '32px', alignItems: 'start' }}>
          
          {/* Appointments List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>Your Scheduled Consultations</h3>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ width: '30px', height: '30px', border: '3px solid rgba(15, 118, 110, 0.15)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
              </div>
            ) : appointments.length === 0 ? (
              <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Calendar size={32} style={{ color: '#64748b', marginBottom: '12px' }} />
                <p>No booked consultations found.</p>
                <a href="#/home" className="btn btn-primary" style={{ marginTop: '16px', fontSize: '0.85rem' }}>Find a Specialist</a>
              </div>
            ) : (
              appointments.map(appt => (
                <div key={appt._id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(15, 118, 110, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Stethoscope size={24} style={{ color: 'var(--primary)' }} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: '1.1rem', margin: 0 }}>Dr. {appt.doctorId?.name || 'Practitioner'}</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{appt.doctorId?.speciality || 'General Specialist'}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {getPaymentStatusBadge(appt.paymentStatus)}
                        {getStatusBadge(appt.status)}
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {appt.date} @ {appt.startTime}
                      </span>
                    </div>
                  </div>

                  {/* Symptoms & AI Suggestion carrying card */}
                  <div style={{ background: 'rgba(15, 23, 42, 0.02)', padding: '12px 16px', borderRadius: '8px', borderLeft: '3px solid rgba(15, 23, 42, 0.1)', fontSize: '0.9rem' }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '4px' }}><strong>My Symptoms:</strong> {appt.symptomsDescription}</p>
                    {appt.aiSpecialistSuggestion && (
                      <p style={{ color: 'var(--primary)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={14} />
                        <span><strong>AI Match Suggestion:</strong> {appt.aiSpecialistSuggestion}</span>
                      </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    
                    {/* Unpaid Booking Actions */}
                    {appt.status === 'pending' && appt.paymentStatus === 'pending' && (
                      <button 
                        onClick={() => handleStartPayment(appt)} 
                        className="btn btn-primary" 
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        <CreditCard size={14} />
                        <span>Complete Payment</span>
                      </button>
                    )}

                    {/* Active Consultation Room Action */}
                    {appt.status === 'accepted' && appt.paymentStatus === 'paid' && (
                      <button 
                        onClick={() => setActiveConsultation(
                          activeConsultation?._id === appt._id ? null : appt
                        )} 
                        className="btn btn-primary"
                        style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                      >
                        <MessageSquare size={14} />
                        <span>
                          {activeConsultation?._id === appt._id ? 'Close Chat View' : 'Join Consultation Chat'}
                        </span>
                      </button>
                    )}

                    {/* Completed Consultation Actions */}
                    {appt.status === 'completed' && (
                      <>
                        {appt.aiSummary && (
                          <button 
                            onClick={() => setSelectedAIReview(appt)} 
                            className="btn btn-secondary"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          >
                            <Sparkles size={14} style={{ color: 'var(--primary)' }} />
                            <span>View Consultation Summary</span>
                          </button>
                        )}
                        <button 
                          onClick={() => handleDownloadPDF(appt._id)} 
                          className="btn btn-primary"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                        >
                          <Download size={14} />
                          <span>Download Prescription PDF</span>
                        </button>
                      </>
                    )}

                    {/* Invoice Download Action for Paid/Completed */}
                    {(appt.paymentStatus === 'paid' || appt.paymentStatus === 'refunded') && (
                      <button 
                        onClick={() => handleDownloadInvoice(appt._id)} 
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <FileText size={14} />
                        <span>Download Invoice</span>
                      </button>
                    )}

                    {/* Cancellation Action */}
                    {!['completed', 'cancelled', 'rejected'].includes(appt.status) && (
                      <button 
                        onClick={() => handleCancelAppointment(appt._id)} 
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px', fontSize: '0.85rem', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                      >
                        <XCircle size={14} />
                        <span>Cancel Appt</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Real-time Consultation Chat Area (Right Hand Panel) */}
          {activeConsultation && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>Active Consultation Session</h3>
                <button 
                  onClick={() => setActiveConsultation(null)} 
                  className="btn btn-secondary" 
                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                >
                  Close Chat Panel
                </button>
              </div>
              
              <ChatRoom 
                appointmentId={activeConsultation._id}
                currentUser={user}
                partnerName={`Dr. ${activeConsultation.doctorId?.name}`}
              />
            </div>
          )}
        </div>
      ) : (
        /* MEDICAL REPORTS ANALYZER TAB VIEW */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }} className="animate-fade-in">
          
          {/* Drag & Drop Upload Zone */}
          <div 
            className="glass-panel" 
            style={{ 
              padding: '36px', 
              border: '2px dashed var(--primary)', 
              borderRadius: '16px', 
              textAlign: 'center', 
              background: uploading ? 'rgba(15, 118, 110, 0.04)' : 'rgba(255, 255, 255, 0.4)',
              cursor: uploading ? 'not-allowed' : 'pointer',
              position: 'relative',
              transition: 'all 0.3s ease'
            }}
          >
            {uploading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', border: '3px solid rgba(15, 118, 110, 0.15)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <div>
                  <h4 style={{ fontSize: '1.15rem', color: 'var(--text-main)', margin: '0 0 4px' }}>AI Medical Analyzer Active</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>{uploadProgress}</p>
                </div>
              </div>
            ) : (
              <label style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', margin: 0 }}>
                <div style={{ padding: '14px', borderRadius: '50%', background: 'rgba(15, 118, 110, 0.08)', color: 'var(--primary)' }}>
                  <Upload size={32} />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.2rem', color: 'var(--text-main)', margin: '0 0 4px' }}>Upload Medical PDF Report</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: '0 0 12px' }}>Drag & drop or browse your local files (PDF only, max 5MB)</p>
                  <span className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '6px 16px' }}>Select File</span>
                </div>
                <input 
                  type="file" 
                  accept="application/pdf" 
                  onChange={handlePdfUpload} 
                  style={{ display: 'none' }} 
                />
              </label>
            )}
          </div>

          {/* List of Analyzed Reports */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', margin: 0 }}>
              Analyzed Medical Documents ({reports.length})
            </h3>

            {loadingReports ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ width: '24px', height: '24px', border: '2px solid rgba(15, 118, 110, 0.15)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
              </div>
            ) : reports.length === 0 ? (
              <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <FileText size={36} style={{ color: '#64748b', marginBottom: '12px', opacity: 0.7 }} />
                <p style={{ fontSize: '0.95rem', margin: 0 }}>No analyzed medical reports yet.</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)', margin: '4px 0 0' }}>Upload your laboratory panel to extract and explain out-of-range clinical values.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {reports.map(report => {
                  const severityColors = {
                    low: { bg: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', text: '#10b981' },
                    medium: { bg: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.3)', text: '#f59e0b' },
                    high: { bg: 'rgba(249, 115, 22, 0.12)', border: '1px solid rgba(249, 115, 22, 0.3)', text: '#f97316' },
                    critical: { bg: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', text: '#ef4444', pulse: true }
                  };
                  const color = severityColors[report.analysis?.severity] || { bg: 'rgba(100, 116, 139, 0.12)', border: '1px solid rgba(100, 116, 139, 0.3)', text: '#64748b' };
                  
                  return (
                    <div 
                      key={report._id} 
                      className="glass-panel" 
                      style={{ 
                        padding: '20px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'space-between',
                        gap: '14px',
                        border: color.pulse ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid var(--border-color)',
                        boxShadow: color.pulse ? '0 0 12px rgba(239, 68, 68, 0.08)' : 'none'
                      }}
                    >
                      <div>
                        {/* Header: Report Type & Severity Badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em' }}>
                            {report.analysis?.report_type || "Medical Analysis"}
                          </span>
                          <span 
                            style={{ 
                              fontSize: '0.7rem', 
                              fontWeight: 900, 
                              textTransform: 'uppercase', 
                              padding: '2px 8px', 
                              borderRadius: '12px', 
                              backgroundColor: color.bg, 
                              color: color.text,
                              border: color.border,
                              animation: color.pulse ? 'pulse-glow 1.5s infinite' : 'none'
                            }}
                          >
                            {report.analysis?.severity || "Normal"} Severity
                          </span>
                        </div>

                        {/* Title: File Name */}
                        <h4 style={{ fontSize: '1.05rem', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {report.fileName}
                        </h4>
                        
                        {/* Date uploaded */}
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-dim)', margin: '0 0 12px' }}>
                          Analyzed on {new Date(report.createdAt).toLocaleDateString()}
                        </p>

                        {/* Quick summary snippet */}
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0, lineClamp: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {report.analysis?.summary}
                        </p>
                      </div>

                      {/* Footer Actions */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                        <button 
                          onClick={() => handleDeleteReport(report._id)} 
                          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '4px' }}
                          title="Delete Report"
                        >
                          <Trash2 size={16} />
                        </button>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          {report.fileUrl && (
                            <a 
                              href={report.fileUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="btn btn-secondary" 
                              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                            >
                              View PDF
                            </a>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedReport(report);
                              setDetailTab('insights');
                            }} 
                            className="btn btn-primary" 
                            style={{ padding: '4px 12px', fontSize: '0.75rem' }}
                          >
                            Details
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Razorpay Sandbox Payment Simulator Modal */}
      <Modal 
        isOpen={payingAppt !== null} 
        onClose={() => setPayingAppt(null)}
        title={isMockPayment ? "Razorpay Payment Sandbox Simulator" : "Secure Payment Gateway"}
      >
        {paymentSuccess ? (
          <div style={{ textAlign: 'center', padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
              <span style={{ color: '#10b981', fontSize: '1.5rem', fontWeight: 900 }}>✓</span>
            </div>
            <h4 style={{ fontSize: '1.25rem', margin: 0 }}>Payment Approved!</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>Email confirmation has been queued.</p>
            <button
              type="button"
              onClick={() => handleDownloadInvoice(payingAppt._id)}
              className="btn btn-primary"
              style={{ marginTop: '12px', padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>Download Invoice PDF</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.02)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Paying for consultation with:</p>
              <h4 style={{ fontSize: '1.15rem', color: 'var(--text-main)', margin: '4px 0' }}>Dr. {payingAppt?.doctorId?.name}</h4>
              <p style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{payingAppt?.doctorId?.speciality}</p>
              <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '12px', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Total Amount:</span>
                <span style={{ color: '#10b981' }}>₹{payingAppt?.doctorId?.consultationFee || 500}</span>
              </div>
            </div>

            {isMockPayment ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', color: '#fbbf24' }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <div>
                  <strong>Sandbox Simulation Mode:</strong> Razorpay integration credentials are not set. Clicking Pay below will simulate a successful card capture webhook trigger.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'rgba(15, 118, 110, 0.05)', border: '1px solid rgba(15, 118, 110, 0.15)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--primary)' }}>
                <CreditCard size={18} style={{ flexShrink: 0, color: 'var(--primary)' }} />
                <div>
                  <strong>Razorpay Test Mode:</strong> Active credentials detected. You will be redirected to the secure Razorpay payment frame to complete your test checkout.
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button 
                type="button" 
                onClick={() => setPayingAppt(null)} 
                className="btn btn-secondary"
                disabled={paymentLoading}
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleProcessPayment} 
                className="btn btn-primary"
                disabled={paymentLoading}
              >
                {paymentLoading 
                  ? (isMockPayment ? 'Simulating capture...' : 'Opening Checkout...') 
                  : (isMockPayment 
                      ? `Simulate Payment ₹${payingAppt?.doctorId?.consultationFee || 500}` 
                      : `Pay via Razorpay ₹${payingAppt?.doctorId?.consultationFee || 500}`
                    )
                }
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MedConnect AI Review Summary Overlay Modal */}
      <Modal
        isOpen={selectedAIReview !== null}
        onClose={() => setSelectedAIReview(null)}
        title="MedConnect AI Consultation Summary"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ background: 'rgba(15, 118, 110, 0.04)', border: '1px solid rgba(15, 118, 110, 0.12)', padding: '16px 20px', borderRadius: '12px' }}>
            <h4 style={{ color: 'var(--primary)', fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={14} />
              <span>Diagnostic Summary</span>
            </h4>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.5', margin: 0, color: 'var(--text-main)' }}>
              {selectedAIReview?.aiSummary}
            </p>
          </div>

          <div style={{ background: 'rgba(14, 165, 233, 0.04)', border: '1px solid rgba(14, 165, 233, 0.12)', padding: '16px 20px', borderRadius: '12px' }}>
            <h4 style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} />
              <span>Smart Follow-up Reminders</span>
            </h4>
            <p style={{ fontSize: '0.95rem', lineHeight: '1.5', margin: 0, color: 'var(--text-muted)' }}>
              {selectedAIReview?.followUpReminder}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
            <button 
              onClick={() => setSelectedAIReview(null)} 
              className="btn btn-primary"
            >
              Close Review
            </button>
          </div>
        </div>
      </Modal>

      {/* AI MEDICAL REPORT DETAILS PANEL (MODAL) */}
      {selectedReport && (
        <Modal 
          isOpen={selectedReport !== null} 
          onClose={() => setSelectedReport(null)}
          title={`AI Report Review: ${selectedReport.fileName}`}
          maxWidth="900px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '78vh', overflowY: 'auto', paddingRight: '4px', boxSizing: 'border-box' }}>
            
            {/* Urgent Attention Alert Box */}
            {selectedReport.analysis?.requires_urgent_attention && (
              <div style={{ background: 'rgba(239, 68, 68, 0.07)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '16px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '0.95rem', display: 'block', marginBottom: '4px' }}>Urgent Attention Required</strong>
                  <span style={{ fontSize: '0.88rem', color: '#fca5a5' }}>{selectedReport.analysis?.urgent_reason}</span>
                </div>
              </div>
            )}

            {/* Modal Inside Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              <button 
                onClick={() => setDetailTab('insights')} 
                className={`btn ${detailTab === 'insights' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px' }}
              >
                Summary & Insights
              </button>
              <button 
                onClick={() => setDetailTab('findings')} 
                className={`btn ${detailTab === 'findings' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px' }}
              >
                Abnormal Findings ({selectedReport.analysis?.abnormal_findings?.length || 0})
              </button>
              <button 
                onClick={() => setDetailTab('chat')} 
                className={`btn ${detailTab === 'chat' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 14px', fontSize: '0.8rem', borderRadius: '8px' }}
              >
                Ask Report AI Chat
              </button>
            </div>

            {/* CONTENT OF DETAIL TABS */}
            {detailTab === 'insights' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Warm Patient-Friendly Explanation */}
                <div style={{ background: 'rgba(15, 118, 110, 0.04)', border: '1px solid rgba(15, 118, 110, 0.1)', padding: '18px 24px', borderRadius: '12px' }}>
                  <h4 style={{ color: 'var(--primary)', margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 700 }}>AI Patient Explanation</h4>
                  <p style={{ fontSize: '0.94rem', lineHeight: '1.6', margin: 0, color: 'var(--text-main)' }}>
                    {selectedReport.analysis?.patient_friendly_explanation}
                  </p>
                </div>

                {/* Summary & Specialists */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', flexWrap: 'wrap' }}>
                  
                  {/* Summary Box */}
                  <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Clinical Summary</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: '1.5', margin: 0, color: 'var(--text-main)' }}>
                      {selectedReport.analysis?.summary}
                    </p>
                  </div>

                  {/* Recommended Specialists */}
                  <div className="glass-panel" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Recommended Specialists</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {selectedReport.analysis?.recommended_specialists?.length > 0 ? (
                        selectedReport.analysis.recommended_specialists.map((spec, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(15, 23, 42, 0.02)', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{spec}</span>
                            <a 
                              href="#/home" 
                              onClick={() => setSelectedReport(null)} 
                              style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '2px' }}
                            >
                              <span>Book</span>
                              <ArrowRight size={10} />
                            </a>
                          </div>
                        ))
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>No specific specialist suggested.</span>
                      )}
                    </div>
                  </div>

                </div>

                {/* Safety Medical Disclaimer */}
                <div style={{ background: 'rgba(100, 116, 139, 0.05)', borderLeft: '3px solid #64748b', padding: '12px 18px', borderRadius: '4px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  <strong>Important Disclaimer:</strong> {selectedReport.analysis?.disclaimer}
                </div>

              </div>
            )}

            {detailTab === 'findings' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Findings Table list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)' }}>Lab Parameters Outside Reference Ranges</h4>
                  
                  {selectedReport.analysis?.abnormal_findings?.length > 0 ? (
                    selectedReport.analysis.abnormal_findings.map((f, idx) => (
                      <div 
                        key={idx} 
                        style={{ 
                          background: 'rgba(245, 158, 11, 0.03)', 
                          border: '1px solid rgba(245, 158, 11, 0.15)', 
                          borderLeft: '4px solid #f59e0b', 
                          padding: '16px', 
                          borderRadius: '8px',
                          display: 'grid',
                          gridTemplateColumns: '1.5fr 1fr 1fr 2fr',
                          gap: '12px',
                          alignItems: 'start',
                          boxSizing: 'border-box'
                        }}
                      >
                        <div>
                          <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Parameter</span>
                          <strong style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>{f.finding}</strong>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Value</span>
                          <span style={{ fontSize: '0.88rem', color: '#ef4444', fontWeight: 700 }}>{f.value}</span>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Normal Range</span>
                          <span style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{f.reference_range}</span>
                        </div>
                        <div>
                          <span style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>Clinical Meaning</span>
                          <p style={{ fontSize: '0.84rem', margin: 0, color: 'var(--text-muted)', lineHeight: '1.3' }}>{f.explanation}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="glass-panel" style={{ padding: '24px', textAlign: 'center', color: '#10b981' }}>
                      <strong>No out-of-bounds parameters reported. All values within standard ranges!</strong>
                    </div>
                  )}
                </div>

                {/* Potential Concerns & Next Steps */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flexWrap: 'wrap' }}>
                  
                  {/* Concerns */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Potential Health Concerns</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)' }}>
                      {selectedReport.analysis?.potential_concerns?.map((c, i) => (
                        <li key={i}>{c}</li>
                      )) || <li>No general concerns flagged.</li>}
                    </ul>
                  </div>

                  {/* Next Steps */}
                  <div className="glass-panel" style={{ padding: '20px' }}>
                    <h4 style={{ margin: '0 0 10px', fontSize: '0.95rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Clinical Next Steps</h4>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-muted)' }}>
                      {selectedReport.analysis?.next_steps?.map((s, i) => (
                        <li key={i}>{s}</li>
                      )) || <li>Follow standard medical observation.</li>}
                    </ul>
                  </div>

                </div>

              </div>
            )}

            {detailTab === 'chat' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: '1.02rem' }}>Medical Assistant Chatbot</h4>
                  <p style={{ color: 'var(--text-dim)', fontSize: '0.78rem', margin: 0 }}>
                    Discuss specific findings or ask clinical questions about your laboratory values.
                  </p>
                </div>

                {/* Messages Panel */}
                <div 
                  style={{ 
                    maxHeight: '320px', 
                    overflowY: 'auto', 
                    background: 'rgba(15, 23, 42, 0.02)', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  {/* Default AI Introduction Message */}
                  <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-start', maxWidth: '85%' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-glow)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Sparkles size={12} style={{ color: 'var(--primary)' }} />
                    </div>
                    <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '0 12px 12px 12px', fontSize: '0.86rem', color: '#1e293b', lineHeight: '1.4' }}>
                      Hello! I have fully processed your report. Ask me anything about your parameters or lab results.
                    </div>
                  </div>

                  {selectedReport.chatHistory?.map((chat, idx) => (
                    <div 
                      key={idx} 
                      style={{ 
                        display: 'flex', 
                        gap: '10px', 
                        alignSelf: chat.sender === 'patient' ? 'flex-end' : 'flex-start',
                        flexDirection: chat.sender === 'patient' ? 'row-reverse' : 'row',
                        maxWidth: '85%'
                      }}
                    >
                      <div 
                        style={{ 
                          width: '28px', 
                          height: '28px', 
                          borderRadius: '50%', 
                          background: chat.sender === 'patient' ? 'var(--primary)' : 'var(--primary-glow)',
                          color: chat.sender === 'patient' ? '#fff' : 'var(--primary)',
                          border: '1px solid var(--border-color)', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          flexShrink: 0,
                          fontSize: '0.65rem',
                          fontWeight: 700
                        }}
                      >
                        {chat.sender === 'patient' ? 'ME' : 'AI'}
                      </div>
                      <div 
                        style={{ 
                          background: chat.sender === 'patient' ? 'var(--primary)' : '#f1f5f9', 
                          color: chat.sender === 'patient' ? '#fff' : '#1e293b', 
                          padding: '10px 14px', 
                          borderRadius: chat.sender === 'patient' ? '12px 0 12px 12px' : '0 12px 12px 12px', 
                          fontSize: '0.86rem', 
                          lineHeight: '1.4',
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {chat.message}
                      </div>
                    </div>
                  ))}

                  {/* AI Typing Indicator */}
                  {chatLoading && (
                    <div style={{ display: 'flex', gap: '10px', alignSelf: 'flex-start' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sparkles size={12} style={{ color: 'var(--primary)' }} />
                      </div>
                      <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '0 12px 12px 12px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <div style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce-dot 1.2s infinite 0.1s' }}></div>
                        <div style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce-dot 1.2s infinite 0.2s' }}></div>
                        <div style={{ width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%', animation: 'bounce-dot 1.2s infinite 0.3s' }}></div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Prompt Suggestions */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {["Explain out-of-bounds levels", "What diet improvements help?", "Should I seek clinical attention?"].map((sug, i) => (
                    <button 
                      key={i} 
                      type="button" 
                      onClick={() => setChatMessage(sug)}
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '0.72rem', borderRadius: '6px' }}
                      disabled={chatLoading}
                    >
                      {sug}
                    </button>
                  ))}
                </div>

                {/* Form Input */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendChat(selectedReport._id);
                  }}
                  style={{ display: 'flex', gap: '10px', alignItems: 'center' }}
                >
                  <input 
                    type="text" 
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type clinical question here (e.g. what should I eat to raise hemoglobin?)..." 
                    className="form-input"
                    style={{ flex: 1 }}
                    disabled={chatLoading}
                  />
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    style={{ padding: '10px 20px' }}
                    disabled={chatLoading || !chatMessage.trim()}
                  >
                    Send
                  </button>
                </form>

              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '8px' }}>
              <button 
                onClick={() => setSelectedReport(null)} 
                className="btn btn-primary"
              >
                Close Analysis
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Bounce keyframe and pulse css animations helper injected */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-glow {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
          70% { box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes bounce-dot {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>

    </div>
  );
}
