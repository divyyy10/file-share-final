import React, { useRef, useState } from 'react';
import { Upload, Folder, File, ChevronRight, FileUp, AlertCircle } from 'lucide-react';

interface FileSelectorProps {
  onFilesSelected: (files: FileList | File[]) => void;
  disabled: boolean;
}

export default function FileSelector({ onFilesSelected, disabled }: FileSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(e.target.files);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // In the browser, folder structure files can be read as standard files with paths
      onFilesSelected(e.target.files);
    }
  };

  const triggerFileSelect = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const triggerFolderSelect = () => {
    if (!disabled && folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Hidden inputs */}
      <input
        ref={fileInputRef}
        id="file-input"
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled}
      />
      <input
        ref={folderInputRef}
        id="folder-input"
        type="file"
        multiple
        // @ts-ignore
        webkitdirectory="true"
        directory="true"
        className="hidden"
        onChange={handleFolderChange}
        disabled={disabled}
      />

      {/* Main Drag-Drop Stage */}
      <div
        id="drag-drop-zone"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={triggerFileSelect}
        className={`relative w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-8 text-center transition-all duration-300 cursor-pointer overflow-hidden ${
          disabled
            ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-60'
            : isDragActive
            ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01] shadow-md border-solid'
            : 'border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/50 shadow-sm'
        }`}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-3xl opacity-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-sky-100 rounded-full blur-3xl opacity-20 pointer-events-none" />

        <div className={`p-4 rounded-full bg-slate-50 border border-slate-100 mb-4 transition-transform duration-300 ${
          isDragActive ? 'scale-110 bg-indigo-100 text-indigo-600' : 'text-slate-500'
        }`}>
          <Upload className={`w-8 h-8 ${isDragActive ? 'animate-bounce' : ''}`} />
        </div>

        <h4 className="text-base font-bold text-slate-800 mb-1">
          {disabled ? 'Pair a device to start sharing' : 'Drag & drop files here'}
        </h4>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-4">
          {disabled 
            ? 'Connect your phone or another computer first using the QR Code or Link.' 
            : 'Select any format (videos, songs, images, documents) with unlimited file size!'}
        </p>

        {!disabled && (
          <div className="flex flex-wrap items-center justify-center gap-3" onClick={(e) => e.stopPropagation()}>
            <button
              id="btn-select-files"
              type="button"
              onClick={triggerFileSelect}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all py-2 px-4 rounded-xl text-xs shadow-sm shadow-indigo-200 cursor-pointer"
            >
              <File className="w-3.5 h-3.5" />
              <span>Select Files</span>
            </button>
            <button
              id="btn-select-folder"
              type="button"
              onClick={triggerFolderSelect}
              className="flex items-center gap-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 font-semibold transition-all py-2 px-4 rounded-xl text-xs cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Select Folder</span>
            </button>
          </div>
        )}
      </div>

      {disabled && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 animate-pulse">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Awaiting device connection:</span>
            <p className="mt-0.5 text-amber-600 leading-relaxed">
              Once you scan the QR code and connect, this transfer pane will instantly become active. Try opening the QR link on another browser tab if testing locally!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
