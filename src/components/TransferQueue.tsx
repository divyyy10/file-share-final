import React from 'react';
import { 
  File, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Archive, 
  ArrowUpRight, 
  ArrowDownLeft, 
  X, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  TrendingUp 
} from 'lucide-react';
import { TransferFile } from '../types';

interface TransferQueueProps {
  files: TransferFile[];
  onCancel: (fileId: string) => void;
  onClear: () => void;
  autoDownload: boolean;
  onToggleAutoDownload: () => void;
}

export function formatBytes(bytes: number, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSec: number) {
  if (!bytesPerSec || bytesPerSec === 0) return '0 B/s';
  const k = 1024;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));
  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function TransferQueue({
  files,
  onCancel,
  onClear,
  autoDownload,
  onToggleAutoDownload,
}: TransferQueueProps) {
  
  const getFileIcon = (fileName: string, mimeType: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const name = fileName.toLowerCase();
    
    if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext) || mimeType.startsWith('video/')) {
      return <Video className="w-5 h-5 text-indigo-500" />;
    }
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext) || mimeType.startsWith('audio/')) {
      return <Music className="w-5 h-5 text-emerald-500" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic'].includes(ext) || mimeType.startsWith('image/')) {
      return <ImageIcon className="w-5 h-5 text-sky-500" />;
    }
    if (['pdf'].includes(ext)) {
      return <FileText className="w-5 h-5 text-rose-500" />;
    }
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'md'].includes(ext)) {
      return <FileText className="w-5 h-5 text-amber-500" />;
    }
    if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
      return <Archive className="w-5 h-5 text-purple-500" />;
    }
    return <File className="w-5 h-5 text-slate-500" />;
  };

  const getStatusMessage = (file: TransferFile) => {
    switch (file.status) {
      case 'waiting':
        return 'Waiting...';
      case 'transferring':
        return file.direction === 'send' ? 'Sending...' : 'Receiving...';
      case 'completed':
        return 'Transferred';
      case 'failed':
        return 'Failed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return '';
    }
  };

  if (files.length === 0) {
    return null;
  }

  // Calculate overall progress stats
  const activeFiles = files.filter(f => f.status === 'transferring' || f.status === 'waiting');
  const completedFiles = files.filter(f => f.status === 'completed');

  return (
    <div 
      id="transfer-queue-panel"
      className="bg-white/90 backdrop-blur-md rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col w-full animate-fade-in"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-4 gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">
            Active Transfers ({files.length})
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeFiles.length > 0 
              ? `Processing ${activeFiles.length} file(s) in queue` 
              : `All completed (${completedFiles.length} successful)`}
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Auto Download Toggle for received files */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600">
            <input
              type="checkbox"
              checked={autoDownload}
              onChange={onToggleAutoDownload}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            <span>Auto Download Recieved</span>
          </label>

          <button
            id="btn-clear-queue"
            onClick={onClear}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Clear Finished
          </button>
        </div>
      </div>

      {/* Queue List */}
      <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
        {files.map((file) => {
          const isTransferring = file.status === 'transferring';
          const isCompleted = file.status === 'completed';
          const isFailed = file.status === 'failed' || file.status === 'cancelled';

          return (
            <div
              key={file.id}
              id={`transfer-item-${file.id}`}
              className={`rounded-xl border p-3 flex flex-col gap-2 transition-all ${
                isTransferring
                  ? 'border-indigo-100 bg-indigo-50/20'
                  : isCompleted
                  ? 'border-emerald-100 bg-emerald-50/5'
                  : isFailed
                  ? 'border-slate-100 bg-slate-50/40 opacity-70'
                  : 'border-slate-100 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {/* Direction Badge */}
                  <div className={`p-1 rounded-md shrink-0 flex items-center justify-center ${
                    file.direction === 'send' 
                      ? 'bg-blue-50 text-blue-600 border border-blue-100' 
                      : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  }`}>
                    {file.direction === 'send' ? (
                      <ArrowUpRight className="w-3.5 h-3.5" title="Outgoing File" />
                    ) : (
                      <ArrowDownLeft className="w-3.5 h-3.5" title="Incoming File" />
                    )}
                  </div>

                  {/* File Icon */}
                  <div className="p-1.5 bg-slate-100 rounded-lg">
                    {getFileIcon(file.name, file.type)}
                  </div>

                  {/* File Meta */}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 truncate" title={file.name}>
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                      <span>{formatBytes(file.size)}</span>
                      <span>•</span>
                      <span className="font-medium capitalize">{getStatusMessage(file)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions Panel */}
                <div className="flex items-center gap-2 shrink-0">
                  {isTransferring && (
                    <button
                      id={`btn-cancel-transfer-${file.id}`}
                      onClick={() => onCancel(file.id)}
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer bg-slate-100 border border-slate-200"
                      title="Cancel Transfer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {isCompleted && file.direction === 'receive' && file.url && (
                    <a
                      href={file.url}
                      download={file.name}
                      id={`btn-download-${file.id}`}
                      className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-all py-1.5 px-3 rounded-lg text-xs cursor-pointer shadow-sm shadow-emerald-200"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  )}

                  {isCompleted && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  )}

                  {isFailed && (
                    <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </div>
              </div>

              {/* Progress and speed metrics */}
              {(isTransferring || file.status === 'waiting') && (
                <div className="flex flex-col gap-1.5 mt-1">
                  {/* Progress Bar */}
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                  
                  {/* Realtime Numbers */}
                  {isTransferring && (
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3 text-indigo-500" />
                        <span>{formatSpeed(file.speed)}</span>
                      </div>
                      
                      <span>{file.progress}%</span>

                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>
                          {file.timeRemaining > 0 
                            ? `${Math.round(file.timeRemaining)}s left` 
                            : 'Finishing...'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
