import React from 'react';
import { History, Share2, ThumbsUp, Trash2, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { TransferLog } from '../types';
import { formatBytes } from './TransferQueue';

interface TransferHistoryProps {
  logs: TransferLog[];
  onClearLogs: () => void;
}

export default function TransferHistory({ logs, onClearLogs }: TransferHistoryProps) {
  // Compute analytics
  const totalSentBytes = logs
    .filter((log) => log.direction === 'send' && log.status === 'completed')
    .reduce((acc, curr) => acc + curr.size, 0);

  const totalReceivedBytes = logs
    .filter((log) => log.direction === 'receive' && log.status === 'completed')
    .reduce((acc, curr) => acc + curr.size, 0);

  const completedCount = logs.filter((log) => log.status === 'completed').length;

  return (
    <div 
      id="transfer-history-panel"
      className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col w-full"
    >
      {/* Metrics Banner */}
      <div className="grid grid-cols-3 gap-2 text-center pb-5 border-b border-slate-100 mb-5">
        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Sent</span>
          <span className="text-sm font-extrabold text-slate-700 mt-0.5 block">{formatBytes(totalSentBytes)}</span>
        </div>
        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Received</span>
          <span className="text-sm font-extrabold text-slate-700 mt-0.5 block">{formatBytes(totalReceivedBytes)}</span>
        </div>
        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">Transfers</span>
          <span className="text-sm font-extrabold text-slate-700 mt-0.5 block">{completedCount}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <span>Transfer History Log</span>
        </h3>

        {logs.length > 0 && (
          <button
            id="btn-clear-history"
            onClick={onClearLogs}
            className="text-xs font-semibold text-rose-500 hover:text-rose-700 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Logs</span>
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 opacity-60">
          <Share2 className="w-7 h-7 text-slate-300 stroke-dasharray mb-2" />
          <p className="text-xs font-semibold">No recent transfers</p>
          <p className="text-[10px] text-slate-300 mt-0.5">Your files will be cataloged here after pairing.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
          {logs.map((log) => (
            <div
              key={log.id}
              id={`log-item-${log.id}`}
              className="flex items-center justify-between text-xs py-2 px-3 hover:bg-slate-50 rounded-lg border border-slate-100 bg-white transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={`p-1 rounded shrink-0 ${
                  log.direction === 'send' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {log.direction === 'send' ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                  )}
                </span>
                <div className="truncate">
                  <p className="font-bold text-slate-700 truncate" title={log.fileName}>
                    {log.fileName}
                  </p>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-bold text-slate-600">{formatBytes(log.size)}</span>
                <span className={`block text-[9px] font-bold mt-0.5 ${
                  log.status === 'completed' ? 'text-emerald-500' : 'text-rose-500'
                }`}>
                  {log.status === 'completed' ? 'Success' : 'Failed'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
