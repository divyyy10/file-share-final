import React, { useEffect, useRef, useState } from 'react';
import { 
  Share2, 
  Wifi, 
  WifiOff, 
  Smartphone, 
  Laptop, 
  Server, 
  ShieldCheck, 
  Zap, 
  ChevronRight, 
  AlertCircle,
  QrCode,
  History,
  Activity,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import QRPanel from './components/QRPanel';
import FileSelector from './components/FileSelector';
import DeviceStatus from './components/DeviceStatus';
import TransferQueue, { formatBytes, formatSpeed } from './components/TransferQueue';
import TransferHistory from './components/TransferHistory';
import { Device, ConnectionStatus, TransferFile, TransferLog } from './types';

// Large chunk size for speed and small header overhead
const CHUNK_SIZE = 512 * 1024; // 512KB chunks for hyper-fast speed and maximum throughput
const MAX_RECONNECT_ATTEMPTS = 15;

// Random name adjectives and nouns for fun, friendly device labels
const ADJECTIVES = ['Mystic', 'Noble', 'Sunset', 'Hyper', 'Sonic', 'Cosmic', 'Golden', 'Velo', 'Ember', 'Alpine'];
const NOUNS = ['Falcon', 'Phoenix', 'Pixel', 'Orbiter', 'Prism', 'Beacon', 'Atlas', 'Rider', 'Eclipse', 'Horizon'];

function generateDeviceName(type: string): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj} ${noun} ${type}`;
}

export default function App() {
  // Device specifics
  const [deviceId, setDeviceId] = useState<string>('');
  const [deviceType, setDeviceType] = useState<'PC' | 'Phone' | 'Tablet'>('PC');
  const [deviceName, setDeviceName] = useState<string>('');

  // Sockets & pairing state
  const [roomId, setRoomId] = useState<string>('');
  const [pairingUrl, setPairingUrl] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [pairedDevices, setPairedDevices] = useState<Device[]>([]);

  // Transfer & History Queues
  const [transfers, setTransfers] = useState<TransferFile[]>([]);
  const [logs, setLogs] = useState<TransferLog[]>([]);
  const [autoDownload, setAutoDownload] = useState<boolean>(true);

  // Synchronization refs to hold non-react handles for files and progress throttling
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sendingFilesRef = useRef<{ [fileId: string]: File }>({});
  const receivingChunksRef = useRef<{ [fileId: string]: { [index: number]: Uint8Array } }>({});
  const transferStartTimesRef = useRef<{ [fileId: string]: number }>({});
  const lastProgressUpdateTimesRef = useRef<{ [fileId: string]: number }>({});
  const fileSendersRef = useRef<{ [fileId: string]: string }>({});

  // Sync references to prevent stale react state closures in async websocket thread
  const transfersRef = useRef<TransferFile[]>(transfers);
  useEffect(() => {
    transfersRef.current = transfers;
  }, [transfers]);

  const autoDownloadRef = useRef<boolean>(autoDownload);
  useEffect(() => {
    autoDownloadRef.current = autoDownload;
  }, [autoDownload]);

  // Establish device profile on load
  useEffect(() => {
    // 1. Detect Device Type
    const ua = navigator.userAgent.toLowerCase();
    let detectedType: 'PC' | 'Phone' | 'Tablet' = 'PC';
    if (/ipad|tablet|playbook|silk/i.test(ua)) {
      detectedType = 'Tablet';
    } else if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) {
      detectedType = 'Phone';
    }
    setDeviceType(detectedType);

    // 2. Load or create session-specific Device ID to avoid cross-tab clashing during same-PC testing
    let savedId = sessionStorage.getItem('fshare_session_device_id');
    if (!savedId) {
      savedId = 'dev_' + Math.random().toString(36).substring(2, 10);
      sessionStorage.setItem('fshare_session_device_id', savedId);
    }
    setDeviceId(savedId);

    // 3. Load or create Device Name
    let savedName = localStorage.getItem('fshare_device_name');
    if (!savedName) {
      savedName = generateDeviceName(detectedType);
      localStorage.setItem('fshare_device_name', savedName);
    }
    setDeviceName(savedName);

    // 4. Retrieve or generate Room ID
    const urlParams = new URLSearchParams(window.location.search);
    let activeRoom = urlParams.get('room');
    if (!activeRoom) {
      // Create a clean room ID
      activeRoom = 'R' + Math.random().toString(36).substring(2, 8).toUpperCase();
      // Replace location query param smoothly
      const newUrl = window.location.pathname + '?room=' + activeRoom;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    }
    setRoomId(activeRoom);

    // Set QR pairing URL with automatic dev to pre replacement for frictionless mobile phone scanning
    const browserOrigin = window.location.origin;
    let fallbackOrigin = browserOrigin;
    if (fallbackOrigin.includes('ais-dev-')) {
      fallbackOrigin = fallbackOrigin.replace('ais-dev-', 'ais-pre-');
    }
    setPairingUrl(fallbackOrigin + window.location.pathname + '?room=' + activeRoom);

    // Fetch backend public appUrl config to construct the correct pairing link on load
    fetch('/api/config')
      .then(res => res.json())
      .then(config => {
        if (config && config.appUrl) {
          let publicUrl = config.appUrl.endsWith('/') ? config.appUrl.slice(0, -1) : config.appUrl;
          if (publicUrl.includes('ais-dev-')) {
            publicUrl = publicUrl.replace('ais-dev-', 'ais-pre-');
          }
          setPairingUrl(publicUrl + '?room=' + activeRoom);
        }
      })
      .catch(err => {
        console.error('Failed to fetch public appUrl, falling back to local origin:', err);
      });

    // Load logs from localStorage if present
    const savedLogs = localStorage.getItem('fshare_logs');
    if (savedLogs) {
      try {
        setLogs(JSON.parse(savedLogs));
      } catch (e) {
        console.error('Error loading logs:', e);
      }
    }
  }, []);

  // Sync Device Name changes to LocalStorage
  const handleUpdateDeviceName = (newName: string) => {
    setDeviceName(newName);
    localStorage.setItem('fshare_device_name', newName);

    // If active websocket, inform current participants
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'join',
        roomId,
        deviceId,
        deviceName: newName,
        deviceType,
      }));
    }
  };

  // Main Socket Initiator
  const connectWebSocket = () => {
    if (!roomId || !deviceId || !deviceName) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    setConnectionStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socketUrl = `${protocol}//${window.location.host}/ws`;
    
    console.log(`Establishing pairing channel on ${socketUrl}...`);
    const socket = new WebSocket(socketUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('Main network channel connected.');
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;

      // Instandy pair/join room
      socket.send(JSON.stringify({
        type: 'join',
        roomId,
        deviceId,
        deviceName,
        deviceType,
      }));
    };

    socket.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'room-status': {
            // Filter out ourselves
            const peers = (message.devices || []).filter((d: Device) => d.id !== deviceId);
            setPairedDevices(peers);
            break;
          }

          case 'file-metadata': {
            const { fileId, name, size, mimeType, totalChunks, senderId } = message;
            
            // Defend against duplicate incoming metadata events
            if (transfersRef.current.some(f => f.id === fileId)) {
              break;
            }

            if (senderId) {
              fileSendersRef.current[fileId] = senderId;
            }

            // Set start tracker
            transferStartTimesRef.current[fileId] = Date.now();
            receivingChunksRef.current[fileId] = {};
            lastProgressUpdateTimesRef.current[fileId] = Date.now();

            const newReceiveFile: TransferFile = {
              id: fileId,
              name,
              size,
              type: mimeType || 'application/octet-stream',
              progress: 0,
              status: 'transferring',
              direction: 'receive',
              speed: 0,
              timeRemaining: 0,
              chunksCompleted: 0,
              totalChunks,
            };

            setTransfers(prev => [...prev, newReceiveFile]);
            
            // Immediately send backpressure ack for next step chunk
            socket.send(JSON.stringify({
              type: 'file-chunk-ack',
              fileId,
              index: -1, // signal meta received, ready for chunk 0
              senderId: deviceId,
              targetId: senderId || '',
            }));
            break;
          }

          case 'file-chunk': {
            const { fileId, index, chunk, totalChunks, senderId } = message;
            if (senderId) {
              fileSendersRef.current[fileId] = senderId;
            }
            
            // Convert Base64 chunk to Uint8Array directly
            const binaryString = atob(chunk);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            // Save chunk in index maps
            if (!receivingChunksRef.current[fileId]) {
              receivingChunksRef.current[fileId] = {};
            }
            receivingChunksRef.current[fileId][index] = bytes;

            const chunksDone = Object.keys(receivingChunksRef.current[fileId]).length;
            const progress = Math.min(Math.round((chunksDone / totalChunks) * 100), 100);

            // Throttle state update to once every 200ms or on completion for high graphics performance
            const now = Date.now();
            const lastUpdate = lastProgressUpdateTimesRef.current[fileId] || 0;
            const sizeReceived = chunksDone * CHUNK_SIZE;
            const elapsed = (now - (transferStartTimesRef.current[fileId] || now)) / 1000;
            const speed = elapsed > 0 ? sizeReceived / elapsed : 0;
            const timeRemaining = speed > 0 ? (totalChunks - chunksDone) * CHUNK_SIZE / speed : 0;

            if (now - lastUpdate > 180 || chunksDone === totalChunks) {
              setTransfers(prev => prev.map(f => {
                if (f.id === fileId) {
                  return {
                    ...f,
                    progress,
                    chunksCompleted: chunksDone,
                    speed,
                    timeRemaining,
                  };
                }
                return f;
              }));
              lastProgressUpdateTimesRef.current[fileId] = now;
            }

            // Send backpressure acknowledgment for chunk
            const targetId = fileSendersRef.current[fileId] || senderId || '';
            socket.send(JSON.stringify({
              type: 'file-chunk-ack',
              fileId,
              index,
              senderId: deviceId,
              targetId,
            }));
            break;
          }

          case 'file-chunk-ack': {
            const { fileId, index, senderId: receiverId } = message;
            const nextIndex = index + 1;
            const fileHandle = sendingFilesRef.current[fileId];
            if (!fileHandle) return;

            const totalSize = fileHandle.size;
            const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

            if (nextIndex < totalChunks) {
              // Read and dispatch next chunk
              const startOffset = nextIndex * CHUNK_SIZE;
              const endOffset = Math.min(startOffset + CHUNK_SIZE, totalSize);
              const slice = fileHandle.slice(startOffset, endOffset);

              // Convert slice blob to base64
              const reader = new FileReader();
              reader.onloadend = () => {
                const dataUrl = reader.result as string;
                const base64Part = dataUrl.split(',')[1] || '';
                
                if (socket.readyState === WebSocket.OPEN) {
                  socket.send(JSON.stringify({
                    type: 'file-chunk',
                    fileId,
                    index: nextIndex,
                    chunk: base64Part,
                    totalChunks,
                    senderId: deviceId,
                    targetId: receiverId || '',
                  }));
                }
              };
              reader.readAsDataURL(slice);

              // Update progress stats visually
              const now = Date.now();
              const lastUpdate = lastProgressUpdateTimesRef.current[fileId] || 0;
              const chunksDone = nextIndex;
              const progress = Math.min(Math.round((chunksDone / totalChunks) * 100), 100);
              const sizeTransferred = chunksDone * CHUNK_SIZE;
              const elapsed = (now - (transferStartTimesRef.current[fileId] || now)) / 1000;
              const speed = elapsed > 0 ? sizeTransferred / elapsed : 0;
              const timeRemaining = speed > 0 ? (totalChunks - chunksDone) * CHUNK_SIZE / speed : 0;

              if (now - lastUpdate > 180 || progress === 100) {
                setTransfers(prev => prev.map(f => {
                  if (f.id === fileId) {
                    return {
                      ...f,
                      progress,
                      chunksCompleted: chunksDone,
                      speed,
                      timeRemaining,
                      status: 'transferring',
                    };
                  }
                  return f;
                }));
                lastProgressUpdateTimesRef.current[fileId] = now;
              }
            } else {
              // Ensure we don't complete the same file multiple times
              const checkTransfer = transfersRef.current.find(f => f.id === fileId);
              if (checkTransfer && checkTransfer.status === 'completed') {
                break;
              }

              // Complete Sending Process
              socket.send(JSON.stringify({
                type: 'transfer-complete',
                fileId,
                senderId: deviceId,
                targetId: receiverId || '',
              }));

              setTransfers(prev => prev.map(f => {
                if (f.id === fileId) {
                  return {
                    ...f,
                    progress: 100,
                    status: 'completed',
                    chunksCompleted: totalChunks,
                    speed: 0,
                    timeRemaining: 0,
                  };
                }
                return f;
              }));

              // Log standard receipt
              const completeLog: TransferLog = {
                id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
                fileName: fileHandle.name,
                size: fileHandle.size,
                status: 'completed',
                timestamp: Date.now(),
                direction: 'send',
              };

              setLogs(prev => {
                const updated = [completeLog, ...prev];
                localStorage.setItem('fshare_logs', JSON.stringify(updated));
                return updated;
              });

              // Clean active memory cache
              delete sendingFilesRef.current[fileId];

              // Pick next waiting file in our stream!
              processNextWaitingFile();
            }
            break;
          }

          case 'transfer-complete': {
            const { fileId } = message;
            
            // Guard: check if already completed
            const checkItem = transfersRef.current.find(f => f.id === fileId);
            if (checkItem && checkItem.status === 'completed') {
              break;
            }
            
            // Gather all completed cached chunks
            const chunkMap = receivingChunksRef.current[fileId] || {};
            const sortedIndices = Object.keys(chunkMap)
              .map(Number)
              .sort((a, b) => a - b);

            const chunkArrays: Uint8Array[] = sortedIndices.map(idx => chunkMap[idx]);
            const finalBlob = new Blob(chunkArrays);
            const objectUrl = URL.createObjectURL(finalBlob);

            // Access synchronous stable progress lists rather than state closures
            const currentItem = transfersRef.current.find(f => f.id === fileId);
            const fileName = currentItem ? currentItem.name : 'download';
            const fileSize = currentItem ? currentItem.size : finalBlob.size;

            setTransfers(prev => {
              // De-duplicate completed state records to keep updates perfectly stable
              const match = prev.find(f => f.id === fileId);
              if (match && match.status === 'completed') {
                return prev;
              }
              return prev.map(f => {
                if (f.id === fileId) {
                  return {
                    ...f,
                    progress: 100,
                    status: 'completed' as const,
                    url: objectUrl,
                    blob: finalBlob,
                  };
                }
                return f;
              });
            });

            // Pure side-effect triggered safely EXACTLY ONCE outside of React render flow
            if (autoDownloadRef.current) {
              const downloadLink = document.createElement('a');
              downloadLink.href = objectUrl;
              downloadLink.download = fileName;
              document.body.appendChild(downloadLink);
              downloadLink.click();
              document.body.removeChild(downloadLink);
            }

            // Record Log
            const completeLog: TransferLog = {
              id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
              fileName,
              size: fileSize,
              status: 'completed',
              timestamp: Date.now(),
              direction: 'receive',
            };

            setLogs(prev => {
              const updated = [completeLog, ...prev];
              localStorage.setItem('fshare_logs', JSON.stringify(updated));
              return updated;
            });

            // Cleanup memory caching refs
            delete receivingChunksRef.current[fileId];
            break;
          }

          case 'transfer-cancel': {
            const { fileId } = message;
            handleCancelNotification(fileId);
            break;
          }

          default:
            break;
        }
      } catch (e) {
        console.error('Socket message parse error:', e);
      }
    };

    socket.onclose = (event) => {
      console.log('Socket disconnected:', event.reason);
      setConnectionStatus('disconnected');
      setPairedDevices([]);

      // Attempt automatic reconnection with linear backing
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        console.log(`Scheduling reconnect attempt #${reconnectAttemptsRef.current} in 2s...`);
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 2200);
      }
    };

    socket.onerror = (err) => {
      console.error('Socket error event:', err);
      setConnectionStatus('disconnected');
    };
  };

  // Re-run connection when profile elements trigger
  useEffect(() => {
    if (roomId && deviceId && deviceName) {
      connectWebSocket();
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomId, deviceId, deviceName]);

  // Execute processing of next available file queue
  const processNextWaitingFile = () => {
    // Check if there is already an active transfer
    const isAnyActive = transfersRef.current.some(f => f.status === 'transferring');
    if (isAnyActive) return;

    // Find first waiting file
    const waitingFile = transfersRef.current.find(f => f.status === 'waiting' && f.direction === 'send');
    if (!waitingFile) return;

    const fileHandle = sendingFilesRef.current[waitingFile.id];
    if (!fileHandle) return;

    // Update state to transferring
    setTransfers(prev => prev.map(f => f.id === waitingFile.id ? { ...f, status: 'transferring' as const } : f));

    // Side-effects strictly outside of React's render/state updates
    transferStartTimesRef.current[waitingFile.id] = Date.now();
    lastProgressUpdateTimesRef.current[waitingFile.id] = Date.now();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'file-metadata',
        fileId: waitingFile.id,
        name: fileHandle.name,
        size: fileHandle.size,
        mimeType: fileHandle.type,
        totalChunks: Math.ceil(fileHandle.size / CHUNK_SIZE),
        senderId: deviceId,
      }));
    }
  };

  // Run automatically when transfer queue updates
  useEffect(() => {
    const isAnyActive = transfers.some(f => f.status === 'transferring');
    if (!isAnyActive) {
      processNextWaitingFile();
    }
  }, [transfers]);

  // Files/Directories Selected Handler
  const handleFilesSelected = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const newTransfers: TransferFile[] = list.map(f => {
      const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      
      // Save full JS File Handle in ref database
      sendingFilesRef.current[fileId] = f;

      return {
        id: fileId,
        name: f.name,
        size: f.size,
        type: f.type || 'application/octet-stream',
        progress: 0,
        status: 'waiting' as const,
        direction: 'send' as const,
        speed: 0,
        timeRemaining: 0,
        chunksCompleted: 0,
        totalChunks: Math.ceil(f.size / CHUNK_SIZE),
      };
    });

    setTransfers(prev => [...prev, ...newTransfers]);
  };

  // Interruption logic
  const handleCancelTransfer = (fileId: string) => {
    // Notify peer
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'transfer-cancel',
        fileId,
      }));
    }

    setTransfers(prev => prev.map(f => {
      if (f.id === fileId) {
        return {
          ...f,
          status: 'cancelled' as const,
          speed: 0,
          timeRemaining: 0,
        };
      }
      return f;
    }));

    // Record fail log
    const cancelledFile = transfers.find(f => f.id === fileId);
    if (cancelledFile) {
      const failLog: TransferLog = {
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        fileName: cancelledFile.name,
        size: cancelledFile.size,
        status: 'failed',
        timestamp: Date.now(),
        direction: cancelledFile.direction,
      };
      setLogs(prev => {
        const u = [failLog, ...prev];
        localStorage.setItem('fshare_logs', JSON.stringify(u));
        return u;
      });
    }

    // Stop and clean caches
    delete sendingFilesRef.current[fileId];
    delete receivingChunksRef.current[fileId];
  };

  const handleCancelNotification = (fileId: string) => {
    setTransfers(prev => prev.map(f => {
      if (f.id === fileId) {
        return {
          ...f,
          status: 'cancelled' as const,
          speed: 0,
          timeRemaining: 0,
        };
      }
      return f;
    }));

    delete sendingFilesRef.current[fileId];
    delete receivingChunksRef.current[fileId];
  };

  const handleClearFinished = () => {
    setTransfers(prev => prev.filter(f => f.status === 'transferring' || f.status === 'waiting'));
  };

  const handleClearHistory = () => {
    setLogs([]);
    localStorage.removeItem('fshare_logs');
  };

  // Check if active transfers are running
  const isTransferringInQueue = transfers.some(f => f.status === 'transferring');

  return (
    <div id="full-applet-viewport" className="min-h-screen bg-slate-50/50 flex flex-col justify-between p-4 sm:p-6 md:p-8">
      
      {/* Decorative Blur Orbs */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-100 rounded-full blur-3xl opacity-30 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-sky-200 rounded-full blur-3xl opacity-20 pointer-events-none" />

      {/* Main App Bar / Navigation Header */}
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between mb-8 z-10 relative">
        <div className="flex items-center gap-2">
          {/* Main Logo Container */}
          <div className="bg-gradient-to-tr from-indigo-600 to-sky-500 rounded-xl p-2.5 shadow-md shadow-indigo-100 flex items-center justify-center text-white">
            <Zap className="w-5 h-5 fill-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight leading-none">
              Cross-Device Stream
            </h1>
            <span className="text-[10px] font-mono bg-sky-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase mt-1 inline-block border border-sky-100">
              No-Limit Sync Engine
            </span>
          </div>
        </div>
        
        {/* Status indicator pill */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-white/80 p-2 rounded-xl border border-slate-100 shadow-sm leading-none font-semibold">
          <Activity className={`w-3.5 h-3.5 ${connectionStatus === 'connected' ? 'text-emerald-500 animate-pulse' : 'text-slate-300'}`} />
          <span className="capitalize">{connectionStatus}</span>
        </div>
      </header>

      {/* Main Structural Body Workspace Grid */}
      <main className="max-w-6xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start z-10 relative flex-1">
        
        {/* Left Hand: Controller Panel - Pairing QR, Link setup, Pair discovery */}
        <div className="lg:col-span-5 flex flex-col gap-6 w-full">
          {/* Pair Code Generator Panels */}
          <QRPanel 
            pairingUrl={pairingUrl} 
            roomId={roomId} 
            deviceCount={pairedDevices.length} 
          />

          {/* Device status discovery tracker */}
          <DeviceStatus
            localDevice={{ id: deviceId, name: deviceName, type: deviceType }}
            onUpdateName={handleUpdateDeviceName}
            pairedDevices={pairedDevices}
            connectionStatus={connectionStatus}
            isTransferring={isTransferringInQueue}
            onReconnect={connectWebSocket}
          />
        </div>

        {/* Right Hand: Action Panel - File selecting, Queue updates, Download center */}
        <div className="lg:col-span-7 flex flex-col gap-6 w-full">
          {/* Standard Select Pane (Requires paired peer to select, to avoid headless data loss) */}
          <FileSelector 
            onFilesSelected={handleFilesSelected}
            disabled={pairedDevices.length === 0} 
          />

          {/* Transfers in dynamic progress queue */}
          <TransferQueue
            files={transfers}
            onCancel={handleCancelTransfer}
            onClear={handleClearFinished}
            autoDownload={autoDownload}
            onToggleAutoDownload={() => setAutoDownload(!autoDownload)}
          />

          {/* Finished historic activities logs  */}
          <TransferHistory
            logs={logs}
            onClearLogs={handleClearHistory}
          />
        </div>
      </main>

      {/* Humble Footer containing details and credits */}
      <footer className="max-w-6xl w-full mx-auto border-t border-slate-100 pt-6 mt-12 z-10 relative flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
        <div className="flex items-center gap-3 font-semibold text-slate-500">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>End-to-End Piped Streaming</span>
          </div>
          <span>•</span>
          <span>Zero Server Storage</span>
          <span>•</span>
          <span>Dual Network Compatibility</span>
        </div>
        <div>
          <span>Cross-Device File Share &copy; {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
