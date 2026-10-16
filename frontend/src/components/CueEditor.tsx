'use client';

import React, { useState } from 'react';
import {
  Play,
  Plus,
  Trash2,
  Split,
  Combine,
  Search,
  ChevronUp,
  ChevronDown,
  Clock,
  Sparkles,
} from 'lucide-react';
import { SubtitleCue, TimelineIssue } from '@/lib/types';
import { formatMsToTime } from '@/lib/utils';
import ValidationBadge from './ValidationBadge';

interface CueEditorProps {
  cues: SubtitleCue[];
  activeCueId?: string | null;
  validationIssues?: TimelineIssue[];
  onSeek: (ms: number) => void;
  onUpdateCue: (cueId: string, updates: Partial<SubtitleCue>) => void;
  onAddCue: (afterSequence: number) => void;
  onDeleteCue: (cueId: string) => void;
  onSplitCue: (cueId: string) => void;
  onMergeCue: (cueId: string) => void;
}

export default function CueEditor({
  cues,
  activeCueId,
  validationIssues = [],
  onSeek,
  onUpdateCue,
  onAddCue,
  onDeleteCue,
  onSplitCue,
  onMergeCue,
}: CueEditorProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');

  const filteredCues = cues.filter((cue) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      cue.sinhala_text.toLowerCase().includes(term) ||
      cue.source_text.toLowerCase().includes(term) ||
      cue.sequence_number.toString().includes(term)
    );
  });

  const getIssuesForCue = (cueId: string, seq: number) => {
    return validationIssues.filter(
      (i) => i.cue_id === cueId || i.sequence_number === seq
    );
  };

  const handleNudgeTime = (
    cueId: string,
    field: 'start_time' | 'end_time',
    delta: number,
    currentValue: number
  ) => {
    const nextVal = Math.max(0, currentValue + delta);
    onUpdateCue(cueId, { [field]: nextVal });
  };

  return (
    <div className="flex flex-col h-full glass-panel rounded-2xl overflow-hidden border border-border">
      {/* Top Bar: Search and Stats */}
      <div className="p-3 border-b border-border bg-surface/80 flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search subtitles in English or සිංහල..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-surface-elevated border border-border text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">
            {cues.length} cues
          </span>
          <button
            type="button"
            onClick={() => onAddCue(cues.length)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Cue</span>
          </button>
        </div>
      </div>

      {/* Cues List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredCues.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            {searchTerm ? 'No matching cues found.' : 'No subtitle cues available.'}
          </div>
        ) : (
          filteredCues.map((cue, index) => {
            const isActive = activeCueId === cue.id;
            const cueIssues = getIssuesForCue(cue.id, cue.sequence_number);

            return (
              <div
                key={cue.id}
                id={`cue-${cue.id}`}
                className={`p-3.5 rounded-xl border transition-all ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/10'
                    : 'border-border/60 bg-surface/60 hover:border-slate-700'
                }`}
              >
                {/* Cue Header */}
                <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-[11px] font-bold">
                      {cue.sequence_number}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSeek(cue.start_time)}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>{formatMsToTime(cue.start_time)}</span>
                      <span className="text-slate-600">→</span>
                      <span>{formatMsToTime(cue.end_time)}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <ValidationBadge issues={cueIssues} compact />

                    {/* Actions */}
                    <button
                      type="button"
                      title="Split cue"
                      onClick={() => onSplitCue(cue.id)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Split className="w-3.5 h-3.5" />
                    </button>
                    {index < filteredCues.length - 1 && (
                      <button
                        type="button"
                        title="Merge with next cue"
                        onClick={() => onMergeCue(cue.id)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      >
                        <Combine className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Delete cue"
                      onClick={() => onDeleteCue(cue.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Timing controls */}
                <div className="grid grid-cols-2 gap-2 mb-3 text-[11px]">
                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-surface-elevated/70 border border-border/40 font-mono">
                    <span className="text-slate-400">Start:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleNudgeTime(cue.id, 'start_time', -100, cue.start_time)}
                        className="px-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                      >
                        -0.1s
                      </button>
                      <span className="text-slate-200">{formatMsToTime(cue.start_time)}</span>
                      <button
                        type="button"
                        onClick={() => handleNudgeTime(cue.id, 'start_time', 100, cue.start_time)}
                        className="px-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                      >
                        +0.1s
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-1.5 rounded-lg bg-surface-elevated/70 border border-border/40 font-mono">
                    <span className="text-slate-400">End:</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleNudgeTime(cue.id, 'end_time', -100, cue.end_time)}
                        className="px-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                      >
                        -0.1s
                      </button>
                      <span className="text-slate-200">{formatMsToTime(cue.end_time)}</span>
                      <button
                        type="button"
                        onClick={() => handleNudgeTime(cue.id, 'end_time', 100, cue.end_time)}
                        className="px-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                      >
                        +0.1s
                      </button>
                    </div>
                  </div>
                </div>

                {/* Text fields */}
                <div className="space-y-2">
                  {/* Original Speech Text */}
                  {cue.source_text && (
                    <div className="text-xs text-slate-400 bg-surface-elevated/40 p-2 rounded-lg border border-border/30">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">
                        Original Speech
                      </span>
                      <p>{cue.source_text}</p>
                    </div>
                  )}

                  {/* Sinhala Subtitle Text */}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-indigo-400 block mb-0.5 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      <span>Sinhala Translation (සිංහල උපසිරැසිය)</span>
                    </span>
                    <textarea
                      rows={2}
                      value={cue.sinhala_text}
                      onChange={(e) => onUpdateCue(cue.id, { sinhala_text: e.target.value })}
                      className="w-full p-2 text-sm rounded-lg bg-surface-elevated border border-border text-slate-100 sinhala-text focus:outline-none focus:border-indigo-500 leading-relaxed resize-none"
                      placeholder="සිංහල උපසිරැසි පෙළ මෙහි ඇතුලත් කරන්න..."
                    />
                  </div>
                </div>

                {/* Validation Warnings expanded */}
                {cueIssues.length > 0 && (
                  <div className="mt-2">
                    <ValidationBadge issues={cueIssues} />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
