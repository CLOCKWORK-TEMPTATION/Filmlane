'use client';

import * as React from 'react';
import { Download, History, Info, Redo2, Save, Undo2 } from 'lucide-react';

type EditorHeaderProps = {
  onSave?: () => void;
  onDownload?: () => void;
  onHistory?: () => void;
  onInfo?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
};

export function EditorHeader({ onSave, onDownload, onHistory, onInfo }: EditorHeaderProps) {
  const iconClass = 'w-5 h-5 transition-colors duration-200';

  return (
    <header className="border-b border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-900/70 text-white sticky top-0 z-30 backdrop-blur-xl shadow-2xl shadow-black/20 flex items-center justify-center px-4 py-4">
      <div className="flex items-center justify-center gap-4 select-none">
        {/* Info Button - Sky Blue */}
        <button
          onClick={onInfo}
          className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
        >
          <div className="absolute inset-0 bg-sky-500/0 group-hover:bg-sky-500/10 rounded-xl transition-all duration-300"></div>
          <Info className={`${iconClass} text-sky-400 group-hover:text-sky-300 relative`} />
        </button>

        {/* Undo/Redo Group */}
        <div className="flex items-center gap-1">
          <button className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed">
            <div className="absolute inset-0 bg-slate-500/0 group-hover:bg-slate-500/10 rounded-xl transition-all duration-300"></div>
            <Undo2 className={`${iconClass} text-slate-400 group-hover:text-slate-300 relative`} />
          </button>
          <button className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed">
            <div className="absolute inset-0 bg-slate-500/0 group-hover:bg-slate-500/10 rounded-xl transition-all duration-300"></div>
            <Redo2 className={`${iconClass} text-slate-400 group-hover:text-slate-300 relative`} />
          </button>
        </div>

        {/* Action Buttons Group */}
        <div className="flex items-center gap-1">
          {/* Save - Violet */}
          <button
            onClick={onSave}
            className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-violet-500/0 group-hover:bg-violet-500/10 rounded-xl transition-all duration-300"></div>
            <Save className={`${iconClass} text-violet-400 group-hover:text-violet-300 relative`} />
          </button>

          {/* Download - Pink */}
          <button
            onClick={onDownload}
            className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-pink-500/0 group-hover:bg-pink-500/10 rounded-xl transition-all duration-300"></div>
            <Download className={`${iconClass} text-pink-400 group-hover:text-pink-300 relative`} />
          </button>

          {/* History - Amber */}
          <button
            onClick={onHistory}
            className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/10 rounded-xl transition-all duration-300"></div>
            <History
              className={`${iconClass} text-amber-400 group-hover:text-amber-300 relative`}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
