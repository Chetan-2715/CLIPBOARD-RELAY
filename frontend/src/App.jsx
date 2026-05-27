import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
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
  Download,
  Terminal,
  Activity,
  ChevronDown,
  Folder,
  Image
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Resolve backend url dynamically to support local network device connection (PCs & Phones)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:3000`;

import VolumetricBeamsFullScreen from './components/ui/volumetric-beams';
import TubesCursor from './components/ui/tubes-cursor';

/* ================= MAIN APPLICATION ================= */
function App() {
  // Preloader state
  const [showPreloader, setShowPreloader] = useState(true);

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
  const [latency, setLatency] = useState(0);

  // 3D Tilt coordinates state
  const [tiltOffset, setTiltOffset] = useState({ x: 0, y: 0 });

  // References
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const timelineRef = useRef(null);

  // Scroll Progress calculations for Timeline
  const { scrollYProgress } = useScroll({
    target: timelineRef,
    offset: ["start end", "end end"]
  });
  const pipelineLength = useTransform(scrollYProgress, [0.05, 0.95], [0, 1]);

  // Remove preloader after 2 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPreloader(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Auto-join if room code is in the URL pathname: /room/XYZ123
  useEffect(() => {
    const path = window.location.pathname;
    const roomMatch = path.match(/^\/room\/([A-Z2-9]{6})$/i);
    
    if (roomMatch) {
      const code = roomMatch[1].toUpperCase();
      joinRoom(code);
    }
  }, [showPreloader]);

  // Measure latency to show connection indicator
  useEffect(() => {
    if (!roomCode) return;
    
    const interval = setInterval(() => {
      const start = Date.now();
      fetch(`${BACKEND_URL}/api/room/${roomCode}`)
        .then(() => {
          setLatency(Date.now() - start);
        })
        .catch(() => {
          setLatency(0);
        });
    }, 5000);

    return () => clearInterval(interval);
  }, [roomCode]);

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
      
      window.history.pushState(null, '', `/room/${data.roomCode}`);
      initializeSocket(data.roomCode);
      
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

  // Handle Mouse Tilt calculations
  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // range -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5; // range -0.5 to 0.5
    setTiltOffset({ x, y });
  };

  const handleMouseLeave = () => {
    setTiltOffset({ x: 0, y: 0 });
  };

  // Tilt Style Coordinates
  const interactive3DTilt = {
    transform: `rotateY(${-15 + tiltOffset.x * 20}deg) rotateX(${10 - tiltOffset.y * 15}deg)`,
    transition: 'transform 0.1s ease-out'
  };

  const revealVariants = {
    hidden: { opacity: 0, scale: 0.98, filter: 'blur(12px)' },
    visible: { 
      opacity: 1, 
      scale: 1, 
      filter: 'blur(0px)',
      transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.15 }
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Background Volumetric Shader Beams */}
      <VolumetricBeamsFullScreen
        className="fixed inset-0 bg-[#020306] z-[-10]"
        dpr={[1, 1.5]}
        speed={0.25}
        autoRotateSpeed={0.015}
        mouseInfluence={0.45}
        pointerSmoothing={0.18}
        cameraRadius={3.8}
        fov={1.65}
        beamCount={5}
        beamHalfAngle={0.085}
        beamEdgeSoft={0.045}
        beamRotation={0.0}
        twistDepth={0.06}
        density={1.15}
        falloff={0.55}
        anisotropy={0.76}
        lightIntensity={2.2}
        lightColor={[0.64, 0.74, 1.0]}
        stripeFreq={42.0}
        stripeAmp={0.55}
        stripeSharp={1.85}
        stripeSpeed={0.12}
        stripeJitter={0.25}
        volSteps={80}
        stepMin={0.015}
        stepMax={0.06}
        maxDist={18.0}
        bgColor={[0.02, 0.015, 0.03]}
        tint={[0.55, 0.58, 0.95]}
        grainAmount={0.045}
        vignette={0.35}
        exposure={1.05}
        gamma={2.0}
      />

      {/* Interactive 3D Cursor Trails */}
      <TubesCursor className="fixed inset-0 pointer-events-none z-[1]" />

      {/* ================= GRAND PRELOADER OVERLAY ================= */}
      <AnimatePresence>
        {showPreloader && (
          <motion.div
            key="preloader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="fixed inset-0 z-50 bg-[#020306] flex flex-col items-center justify-center"
          >
            {/* Spinning 3D Favicon Icon */}
            <div className="w-[120px] h-[120px] perspective-1000 flex items-center justify-center mb-8">
              <div className="w-[70px] h-[80px] preserve-3d animate-spin-3d-favicon relative">
                
                {/* Clipboard Card Base Layer */}
                <div 
                  className="absolute inset-0 rounded-2xl border-2 border-primary/50 bg-[#08090f] shadow-2xl flex items-center justify-center"
                  style={{ transform: 'translateZ(-8px)' }}
                >
                  {/* Top Metallic Clip */}
                  <div className="absolute -top-1 w-8 h-3 rounded-b-md bg-[#1b1c24] border border-primary/30" />
                </div>

                {/* Floating Neon Document Page Layer */}
                <div 
                  className="absolute inset-x-2.5 inset-y-4 rounded-xl bg-gradient-to-br from-primary/30 to-secondary/20 border border-primary/40 flex flex-col items-center justify-center backdrop-blur-sm shadow-lg shadow-primary/10"
                  style={{ transform: 'translateZ(8px)' }}
                >
                  <Sparkles className="w-5 h-5 text-white text-glow-primary animate-pulse" />
                </div>

              </div>
            </div>

            <motion.h2
              initial={{ letterSpacing: "0.1em", opacity: 0 }}
              animate={{ letterSpacing: "0.25em", opacity: 1 }}
              transition={{ duration: 1.5 }}
              className="text-white text-sm font-semibold uppercase tracking-widest font-mono text-glow-primary"
            >
              Initializing Secure Relay...
            </motion.h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container with smooth grand reveal fade/scale effect */}
      <motion.main 
        initial="hidden"
        animate={showPreloader ? "hidden" : "visible"}
        variants={revealVariants}
        className="flex-grow flex flex-col items-center justify-center max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 z-10 space-y-24"
      >
        
        <AnimatePresence mode="wait">
          {!roomCode ? (
            /* ================= 3D HERO LANDING SCREEN ================= */
            <motion.div 
              key="landing"
              className="w-full flex flex-col items-center space-y-16"
            >
              {/* Hero Two-Column Layout */}
              <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center pt-8">
                
                {/* Left Column: Title & Actions */}
                <motion.div 
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="space-y-8 text-left max-w-xl"
                >
                  <div className="inline-flex items-center space-x-2 py-1 px-3 bg-primary/10 border border-primary/20 rounded-full text-xs font-semibold text-primary">
                    <Sparkles className="w-3.5 h-3.5 text-glow-primary" />
                    <span>Real-time Ephemeral Data Sync</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
                    Secure Ephemeral <br/>
                    <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent text-glow-primary">
                      Clipboard & File Relay
                    </span>
                  </h1>
                  
                  <p className="text-gray-400 text-sm sm:text-base leading-relaxed">
                    A secure, serverless bridge between your desktop workstation and mobile phone. Instantly sync formatted code blocks and upload files. Data automatically self-destructs after 15 minutes.
                  </p>

                  {/* Error Message Box */}
                  {error && (
                    <div className="p-3.5 rounded-xl bg-red-900/25 border border-red-500/20 text-red-300 text-xs flex items-start space-x-2 animate-pulse">
                      <span className="font-bold">Error:</span>
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Join/Create Interface Panel */}
                  <div className="glass-card p-5 sm:p-6 rounded-2xl border border-white/5 shadow-xl relative overflow-hidden space-y-5">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary" />
                    
                    <div>
                      <label htmlFor="room-code-input" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5">
                        Have a Room Code?
                      </label>
                      <div className="flex relative rounded-xl shadow-inner bg-black/40">
                        <input
                          id="room-code-input"
                          type="text"
                          maxLength={6}
                          placeholder="ENTER CODE"
                          value={inputRoomCode}
                          onChange={(e) => setInputRoomCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
                          className="glass-input block w-full px-4 py-3 text-center text-lg font-mono tracking-widest rounded-l-xl uppercase font-bold placeholder:tracking-normal placeholder:font-sans placeholder:text-sm placeholder:text-gray-500 focus:z-10 bg-transparent border-0 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => joinRoom(inputRoomCode)}
                          disabled={loading || inputRoomCode.length !== 6}
                          className="inline-flex items-center px-5 py-2 text-sm font-bold rounded-r-xl text-white bg-primary hover:bg-primary-dark transition duration-150 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div className="relative flex items-center justify-center py-1">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/5"></div>
                      </div>
                      <span className="relative px-3 bg-[#06070b] text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                        Or Create Room
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={createRoom}
                      disabled={loading}
                      className="w-full py-3.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-primary to-secondary hover:opacity-95 transition shadow-lg shadow-primary/20 cursor-pointer flex items-center justify-center space-x-2"
                    >
                      {loading ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-glow-primary" />
                          <span>Generate Temporary Room</span>
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>

                {/* Right Column: 3D Side-by-Side Device & File Particle Loop Scene */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                  className="w-full flex items-center justify-center py-6 perspective-1000 min-h-[360px] overflow-hidden"
                >
                  <div 
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    style={interactive3DTilt}
                    className="relative w-[500px] h-[320px] preserve-3d transition-transform flex items-center justify-center select-none scale-75 sm:scale-90 md:scale-100"
                  >
                    
                    {/* Outward flying file particles (Laptop -> Phone) */}
                    {[
                      { id: 1, icon: FileText, label: 'notes.txt', delay: 0, color: '#a855f7' },
                      { id: 2, icon: Image, label: 'image.png', delay: 1.3, color: '#ec4899' },
                      { id: 3, icon: Folder, label: 'src_code/', delay: 2.6, color: '#3b82f6' }
                    ].map((file) => {
                      const FileIcon = file.icon;
                      return (
                        <motion.div
                          key={file.id}
                          initial={{ opacity: 0 }}
                          animate={{
                            x: [0, 140, 280, 360],
                            y: [0, -110, -110, -30],
                            opacity: [0, 1, 1, 0],
                            scale: [0.6, 1, 1, 0.6]
                          }}
                          transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: file.delay
                          }}
                          className="absolute left-[80px] top-[140px] px-2.5 py-1 rounded-full border bg-[#050609]/95 text-[9px] font-mono flex items-center space-x-1.5 shadow-lg pointer-events-none z-20"
                          style={{ 
                            borderColor: `${file.color}40`,
                            color: file.color,
                            boxShadow: `0 4px 15px -3px ${file.color}20`
                          }}
                        >
                          <FileIcon className="w-3.5 h-3.5" />
                          <span>{file.label}</span>
                        </motion.div>
                      );
                    })}

                    {/* Return flying file particles (Phone -> Laptop) */}
                    {[
                      { id: 4, icon: Terminal, label: 'build_log', delay: 0.6, color: '#a855f7' },
                      { id: 5, icon: FileText, label: 'data.json', delay: 1.9, color: '#3b82f6' },
                      { id: 6, icon: Lock, label: 'token.key', delay: 3.2, color: '#10b981' }
                    ].map((file) => {
                      const FileIcon = file.icon;
                      return (
                        <motion.div
                          key={file.id}
                          initial={{ opacity: 0 }}
                          animate={{
                            x: [360, 280, 140, 0],
                            y: [-30, 80, 80, 0],
                            opacity: [0, 1, 1, 0],
                            scale: [0.6, 1, 1, 0.6]
                          }}
                          transition={{
                            duration: 4,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: file.delay
                          }}
                          className="absolute left-[80px] top-[140px] px-2.5 py-1 rounded-full border bg-[#050609]/95 text-[9px] font-mono flex items-center space-x-1.5 shadow-lg pointer-events-none z-20"
                          style={{ 
                            borderColor: `${file.color}40`,
                            color: file.color,
                            boxShadow: `0 4px 15px -3px ${file.color}20`
                          }}
                        >
                          <FileIcon className="w-3.5 h-3.5" />
                          <span>{file.label}</span>
                        </motion.div>
                      );
                    })}

                    {/* Left side Laptop Mockup */}
                    <div 
                      className="absolute left-0 top-[90px] w-[180px] preserve-3d"
                      style={{ transform: 'rotateY(12deg) rotateX(4deg)' }}
                    >
                      {/* Screen */}
                      <div className="w-full aspect-[16/10] bg-[#0c0d15] rounded-t-xl border border-white/10 p-1.5 shadow-2xl relative">
                        <div className="w-full h-full bg-[#030407] rounded border border-white/5 p-2 flex flex-col font-mono text-[8px] text-gray-400 text-left overflow-hidden">
                          <div className="flex items-center space-x-1 border-b border-white/5 pb-1 mb-1.5 text-[7px] text-gray-500">
                            <Terminal className="w-2.5 h-2.5 text-primary" />
                            <span>CLI Bridge</span>
                          </div>
                          <span className="text-emerald-400 font-semibold">$ npm run dev</span>
                          <span className="text-primary font-bold text-[7px]">Room active: {roomCode || 'BRIDGE'}</span>
                          <div className="w-full h-0.5 bg-primary/20 mt-1 animate-pulse" />
                        </div>
                      </div>
                      {/* Base */}
                      <div 
                        className="w-full h-[100px] bg-[#222329] rounded-b-xl border-t border-white/30 relative flex flex-col items-center p-2" 
                        style={{ transform: 'rotateX(75deg)', transformOrigin: 'top' }}
                      >
                        <div className="w-14 h-6 rounded border border-black/50 bg-[#16171b] shadow-inner mt-2" />
                      </div>
                    </div>

                    {/* Right side Phone Mockup */}
                    <div 
                      className="absolute right-0 top-[70px] w-[85px] aspect-[9/18] bg-[#0c0d15] rounded-2xl border border-white/15 p-1.5 shadow-2xl animate-bob preserve-3d z-10"
                      style={{ transform: 'rotateY(-12deg) rotateX(4deg)' }}
                    >
                      <div className="w-full h-full bg-[#030407] rounded-xl border border-white/5 p-1.5 flex flex-col font-sans overflow-hidden text-[7px] text-left relative">
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-2 bg-black rounded-full border border-white/5" />
                        
                        <div className="mt-3 flex flex-col space-y-1 overflow-hidden">
                          <span className="text-gray-500 uppercase tracking-wider text-[5px]">Active Relay</span>
                          <div className="p-1 rounded bg-primary/15 border border-primary/20 text-[5px] font-mono text-gray-300">
                            sync: ready
                          </div>
                        </div>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-1/3 h-0.5 bg-white/20 rounded-full" />
                      </div>
                    </div>

                  </div>
                </motion.div>
              </div>

              {/* Bounce Down Arrow */}
              <div className="flex flex-col items-center space-y-2 cursor-pointer mt-10">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest font-mono">Learn How It Works</span>
                <ChevronDown className="w-4 h-4 text-primary animate-bounce" />
              </div>

              {/* ================= SCROLL-LINKED TIMELINE SECTION ================= */}
              <section 
                id="features-timeline"
                ref={timelineRef}
                className="w-full max-w-4xl py-12 relative flex flex-col items-center"
              >
                <div className="text-center mb-16 space-y-3">
                  <h2 className="text-2xl sm:text-3xl font-black text-white">How To Connect Devices</h2>
                  <p className="text-sm text-gray-400 max-w-md mx-auto">
                    Three simple steps to bridge your college workstation to your phone securely in seconds.
                  </p>
                </div>

                {/* SVG Pipeline (animated by Scroll) */}
                <div className="absolute left-4 md:left-1/2 top-40 bottom-16 w-1 -translate-x-1/2 z-0">
                  {/* Gray Pipeline Background */}
                  <div className="absolute inset-0 bg-white/5 rounded-full" />
                  {/* Glowing Scroll Progress */}
                  <motion.div 
                    style={{ scaleY: pipelineLength }}
                    className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-primary via-secondary to-accent rounded-full origin-top"
                  />
                </div>

                {/* Timeline Step Cards */}
                <div className="w-full space-y-20 relative z-10 text-left">
                  
                  {/* Step 1 */}
                  <div className="relative flex flex-col md:flex-row md:justify-between items-start md:items-center">
                    {/* Left column (Text on Desktop) */}
                    <motion.div 
                      whileInView={{ opacity: [0, 1], x: [-35, 0] }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.7 }}
                      className="w-full md:w-[45%] pl-12 md:pl-0 md:pr-10 md:text-right space-y-2 order-2 md:order-1"
                    >
                      <span className="font-mono text-xs font-bold text-primary text-glow-primary">STEP 01</span>
                      <h3 className="text-xl font-bold text-white font-sans">Spawn a Temporary Session</h3>
                      <p className="text-xs text-gray-400 leading-relaxed max-w-sm md:ml-auto">
                        Click "Generate Temporary Room" to create a unique 6-character room code instantly.
                      </p>
                    </motion.div>
                    
                    {/* Center Node */}
                    <div className="absolute left-4 md:left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#020306] border-2 border-primary flex items-center justify-center text-primary font-mono text-xs font-bold shadow-lg shadow-primary/20 order-1 md:order-2">
                      1
                    </div>

                    {/* Right column (Spacer on Desktop) */}
                    <div className="hidden md:block w-[45%] order-3" />
                  </div>

                  {/* Step 2 */}
                  <div className="relative flex flex-col md:flex-row md:justify-between items-start md:items-center">
                    {/* Left column (Spacer on Desktop) */}
                    <div className="hidden md:block w-[45%] order-1" />

                    {/* Center Node */}
                    <div className="absolute left-4 md:left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#020306] border-2 border-secondary flex items-center justify-center text-secondary font-mono text-xs font-bold shadow-lg shadow-secondary/20 order-1 md:order-2">
                      2
                    </div>

                    {/* Right column (Text on Desktop) */}
                    <motion.div 
                      whileInView={{ opacity: [0, 1], x: [35, 0] }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.7 }}
                      className="w-full md:w-[45%] pl-12 md:pl-10 space-y-2 order-2 md:order-3"
                    >
                      <span className="font-mono text-xs font-bold text-secondary text-glow-secondary">STEP 02</span>
                      <h3 className="text-xl font-bold text-white font-sans">Scan QR Code to Join</h3>
                      <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
                        Open the QR code modal on your desktop, and scan it with your phone's camera to bridge devices instantly.
                      </p>
                    </motion.div>
                  </div>

                  {/* Step 3 */}
                  <div className="relative flex flex-col md:flex-row md:justify-between items-start md:items-center">
                    {/* Left column (Text on Desktop) */}
                    <motion.div 
                      whileInView={{ opacity: [0, 1], x: [-35, 0] }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.7 }}
                      className="w-full md:w-[45%] pl-12 md:pl-0 md:pr-10 md:text-right space-y-2 order-2 md:order-1"
                    >
                      <span className="font-mono text-xs font-bold text-accent">STEP 03</span>
                      <h3 className="text-xl font-bold text-white font-sans">Bridge Data & Wipe Cleans</h3>
                      <p className="text-xs text-gray-400 leading-relaxed max-w-sm md:ml-auto">
                        Instantly sync texts with whitespace indents preserved, and stream file relays up to 10MB to Cloudinary. Click "Wipe Data" to instantly clear Redis keys on exit.
                      </p>
                    </motion.div>

                    {/* Center Node */}
                    <div className="absolute left-4 md:left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#020306] border-2 border-accent flex items-center justify-center text-accent font-mono text-xs font-bold shadow-lg shadow-accent/20 order-1 md:order-2">
                      3
                    </div>

                    {/* Right column (Spacer on Desktop) */}
                    <div className="hidden md:block w-[45%] order-3" />
                  </div>

                </div>
              </section>
            </motion.div>
          ) : (
            /* ================= DASHBOARD / ACTIVE ROOM ================= */
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6"
            >
              {/* Sidebar Panel: Room Info & Settings */}
              <div className="lg:col-span-1 space-y-6">
                
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
                    className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-gray-300 transition cursor-pointer"
                  >
                    <QrCode className="w-4 h-4 text-primary text-glow-primary" />
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
                    <span className="text-xs text-gray-400 font-semibold">minutes</span>
                  </div>
                  
                  <p className="text-[11px] text-gray-400 mt-2.5">
                    TTL refreshes back to 15:00 on every new text sync or file upload!
                  </p>
                </div>

                {/* Danger Actions Card */}
                <div className="glass-card rounded-2xl p-5 shadow-xl border border-white/5 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-1">
                      Wipe Session
                    </h3>
                    <p className="text-xs text-gray-400 leading-normal">
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
                      className="py-2.5 px-3 rounded-xl bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-xs font-semibold text-red-300 hover:text-white transition cursor-pointer text-center flex items-center justify-center space-x-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Wipe Data</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Main Board Panel: Sync Inputs & Relay List */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Sync input panel */}
                <div className="glass-card rounded-2xl p-6 shadow-xl border border-white/5">
                  <h2 className="text-lg font-bold text-white mb-4 flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-primary text-glow-primary" />
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
                      <div className="mt-2.5 flex justify-between items-center">
                        <span className="text-[11px] text-gray-500">
                          Preserves spaces, tabs, and indentation format.
                        </span>
                        <button
                          type="button"
                          onClick={syncText}
                          disabled={!inputText.trim()}
                          className="px-4 py-2 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-glow-primary" />
                          <span>Sync Clipboard</span>
                        </button>
                      </div>
                    </div>

                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-white/5"></div>
                      </div>
                      <span className="relative px-3 bg-[#020306] text-[10px] font-bold text-gray-500 uppercase tracking-widest">
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
                      className={`border border-dashed rounded-xl p-6 text-center transition cursor-pointer ${
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
                          <UploadCloud className="w-8 h-8 text-gray-400 mb-3 animate-pulse" />
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
                              <pre className="whitespace-pre-wrap font-mono text-sm bg-[#050609] p-4 rounded-xl border border-white/5 text-left text-gray-200 overflow-x-auto select-text break-all">
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
                            <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-4 bg-[#050609] p-4 rounded-xl border border-white/5">
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
                                    className="py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 rounded-lg text-xs font-semibold text-emerald-400 transition cursor-pointer flex items-center space-x-1.5"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                  </a>

                                  <button
                                    onClick={() => copyToClipboard(item.content, item.id)}
                                    className="py-1.5 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-gray-300 transition cursor-pointer flex items-center space-x-1.5"
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
      </motion.main>

      {/* QR Code sharing Modal overlay */}
      <AnimatePresence>
        {showQRModal && roomCode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50"
            onClick={() => setShowQRModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 20 }}
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
                <Smartphone className="w-6 h-6 text-glow-primary" />
              </div>
              
              <h3 className="text-lg font-bold text-white mb-1">Bridge Connection</h3>
              <p className="text-xs text-gray-400 mb-6 px-4">
                Scan the QR code below using your phone's camera to join this room instantly.
              </p>

              {/* QR Container */}
              <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-6">
                <QRCodeSVG 
                  value={`${window.location.origin}/room/${roomCode}`}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>

              {/* Room Details in Modal */}
              <div className="bg-[#050609] p-3 rounded-lg border border-white/5 mb-2 font-mono flex items-center justify-between px-4">
                <span className="text-xs text-gray-500">Room Code</span>
                <span className="text-lg font-bold text-white tracking-widest">{roomCode}</span>
              </div>
              
              <p className="text-[10px] text-gray-500 leading-tight">
                No passwords required. Sockets will bridge instantly upon join.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Footer */}
      <footer className="mt-10 py-6 text-center text-xs text-gray-500 border-t border-white/5 z-10 bg-black/10">
        <p>© 2026 Secure Ephemeral Clipboard & File Relay • Developed for shared workspace security.</p>
      </footer>
    </div>
  );
}

export default App;
