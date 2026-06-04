import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, Copy, Check, Info, Link } from 'lucide-react';

interface QRPanelProps {
  pairingUrl: string;
  roomId: string;
  deviceCount: number;
}

export default function QRPanel({ pairingUrl, roomId, deviceCount }: QRPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [showTrouble, setShowTrouble] = useState(false);

  useEffect(() => {
    if (canvasRef.current && pairingUrl) {
      QRCode.toCanvas(
        canvasRef.current,
        pairingUrl,
        {
          width: 200,
          margin: 1.5,
          color: {
            dark: '#1e293b', // slate-800
            light: '#ffffff', // white
          },
        },
        (error) => {
          if (error) {
            console.error('Error generating QR code:', error);
            setQrError('Failed to generate QR Code. Please use the link below.');
          } else {
            setQrError(null);
          }
        }
      );
    }
  }, [pairingUrl]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(pairingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <div 
      id="qr-pairing-panel"
      className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col items-center justify-center text-center max-w-sm w-full mx-auto"
    >
      <div className="flex items-center gap-2 mb-4 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">
        <QrCode className="w-3.5 h-3.5 animate-pulse" />
        <span>Scan to Connect</span>
      </div>

      <h3 className="text-lg font-bold text-slate-800 mb-1">
        Pair Another Device
      </h3>
      <p className="text-xs text-slate-500 mb-5 leading-relaxed max-w-[280px]">
        Scan this QR code with any mobile phone, or open the link on another PC to share files instantly.
      </p>

      {/* QR Display */}
      <div className="relative bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-inner flex items-center justify-center h-[232px] w-[232px] mb-5">
        {qrError ? (
          <div className="text-red-500 text-xs text-center p-3">
            {qrError}
          </div>
        ) : (
          <canvas ref={canvasRef} className="rounded-lg shadow-sm" id="qr-code-canvas" />
        )}
        
        {deviceCount > 0 && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 rounded-xl animate-fade-in">
            <span className="flex h-3 w-3 relative mb-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <p className="text-sm font-semibold text-slate-800">Connected & Paired</p>
            <p className="text-xs text-slate-500 mt-1">Ready to share files!</p>
          </div>
        )}
      </div>

      {/* Pairing Info Display */}
      <div className="w-full flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-slate-500 px-1">
          <span>Room Code:</span>
          <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-700">{roomId}</span>
        </div>

        <button
          id="btn-copy-pairing-link"
          onClick={copyToClipboard}
          className="w-full flex items-center justify-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 transition-all py-2.5 rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500">Link Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-slate-500" />
              <span>Copy Shareable Link</span>
            </>
          )}
        </button>

        <div className="flex items-start gap-1.5 mt-2 bg-slate-50 rounded-lg p-2.5 text-[10px] text-left text-slate-500 leading-relaxed border border-slate-100">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span>Both devices will discover each other over any active internet connection. No local network or same Wi-Fi pairing needed.</span>
        </div>

        {/* Dynamic troubleshooting section */}
        <div className="w-full mt-3 border-t border-dashed border-slate-100 pt-3">
          <button
            id="btn-troubleshoot-toggle"
            type="button"
            onClick={() => setShowTrouble(!showTrouble)}
            className="flex items-center justify-center gap-1 mx-auto text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors focus:outline-none cursor-pointer"
          >
            <Info className="w-3 h-3 text-indigo-500" />
            <span>Having connection problems on your mobile phone?</span>
          </button>
          
          {showTrouble && (
            <div id="troubleshoot-instructions-box" className="mt-2 text-left bg-indigo-50/55 p-3 rounded-xl border border-indigo-100/50 text-[10.5px] leading-relaxed text-slate-600 space-y-1.5 animate-fade-in">
              <p className="font-bold text-indigo-900 leading-tight">Why do you see "Page Not Found" or "Cookie check" on phone?</p>
              <p className="text-slate-500 text-[10px] pb-1 leading-normal">
                Google AI Studio secures private development previews. If your mobile browser isn't logged into your Google Account, Google's proxy prevents loading the page.
              </p>
              <p className="font-bold text-slate-800">Choose one easy fix:</p>
              <ul className="list-decimal pl-3 space-y-1 text-slate-600 text-[10px]">
                <li>
                  <strong className="text-indigo-950 font-bold">Sign into Google on Phone:</strong> Open <span className="underline">google.com</span> on your phone browser, log into the same Gmail/Google account you use for Google AI Studio, and then refresh!
                </li>
                <li>
                  <strong className="text-indigo-955 font-bold">Use the "Share" Workflow:</strong> Click the <strong className="text-indigo-900">"Share"</strong> button in the top-right of your AI Studio browser window to generate a fully public shareable link. Use that link to connect instantly!
                </li>
                <li>
                  <strong className="text-indigo-950 font-bold">Deploy:</strong> Deploy your application to Cloud Run from the settings menu. You will get a 100% public, permanent URL that anyone can scan without login checks!
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
