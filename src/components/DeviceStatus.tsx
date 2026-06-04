import React, { useState } from 'react';
import { Laptop, Smartphone, Tablet, Edit, Check, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Device, ConnectionStatus } from '../types';

interface DeviceStatusProps {
  localDevice: { id: string; name: string; type: 'PC' | 'Phone' | 'Tablet' };
  onUpdateName: (newName: string) => void;
  pairedDevices: Device[];
  connectionStatus: ConnectionStatus;
  isTransferring: boolean;
  onReconnect: () => void;
}

export default function DeviceStatus({
  localDevice,
  onUpdateName,
  pairedDevices,
  connectionStatus,
  isTransferring,
  onReconnect,
}: DeviceStatusProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(localDevice.name);

  const getDeviceIcon = (type: 'PC' | 'Phone' | 'Tablet', className = "w-5 h-5") => {
    switch (type) {
      case 'PC':
        return <Laptop className={className} />;
      case 'Phone':
        return <Smartphone className={className} />;
      case 'Tablet':
        return <Tablet className={className} />;
      default:
        return <Laptop className={className} />;
    }
  };

  const handleSaveName = () => {
    if (editedName.trim()) {
      onUpdateName(editedName.trim());
      setIsEditing(false);
    }
  };

  const activePeer = pairedDevices[0]; // Currently supporting primary peer

  return (
    <div 
      id="device-status-container"
      className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col w-full"
    >
      {/* Header and Connection Status Indicator */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          Network Discovery
        </h3>
        
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 shadow-sm">
              <Wifi className="w-3.5 h-3.5 text-emerald-500" />
              <span>Discovery Active</span>
            </span>
          ) : connectionStatus === 'connecting' ? (
            <span className="flex items-center gap-1 text-[11px] font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-500" />
              <span>Connecting Router...</span>
            </span>
          ) : (
            <button
              id="btn-reconnect-ws"
              onClick={onReconnect}
              className="flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100 hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <WifiOff className="w-3.5 h-3.5 text-rose-500" />
              <span>Offline - Retry?</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-6 md:gap-4 relative py-2">
        {/* Local Device Display */}
        <div className="flex flex-col items-center text-center p-3 rounded-xl hover:bg-slate-50/50 transition-colors">
          <div className="relative mb-3">
            <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">
              {getDeviceIcon(localDevice.type, "w-8 h-8")}
            </div>
            <span className="absolute -bottom-1.5 -right-1.5 bg-indigo-600 text-[10px] font-extrabold text-white px-2 py-0.5 rounded-full uppercase shadow">
              You
            </span>
          </div>

          {isEditing ? (
            <div className="flex items-center gap-1 border-b border-indigo-500 mt-1 max-w-[160px]">
              <input
                id="input-device-rename"
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                maxLength={20}
                className="text-xs font-bold text-slate-800 outline-none text-center bg-transparent py-0.5 w-28"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              />
              <button
                id="btn-save-device-name"
                onClick={handleSaveName}
                className="p-1 text-emerald-600 hover:text-emerald-700 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1 group justify-center mt-1">
              <span className="text-xs font-bold text-slate-700">{localDevice.name}</span>
              <button
                id="btn-edit-device-name"
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition-opacity p-0.5 cursor-pointer"
                title="Rename device"
              >
                <Edit className="w-3 h-3" />
              </button>
            </div>
          )}
          <span className="text-[10px] text-slate-400 mt-1 uppercase font-semibold font-mono tracking-wider">
            {localDevice.type} Device
          </span>
        </div>

        {/* GLOWING SYNC LINE & CONNECTIVITY MIDDLE SECTION */}
        <div className="flex flex-col items-center justify-center relative min-h-[64px]">
          {/* Label */}
          <span className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wide">
            {activePeer ? "Link Stream" : "Awaiting Pairing"}
          </span>

          {/* Dotted Link Cable */}
          <div className="w-full max-w-[140px] h-1 bg-slate-100 rounded relative overflow-hidden flex items-center justify-center">
            {activePeer ? (
              <div 
                className={`h-full bg-gradient-to-r from-indigo-500 via-sky-500 to-indigo-500 rounded transition-all duration-500 ${
                  isTransferring ? 'w-full animate-pulse' : 'w-full'
                }`}
              >
                {/* Flow particles */}
                <div className="absolute top-0 bottom-0 left-0 right-0 overflow-hidden">
                  <div className={`h-full bg-white/40 w-8 blur-sm absolute transform -skew-x-12 ${
                    isTransferring ? 'animate-[shimmer_1s_infinite_linear]' : 'animate-[shimmer_3s_infinite_linear]'
                  }`} />
                </div>
              </div>
            ) : (
              <div className="w-full border-t-2 border-dotted border-slate-300" />
            )}
          </div>

          {activePeer && (
            <span className={`text-[9px] font-bold mt-2 px-2 py-0.5 rounded-full ${
              isTransferring 
                ? "bg-indigo-100 text-indigo-700 animate-pulse" 
                : "bg-slate-100 text-slate-600"
            }`}>
              {isTransferring ? "Streaming Chunks" : "Channel Idle"}
            </span>
          )}
        </div>

        {/* Remote Device Display */}
        <div className="flex flex-col items-center text-center p-3 rounded-xl hover:bg-slate-50/50 transition-colors">
          {activePeer ? (
            <>
              <div className="relative mb-3">
                <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm animate-bounce">
                  {getDeviceIcon(activePeer.type as 'PC' | 'Phone' | 'Tablet', "w-8 h-8")}
                </div>
                <span className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-[10px] font-extrabold text-white px-2 py-0.5 rounded-full uppercase shadow animate-pulse">
                  Peer
                </span>
              </div>

              <div className="flex items-center gap-1 justify-center mt-1">
                <span className="text-xs font-bold text-slate-700">{activePeer.name}</span>
              </div>
              
              <span className="text-[10px] text-slate-400 mt-1 uppercase font-semibold font-mono tracking-wider">
                {activePeer.type} Device
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center opacity-40">
              <div className="mb-3 p-4 rounded-2xl bg-slate-100 text-slate-400 border border-slate-200 border-dashed">
                <Smartphone className="w-8 h-8 stroke-dasharray" />
              </div>
              <span className="text-xs font-semibold text-slate-400">Waiting for peer...</span>
              <span className="text-[9px] text-slate-300 mt-1 uppercase font-bold tracking-wide">
                Scan QR to establish link
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
