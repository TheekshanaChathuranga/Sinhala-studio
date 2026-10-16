'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Download,
  Film,
  CheckCircle2,
  Loader2,
  Smartphone,
  Monitor,
  Square,
  Sparkles,
} from 'lucide-react';
import { AspectRatio } from '@/lib/types';

interface EditorNavbarProps {
  projectTitle: string;
  aspectRatio: AspectRatio;
  saveStatus: 'saved' | 'saving' | 'error';
  canUndo: boolean;
  canRedo: boolean;
  onTitleChange: (title: string) => void;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenExport: () => void;
}

export default function EditorNavbar({
  projectTitle,
  aspectRatio,
  saveStatus,
  canUndo,
  canRedo,
  onTitleChange,
  onAspectRatioChange,
  onUndo,
  onRedo,
  onOpenExport,
}: EditorNavbarProps) {
  const aspectOptions: { id: AspectRatio; label: string; icon: any }[] = [
    { id: '16:9', label: '16:9 (Landscape)', icon: Monitor },
    { id: '9:16', label: '9:16 (TikTok/Shorts)', icon: Smartphone },
    { id: '1:1', label: '1:1 (Square)', icon: Square },
    { id: '4:5', label: '4:5 (Portrait)', icon: Smartphone },
  ];

  return (
    <header className="h-14 glass-panel border-b border-border/80 px-4 flex items-center justify-between shrink-0 select-none z-40">
      {/* Left: Back & Project Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/projects"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
          title="Back to Projects"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
            <Film className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={projectTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            className="bg-transparent text-sm font-bold text-white hover:bg-surface-elevated/50 focus:bg-surface-elevated px-2 py-1 rounded-lg border border-transparent focus:border-indigo-500 focus:outline-none transition-colors max-w-[200px] sm:max-w-xs truncate"
            placeholder="Project Title"
          />
        </div>
      </div>

      {/* Center: Undo/Redo & Aspect Ratio Switcher */}
      <div className="flex items-center gap-3">
        {/* Undo & Redo */}
        <div className="flex items-center gap-1 bg-surface-elevated/60 p-1 rounded-xl border border-border/60">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Aspect Ratio Selector */}
        <div className="flex items-center gap-1 bg-surface-elevated/60 p-1 rounded-xl border border-border/60 text-xs">
          {aspectOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = aspectRatio === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onAspectRatioChange(opt.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={opt.label}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline font-mono">{opt.id}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Autosave status & Export */}
      <div className="flex items-center gap-3">
        {/* Autosave Status */}
        <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Saved</span>
            </>
          )}
          {saveStatus === 'error' && (
            <span className="text-rose-400">Save failed</span>
          )}
        </div>

        {/* Export Button */}
        <button
          type="button"
          onClick={onOpenExport}
          className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02]"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
}
