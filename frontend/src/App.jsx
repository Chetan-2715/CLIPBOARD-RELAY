import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clipboard, 
  UploadCloud, 
  Trash2, 
  QrCode, 
  Copy, 
  Check, 
  Link, 
  Clock, 
  ArrowRight, 
  Lock, 
  FileText, 
  X, 
  Sparkles, 
  Smartphone, 
  LogOut,
  RefreshCw,
  Download
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Resolve backend url dynamically to support local network device connection (PCs & Phones)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

function App() {
  // Room states
  const [roomCode, setRoomCode] = useState(null);
  const [items, setItems] = useState([]);
  const [ttlRemaining, setTtlRemaining] = useState(null);

  // Form states
  const [inputRoomCode, setInputRoomCode] = useState('');
  const [inputText, setInputText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // UI / App states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Socket reference
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-join if room code is in the URL pathname: /room/XYZ123
  useEffect(() => {
    const path = window.location.pathname;
    const roomMatch = path.match(/^\/room\/([A-Z2-9]{6})$/i);
    
    if (roomMatch) {
      const code = roomMatch[1].toUpperCase();
      joinRoom(code);
    }
  }, []);

  // Sync TTL countdown timer in frontend
  useEffect(() => {
    if (ttlRemaining === null || ttlRemaining <= 0) return;
    
    const interval = setInterval(() => {
      setTtlRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setError("Your session has expired (15-minute TTL reached).");
          disconnectSocket();
          setRoomCode(null);
          setItems([]);
          window.history.pushState(null, '', '/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [ttlRemaining]);

  // Clean up socket on unmount
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  const disconnectSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  // Socket Connection & Listeners
  const initializeSocket = (code) => {
    disconnectSocket();

    const socket = io(BACKEND_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.emit('join-room', { roomCode: code });

    socket.on('room-data', ({ items: roomItems, ttlRemaining: roomTtl }) => {
      setItems(roomItems.reverse()); // Show newest first
      setTtlRemaining(roomTtl);
      setLoading(false);
    });

    socket.on('room-cleared', () => {
      confetti({
        particleCount: 50,
        spread: 30,
        colors: ['#ef4444', '#f87171']
      });
      setError("The session was wiped and cleared.");
      setRoomCode(null);
      setItems([]);
      setTtlRemaining(null);
      disconnectSocket();
      window.history.pushState(null, '', '/');
    });

    socket.on('error', (errMsg) => {
      setError(errMsg);
      setLoading(false);
    });
  };

  // Actions: Create Room
  const createRoom = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/room`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!res.ok) throw new Error('Failed to create session');
      
      const data = await res.json();
      setRoomCode(data.roomCode);
      setTtlRemaining(data.ttlRemaining);
      
      // Update browser URL without reloading
      window.history.pushState(null, '', `/room/${data.roomCode}`);
      
      // Initialize Real-time socket
      initializeSocket(data.roomCode);
      
      // Trigger a nice success confetti burst
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#a855f7', '#ec4899', '#3b82f6']
      });
    } catch (err) {
      console.error(err);
      setError('Could not connect to the backend server. Please make sure it is running.');
      setLoading(false);
    }
  };

  // Actions: Join Existing Room
  const joinRoom = async (code) => {
    const formattedCode = code.toUpperCase().trim();
    if (formattedCode.length !== 6) {
      setError('Room code must be exactly 6 characters.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/room/${formattedCode}`);
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'Room expired or does not exist.' : 'Server connection error.');
      }
      
      const data = await res.json();
      setRoomCode(data.roomCode);
      setItems(data.items.reverse());
      setTtlRemaining(data.ttlRemaining);
      
      window.history.pushState(null, '', `/room/${data.roomCode}`);
      
      // Initialize Socket connection
      initializeSocket(data.roomCode);
      
      confetti({
        particleCount: 50,
        spread: 50,
        colors: ['#a855f7', '#3b82f6']
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Could not join room.');
      setLoading(false);
      window.history.pushState(null, '', '/');
    }
  };

  // Actions: Sync Text Item
  const syncText = () => {
    if (!inputText.trim() || !socketRef.current) return;
    
    socketRef.current.emit('send-item', {
      roomCode,
      item: {
        type: 'text',
        content: inputText
      }
    });

    setInputText('');
    
    confetti({
      particleCount: 40,
      angle: 60,
      spread: 55,
      origin: { x: 0 }
    });
    confetti({
      particleCount: 40,
      angle: 120,
      spread: 55,
      origin: { x: 1 }
    });
  };

  // Actions: Upload File & Sync
  const uploadAndSyncFile = async (selectedFile) => {
    if (!selectedFile || !roomCode) return;
    
    setUploading(true);
    setError(null);
    
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await fetch(`${BACKEND_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to upload file');
      }

      const fileData = await res.json();

      // Send to room via socket
      socketRef.current.emit('send-item', {
        roomCode,
        item: {
          type: 'file',
          content: fileData.url,
          fileName: fileData.fileName,
          fileType: fileData.fileType,
          fileSize: fileData.fileSize
        }
      });

      // Clear input
      if (fileInputRef.current) fileInputRef.current.value = '';
      
      confetti({
        particleCount: 80,
        spread: 60,
        colors: ['#10b981', '#34d399', '#3b82f6']
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error uploading file. Limit is 10MB.');
    } finally {
      setUploading(false);
    }
  };

  // Drag and drop event handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadAndSyncFile(e.dataTransfer.files[0]);
    }
  };

  // Actions: Clear Entire Session
  const triggerClearSession = () => {
    if (!socketRef.current || !roomCode) return;
    if (window.confirm("Are you sure you want to immediately wipe all data in this session? This deletes everything from Redis and disconnects all connected devices.")) {
      socketRef.current.emit('clear-session', { roomCode });
    }
  };

  // Utilities: Copy Text
  const copyToClipboard = (text, itemId) => {
    navigator.clipboard.writeText(text);
    setCopiedId(itemId);
    
    // Confetti pop on copy
    confetti({
      particleCount: 15,
      spread: 20,
      colors: ['#a855f7', '#ec4899']
    });

    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const copyRoomLink = () => {
    const link = `${window.location.origin}/room/${roomCode}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // Timer Formatter
  const formatTime = (secs) => {
    if (secs === null) return '--:--';
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Helper to format file sizes
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Check if file is image
  const isImage = (type, name) => {
    if (type && type.startsWith('image/')) return true;
    if (name) {
      const ext = name.split('.').pop().toLowerCase();
      return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext);
    }
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col relative px-4 sm:px-6 lg:px-8 py-10">
      {/* Background decoration */}
      <div className="mesh-bg" />

      {/* Main Container */}
      <main className="flex-grow flex items-center justify-center max-w-4xl w-full mx-auto z-10">
        <AnimatePresence mode="wait">
          {!roomCode ? (
            /* ================= LANDING SCREEN ================= */
            <motion.div 
              key="landing"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4 }}
              className="glass-card max-w-md w-full rounded-2xl p-6 sm:p-8 text-center relative overflow-hidden shadow-2xl"
            >
              {/* Header Design */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-secondary to-accent" />
              
              <div className="mx-auto w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary shadow-lg border border-primary/20">
                <Clipboard className="w-8 h-8" />
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2 leading-none">
                Secure Ephemeral <br/>
                <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">Clipboard & File Relay</span>
              </h1>
              
              <p className="text-gray-400 text-sm mb-8 max-w-xs mx-auto">
                Instantly transfer code snippets, links, and files between devices. Expired rooms automatically wipe from memory in 15 minutes.
              </p>

              {/* Error messages */}
              {error && (
                <div className="mb-6 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-xs text-left flex items-start space-x-2">
                  <span className="font-bold">Error:</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Form Action */}
              <div className="space-y-6">
                <div>
                  <label htmlFor="room-code-input" className="block text-left text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Have a Room Code?
                  </label>
                  <div className="relative flex rounded-xl shadow-sm">
                    <input
                      id="room-code-input"
                      type="text"
                      maxLength={6}
                      placeholder="ENTER CODE"
                      value={inputRoomCode}
                      onChange={(e) => setInputRoomCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
                      className="glass-input block w-full px-4 py-3 text-center text-xl font-mono tracking-widest rounded-l-xl uppercase font-bold placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-gray-500 focus:z-10"
                    />
                    <button
                      type="button"
                      onClick={() => joinRoom(inputRoomCode)}
                      disabled={loading || inputRoomCode.length !== 6}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-r-xl text-white bg-primary hover:bg-primary-dark focus:outline-none transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="relative flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <span className="relative px-3 bg-[#0c0d15] text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Or
                  </span>
                </div>

                <button
                  type="button"
                  onClick={createRoom}
                  disabled={loading}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition shadow-lg shadow-primary/25 cursor-pointer flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Generate New Room</span>
                    </>
                  )}
                </button>
              </div>

              {/* Privacy Footer */}
              <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center space-x-1.5 text-xs text-gray-500">
                <Lock className="w-3.5 h-3.5" />
                <span>Zero persistent logs. End-to-end serverless deletion.</span>
              </div>
            </motion.div>
          ) : (
            /* ================= DASHBOARD / ACTIVE ROOM ================= */
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {/* Sidebar Panel: Room Info & Settings */}
              <div className="md:col-span-1 space-y-6">
                {/* Room code card */}
                <div className="glass-card rounded-2xl p-5 relative overflow-hidden shadow-xl border border-white/5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Active Session</span>
                    <span className="flex items-center space-x-1 text-primary">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span className="text-[10px] text-gray-300 font-sans">Live Sync</span>
                    </span>
                  </h3>
                  
                  <div className="flex items-baseline space-x-2 mb-4">
                    <span className="text-4xl font-mono font-black text-white tracking-wider">{roomCode}</span>
                    <button 
                      onClick={copyRoomLink}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
                      title="Copy join link"
                    >
                      {linkCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Link className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Share QR Code Button */}
                  <button
                    onClick={() => setShowQRModal(true)}
                    className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-gray-300 transition cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-primary" />
                    <span>Scan with Mobile Device</span>
                  </button>
                </div>

                {/* Expiry / Countdown Timer Card */}
                <div className="glass-card rounded-2xl p-5 shadow-xl border border-white/5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                    <span>Time Remaining</span>
                    <Clock className="w-4 h-4 text-secondary animate-pulse-slow" />
                  </h3>
                  
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-mono font-bold text-white tracking-widest">
                      {formatTime(ttlRemaining)}
                    </span>
                    <span className="text-xs text-gray-400">minutes</span>
                  </div>
                  
                  <p className="text-[11px] text-gray-400 mt-2">
                    TTL refreshes back to 15:00 on every new text sync or file upload!
                  </p>
                </div>

                {/* Danger Actions Card */}
                <div className="glass-card rounded-2xl p-5 shadow-xl border border-white/5 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">
                      Wipe Session
                    </h3>
                    <p className="text-xs text-gray-400">
                      Leaving a shared PC? Instantly delete all keys from Redis and disconnect all sockets immediately.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        disconnectSocket();
                        setRoomCode(null);
                        setItems([]);
                        window.history.pushState(null, '', '/');
                      }}
                      className="py-2.5 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition cursor-pointer text-center"
                    >
                      Exit Room
                    </button>
                    
                    <button
                      onClick={triggerClearSession}
                      className="py-2.5 px-3 rounded-xl bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-xs font-semibold text-red-300 hover:text-white transition cursor-pointer text-center flex items-center justify-center space-x-1"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Wipe Data</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Board Panel: Sync Inputs & Relay List */}
              <div className="md:col-span-2 space-y-6">
                
                {/* Sync input panel */}
                <div className="glass-card rounded-2xl p-6 shadow-xl border border-white/5">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <span>Sync New Data</span>
                  </h2>

                  {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-500/30 text-red-300 text-xs flex justify-between items-center">
                      <span>{error}</span>
                      <button onClick={() => setError(null)} className="text-red-300 hover:text-white">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="space-y-4">
                    {/* Text sync textarea */}
                    <div>
                      <textarea
                        rows={4}
                        placeholder="Paste code snippet, lines of text, or links to share..."
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        className="glass-input block w-full p-4 text-sm font-mono rounded-xl placeholder:font-sans placeholder:text-gray-500 focus:ring-1 focus:ring-primary focus:border-primary"
                      ></textarea>
                      <div className="mt-2 flex justify-between items-center">
                        <span className="text-[11px] text-gray-500">
                          Preserves spaces, tabs, and indentation format.
                        </span>
                        <button
                          type="button"
                          onClick={syncText}
                          disabled={!inputText.trim()}
                          className="px-4 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Sync Clipboard</span>
                        </button>
                      </div>
                    </div>

                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-white/5"></div>
                      </div>
                      <span className="relative px-3 bg-[#0c0d15] text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                        Or Upload File
                      </span>
                    </div>

                    {/* File Dropzone */}
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      className={`border-2 border-dashed rounded-xl p-6 text-center transition cursor-pointer ${
                        dragActive 
                          ? 'border-primary bg-primary/5' 
                          : 'border-white/10 hover:border-white/20 bg-white/[0.01]'
                      } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            uploadAndSyncFile(e.target.files[0]);
                          }
                        }}
                      />
                      
                      {uploading ? (
                        <div className="flex flex-col items-center justify-center py-2">
                          <RefreshCw className="w-8 h-8 text-primary animate-spin mb-3" />
                          <p className="text-sm font-semibold text-white">Uploading file directly to Cloudinary...</p>
                          <p className="text-xs text-gray-400 mt-1">This will sync immediately once completed.</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-2">
                          <UploadCloud className="w-8 h-8 text-gray-400 mb-3" />
                          <p className="text-sm font-semibold text-gray-200">Drag & Drop file here or <span className="text-primary hover:underline">browse</span></p>
                          <p className="text-xs text-gray-500 mt-1">Images, PDFs, Docs, etc. (Max 10MB)</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Shared Clipboard Feed */}
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-white px-1">
                    Shared Clipboard History ({items.length})
                  </h2>

                  <AnimatePresence initial={false}>
                    {items.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="glass-card rounded-2xl p-8 text-center border border-white/5"
                      >
                        <Clipboard className="w-10 h-10 text-gray-500 mx-auto mb-3 opacity-40" />
                        <p className="text-sm text-gray-400 font-medium">Nothing has been synced to this room yet.</p>
                        <p className="text-xs text-gray-500 mt-1">Sync text or upload files above to see them instantly on all devices.</p>
                      </motion.div>
                    ) : (
                      items.map((item, index) => (
                        <motion.div
                          key={item.id || index}
                          initial={{ opacity: 0, x: -20, y: 10 }}
                          animate={{ opacity: 1, x: 0, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          className="glass-card rounded-2xl p-4 sm:p-5 shadow-lg border border-white/5 relative overflow-hidden"
                        >
                          {/* Item card accent color bar */}
                          <div className={`absolute top-0 left-0 h-full w-1 ${
                            item.type === 'file' ? 'bg-emerald-400' : 'bg-primary'
                          }`} />

                          <div className="flex justify-between items-center mb-3 text-xs text-gray-400 ml-1">
                            <span className="font-semibold text-gray-400">
                              {item.type === 'file' ? '📁 Attached File' : '📝 Text Clipboard'}
                            </span>
                            <span>
                              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {/* Content Display */}
                          {item.type === 'text' ? (
                            <div className="relative">
                              <pre className="whitespace-pre-wrap font-mono text-sm bg-[#08090f] p-4 rounded-xl border border-white/5 text-left text-gray-200 overflow-x-auto select-text break-all">
                                {item.content}
                              </pre>
                              
                              <button
                                onClick={() => copyToClipboard(item.content, item.id)}
                                className={`absolute top-3 right-3 p-2 rounded-lg bg-neutral-900/90 text-gray-400 hover:text-white transition border border-white/10 hover:border-white/20 cursor-pointer shadow-md flex items-center justify-center`}
                                title="Copy contents"
                              >
                                {copiedId === item.id ? (
                                  <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          ) : (
                            /* File Display Layout */
                            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-4 bg-[#08090f] p-4 rounded-xl border border-white/5">
                              {/* Preview Column */}
                              {isImage(item.fileType, item.fileName) ? (
                                <a 
                                  href={item.content} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="w-full sm:w-28 h-28 rounded-lg overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center group flex-shrink-0 cursor-zoom-in"
                                >
                                  <img 
                                    src={item.content} 
                                    alt={item.fileName} 
                                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                  />
                                </a>
                              ) : (
                                <div className="w-20 h-20 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                                  <FileText className="w-10 h-10" />
                                </div>
                              )}

                              {/* Details Column */}
                              <div className="flex-grow text-left w-full overflow-hidden">
                                <h4 className="font-semibold text-sm text-gray-200 truncate">{item.fileName || 'Unnamed File'}</h4>
                                <p className="text-xs text-gray-400 mt-1">{formatBytes(item.fileSize)} • {item.fileType || 'Unknown Type'}</p>
                                
                                <div className="mt-4 flex flex-wrap gap-2">
                                  <a
                                    href={item.content}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 rounded-lg text-xs font-semibold text-emerald-400 transition cursor-pointer flex items-center space-x-1"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                  </a>

                                  <button
                                    onClick={() => copyToClipboard(item.content, item.id)}
                                    className="py-1.5 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-gray-300 transition cursor-pointer flex items-center space-x-1"
                                  >
                                    {copiedId === item.id ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                                        <span className="text-emerald-400">URL Copied!</span>
                                      </>
                                    ) : (
                                      <>
                                        <Link className="w-3.5 h-3.5" />
                                        <span>Copy Link</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* QR Code sharing Modal overlay */}
      <AnimatePresence>
        {showQRModal && roomCode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50"
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass-card max-w-sm w-full rounded-2xl p-6 shadow-2xl relative border border-white/10 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowQRModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="mb-4 text-primary mx-auto w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                <Smartphone className="w-6 h-6" />
              </div>
              
              <h3 className="text-lg font-bold text-white mb-1">Join via Phone / Tablet</h3>
              <p className="text-xs text-gray-400 mb-6 px-4">
                Scan the QR code below using your mobile camera or scanner to instantly join this room.
              </p>

              {/* QR Container */}
              <div className="bg-white p-4 rounded-xl inline-block shadow-inner mb-6">
                <QRCodeSVG 
                  value={`${window.location.origin}/room/${roomCode}`}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Room Details in Modal */}
              <div className="bg-[#08090f] p-3 rounded-lg border border-white/5 mb-2 font-mono flex items-center justify-between px-4">
                <span className="text-xs text-gray-500">Room Code</span>
                <span className="text-lg font-bold text-white tracking-widest">{roomCode}</span>
              </div>
              
              <p className="text-[10px] text-gray-500 leading-tight">
                Make sure your phone is connected to the same network if hosting on localhost.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Footer */}
      <footer className="mt-10 py-6 text-center text-xs text-gray-500 border-t border-white/5 z-10">
        <p>© 2026 Secure Ephemeral Clipboard • Built for shared workstation peace of mind.</p>
      </footer>
    </div>
  );
}

export default App;
