'use client';

import React, { useState, useRef } from 'react';
import {
  FolderOpen,
  Subtitles,
  Type,
  Music,
  Sliders,
  Sparkles,
  Upload,
  Plus,
  Play,
  Trash2,
  FileVideo,
  FileAudio,
  Loader2,
  Clock,
} from 'lucide-react';
import { MediaAsset, SubtitleCue } from '@/lib/types';
import { TEXT_OVERLAY_PRESETS } from '@/lib/presets';
import { formatTimeShort } from '@/lib/utils';

export type SidebarTab = 'media' | 'subtitles' | 'text' | 'audio' | 'effects';

interface LeftSidebarProps {
  assets: MediaAsset[];
  cues: SubtitleCue[];
  isGeneratingSubtitles: boolean;
  subtitlesJobStatus?: string;
  subtitlesJobProgress?: number;
  subtitlesJobMessage?: string;
  subtitlesMetrics?: Record<string, any>;
  onUploadAsset: (file: File) => Promise<void>;
  onDeleteAsset: (assetId: string) => void;
  onAddAssetToTimeline: (asset: MediaAsset) => void;
  onAddTextPreset: (presetId: string) => void;
  onGenerateSubtitles: () => void;
  onSelectCue: (cueId: string, timeMs: number) => void;
  onApplyEffect: (effectType: 'brightness' | 'contrast' | 'saturation' | 'blur', value: number) => void;
}

