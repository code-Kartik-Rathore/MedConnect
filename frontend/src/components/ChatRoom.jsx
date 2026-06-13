import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Send, User as UserIcon, Image as ImageIcon, Video, Phone, PhoneOff, Mic, MicOff, VideoOff } from 'lucide-react';
import { useAuth } from '../App';

export default function ChatRoom({ appointmentId, currentUser, partnerName }) {
  const { API_URL } = useAuth();
  const socketBaseUrl = API_URL.endsWith('/api') ? API_URL.slice(0, -4) : API_URL;
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // WebRTC State Variables
  const [callState, setCallState] = useState('idle'); // idle, calling, ringing, connected
  const [callType, setCallType] = useState('video'); // video, voice
  const [incomingSignal, setIncomingSignal] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);

  // References
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // WebRTC References
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const candidatesQueueRef = useRef([]);

  // Public Google STUN servers for NAT Traversal
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    // Connect to Socket.io server
    socketRef.current = io(socketBaseUrl, {
      withCredentials: true
    });

    // Join the appointment consultation room
    socketRef.current.emit('join_room', {
      appointmentId,
      userId: currentUser._id
    });

    // Listen for prior message history from database
    socketRef.current.on('chat_history', (history) => {
      setMessages(history);
    });

    // Listen for new incoming messages
    socketRef.current.on('receive_message', (message) => {
      setMessages((prev) => [...prev, message]);
    });

    // Handle WebRTC connection signals
    socketRef.current.on('webrtc_signal', async (signal) => {
      try {
        if (signal.type === 'offer') {
          setIncomingSignal(signal);
          setCallType(signal.callType);
          setCallState('ringing');
        } else if (signal.type === 'answer') {
          if (peerConnectionRef.current) {
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(signal.data));
            // Apply queued candidates
            if (candidatesQueueRef.current.length > 0) {
              for (const candidate of candidatesQueueRef.current) {
                await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
              }
              candidatesQueueRef.current = [];
            }
          }
        } else if (signal.type === 'candidate') {
          if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(signal.data));
          } else {
            candidatesQueueRef.current.push(signal.data);
          }
        } else if (signal.type === 'hangup') {
          cleanupCall();
        }
      } catch (err) {
        console.error('Error handling WebRTC signal:', err);
      }
    });

    // Clean up on component unmount
    return () => {
      cleanupCall();
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [appointmentId, currentUser]);

  // Scroll to bottom whenever messages list updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Emit message to Socket server
    socketRef.current.emit('send_message', {
      appointmentId,
      senderId: currentUser._id,
      content: input,
      image: ''
    });

    setInput('');
  };

  // Convert and upload image file to Cloudinary via backend REST route
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Symptom photo size must be less than 5MB.');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ image: reader.result })
        });

        let data;
        try {
          data = await res.json();
        } catch (e) {
          data = { message: `Server error (${res.status}). Failed to parse response.` };
        }
        if (res.ok && data.imageUrl) {
          // Send image message via Socket
          socketRef.current.emit('send_message', {
            appointmentId,
            senderId: currentUser._id,
            content: '',
            image: data.imageUrl
          });
        } else {
          alert(data.message || 'Image upload failed.');
        }
      } catch (err) {
        console.error(err);
        alert('Connection error uploading image.');
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      alert('Error reading image file.');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // ----------------------------------------------------
  // WebRTC Operation Functions
  // ----------------------------------------------------

  const initiateCall = async (type) => {
    setCallType(type);
    setCallState('calling');
    try {
      const constraints = {
        audio: true,
        video: type === 'video'
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      
      // Delay source allocation to let video DOM elements render
      setTimeout(async () => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection(iceServers);
        peerConnectionRef.current = pc;

        // Attach local tracks
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        // Relabel media arrival
        pc.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
          setCallState('connected');
        };

        // Relabel network updates
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socketRef.current.emit('webrtc_signal', {
              appointmentId,
              signal: {
                type: 'candidate',
                data: event.candidate
              }
            });
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socketRef.current.emit('webrtc_signal', {
          appointmentId,
          signal: {
            type: 'offer',
            callType: type,
            data: offer
          }
        });
      }, 300);
    } catch (err) {
      console.error(err);
      alert('Could not access camera or microphone devices.');
      setCallState('idle');
    }
  };

  const acceptCall = async () => {
    if (!incomingSignal) return;
    setCallState('connected');
    try {
      const constraints = {
        audio: true,
        video: callType === 'video'
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      setTimeout(async () => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const pc = new RTCPeerConnection(iceServers);
        peerConnectionRef.current = pc;

        // Attach local tracks
        stream.getTracks().forEach(track => {
          pc.addTrack(track, stream);
        });

        pc.ontrack = (event) => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socketRef.current.emit('webrtc_signal', {
              appointmentId,
              signal: {
                type: 'candidate',
                data: event.candidate
              }
            });
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal.data));

        // Process queued ice candidates
        if (candidatesQueueRef.current.length > 0) {
          for (const candidate of candidatesQueueRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          candidatesQueueRef.current = [];
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socketRef.current.emit('webrtc_signal', {
          appointmentId,
          signal: {
            type: 'answer',
            data: answer
          }
        });
      }, 300);
    } catch (err) {
      console.error(err);
      alert('Could not answer call due to missing media permissions.');
      cleanupCall();
    }
  };

  const hangupCall = () => {
    if (socketRef.current) {
      socketRef.current.emit('webrtc_signal', {
        appointmentId,
        signal: { type: 'hangup' }
      });
    }
    cleanupCall();
  };

  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    candidatesQueueRef.current = [];
    setIncomingSignal(null);
    setIsMuted(false);
    setIsCamOff(false);
    setCallState('idle');
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCamOff(!videoTrack.enabled);
      }
    }
  };

  return (
    <div className="chat-container glass-panel animate-fade-in" style={{ height: '620px', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px 20px', borderBottom: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.02)' }}>
        <div style={{ padding: '6px', borderRadius: '50%', background: 'rgba(15, 118, 110, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <UserIcon size={18} style={{ color: 'var(--primary)' }} />
        </div>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)' }}>Consultation Room</h4>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Connected with {partnerName}</span>
        </div>

        {/* WebRTC Video/Voice Call Action Triggers */}
        <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
          {callState === 'idle' && (
            <>
              <button 
                onClick={() => initiateCall('voice')}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
                title="Start voice call"
              >
                <Phone size={18} />
              </button>
              <button 
                onClick={() => initiateCall('video')}
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px' }}
                title="Start video call"
              >
                <Video size={18} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Embedded WebRTC Screens Panel */}
      <div style={{ padding: '12px 20px 0' }}>
        {callState === 'calling' && (
          <div className="ringing-panel animate-fade-in">
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              {callType === 'video' ? <Video size={20} /> : <Phone size={20} />}
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Calling {partnerName}...</p>
            <button onClick={hangupCall} className="btn btn-danger" style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem' }}>
              Cancel Call
            </button>
          </div>
        )}

        {callState === 'ringing' && (
          <div className="ringing-panel animate-fade-in">
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              {callType === 'video' ? <Video size={20} /> : <Phone size={20} />}
            </div>
            <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Incoming {callType} call from {partnerName}...</p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={hangupCall} className="btn btn-secondary" style={{ padding: '6px 14px', borderRadius: '20px', color: '#ef4444', fontSize: '0.85rem' }}>
                Decline
              </button>
              <button onClick={acceptCall} className="btn btn-primary" style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem' }}>
                Accept Call
              </button>
            </div>
          </div>
        )}

        {callState === 'connected' && callType === 'video' && (
          <div className="video-call-panel animate-fade-in">
            {/* Remote Partner Feed */}
            <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
            
            {/* Local Webcam Feed (PIP) */}
            {!isCamOff ? (
              <video ref={localVideoRef} autoPlay playsInline muted className="local-video" />
            ) : (
              <div className="local-video" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', fontSize: '0.65rem', fontWeight: 600 }}>
                Cam Off
              </div>
            )}

            {/* Controls */}
            <div className="call-controls">
              <button onClick={toggleMute} className={`control-btn ${isMuted ? 'active' : ''}`} title={isMuted ? "Unmute mic" : "Mute mic"}>
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button onClick={toggleCamera} className={`control-btn ${isCamOff ? 'active' : ''}`} title={isCamOff ? "Turn webcam on" : "Turn webcam off"}>
                {isCamOff ? <VideoOff size={16} /> : <Video size={16} />}
              </button>
              <button onClick={hangupCall} className="control-btn decline" title="End call">
                <PhoneOff size={16} />
              </button>
            </div>
          </div>
        )}

        {callState === 'connected' && callType === 'voice' && (
          <div className="voice-call-panel animate-fade-in">
            {/* Hidden media player for inbound audio stream */}
            <audio ref={remoteVideoRef} autoPlay />
            
            <div className="voice-call-info">
              <div className="voice-call-avatar">
                {partnerName ? partnerName.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0,2).toUpperCase() : 'U'}
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>Active Voice Call</p>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Connected securely with {partnerName}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                onClick={toggleMute} 
                className={`btn ${isMuted ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px', borderRadius: '50%', display: 'flex', width: '36px', height: '36px', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                title={isMuted ? "Unmute mic" : "Mute mic"}
              >
                {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              <button 
                onClick={hangupCall} 
                className="btn btn-danger" 
                style={{ padding: '8px', borderRadius: '50%', display: 'flex', width: '36px', height: '36px', alignItems: 'center', justifyContent: 'center', margin: 0 }}
                title="End call"
              >
                <PhoneOff size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="chat-messages" style={{ flex: 1, padding: '12px 20px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-dim)' }}>
            <p style={{ fontSize: '0.9rem' }}>Secure connection established.</p>
            <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Feel free to describe symptoms, request advice, and send reports.</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSentByMe = msg.senderId === currentUser._id;
            return (
              <div 
                key={msg._id || index} 
                className={`chat-bubble ${isSentByMe ? 'sent' : 'received'}`}
                style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
              >
                {msg.content && <div>{msg.content}</div>}
                {msg.image && (
                  <div style={{ marginTop: '4px' }}>
                    <img 
                      src={msg.image} 
                      alt="Physical symptom" 
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '220px', 
                        borderRadius: '12px', 
                        objectFit: 'cover',
                        cursor: 'pointer',
                        display: 'block',
                        border: '1px solid rgba(255, 255, 255, 0.2)'
                      }} 
                      onClick={() => window.open(msg.image, '_blank')}
                    />
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', opacity: 0.6, textAlign: 'right', marginTop: '2px' }}>
                  {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="chat-input-area" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <button 
          type="button" 
          onClick={() => fileInputRef.current?.click()}
          className="btn btn-secondary" 
          disabled={uploading}
          style={{ padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0, borderRadius: '8px' }}
          title="Share symptom photo"
        >
          {uploading ? (
            <div style={{ width: '16px', height: '16px', border: '2px solid rgba(15, 118, 110, 0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          ) : (
            <ImageIcon size={16} style={{ color: 'var(--primary)' }} />
          )}
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          accept="image/*" 
          style={{ display: 'none' }} 
        />
        
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={uploading ? "Uploading photo..." : "Type your message here..."}
          disabled={uploading}
          className="form-input"
          style={{ background: '#ffffff', border: '1px solid var(--border-color)', flex: 1 }}
        />
        <button type="submit" className="btn btn-primary" disabled={uploading || !input.trim()} style={{ padding: '10px 16px' }}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
