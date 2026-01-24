'use client';

import React from 'react';
import {
  MessageSquare,
  Lightbulb,
  Stethoscope,
  Film,
  Camera,
  Play,
  Pause,
  Scissors,
} from 'lucide-react';

type EditorSidebarProps = {
  onMessages?: () => void;
  onIdeas?: () => void;
  onCheck?: () => void;
  isProcessing?: boolean;
};

export function EditorSidebar({ onMessages, onIdeas, onCheck, isProcessing }: EditorSidebarProps) {
  return (
    <div className="no-print sidebar w-64 border-l border-white/10 bg-gradient-to-b from-slate-900/80 to-slate-900/60 backdrop-blur-xl">
      <div className="p-4">
        <div className="grid grid-cols-4 gap-2">
          {/* ... existing buttons ... */}
          <button
            onClick={onMessages}
            disabled={isProcessing}
            className={`group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="رسائل"
          >
            <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 rounded-xl transition-all duration-300"></div>
            <MessageSquare className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 relative" />
          </button>
          <button
            onClick={onIdeas}
            disabled={isProcessing}
            className={`group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="أفكار"
          >
            <div className="absolute inset-0 bg-yellow-500/0 group-hover:bg-yellow-500/10 rounded-xl transition-all duration-300"></div>
            <Lightbulb className="w-5 h-5 text-yellow-400 group-hover:text-yellow-300 relative" />
          </button>
          <button
            onClick={onCheck}
            disabled={isProcessing}
            className={`group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="فحص"
          >
            <div className="absolute inset-0 bg-rose-500/0 group-hover:bg-rose-500/10 rounded-xl transition-all duration-300"></div>
            <Stethoscope className="w-5 h-5 text-rose-400 group-hover:text-rose-300 relative" />
          </button>

          <button
            className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
            title="فيلم"
          >
            <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/10 rounded-xl transition-all duration-300"></div>
            <Film className="w-5 h-5 text-blue-400 group-hover:text-blue-300 relative" />
          </button>
          <button
            className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
            title="كاميرا"
          >
            <div className="absolute inset-0 bg-violet-500/0 group-hover:bg-violet-500/10 rounded-xl transition-all duration-300"></div>
            <Camera className="w-5 h-5 text-violet-400 group-hover:text-violet-300 relative" />
          </button>
          <button
            className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
            title="تشغيل"
          >
            <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 rounded-xl transition-all duration-300"></div>
            <Play className="w-5 h-5 text-emerald-400 group-hover:text-emerald-300 relative" />
          </button>
          <button
            className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
            title="إيقاف مؤقت"
          >
            <div className="absolute inset-0 bg-amber-500/0 group-hover:bg-amber-500/10 rounded-xl transition-all duration-300"></div>
            <Pause className="w-5 h-5 text-amber-400 group-hover:text-amber-300 relative" />
          </button>
          <button
            className="group relative p-2 rounded-xl hover:bg-white/10 transition-all duration-300"
            title="مقص"
          >
            <div className="absolute inset-0 bg-cyan-500/0 group-hover:bg-cyan-500/10 rounded-xl transition-all duration-300"></div>
            <Scissors className="w-5 h-5 text-cyan-400 group-hover:text-cyan-300 relative" />
          </button>
        </div>
      </div>
    </div>
  );
}
