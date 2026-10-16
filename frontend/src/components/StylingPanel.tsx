'use client';

import React from 'react';
import { Type, Palette, Layout, Sliders } from 'lucide-react';
import { SubtitleStyling } from '@/lib/types';

interface StylingPanelProps {
  styling: SubtitleStyling;
  onChange: (updated: SubtitleStyling) => void;
}

export default function StylingPanel({ styling, onChange }: StylingPanelProps) {
  const updateField = <K extends keyof SubtitleStyling>(key: K, value: SubtitleStyling[K]) => {
    onChange({ ...styling, [key]: value });
  };

  return (
    <div className="glass-panel rounded-xl p-4 space-y-4 text-xs">
      <div className="flex items-center gap-2 pb-2 border-b border-border text-slate-300 font-semibold">
        <Sliders className="w-4 h-4 text-indigo-400" />
        <span>Subtitle Styling & Appearance</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Font Size */}
        <div>
          <label className="text-slate-400 block mb-1 flex items-center justify-between">
            <span>Font Size</span>
            <span className="text-indigo-400 font-mono">{styling.font_size}px</span>
          </label>
          <input
            type="range"
            min="14"
            max="38"
            value={styling.font_size}
            onChange={(e) => updateField('font_size', parseInt(e.target.value, 10))}
            className="w-full accent-indigo-500"
          />
        </div>

        {/* Background Opacity */}
        <div>
          <label className="text-slate-400 block mb-1 flex items-center justify-between">
            <span>Box Opacity</span>
            <span className="text-indigo-400 font-mono">{Math.round(styling.background_opacity * 100)}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={styling.background_opacity}
            onChange={(e) => updateField('background_opacity', parseFloat(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </div>

        {/* Text Color */}
        <div>
          <label className="text-slate-400 block mb-1">Text Color</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={styling.text_color}
              onChange={(e) => updateField('text_color', e.target.value)}
              className="w-7 h-7 rounded border border-border bg-transparent cursor-pointer"
            />
            <span className="font-mono text-slate-300">{styling.text_color}</span>
          </div>
        </div>

        {/* Font Family */}
        <div>
          <label className="text-slate-400 block mb-1">Font Family</label>
          <select
            value={styling.font_name}
            onChange={(e) => updateField('font_name', e.target.value)}
            className="w-full px-2 py-1.5 rounded bg-surface-elevated border border-border text-slate-200"
          >
            <option value="Noto Sans Sinhala">Noto Sans Sinhala</option>
            <option value="Sinhala Sangam MN">Sinhala Sangam</option>
            <option value="Iskoola Pota">Iskoola Pota</option>
            <option value="Arial Unicode MS">Arial Unicode</option>
          </select>
        </div>

        {/* Position */}
        <div>
          <label className="text-slate-400 block mb-1">Vertical Position</label>
          <div className="grid grid-cols-3 gap-1">
            {(['bottom', 'middle', 'top'] as const).map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => updateField('position', pos)}
                className={`py-1 rounded text-center capitalize transition-colors ${
                  styling.position === pos
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'bg-surface-elevated hover:bg-slate-800 text-slate-400'
                }`}
              >
                {pos}
              </button>
            ))}
          </div>
        </div>

        {/* Alignment */}
        <div>
          <label className="text-slate-400 block mb-1">Alignment</label>
          <div className="grid grid-cols-3 gap-1">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => updateField('alignment', align)}
                className={`py-1 rounded text-center capitalize transition-colors ${
                  styling.alignment === align
                    ? 'bg-indigo-600 text-white font-medium'
                    : 'bg-surface-elevated hover:bg-slate-800 text-slate-400'
                }`}
              >
                {align}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
