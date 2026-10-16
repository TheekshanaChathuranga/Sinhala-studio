'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Film,
  Sparkles,
  Upload,
  ArrowRight,
  Sliders,
  Layers,
  Music,
  FileText,
  Smartphone,
  Play,
  Pause,
  Download,
  Scissors,
  CheckCircle2,
} from 'lucide-react';

export default function LandingPage() {
  const [demoPlaying, setDemoPlaying] = useState<boolean>(true);
  const [demoTime, setDemoTime] = useState<number>(0);

  const demoCues = [
    { start: 0, end: 3500, src: 'Welcome to Sinhala Studio video editor.', sin: 'සිංහල ස්ටූඩියෝ වීඩියෝ සංස්කාරකයට සාදරයෙන් පිළිගනිමු.' },
    { start: 3500, end: 7500, src: 'CapCut-style multi-track timeline with AI subtitles.', sin: 'කැප්කට් මට්ටමේ බහු-ධාවන පථ කාලරාමුව සහ AI උපසිරැසි.' },
    { start: 7500, end: 11000, src: 'Export in 1080p with styled Sinhala typography.', sin: 'හැඩගැන්වූ සිංහල අකුරු සමඟින් 1080p වීඩියෝවක් බාගත කරන්න.' },
  ];

  useEffect(() => {
    if (!demoPlaying) return;
    const interval = setInterval(() => {
      setDemoTime((prev) => (prev >= 11000 ? 0 : prev + 200));
    }, 200);
    return () => clearInterval(interval);
  }, [demoPlaying]);

  const activeDemoCue = demoCues.find(
    (c) => demoTime >= c.start && demoTime < c.end
  ) || demoCues[0];

  return (
    <div className="flex flex-col items-center">
      {/* Hero Section */}
      <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 text-center relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-indigo-600/20 via-cyan-500/15 to-purple-600/10 blur-[120px] pointer-events-none rounded-full" />

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-6 animate-pulse-subtle">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Browser-Based CapCut-Style Video Editor with AI Sinhala Subtitles</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-tight sm:leading-none">
          Edit Videos & Generate{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
            Sinhala Subtitles
          </span>{' '}
          Online
        </h1>

        <p className="mt-6 text-base sm:text-xl text-slate-300 max-w-2xl mx-auto font-normal leading-relaxed">
          The all-in-one browser video editing platform inspired by CapCut. Trim, split, arrange multi-tracks, mix audio, transform aspect ratios (16:9, 9:16 Shorts), style Sinhala subtitles with rich presets, and render real MP4 videos.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/upload"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all text-sm group"
          >
            <Film className="w-4 h-4" />
            <span>Open Sinhala Studio</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/projects"
            className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-medium text-slate-300 hover:text-white glass-panel glass-panel-hover text-sm"
          >
            View Projects Library
          </Link>
        </div>

        {/* Live Interactive CapCut Multi-Track Simulator */}
        <div className="mt-14 max-w-4xl mx-auto">
          <div className="glass-panel rounded-2xl p-4 border border-border/80 shadow-2xl relative text-left">
            <div className="flex items-center justify-between pb-3 border-b border-border/60 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="text-xs text-slate-400 font-mono ml-2">Sinhala Studio Composition Preview</span>
              </div>
              <button
                type="button"
                onClick={() => setDemoPlaying(!demoPlaying)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-elevated text-xs text-slate-300 hover:text-white font-mono"
              >
                {demoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                <span>{(demoTime / 1000).toFixed(1)}s</span>
              </button>
            </div>

            {/* Simulated 16:9 Video Canvas */}
            <div className="relative rounded-xl overflow-hidden aspect-video bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-950 flex flex-col justify-end p-6 border border-border/50">
              {/* Animated waveform visualizer */}
              <div className="absolute inset-0 flex items-center justify-center opacity-25 gap-1.5 pointer-events-none">
                {[40, 65, 85, 45, 95, 75, 55, 30, 80, 60, 90, 50, 70, 35, 85].map((h, i) => (
                  <div
                    key={i}
                    className="w-1.5 rounded-full bg-indigo-500 transition-all duration-300"
                    style={{
                      height: demoPlaying ? `${(h * ((demoTime % 1000) + 200)) / 1000}%` : `${h / 2}%`,
                    }}
                  />
                ))}
              </div>

              {/* Top Text Title Banner */}
              <div className="absolute top-6 left-6 z-10">
                <span className="px-3 py-1 rounded-lg bg-purple-900/70 border border-purple-600/50 text-white font-semibold text-xs shadow-md">
                  TITLE • අලුත් වීඩියෝව
                </span>
              </div>

              {/* Subtitle Display */}
              <div className="relative z-10 text-center space-y-1">
                <div className="bg-black/80 px-4 py-2 rounded-xl inline-block text-amber-300 font-bold sinhala-text text-base sm:text-lg shadow-xl border border-black/50">
                  {activeDemoCue.sin}
                </div>
              </div>

              {/* Simulated timeline progress bar */}
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-4 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full transition-all duration-200"
                  style={{ width: `${(demoTime / 11000) * 100}%` }}
                />
              </div>
            </div>

            {/* Simulated Multi-Track Timeline mini view */}
            <div className="mt-3 p-2.5 rounded-xl bg-surface/70 border border-border/40 space-y-1.5 font-mono text-[10px]">
              <div className="flex items-center gap-2">
                <span className="w-16 text-purple-400 font-semibold truncate">TEXT</span>
                <div className="flex-1 bg-purple-950/40 border border-purple-800/40 rounded px-2 py-0.5 text-purple-300 truncate">
                  Main Title Card (00:00 - 00:04)
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-16 text-amber-400 font-semibold truncate">SUBTITLES</span>
                <div className="flex-1 bg-amber-950/40 border border-amber-800/40 rounded px-2 py-0.5 text-amber-300 truncate">
                  {activeDemoCue.sin}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-16 text-indigo-400 font-semibold truncate">VIDEO 1</span>
                <div className="flex-1 bg-indigo-950/40 border border-indigo-800/40 rounded px-2 py-0.5 text-indigo-300 truncate">
                  Main Footage (1080p 30fps) • 1.0x Speed
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-16 text-emerald-400 font-semibold truncate">AUDIO</span>
                <div className="flex-1 bg-emerald-950/40 border border-emerald-800/40 rounded px-2 py-0.5 text-emerald-300 truncate">
                  Background Music Track (Vol: 80%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-16 border-t border-border/40">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            CapCut-Level Editing Power in Your Browser
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            No desktop software required. Full nonlinear video sequencing with Sinhala AI.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <Scissors className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-white">Multi-Track Timeline</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sequence video, B-roll overlays, text titles, AI subtitles, and background audio tracks with split, trim, and move operations.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-white">CapCut Subtitle Styling</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Classic White, YouTube Yellow, Bold Outline, Dark Box, Neon Cyan, and Sinhala Gold styling presets with Noto Sans Sinhala font.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-white">Aspect Ratio Switcher</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Switch seamlessly between 16:9 Landscape for YouTube, 9:16 Vertical for TikTok/Shorts/Reels, 1:1 Square, and 4:5 Portrait.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-white">Text Titles & Lower Thirds</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Add customizable text overlays, title banners, documentary lower thirds, and callouts with animated fade, slide, and pop entries.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Music className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-white">Audio Mixing & Speed</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Mix background music with spoken voice, adjust volume levels (0% to 200%), and change video speed from 0.5x slow-mo to 2.0x fast forward.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
              <Download className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-base text-white">Real Server FFmpeg MP4 Render</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Deterministic server-side FFmpeg rendering producing 1080p and 720p MP4 videos with burned-in Sinhala subtitles and downloadable SRT/VTT.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
