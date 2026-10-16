'use client';

import React from 'react';
import {
  Sliders,
  Type,
  Palette,
  Volume2,
  Gauge,
  Layers,
  Sparkles,
  AlignLeft,
  AlignCenter,
  AlignRight,
  MoveVertical,
} from 'lucide-react';
import {
  SubtitleStyling,
  TimelineClip,
  SubtitleCue,
  ClipTransform,
  TextOverlaySettings,
} from '@/lib/types';
import { SUBTITLE_PRESETS } from '@/lib/presets';

interface PropertiesPanelProps {
  selectedClip: TimelineClip | null;
  selectedCue: SubtitleCue | null;
  subtitleStyling: SubtitleStyling;
  onUpdateSubtitleStyling: (styling: SubtitleStyling) => void;
  onUpdateSelectedCue: (cueId: string, text: string) => void;
  onUpdateClipTransform: (clipId: string, transform: Partial<ClipTransform>) => void;
  onUpdateClipSpeed: (clipId: string, speed: number) => void;
  onUpdateClipVolume: (clipId: string, volume: number) => void;
  onUpdateTextSettings: (clipId: string, settings: Partial<TextOverlaySettings>) => void;
}

export default function PropertiesPanel({
  selectedClip,
  selectedCue,
  subtitleStyling,
  onUpdateSubtitleStyling,
  onUpdateSelectedCue,
  onUpdateClipTransform,
  onUpdateClipSpeed,
  onUpdateClipVolume,
  onUpdateTextSettings,
}: PropertiesPanelProps) {
  const updateStyleField = <K extends keyof SubtitleStyling>(key: K, value: SubtitleStyling[K]) => {
    onUpdateSubtitleStyling({ ...subtitleStyling, [key]: value });
  };

  const isSubtitleSelected = !!selectedCue || selectedClip?.type === 'subtitle';
  const isVideoSelected = selectedClip?.type === 'video' || selectedClip?.type === 'image';
  const isTextSelected = selectedClip?.type === 'text';
  const isAudioSelected = selectedClip?.type === 'audio';

  return (
    <aside className="w-80 glass-panel border-l border-border/80 flex flex-col shrink-0 h-full overflow-hidden select-none z-30">
      <div className="p-3 border-b border-border/60 flex items-center gap-2">
        <Sliders className="w-4 h-4 text-indigo-400" />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
          {isSubtitleSelected
            ? 'Subtitle Styling'
            : isTextSelected
            ? 'Text Overlay'
            : isVideoSelected
            ? 'Video Properties'
            : isAudioSelected
            ? 'Audio Settings'
            : 'Inspector'}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
        {/* SUBTITLE STYLING CONTROLS */}
        {isSubtitleSelected && (
          <div className="space-y-4">
            {/* Selected Cue Text Quick Edit */}
            {selectedCue && (
              <div className="space-y-1.5 p-2.5 rounded-xl bg-surface-elevated/70 border border-border/60">
                <span className="text-[10px] font-bold uppercase text-indigo-400 block">
                  Cue #{selectedCue.sequence_number} Text
                </span>
                <textarea
                  rows={2}
                  value={selectedCue.sinhala_text}
                  onChange={(e) => onUpdateSelectedCue(selectedCue.id, e.target.value)}
                  className="w-full p-2 text-xs rounded-lg bg-surface border border-border text-slate-100 sinhala-text focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                  placeholder="සිංහල උපසිරැසි පෙළ..."
                />
              </div>
            )}

            {/* Presets Grid */}
            <div>
              <label className="text-[11px] font-semibold text-slate-300 block mb-2">
                CapCut Subtitle Presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                {SUBTITLE_PRESETS.map((preset) => {
                  const isCurrent = subtitleStyling.preset_name === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onUpdateSubtitleStyling(preset.styling)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isCurrent
                          ? 'border-indigo-500 bg-indigo-500/15 shadow-sm'
                          : 'border-border/60 bg-surface/50 hover:bg-surface-elevated'
                      }`}
                    >
                      <div
                        className="h-6 rounded-md flex items-center justify-center font-bold text-xs mb-1.5 sinhala-text"
                        style={{
                          backgroundColor: preset.previewBg,
                          color: preset.previewTextColor,
                        }}
                      >
                        අ ආ ඇ
                      </div>
                      <span className="font-semibold text-[11px] text-slate-200 block truncate">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Typography Controls */}
            <div className="space-y-3 pt-3 border-t border-border/50">
              <div>
                <label className="text-slate-400 block mb-1">Font Family</label>
                <select
                  value={subtitleStyling.font_name}
                  onChange={(e) => updateStyleField('font_name', e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-slate-200"
                >
                  <option value="Noto Sans Sinhala">Noto Sans Sinhala</option>
                  <option value="Sinhala Sangam MN">Sinhala Sangam</option>
                  <option value="Iskoola Pota">Iskoola Pota</option>
                  <option value="Arial Unicode MS">Arial Unicode</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Font Size</span>
                  <span className="font-mono text-indigo-400">{subtitleStyling.font_size}px</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="44"
                  value={subtitleStyling.font_size}
                  onChange={(e) => updateStyleField('font_size', parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Text Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={subtitleStyling.text_color}
                      onChange={(e) => updateStyleField('text_color', e.target.value)}
                      className="w-7 h-7 rounded border border-border bg-transparent cursor-pointer"
                    />
                    <span className="font-mono text-slate-300">{subtitleStyling.text_color}</span>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Outline Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={subtitleStyling.outline_color}
                      onChange={(e) => updateStyleField('outline_color', e.target.value)}
                      className="w-7 h-7 rounded border border-border bg-transparent cursor-pointer"
                    />
                    <span className="font-mono text-slate-300">{subtitleStyling.outline_color}</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Outline Stroke</span>
                  <span className="font-mono text-indigo-400">{subtitleStyling.outline_width}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={subtitleStyling.outline_width}
                  onChange={(e) => updateStyleField('outline_width', parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-slate-400 mb-1">
                  <span>Background Box Opacity</span>
                  <span className="font-mono text-indigo-400">
                    {Math.round(subtitleStyling.background_opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={subtitleStyling.background_opacity}
                  onChange={(e) => updateStyleField('background_opacity', parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              {/* Position & Alignment */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <label className="text-slate-400 block mb-1">Vertical</label>
                  <div className="flex gap-1">
                    {(['top', 'middle', 'bottom'] as const).map((pos) => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => updateStyleField('position', pos)}
                        className={`flex-1 py-1 rounded capitalize text-center ${
                          subtitleStyling.position === pos
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'bg-surface-elevated text-slate-400'
                        }`}
                      >
                        {pos}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Alignment</label>
                  <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => updateStyleField('alignment', align)}
                        className={`flex-1 py-1 rounded capitalize text-center ${
                          subtitleStyling.alignment === align
                            ? 'bg-indigo-600 text-white font-semibold'
                            : 'bg-surface-elevated text-slate-400'
                        }`}
                      >
                        {align[0].toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIDEO CLIP PROPERTIES */}
        {isVideoSelected && selectedClip && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Clip Name
              </span>
              <p className="font-semibold text-white">{selectedClip.name}</p>
            </div>

            {/* Volume */}
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Clip Volume</span>
                <span className="font-mono text-indigo-400">
                  {Math.round(selectedClip.volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={selectedClip.volume}
                onChange={(e) => onUpdateClipVolume(selectedClip.id, parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>

            {/* Speed Presets */}
            <div>
              <label className="text-slate-400 block mb-1.5">Playback Speed</label>
              <div className="grid grid-cols-4 gap-1">
                {[0.5, 1.0, 1.5, 2.0].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => onUpdateClipSpeed(selectedClip.id, spd)}
                    className={`py-1.5 rounded text-center font-mono ${
                      selectedClip.playback_rate === spd
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-surface-elevated text-slate-400 hover:text-white'
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Scale */}
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Scale</span>
                <span className="font-mono text-indigo-400">
                  {Math.round((selectedClip.transform?.scale || 1.0) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.05"
                value={selectedClip.transform?.scale || 1.0}
                onChange={(e) =>
                  onUpdateClipTransform(selectedClip.id, { scale: parseFloat(e.target.value) })
                }
                className="w-full accent-indigo-500"
              />
            </div>
          </div>
        )}

        {/* TEXT OVERLAY PROPERTIES */}
        {isTextSelected && selectedClip && selectedClip.text_settings && (
          <div className="space-y-4">
            <div>
              <label className="text-slate-400 block mb-1 font-semibold">Text Content</label>
              <textarea
                rows={3}
                value={selectedClip.text_settings.content}
                onChange={(e) => onUpdateTextSettings(selectedClip.id, { content: e.target.value })}
                className="w-full p-2 text-xs rounded-lg bg-surface border border-border text-white sinhala-text focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
                placeholder="පෙළ ඇතුලත් කරන්න..."
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Font Size</span>
                <span className="font-mono text-indigo-400">
                  {selectedClip.text_settings.font_size}px
                </span>
              </div>
              <input
                type="range"
                min="16"
                max="64"
                value={selectedClip.text_settings.font_size}
                onChange={(e) =>
                  onUpdateTextSettings(selectedClip.id, { font_size: parseInt(e.target.value, 10) })
                }
                className="w-full accent-indigo-500"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedClip.text_settings.text_color}
                  onChange={(e) =>
                    onUpdateTextSettings(selectedClip.id, { text_color: e.target.value })
                  }
                  className="w-7 h-7 rounded border border-border bg-transparent cursor-pointer"
                />
                <span className="font-mono text-slate-300">
                  {selectedClip.text_settings.text_color}
                </span>
              </div>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Entry Animation</label>
              <select
                value={selectedClip.text_settings.animation}
                onChange={(e) =>
                  onUpdateTextSettings(selectedClip.id, { animation: e.target.value as any })
                }
                className="w-full px-2.5 py-1.5 rounded-lg bg-surface-elevated border border-border text-slate-200"
              >
                <option value="none">None (Cut)</option>
                <option value="fade">Fade In</option>
                <option value="slide_up">Slide Up</option>
                <option value="pop">Pop Scale In</option>
              </select>
            </div>
          </div>
        )}

        {/* AUDIO CLIP PROPERTIES */}
        {isAudioSelected && selectedClip && (
          <div className="space-y-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Audio Track
              </span>
              <p className="font-semibold text-white">{selectedClip.name}</p>
            </div>

            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Volume</span>
                <span className="font-mono text-indigo-400">
                  {Math.round(selectedClip.volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={selectedClip.volume}
                onChange={(e) => onUpdateClipVolume(selectedClip.id, parseFloat(e.target.value))}
                className="w-full accent-indigo-500"
              />
            </div>
          </div>
        )}

        {!isSubtitleSelected && !isVideoSelected && !isTextSelected && !isAudioSelected && (
          <div className="text-center py-12 text-slate-500">
            <Layers className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Select a clip or subtitle on the timeline to edit its properties.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
