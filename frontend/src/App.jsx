import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import confetti from 'canvas-confetti';
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
  ChevronDown,
  Folder,
  Image,
  Activity,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import ScrollExpandMedia from './components/ui/scroll-expansion-hero';

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
  const [latency, setLatency] = useState(0);

  const [showIntro, setShowIntro] = useState(() => {
    // If joining a room link directly, bypass intro
    const path = window.location.pathname;
    const isRoomLink = /^\/room\/([A-Z2-9]{6})$/i.test(path);
    if (isRoomLink) return false;
    
    // Otherwise, check session storage
    return sessionStorage.getItem('clipboard_relay_intro_played') !== 'true';
  });

  const handleSkipIntro = () => {
    sessionStorage.setItem('clipboard_relay_intro_played', 'true');
    setShowIntro(false);
  };

  // References
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
        particleCount: 80,
        spread: 50,
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
        particleCount: 40,
        spread: 40,
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
      particleCount: 20,
      angle: 60,
      spread: 35,
      origin: { x: 0 }
    });
    confetti({
      particleCount: 20,
      angle: 120,
      spread: 35,
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
        particleCount: 40,
        spread: 40,
        colors: ['#10b981', '#3b82f6']
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
    if (window.confirm("Immediately delete all files/texts in this session? This wipes Redis keys and disconnects all connected devices.")) {
      socketRef.current.emit('clear-session', { roomCode });
    }
  };

  // Utilities: Copy Text
  const copyToClipboard = (text, itemId) => {
    navigator.clipboard.writeText(text);
    setCopiedId(itemId);
    
    confetti({
      particleCount: 10,
      spread: 15,
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

  if (showIntro) {
    return (
      <div className="fixed inset-0 z-50 bg-[#08090d] flex flex-col items-center justify-center overflow-hidden">
        {/* Video Player */}
        <video
          src="/intro.mp4"
          autoPlay
          muted
          playsInline
          onEnded={handleSkipIntro}
          className="w-full h-full object-cover md:object-contain"
        />
        
        {/* Skip Button */}
        <button
          onClick={handleSkipIntro}
          className="absolute bottom-8 right-8 px-6 py-2.5 rounded-full bg-black/60 hover:bg-black/80 border border-white/10 text-white font-semibold text-xs tracking-wider uppercase transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 flex items-center space-x-2 z-50 cursor-pointer"
        >
          <span>Skip Intro</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-[#08090d]">
      {/* High-performance CSS background */}
      <div className="minimalist-bg" />

      {!roomCode ? (
        /* ================= MINIMALIST HERO LANDING SCREEN WITH SCROLL EXPANSION HERO ================= */
        <ScrollExpandMedia
          mediaType="video"
          mediaSrc="/hero.mp4"
          bgImageSrc="/bg.png"
          title="Clipboard Relay"
          date="Instant & Ephemeral"
          scrollToExpand="Scroll to Connect Devices"
          textBlend
        >
          <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 z-10 flex flex-col items-center space-y-16">
            
            {/* Split layout: Text on left, 2D Animation on right */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-12 items-center pt-6">
              
              {/* Left Column: Value Proposition & Action Area */}
              <div className="space-y-6 text-left max-w-lg">
                <div className="inline-flex items-center space-x-2 py-1 px-3 bg-primary/10 border border-primary/20 rounded-full text-xs font-semibold text-primary">
                  <Zap className="w-3.5 h-3.5 text-primary" />
                  <span>Minimalist Zero-Lag Relay</span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
                  Instant Ephemeral <br/>
                  <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent text-glow-primary">
                    Clipboard & File Relay
                  </span>
                </h1>
                
                <p className="text-gray-400 text-sm leading-relaxed">
                  A high-speed, secure link between your workstation and mobile phone. Instantly sync copy-pastes and upload files up to 10MB. All data auto-expires from memory after 15 minutes.
                </p>

                {/* Error Box */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-900/20 border border-red-500/20 text-red-300 text-xs flex items-start space-x-2">
                    <span className="font-bold">Error:</span>
                    <span>{error}</span>
                  </div>
                )}

                {/* Join/Create Panel */}
                <div className="glass-card p-5 rounded-xl border border-white/5 shadow-xl relative overflow-hidden space-y-4">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary to-secondary" />
                  
                  <div>
                    <label htmlFor="room-code" className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                      Have a Room Code?
                    </label>
                    <div className="flex relative rounded-lg bg-black/40 overflow-hidden border border-white/5 focus-within:border-primary/50 transition">
                      <input
                        id="room-code"
                        type="text"
                        maxLength={6}
                        placeholder="ENTER 6-CHAR CODE"
                        value={inputRoomCode}
                        onChange={(e) => setInputRoomCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ''))}
                        className="glass-input block w-full px-4 py-2.5 text-center text-md font-mono tracking-widest uppercase font-bold placeholder:tracking-normal placeholder:font-sans placeholder:text-xs placeholder:text-gray-500 bg-transparent border-0 outline-none focus:ring-0"
                      />
                      <button
                        type="button"
                        onClick={() => joinRoom(inputRoomCode)}
                        disabled={loading || inputRoomCode.length !== 6}
                        className="inline-flex items-center px-4 bg-primary hover:bg-primary-dark transition text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-center py-0.5">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/5"></div>
                    </div>
                    <span className="relative px-3 bg-[#08090d] text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                      Or
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={createRoom}
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-lg font-bold text-xs text-white bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition cursor-pointer flex items-center justify-center space-x-2 shadow-md shadow-primary/10"
                  >
                    {loading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate Temporary Room</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Placeholder for Looping File-Transfer Animation */}
              <div className="w-full flex items-center justify-center py-4">
                <div className="relative w-full max-w-[380px] h-[200px] flex items-center justify-between p-6 bg-white/[0.015] border border-white/5 rounded-xl overflow-hidden shadow-inner">
                  
                  {/* Connection Line */}
                  <div className="absolute left-[20%] right-[20%] top-1/2 h-[1px] border-t border-dashed border-white/10 z-0" />
                  
                  {/* Left Device: Desktop Card */}
                  <div className="relative z-10 flex flex-col items-center bg-[#0c0d15] border border-white/10 rounded-lg p-3 w-[100px] shadow-lg">
                    <Terminal className="w-5 h-5 text-primary mb-1" />
                    <span className="text-[9px] font-mono text-gray-400">Desktop</span>
                  </div>

                  {/* Flowing File Badges Container */}
                  <div className="absolute left-[105px] right-[95px] top-[30%] bottom-[30%] pointer-events-none z-20 overflow-hidden">
                    {/* Outward Particle */}
                    <div className="absolute top-[10%] left-0 px-2 py-0.5 rounded-full border border-primary/20 bg-[#0c0d15] text-[8px] font-mono text-primary flex items-center space-x-1 shadow-md animate-flow-lr">
                      <FileText className="w-2.5 h-2.5" />
                      <span>data.txt</span>
                    </div>

                    {/* Return Particle */}
                    <div className="absolute bottom-[10%] left-0 px-2 py-0.5 rounded-full border border-secondary/20 bg-[#0c0d15] text-[8px] font-mono text-secondary flex items-center space-x-1 shadow-md animate-flow-rl">
                      <Image className="w-2.5 h-2.5" />
                      <span>photo.png</span>
                    </div>
                  </div>

                  {/* Right Device: Mobile Card */}
                  <div className="relative z-10 flex flex-col items-center bg-[#0c0d15] border border-white/10 rounded-lg p-3 w-[90px] shadow-lg">
                    <Smartphone className="w-5 h-5 text-secondary mb-1" />
                    <span className="text-[9px] font-mono text-gray-400">Mobile</span>
                  </div>
                </div>
              </div>

            </div>

            {/* ================= STATIC HOW IT WORKS SECTION ================= */}
            <section className="w-full max-w-4xl py-6 border-t border-white/5">
              <h2 className="text-center text-lg font-bold text-white mb-8">How it works</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Step 1 */}
                <div className="bg-white/[0.01] border border-white/5 rounded-xl p-5 space-y-2 text-left">
                  <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-mono text-primary font-bold">1</div>
                  <h3 className="text-sm font-semibold text-white">Create Room</h3>
                  <p className="text-xs text-gray-400 leading-normal">
                    Generate a temporary, secure 6-character room code on your desktop.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="bg-white/[0.01] border border-white/5 rounded-xl p-5 space-y-2 text-left">
                  <div className="w-6 h-6 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center text-xs font-mono text-secondary font-bold">2</div>
                  <h3 className="text-sm font-semibold text-white">Scan & Join</h3>
                  <p className="text-xs text-gray-400 leading-normal">
                    Scan the QR code or enter the code on your mobile browser to bridge the devices.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="bg-white/[0.01] border border-white/5 rounded-xl p-5 space-y-2 text-left">
                  <div className="w-6 h-6 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-xs font-mono text-accent font-bold">3</div>
                  <h3 className="text-sm font-semibold text-white">Sync & Self-Destruct</h3>
                  <p className="text-xs text-gray-400 leading-normal">
                    Sync copied items or relay files. Data self-destructs from memory in 15 minutes.
                  </p>
                </div>

              </div>
            </section>

            {/* ================= DETAILED CAPABILITIES GRID SECTION ================= */}
            <section className="w-full max-w-4xl py-10 border-t border-white/5">
              <h2 className="text-center text-lg font-bold text-white mb-3">Core Capabilities</h2>
              <p className="text-center text-xs text-gray-400 max-w-md mx-auto mb-10">
                Packed with secure, developer-focused features designed for high efficiency and speed.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                
                {/* Feature 1 */}
                <div className="group bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-primary/30 rounded-xl p-5 text-left transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 cursor-default">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 transition duration-200 group-hover:scale-110 group-hover:bg-primary/20">
                    <Clipboard className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">Live Clipboard Sync</h3>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Paste raw text or formatted code blocks. Spacing, tabs, and indentation are fully preserved across all synced devices.
                  </p>
                </div>

                {/* Feature 2 */}
                <div className="group bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-secondary/30 rounded-xl p-5 text-left transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-secondary/5 cursor-default">
                  <div className="w-8 h-8 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center text-secondary mb-4 transition duration-200 group-hover:scale-110 group-hover:bg-secondary/20">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">Cloudinary File Relay</h3>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Drag and drop images, configs, or assets up to 10MB. Stream files directly and download them in one click.
                  </p>
                </div>

                {/* Feature 3 */}
                <div className="group bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-accent/30 rounded-xl p-5 text-left transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-accent/5 cursor-default">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4 transition duration-200 group-hover:scale-110 group-hover:bg-accent/20">
                    <Clock className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">15-Minute Auto-Wipe</h3>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    All stored clipboard keys and file entries in Upstash Redis self-destruct after 15 minutes of inactivity.
                  </p>
                </div>

                {/* Feature 4 */}
                <div className="group bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-emerald-500/30 rounded-xl p-5 text-left transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-emerald-500/5 cursor-default">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 transition duration-200 group-hover:scale-110 group-hover:bg-emerald-500/20">
                    <Lock className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">Zero-Account Setup</h3>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    No sign-ups, email listings, or passwords required. Generate a temporary code and connect instantly.
                  </p>
                </div>

                {/* Feature 5 */}
                <div className="group bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-orange-500/30 rounded-xl p-5 text-left transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-500/5 cursor-default">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-4 transition duration-200 group-hover:scale-110 group-hover:bg-orange-500/20">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">Instant QR Bridge</h3>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Open the session QR code on your PC monitor, scan it with your phone's camera, and bridge devices instantly.
                  </p>
                </div>

                {/* Feature 6 */}
                <div className="group bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-cyan-500/30 rounded-xl p-5 text-left transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-cyan-500/5 cursor-default">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 transition duration-200 group-hover:scale-110 group-hover:bg-cyan-500/20">
                    <Activity className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-2">Completely Wiped on Exit</h3>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Wiping database keys is immediate. Click "Wipe Data" on exit to clear all Redis entries and unlink connected tabs instantly.
                  </p>
                </div>

              </div>
            </section>
          </div>
        </ScrollExpandMedia>
      ) : (
        /* ================= DASHBOARD / ACTIVE ROOM ================= */
        <main className="flex-grow flex flex-col items-center justify-center max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 z-10">
          <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            
            {/* Sidebar Panel: Room Info */}
            <div className="md:col-span-1 space-y-6">
              
              {/* Room Code Card */}
              <div className="glass-card rounded-xl p-5 relative overflow-hidden shadow-xl border border-white/5">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
                  <span>Session Room</span>
                  <span className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-[9px] text-gray-300">Sync Active</span>
                  </span>
                </h3>
                
                <div className="flex items-baseline space-x-2 mb-4">
                  <span className="text-3xl font-mono font-black text-white tracking-wider">{roomCode}</span>
                  <button 
                    onClick={copyRoomLink}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
                    title="Copy Room Link"
                  >
                    {linkCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Link className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  onClick={() => setShowQRModal(true)}
                  className="w-full flex items-center justify-center space-x-2 py-2 px-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-gray-300 transition cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-primary" />
                  <span>Scan QR Code</span>
                </button>
              </div>

              {/* Countdown Card */}
              <div className="glass-card rounded-xl p-5 shadow-xl border border-white/5">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Expiration Countdown</span>
                  <Clock className="w-4 h-4 text-secondary" />
                </h3>
                
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-mono font-bold text-white tracking-widest">
                    {formatTime(ttlRemaining)}
                  </span>
                  <span className="text-[10px] text-gray-400 font-bold">MIN REMAINING</span>
                </div>
                
                <p className="text-[10px] text-gray-500 mt-2">
                  Refreshes back to 15:00 on every Clipboard Sync or File Upload.
                </p>
              </div>

              {/* Session Termination Card */}
              <div className="glass-card rounded-xl p-5 shadow-xl border border-white/5 space-y-3">
                <div>
                  <h3 className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-1">
                    Terminate Session
                  </h3>
                  <p className="text-[10px] text-gray-400 leading-normal">
                    Instantly wipes all synced clips from Redis and disconnects all socket sessions.
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
                    className="py-2 px-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition cursor-pointer text-center"
                  >
                    Exit Room
                  </button>
                  
                  <button
                    onClick={triggerClearSession}
                    className="py-2 px-3 rounded-lg bg-red-600/10 hover:bg-red-600 border border-red-500/20 text-xs font-semibold text-red-300 hover:text-white transition cursor-pointer text-center flex items-center justify-center space-x-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Wipe Data</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Main Sync Content Feed */}
            <div className="md:col-span-2 space-y-6">
              
              {/* Sync form */}
              <div className="glass-card rounded-xl p-5 shadow-xl border border-white/5">
                <h2 className="text-md font-bold text-white mb-3 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span>Sync New Data</span>
                </h2>

                {error && (
                  <div className="mb-3 p-2.5 rounded-lg bg-red-900/20 border border-red-500/20 text-red-300 text-xs flex justify-between items-center">
                    <span>{error}</span>
                    <button onClick={() => setError(null)} className="text-red-300 hover:text-white">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <textarea
                      rows={3}
                      placeholder="Paste text, code snippets, or links to share..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      className="glass-input block w-full p-3 text-xs font-mono rounded-lg placeholder:font-sans placeholder:text-gray-500 focus:ring-0 focus:border-primary"
                    ></textarea>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-[10px] text-gray-500">
                        Whitespace and indentation formats are preserved.
                      </span>
                      <button
                        type="button"
                        onClick={syncText}
                        disabled={!inputText.trim()}
                        className="px-3.5 py-1.5 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer flex items-center space-x-1"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Sync Clipboard</span>
                      </button>
                    </div>
                  </div>

                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/5"></div>
                    </div>
                    <span className="relative px-3 bg-[#08090d] text-[9px] font-bold text-gray-500 uppercase tracking-widest">
                      Or
                    </span>
                  </div>

                  {/* Dropzone */}
                  <div
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    className={`border border-dashed rounded-lg p-5 text-center transition cursor-pointer ${
                      dragActive 
                        ? 'border-primary bg-primary/5' 
                        : 'border-white/10 hover:border-white/20 bg-white/[0.005]'
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
                      <div className="flex flex-col items-center justify-center py-1">
                        <RefreshCw className="w-6 h-6 text-primary animate-spin mb-2" />
                        <p className="text-xs font-semibold text-white">Uploading file directly to Cloudinary...</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-1">
                        <UploadCloud className="w-6 h-6 text-gray-400 mb-2" />
                        <p className="text-xs font-semibold text-gray-300">Drag & Drop file here or <span className="text-primary hover:underline">browse</span></p>
                        <p className="text-[10px] text-gray-500 mt-1">Images, documents, configs (Max 10MB)</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Feed items */}
              <div className="space-y-4">
                <h2 className="text-sm font-bold text-white px-1">
                  Synced Feed ({items.length})
                </h2>

                {items.length === 0 ? (
                  <div className="glass-card rounded-xl p-6 text-center border border-white/5">
                    <Clipboard className="w-8 h-8 text-gray-600 mx-auto mb-2 opacity-40" />
                    <p className="text-xs text-gray-400">Empty room feed.</p>
                  </div>
                ) : (
                  items.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="glass-card rounded-xl p-4 shadow-md border border-white/5 relative overflow-hidden transition"
                    >
                      <div className={`absolute top-0 left-0 h-full w-[2px] ${
                        item.type === 'file' ? 'bg-emerald-400' : 'bg-primary'
                      }`} />

                      <div className="flex justify-between items-center mb-2.5 text-[10px] text-gray-500 ml-1">
                        <span className="font-semibold">
                          {item.type === 'file' ? '📁 File' : '📝 Text'}
                        </span>
                        <span>
                          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {item.type === 'text' ? (
                        <div className="relative">
                          <pre className="whitespace-pre-wrap font-mono text-xs bg-black/40 p-3 rounded-lg border border-white/5 text-left text-gray-300 overflow-x-auto select-text break-all">
                            {item.content}
                          </pre>
                          
                          <button
                            onClick={() => copyToClipboard(item.content, item.id)}
                            className="absolute top-2 right-2 p-1.5 rounded-md bg-neutral-900/90 text-gray-400 hover:text-white border border-white/10 cursor-pointer shadow-md"
                            title="Copy to Clipboard"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-3 bg-black/40 p-3 rounded-lg border border-white/5">
                          {isImage(item.fileType, item.fileName) ? (
                            <a 
                              href={item.content} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="w-12 h-12 rounded overflow-hidden border border-white/10 bg-black/25 flex items-center justify-center flex-shrink-0 cursor-zoom-in"
                            >
                              <img 
                                src={item.content} 
                                alt={item.fileName} 
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ) : (
                            <div className="w-10 h-10 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                          )}

                          <div className="flex-grow text-left overflow-hidden">
                            <h4 className="font-semibold text-xs text-gray-200 truncate">{item.fileName || 'file'}</h4>
                            <p className="text-[10px] text-gray-500">{formatBytes(item.fileSize)} • {item.fileType || 'file'}</p>
                            
                            <div className="mt-2 flex gap-2">
                              <a
                                href={item.content}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="py-1 px-2.5 bg-emerald-500/10 hover:bg-emerald-500 hover:text-black border border-emerald-500/20 rounded-md text-[10px] font-semibold text-emerald-400 transition cursor-pointer flex items-center space-x-1"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </a>

                              <button
                                onClick={() => copyToClipboard(item.content, item.id)}
                                className="py-1 px-2.5 bg-white/5 hover:bg-white/10 rounded-md text-[10px] text-gray-300 transition cursor-pointer flex items-center space-x-1"
                              >
                                {copiedId === item.id ? (
                                  <>
                                    <Check className="w-3 h-3 text-emerald-400" />
                                    <span className="text-emerald-400">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Link className="w-3 h-3" />
                                    <span>Copy URL</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </main>
      )}

      {/* QR sharing Modal */}
      {showQRModal && roomCode && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="glass-card max-w-xs w-full rounded-xl p-5 shadow-2xl relative border border-white/10 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowQRModal(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            
            <div className="mb-3 text-primary mx-auto w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            
            <h3 className="text-sm font-bold text-white mb-1">Bridge Connection</h3>
            <p className="text-[10px] text-gray-400 mb-4 px-2">
              Scan with your phone's camera to join this room instantly.
            </p>

            <div className="bg-white p-3 rounded-lg inline-block shadow-inner mb-4">
              <QRCodeSVG 
                value={`${window.location.origin}/room/${roomCode}`}
                size={160}
                level="M"
              />
            </div>

            <div className="bg-[#050609] p-2.5 rounded-lg border border-white/5 font-mono flex items-center justify-between px-3">
              <span className="text-[9px] text-gray-500">Room Code</span>
              <span className="text-md font-bold text-white tracking-widest">{roomCode}</span>
            </div>
          </div>
        </div>
      )}

      {/* Global Footer */}
      <footer className="py-6 text-center text-[10px] text-gray-600 border-t border-white/5 z-10 bg-black/10">
        <p>© 2026 Secure Ephemeral Clipboard & File Relay • Optimized for speed and safety.</p>
      </footer>
    </div>
  );
}

export default App;