export default function LeftSidebar({
  assets,
  cues,
  isGeneratingSubtitles,
  subtitlesJobStatus,
  subtitlesJobProgress = 0,
  subtitlesJobMessage,
  subtitlesMetrics,
  onUploadAsset,
  onDeleteAsset,
  onAddAssetToTimeline,
  onAddTextPreset,
  onGenerateSubtitles,
  onSelectCue,
  onApplyEffect,
}: LeftSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('media');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Effect slider values
  const [brightness, setBrightness] = useState<number>(0.0);
  const [contrast, setContrast] = useState<number>(1.0);
  const [saturation, setSaturation] = useState<number>(1.0);
  const [blur, setBlur] = useState<number>(0.0);

  const tabs: { id: SidebarTab; label: string; icon: any }[] = [
    { id: 'media', label: 'Media', icon: FolderOpen },
    { id: 'subtitles', label: 'AI Subtitles', icon: Subtitles },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'audio', label: 'Audio', icon: Music },
    { id: 'effects', label: 'Effects', icon: Sliders },
  ];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await onUploadAsset(file);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <aside className="w-80 glass-panel border-r border-border/80 flex shrink-0 h-full overflow-hidden select-none z-30">
      {/* Icon Dock */}
      <div className="w-16 bg-surface/90 border-r border-border/60 py-3 flex flex-col items-center gap-2 shrink-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-surface-elevated'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-medium tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Drawer Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-background/50">
        {/* Tab Header */}
        <div className="p-3 border-b border-border/60 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {tabs.find((t) => t.id === activeTab)?.label}
          </h2>

          {activeTab === 'media' && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition-colors disabled:opacity-50"
            >
              {isUploading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Upload className="w-3 h-3" />
              )}
              <span>Import</span>
            </button>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* MEDIA TAB */}
          {activeTab === 'media' && (
            <div>
              {assets.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-border/80 hover:border-indigo-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-surface/30"
                >
                  <Upload className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-300">Import media assets</p>
                  <p className="text-[10px] text-slate-500 mt-1">MP4, MOV, MP3, WAV, PNG, JPG</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      className="group relative rounded-xl overflow-hidden bg-surface-elevated border border-border/60 hover:border-indigo-500 transition-all text-left"
                    >
                      {/* Thumbnail or Icon */}
                      <div className="aspect-video bg-black/60 relative flex items-center justify-center">
                        {asset.thumbnail_url ? (
                          <img
                            src={asset.thumbnail_url}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                        ) : asset.asset_type === 'video' ? (
                          <FileVideo className="w-6 h-6 text-slate-500" />
                        ) : (
                          <FileAudio className="w-6 h-6 text-slate-500" />
                        )}

                        {asset.duration > 0 && (
                          <span className="absolute bottom-1 right-1 px-1 py-0.2 rounded text-[9px] font-mono bg-black/80 text-white">
                            {formatTimeShort(asset.duration * 1000)}
                          </span>
                        )}

                        {/* Add overlay button */}
                        <button
                          type="button"
                          onClick={() => onAddAssetToTimeline(asset)}
                          className="absolute inset-0 bg-indigo-600/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity font-semibold text-xs gap-1"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add</span>
                        </button>
                      </div>

                      <div className="p-1.5 flex items-center justify-between">
                        <span className="text-[11px] text-slate-300 truncate max-w-[90px] block">
                          {asset.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => onDeleteAsset(asset.id)}
                          className="text-slate-500 hover:text-rose-400 p-0.5"
                          title="Delete asset"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AI SUBTITLES TAB */}
          {activeTab === 'subtitles' && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs">
                <div className="flex items-center gap-1.5 text-indigo-300 font-semibold mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI Sinhala Subtitles</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Transcribes spoken dialogue with faster-whisper and generates synchronized Sinhala Unicode subtitles.
                </p>

                {/* Live Processing Stage & Progress */}
                {isGeneratingSubtitles && (
                  <div className="mt-3 p-2.5 rounded-lg bg-surface/80 border border-indigo-500/30 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-indigo-300 font-medium truncate max-w-[150px]">
                        {subtitlesJobMessage || 'Processing audio...'}
                      </span>
                      <span className="font-mono text-indigo-400 font-bold shrink-0">
                        {Math.round(subtitlesJobProgress)}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(5, subtitlesJobProgress)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Telemetry Metrics on Completion */}
                {!isGeneratingSubtitles && subtitlesMetrics && (
                  <div className="mt-2.5 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] space-y-1">
                    <div className="flex items-center justify-between font-semibold text-emerald-300">
                      <span>⚡ Generation Speed</span>
                      <span>{subtitlesMetrics.speedup_factor || 1.0}x Real-Time</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-400 font-mono text-[9px]">
                      <span>Time: {(subtitlesMetrics.total_processing_ms / 1000).toFixed(2)}s (RTF {subtitlesMetrics.real_time_factor})</span>
                      {subtitlesMetrics.asr_cached && (
                        <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">CACHED</span>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onGenerateSubtitles}
                  disabled={isGeneratingSubtitles}
                  className="w-full mt-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50"
                >
                  {isGeneratingSubtitles ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{cues.length > 0 ? 'Regenerate Subtitles' : 'Generate Subtitles'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Subtitle Cue List */}
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Cues ({cues.length})
                </span>
                {cues.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-4">No subtitles generated yet.</p>
                ) : (
                  cues.map((cue) => (
                    <div
                      key={cue.id}
                      onClick={() => onSelectCue(cue.id, cue.start_time)}
                      className="p-2 rounded-lg bg-surface-elevated border border-border/50 hover:border-indigo-500/60 cursor-pointer transition-colors text-left"
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                        <span>#{cue.sequence_number}</span>
                        <span>{formatTimeShort(cue.start_time)}</span>
                      </div>
                      <p className="text-xs text-slate-200 sinhala-text line-clamp-2">
                        {cue.sinhala_text || cue.source_text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TEXT OVERLAY TAB */}
          {activeTab === 'text' && (
            <div className="space-y-2.5">
              <p className="text-[11px] text-slate-400">
                Click a preset to add a styled text title to the text track.
              </p>
              {TEXT_OVERLAY_PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => onAddTextPreset(preset.id)}
                  className="p-3 rounded-xl bg-surface-elevated border border-border/60 hover:border-indigo-500 cursor-pointer transition-all flex items-center justify-between group"
                >
                  <div>
                    <h4 className="text-xs font-semibold text-white group-hover:text-indigo-300">
                      {preset.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">{preset.description}</p>
                  </div>
                  <button
                    type="button"
                    className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* AUDIO TAB */}
          {activeTab === 'audio' && (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-surface-elevated border border-border/60">
                <h4 className="font-semibold text-white mb-1">Audio Tracks & Music</h4>
                <p className="text-[11px] text-slate-400 mb-3">
                  Upload MP3/WAV background music or voiceovers to mix with video audio.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-1.5 rounded-lg bg-surface border border-border hover:bg-slate-800 text-slate-200 font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import Audio File</span>
                </button>
              </div>
            </div>
          )}

          {/* EFFECTS TAB */}
          {activeTab === 'effects' && (
            <div className="space-y-4 text-xs">
              <p className="text-[11px] text-slate-400">
                Adjust visual grading applied during composition and export.
              </p>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Brightness</span>
                  <span className="font-mono text-indigo-400">{brightness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="-0.5"
                  max="0.5"
                  step="0.05"
                  value={brightness}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setBrightness(val);
                    onApplyEffect('brightness', val);
                  }}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Contrast</span>
                  <span className="font-mono text-indigo-400">{contrast.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.0"
                  step="0.05"
                  value={contrast}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setContrast(val);
                    onApplyEffect('contrast', val);
                  }}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Saturation</span>
                  <span className="font-mono text-indigo-400">{saturation.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="2.0"
                  step="0.05"
                  value={saturation}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setSaturation(val);
                    onApplyEffect('saturation', val);
                  }}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Blur</span>
                  <span className="font-mono text-indigo-400">{blur.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="10.0"
                  step="0.5"
                  value={blur}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setBlur(val);
                    onApplyEffect('blur', val);
                  }}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
