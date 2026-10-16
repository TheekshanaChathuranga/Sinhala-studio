'use client';

import React, { useRef, useState } from 'react';
import {
  Split,
  Trash2,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Subtitles,
  Type,
  Video,
  Music,
  Layers,
} from 'lucide-react';
import { TimelineTrack, TimelineClip, SubtitleCue } from '@/lib/types';
import { formatTimeShort } from '@/lib/utils';

interface TimelineEditorProps {
  tracks: TimelineTrack[];
  cues: SubtitleCue[];
  currentTimeMs: number;
  durationMs: number;
  selectedClipId: string | null;
  onSeek: (ms: number) => void;
  onSelectClip: (clip: TimelineClip | null) => void;
  onSelectCue: (cue: SubtitleCue) => void;
  onSplitAtPlayhead: () => void;
  onDeleteSelectedClip: () => void;
  onToggleTrackMute: (trackId: string) => void;
  onToggleTrackVisible: (trackId: string) => void;
}

export default function TimelineEditor({
  tracks,
  cues,
  currentTimeMs,
  durationMs,
  selectedClipId,
  onSeek,
  onSelectClip,
  onSelectCue,
  onSplitAtPlayhead,
  onDeleteSelectedClip,
  onToggleTrackMute,
  onToggleTrackVisible,
}: TimelineEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoomScale, setZoomScale] = useState<number>(0.05); // px per ms (0.05px/ms = 50px/sec)

  const effectiveDurationMs = Math.max(durationMs || 10000, 15000);
  const totalTimelineWidth = Math.max(1000, effectiveDurationMs * zoomScale);

  const handleRulerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekMs = Math.max(0, Math.min(effectiveDurationMs, clickX / zoomScale));
    onSeek(Math.round(seekMs));
  };

  const getTrackIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <Type className="w-3.5 h-3.5 text-purple-400" />;
      case 'subtitle':
        return <Subtitles className="w-3.5 h-3.5 text-amber-400" />;
      case 'video':
        return <Video className="w-3.5 h-3.5 text-indigo-400" />;
      case 'overlay':
        return <Layers className="w-3.5 h-3.5 text-cyan-400" />;
      case 'audio':
        return <Music className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Layers className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Time ruler tick markers (every 1s or 5s)
  const tickIntervalSec = zoomScale > 0.08 ? 1 : 2;
  const numTicks = Math.ceil(effectiveDurationMs / (tickIntervalSec * 1000));
  const ticks = Array.from({ length: numTicks }, (_, i) => i * tickIntervalSec);

  return (
    <div className="h-64 glass-panel border-t border-border/80 flex flex-col shrink-0 select-none overflow-hidden z-20">
      {/* Timeline Action Header */}
      <div className="h-10 px-4 border-b border-border/60 bg-surface/80 flex items-center justify-between shrink-0 text-xs">
        {/* Left tools: Split, Delete */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onSplitAtPlayhead}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-slate-800 text-slate-200 border border-border font-medium transition-colors"
            title="Split Clip at Playhead (Ctrl+B)"
          >
            <Split className="w-3.5 h-3.5 text-indigo-400" />
            <span>Split</span>
          </button>

          <button
            type="button"
            onClick={onDeleteSelectedClip}
            disabled={!selectedClipId}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-rose-950/60 hover:text-rose-300 text-slate-200 border border-border font-medium transition-colors disabled:opacity-40"
            title="Delete Selected Clip (Del)"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            <span>Delete</span>
          </button>
        </div>

        {/* Right tools: Zoom */}
        <div className="flex items-center gap-2 text-slate-400">
          <button
            type="button"
            onClick={() => setZoomScale((prev) => Math.max(0.015, prev * 0.8))}
            className="p-1 hover:text-white"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <input
            type="range"
            min="0.015"
            max="0.2"
            step="0.005"
            value={zoomScale}
            onChange={(e) => setZoomScale(parseFloat(e.target.value))}
            className="w-20 accent-indigo-500 h-1 bg-slate-700 rounded cursor-pointer"
          />
          <button
            type="button"
            onClick={() => setZoomScale((prev) => Math.min(0.2, prev * 1.25))}
            className="p-1 hover:text-white"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Timeline Scrollable Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers (Left sidebar) */}
        <div className="w-48 bg-surface/90 border-r border-border/80 flex flex-col shrink-0 overflow-y-auto">
          {/* Header spacer aligned with ruler */}
          <div className="h-6 border-b border-border/60 bg-surface/60 px-3 flex items-center text-[10px] uppercase font-bold text-slate-500">
            Tracks
          </div>

          {/* Subtitle Track Header */}
          <div className="h-10 px-3 border-b border-border/40 flex items-center justify-between text-xs font-semibold text-slate-300">
            <div className="flex items-center gap-1.5 truncate">
              <Subtitles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">Sinhala Subtitles</span>
            </div>
          </div>

          {/* Dynamic Tracks Headers */}
          {tracks.map((track) => (
            <div
              key={track.id}
              className="h-10 px-3 border-b border-border/40 flex items-center justify-between text-xs font-semibold text-slate-300"
            >
              <div className="flex items-center gap-1.5 truncate">
                {getTrackIcon(track.type)}
                <span className="truncate">{track.name}</span>
              </div>
              <div className="flex items-center gap-1 text-slate-500">
                <button
                  type="button"
                  onClick={() => onToggleTrackVisible(track.id)}
                  className="p-0.5 hover:text-white"
                >
                  {track.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-slate-600" />}
                </button>
                <button
                  type="button"
                  onClick={() => onToggleTrackMute(track.id)}
                  className="p-0.5 hover:text-white"
                >
                  {track.muted ? <VolumeX className="w-3 h-3 text-rose-400" /> : <Volume2 className="w-3 h-3" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Tracks Sequencer Canvas (Right scrollable container) */}
        <div
          ref={containerRef}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#070b12]"
        >
          <div
            style={{ width: `${totalTimelineWidth}px` }}
            className="relative min-h-full pb-6"
          >
            {/* Time Ruler */}
            <div
              onClick={handleRulerClick}
              className="h-6 border-b border-border/60 bg-surface/40 relative cursor-pointer font-mono text-[9px] text-slate-500"
            >
              {ticks.map((sec) => (
                <div
                  key={sec}
                  className="absolute top-0 bottom-0 border-l border-slate-700/60 pl-1 flex items-center"
                  style={{ left: `${sec * 1000 * zoomScale}px` }}
                >
                  <span>{sec}s</span>
                </div>
              ))}
            </div>

            {/* Playhead Needle Line */}
            <div
              className="absolute top-0 bottom-0 z-40 pointer-events-none transition-all duration-75"
              style={{ left: `${currentTimeMs * zoomScale}px` }}
            >
              <div className="w-2.5 h-3 bg-red-500 -ml-[4px] -mt-[1px] rotate-45 rounded-sm shadow-sm shadow-red-500/50" />
              <div className="w-[1.5px] h-full bg-red-500 -ml-[0.75px] shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            </div>

            {/* 1. Subtitle Track Row */}
            <div className="h-10 border-b border-border/30 relative bg-amber-950/10">
              {cues.map((cue) => {
                const left = cue.start_time * zoomScale;
                const width = Math.max(12, (cue.end_time - cue.start_time) * zoomScale);
                return (
                  <div
                    key={cue.id}
                    onClick={() => onSelectCue(cue)}
                    className="absolute top-1 bottom-1 rounded-md px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/50 hover:border-amber-400 cursor-pointer overflow-hidden flex items-center text-[10px] text-amber-200 font-medium truncate sinhala-text"
                    style={{ left: `${left}px`, width: `${width}px` }}
                    title={cue.sinhala_text || cue.source_text}
                  >
                    <span className="truncate">{cue.sinhala_text || cue.source_text}</span>
                  </div>
                );
              })}
            </div>

            {/* 2. Dynamic Tracks Rows */}
            {tracks.map((track) => (
              <div
                key={track.id}
                className="h-10 border-b border-border/30 relative bg-surface/20"
              >
                {track.clips.map((clip) => {
                  const left = clip.timeline_start_ms * zoomScale;
                  const width = Math.max(16, clip.duration_ms * zoomScale);
                  const isSelected = selectedClipId === clip.id;

                  const clipColor: Record<string, string> = {
                    video: 'bg-indigo-600/30 border-indigo-500 text-indigo-200',
                    image: 'bg-cyan-600/30 border-cyan-500 text-cyan-200',
                    text: 'bg-purple-600/30 border-purple-500 text-purple-200',
                    audio: 'bg-emerald-600/30 border-emerald-500 text-emerald-200',
                    subtitle: 'bg-amber-600/30 border-amber-500 text-amber-200',
                  };
                  const colorClass = clipColor[clip.type] || 'bg-slate-700/40 border-slate-600 text-white';

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectClip(clip);
                      }}
                      className={`absolute top-1 bottom-1 rounded-md px-2 py-0.5 border cursor-pointer overflow-hidden flex items-center justify-between text-[11px] font-semibold transition-all ${colorClass} ${
                        isSelected ? 'ring-2 ring-white shadow-lg' : 'hover:brightness-110'
                      }`}
                      style={{ left: `${left}px`, width: `${width}px` }}
                    >
                      <span className="truncate">{clip.name}</span>
                      <span className="text-[9px] font-mono opacity-60 ml-1 shrink-0">
                        {formatTimeShort(clip.duration_ms)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
