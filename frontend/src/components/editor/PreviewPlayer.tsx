'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
} from 'lucide-react';
import { AspectRatio, SubtitleCue, SubtitleStyling, TimelineClip } from '@/lib/types';
import { formatMsToTime } from '@/lib/utils';

export interface PreviewPlayerRef {
  seekTo: (ms: number) => void;
  play: () => void;
  pause: () => void;
}

interface PreviewPlayerProps {
  mediaUrl: string;
  aspectRatio: AspectRatio;
  currentTimeMs: number;
  durationMs: number;
  isPlaying: boolean;
  activeSubtitle?: SubtitleCue | null;
  activeTextOverlays?: TimelineClip[];
  subtitleStyling: SubtitleStyling;
  onTimeUpdate: (ms: number) => void;
  onTogglePlay: () => void;
}

const PreviewPlayer = forwardRef<PreviewPlayerRef, PreviewPlayerProps>(
  (
    {
      mediaUrl,
      aspectRatio,
      currentTimeMs,
      durationMs,
      isPlaying,
      activeSubtitle,
      activeTextOverlays = [],
      subtitleStyling,
      onTimeUpdate,
      onTogglePlay,
    },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isMuted, setIsMuted] = useState<boolean>(false);

    useImperativeHandle(ref, () => ({
      seekTo: (ms: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = ms / 1000;
        }
      },
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
    }));

    // Play/Pause sync
    useEffect(() => {
      if (!videoRef.current) return;
      if (isPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      } else if (!isPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }, [isPlaying]);

    const handleVideoTimeUpdate = () => {
      if (videoRef.current) {
        const ms = Math.round(videoRef.current.currentTime * 1000);
        onTimeUpdate(ms);
      }
    };

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
      const ms = parseInt(e.target.value, 10);
      if (videoRef.current) {
        videoRef.current.currentTime = ms / 1000;
      }
      onTimeUpdate(ms);
    };

    // Canonical numeric aspect ratios
    const numericRatio = {
      '16:9': 16 / 9,
      '9:16': 9 / 16,
      '1:1': 1 / 1,
      '4:5': 4 / 5,
    }[aspectRatio] || (16 / 9);

    const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');

    // Subtitle position classes
    const subtitlePosClass = {
      bottom: 'bottom-6 items-center',
      top: 'top-6 items-center',
      middle: 'top-1/2 -translate-y-1/2 items-center',
    }[subtitleStyling.position || 'bottom'];

    const subtitleAlignClass = {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    }[subtitleStyling.alignment || 'center'];

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-3 select-none overflow-hidden">
        {/* Canvas Monitor Box */}
        <div
          ref={containerRef}
          style={{
            aspectRatio: `${numericRatio}`,
            maxHeight: 'calc(100vh - 290px)',
            maxWidth: `min(100%, calc((100vh - 290px) * ${numericRatio}))`,
            width: '100%',
            height: 'auto',
          }}
          className="relative rounded-2xl overflow-hidden bg-black flex flex-col justify-center items-center shadow-2xl border border-border/80 transition-all duration-300 mx-auto"
        >
          {mediaUrl ? (
            <video
              ref={videoRef}
              src={mediaUrl}
              playsInline
              onTimeUpdate={handleVideoTimeUpdate}
              onClick={onTogglePlay}
              className={`w-full h-full cursor-pointer ${
                fitMode === 'cover' ? 'object-cover' : 'object-contain'
              }`}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-2">
              <span className="text-xs">No media loaded</span>
            </div>
          )}

          {/* Active Text Title Overlays */}
          {activeTextOverlays.map((overlay) => {
            const st = overlay.text_settings;
            if (!st) return null;
            return (
              <div
                key={overlay.id}
                className="absolute pointer-events-none transition-all z-20"
                style={{
                  left: `${st.position_x * 100}%`,
                  top: `${st.position_y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div
                  className="px-3 py-1.5 rounded-lg whitespace-pre-line sinhala-text"
                  style={{
                    fontSize: `${st.font_size}px`,
                    fontFamily: st.font_name,
                    color: st.text_color,
                    backgroundColor: `rgba(0,0,0,${st.background_opacity})`,
                    textShadow: st.outline_width > 0 ? `0 0 ${st.outline_width * 2}px ${st.outline_color}` : undefined,
                  }}
                >
                  {st.content}
                </div>
              </div>
            );
          })}

          {/* Active Sinhala Subtitle Overlay */}
          {activeSubtitle && (activeSubtitle.sinhala_text || activeSubtitle.source_text) && (
            <div
              className={`absolute inset-x-4 pointer-events-none flex justify-center z-30 transition-all ${subtitlePosClass}`}
            >
              <div
                className={`max-w-[92%] px-4 py-2 rounded-xl transition-all ${subtitleAlignClass}`}
                style={{
                  backgroundColor:
                    subtitleStyling.background_opacity > 0
                      ? `rgba(0, 0, 0, ${subtitleStyling.background_opacity})`
                      : 'transparent',
                  color: subtitleStyling.text_color,
                  fontSize: `${subtitleStyling.font_size}px`,
                  fontFamily: subtitleStyling.font_name
                    ? `"${subtitleStyling.font_name}", var(--font-sinhala)`
                    : 'var(--font-sinhala)',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                  textShadow:
                    subtitleStyling.outline_width > 0
                      ? `0 0 ${subtitleStyling.outline_width * 2}px ${subtitleStyling.outline_color}, 0 2px 4px rgba(0,0,0,0.8)`
                      : '0 2px 4px rgba(0,0,0,0.9)',
                }}
              >
                <p
                  className="whitespace-pre-line sinhala-text font-bold"
                  style={{
                    fontFamily: subtitleStyling.font_name
                      ? `"${subtitleStyling.font_name}", var(--font-sinhala)`
                      : 'var(--font-sinhala)',
                  }}
                >
                  {activeSubtitle.sinhala_text || activeSubtitle.source_text}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Transport & Scrub Bar */}
        <div className="w-full max-w-3xl mt-3 flex flex-col gap-2 glass-panel p-2.5 rounded-xl border border-border/60">
          {/* Time scrubber */}
          <input
            type="range"
            min={0}
            max={durationMs || 10000}
            value={currentTimeMs}
            onChange={handleScrub}
            className="w-full h-1 bg-slate-800 rounded-lg accent-indigo-500 cursor-pointer"
          />

          <div className="flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onTimeUpdate(0)}
                className="p-1 rounded text-slate-400 hover:text-white"
                title="Jump to Start"
              >
                <SkipBack className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={onTogglePlay}
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button
                type="button"
                onClick={() => onTimeUpdate(durationMs)}
                className="p-1 rounded text-slate-400 hover:text-white"
                title="Jump to End"
              >
                <SkipForward className="w-3.5 h-3.5" />
              </button>

              {/* Timecode */}
              <div className="font-mono text-xs text-slate-200 ml-2">
                <span>{formatMsToTime(currentTimeMs)}</span>
                <span className="text-slate-600 mx-1.5">/</span>
                <span className="text-slate-400">{formatMsToTime(durationMs)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setFitMode(fitMode === 'contain' ? 'cover' : 'contain')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                  fitMode === 'cover'
                    ? 'bg-indigo-600/40 border-indigo-500 text-indigo-300'
                    : 'bg-surface-elevated border-border/60 text-slate-400 hover:text-white'
                }`}
                title={
                  fitMode === 'cover'
                    ? 'Canvas Fill: Cropped to ratio (Click to fit letterboxed)'
                    : 'Canvas Fit: Entire video visible with black padding (Click to fill & crop)'
                }
              >
                {fitMode === 'cover' ? 'Fill (Crop)' : 'Fit (Letterbox)'}
              </button>

              <button
                type="button"
                onClick={() => setIsMuted(!isMuted)}
                className="p-1 text-slate-400 hover:text-white"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

PreviewPlayer.displayName = 'PreviewPlayer';

export default PreviewPlayer;
