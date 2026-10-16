'use client';

import React, { useState } from 'react';
import {
  Download,
  Film,
  FileText,
  CheckCircle2,
  Loader2,
  X,
  Sparkles,
  Settings,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { renderVideoExport, requestExport, getExportStatus } from '@/lib/api';
import { AspectRatio, SubtitleStyling, ExportJob } from '@/lib/types';

interface VideoExportModalProps {
  projectId: string;
  projectTitle: string;
  aspectRatio: AspectRatio;
  subtitleStyling: SubtitleStyling;
  isOpen: boolean;
  onClose: () => void;
}

export default function VideoExportModal({
  projectId,
  projectTitle,
  aspectRatio,
  subtitleStyling,
  isOpen,
  onClose,
}: VideoExportModalProps) {
  const [resolution, setResolution] = useState<'1080p' | '720p'>('1080p');
  const [hardcodeSubtitles, setHardcodeSubtitles] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleStartRender = async () => {
    setIsExporting(true);
    setError(null);
    setExportJob(null);

    try {
      const job = await renderVideoExport(projectId, {
        format: 'mp4_rendered',
        resolution,
        styling: subtitleStyling,
        hardcode_subtitles: hardcodeSubtitles,
      });
      setExportJob(job);

      // Poll status for video render
      const pollInterval = setInterval(async () => {
        try {
          const updated = await getExportStatus(job.id);
          setExportJob(updated);
          if (updated.status === 'completed') {
            clearInterval(pollInterval);
            setIsExporting(false);
            if (updated.download_url) {
              window.open(updated.download_url, '_blank');
            }
          } else if (updated.status === 'failed') {
            clearInterval(pollInterval);
            setIsExporting(false);
            setError(updated.error_message || 'Video rendering failed.');
          }
        } catch (err: any) {
          clearInterval(pollInterval);
          setIsExporting(false);
          setError(err.message);
        }
      }, 2000);
    } catch (err: any) {
      setIsExporting(false);
      setError(err.message || 'Export request failed.');
    }
  };

  const handleQuickDownloadText = async (format: 'srt' | 'vtt') => {
    try {
      const job = await requestExport(projectId, format, subtitleStyling);
      if (job.download_url) {
        window.open(job.download_url, '_blank');
      }
    } catch (err) {
      alert(`Could not export ${format.toUpperCase()}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none">
      <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-border shadow-2xl relative text-left">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isExporting}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
          <Film className="w-5 h-5 text-indigo-400" />
          <span>Export Finished Video</span>
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          Render your multi-track timeline into a production MP4 video.
        </p>

        {/* Video Settings */}
        <div className="space-y-4 mb-5">
          {/* Resolution Picker */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Export Resolution
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setResolution('1080p')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  resolution === '1080p'
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-sm'
                    : 'border-border/60 bg-surface/40 hover:bg-surface-elevated'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">1080p Full HD</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300">
                    High Quality
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {aspectRatio === '9:16' ? '1080 x 1920 (Vertical)' : '1920 x 1080 (Landscape)'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setResolution('720p')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  resolution === '720p'
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-sm'
                    : 'border-border/60 bg-surface/40 hover:bg-surface-elevated'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">720p HD</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                    Fast Render
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {aspectRatio === '9:16' ? '720 x 1280 (Vertical)' : '1280 x 720 (Landscape)'}
                </p>
              </button>
            </div>
          </div>

          {/* Subtitle Hardcoding Checkbox */}
          <div className="p-3 rounded-xl bg-surface-elevated/70 border border-border/60 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hardcodeSubtitles}
                onChange={(e) => setHardcodeSubtitles(e.target.checked)}
                className="mt-0.5 rounded accent-indigo-500 w-4 h-4"
              />
              <div>
                <span className="text-xs font-semibold text-slate-200 block">
                  Burn-in Styled Sinhala Subtitles
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  Renders Sinhala subtitles permanently onto the video frames using the selected preset and Noto Sans Sinhala font.
                </span>
              </div>
            </label>
          </div>

          {/* Separate Subtitle Downloads */}
          <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-border/40">
            <span>Also need subtitle files?</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickDownloadText('srt')}
                className="px-2.5 py-1 rounded-lg bg-surface hover:bg-slate-800 text-indigo-400 font-mono text-[11px] border border-border"
              >
                Download .SRT
              </button>
              <button
                type="button"
                onClick={() => handleQuickDownloadText('vtt')}
                className="px-2.5 py-1 rounded-lg bg-surface hover:bg-slate-800 text-indigo-400 font-mono text-[11px] border border-border"
              >
                Download .VTT
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300">
            {error}
          </div>
        )}

        {/* Real-time Render Progress */}
        {isExporting && exportJob && (
          <div className="mb-4 p-4 rounded-xl bg-indigo-950/50 border border-indigo-800/40 space-y-2.5">
            <div className="flex items-center justify-between text-xs text-indigo-200">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Rendering timeline composition with FFmpeg...</span>
              </span>
              <span className="font-mono font-bold text-white">
                {Math.round(exportJob.progress)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-indigo-400 transition-all duration-300"
                style={{ width: `${exportJob.progress}%` }}
              />
            </div>
          </div>
        )}

        {exportJob?.status === 'completed' && !isExporting && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/50 border border-emerald-800/40 flex items-center justify-between text-xs text-emerald-300">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Render Complete: {exportJob.output_filename}</span>
            </span>
            <a
              href={exportJob.download_url || '#'}
              download
              className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              Download
            </a>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartRender}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Rendering Video...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Start Video Render</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
