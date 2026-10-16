'use client';

import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, RotateCcw } from 'lucide-react';
import { SubtitleCue, SubtitleStyling } from '@/lib/types';
import { formatMsToTime } from '@/lib/utils';

export interface VideoPlayerRef {
  seekTo: (ms: number) => void;
  play: () => void;
  pause: () => void;
}

interface VideoPlayerProps {
  mediaUrl: string;
  mediaType?: string;
  cues: SubtitleCue[];
  styling: SubtitleStyling;
  onTimeUpdate?: (currentTimeMs: number) => void;
}

const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  ({ mediaUrl, mediaType, cues, styling, onTimeUpdate }, ref) => {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
    const [durationMs, setDurationMs] = useState<number>(0);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [currentCue, setCurrentCue] = useState<SubtitleCue | null>(null);

    useImperativeHandle(ref, () => ({
      seekTo: (ms: number) => {
        if (videoRef.current) {
          videoRef.current.currentTime = ms / 1000;
          setCurrentTimeMs(ms);
        }
      },
      play: () => videoRef.current?.play(),
      pause: () => videoRef.current?.pause(),
    }));

    // Find current active cue
    useEffect(() => {
      const active = cues.find(
        (c) => currentTimeMs >= c.start_time && currentTimeMs <= c.end_time
      );
      setCurrentCue(active || null);
    }, [currentTimeMs, cues]);

    const handleTimeUpdate = () => {
      if (videoRef.current) {
        const ms = Math.round(videoRef.current.currentTime * 1000);
        setCurrentTimeMs(ms);
        onTimeUpdate?.(ms);
      }
    };

    const handleLoadedMetadata = () => {
      if (videoRef.current) {
        setDurationMs(Math.round(videoRef.current.duration * 1000));
      }
    };

    const togglePlay = () => {
      if (!videoRef.current) return;
      if (videoRef.current.paused) {
        videoRef.current.play();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    };

    const toggleMute = () => {
      if (!videoRef.current) return;
      videoRef.current.muted = !videoRef.current.muted;
      setIsMuted(videoRef.current.muted);
    };

    const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
      const ms = parseInt(e.target.value, 10);
      if (videoRef.current) {
        videoRef.current.currentTime = ms / 1000;
        setCurrentTimeMs(ms);
      }
    };

    const toggleFullscreen = () => {
      if (!containerRef.current) return;
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    };

    // Subtitle position classes
    const positionClass = {
      bottom: 'bottom-8 items-center',
      top: 'top-8 items-center',
      middle: 'top-1/2 -translate-y-1/2 items-center',
    }[styling.position || 'bottom'];

    const alignClass = {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    }[styling.alignment || 'center'];

    return (
      <div
        ref={containerRef}
        className="relative group rounded-2xl overflow-hidden bg-black aspect-video flex flex-col justify-end border border-border shadow-2xl"
      >
        <video
          ref={videoRef}
          src={mediaUrl}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onClick={togglePlay}
          className="w-full h-full object-contain cursor-pointer"
        />

        {/* Dynamic Subtitle Overlay */}
        {currentCue && currentCue.sinhala_text && (
          <div className={`absolute inset-x-4 pointer-events-none flex justify-center z-20 ${positionClass}`}>
            <div
              className={`max-w-[90%] px-4 py-2 rounded-lg transition-all ${alignClass} subtitle-text-shadow`}
              style={{
                backgroundColor: `rgba(0, 0, 0, ${styling.background_opacity})`,
                color: styling.text_color,
                fontSize: `${styling.font_size}px`,
                fontFamily: styling.font_name,
                lineHeight: 1.4,
              }}
            >
              <p className="whitespace-pre-line sinhala-text font-medium">{currentCue.sinhala_text}</p>
            </div>
          </div>
        )}

        {/* Controls Overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-30">
          {/* Progress scrubber */}
          <input
            type="range"
            min={0}
            max={durationMs || 100}
            value={currentTimeMs}
            onChange={handleScrub}
            className="w-full h-1 mb-3 rounded-lg accent-indigo-500 cursor-pointer bg-slate-700"
          />

          <div className="flex items-center justify-between text-white text-xs">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              <button
                type="button"
                onClick={toggleMute}
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <div className="font-mono text-slate-300">
                <span>{formatMsToTime(currentTimeMs)}</span>
                <span className="text-slate-500 mx-1">/</span>
                <span>{formatMsToTime(durationMs)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 text-slate-300 hover:text-white transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;
