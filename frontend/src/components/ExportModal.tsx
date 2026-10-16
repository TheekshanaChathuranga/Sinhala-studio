'use client';

import React, { useState } from 'react';
import { Download, FileText, Video, Film, CheckCircle2, Loader2, X } from 'lucide-react';
import { requestExport, getExportStatus, getExportDownloadUrl } from '@/lib/api';
import { SubtitleStyling, ExportJob } from '@/lib/types';

interface ExportModalProps {
  projectId: string;
  projectTitle: string;
  styling: SubtitleStyling;
  isOpen: boolean;
  onClose: () => void;
}

export default function ExportModal({
  projectId,
  projectTitle,
  styling,
  isOpen,
  onClose,
}: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<string>('srt');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const formats = [
    {
      id: 'srt',
      name: 'SubRip Subtitles (.srt)',
      desc: 'Standard subtitle file compatible with VLC, YouTube, media players.',
      icon: FileText,
      badge: 'Fast',
    },
    {
      id: 'vtt',
      name: 'WebVTT Subtitles (.vtt)',
      desc: 'Web standard for HTML5 video tags and web players.',
      icon: FileText,
      badge: 'Fast',
    },
    {
      id: 'txt',
      name: 'Plain Text Transcript (.txt)',
      desc: 'Sinhala text transcript with timestamp markers.',
      icon: FileText,
      badge: 'Fast',
    },
    {
      id: 'mp4_hardcoded',
      name: 'Burn-in Subtitles Video (.mp4)',
      desc: 'Permanently burns Sinhala subtitles into the video frames with Noto Sans Sinhala font.',
      icon: Film,
      badge: 'FFmpeg',
    },
    {
      id: 'mp4_soft',
      name: 'Soft-subtitled Video (.mp4)',
      desc: 'Muxes Sinhala subtitle track into the MP4 container as a switchable stream.',
      icon: Video,
      badge: 'FFmpeg',
    },
  ];

  const handleStartExport = async () => {
    setIsExporting(true);
    setError(null);
    setExportJob(null);

    try {
      const job = await requestExport(projectId, selectedFormat, styling);
      setExportJob(job);

      // If already completed (SRT, VTT, TXT are synchronous)
      if (job.status === 'completed') {
        setIsExporting(false);
        // Trigger browser download
        if (job.download_url) {
          window.open(job.download_url, '_blank');
        }
        return;
      }

      // For long video exports, poll status
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
            setError(updated.error_message || 'Video export failed.');
          }
        } catch (err: any) {
          clearInterval(pollInterval);
          setIsExporting(false);
          setError(err.message);
        }
      }, 2000);
    } catch (err: any) {
      setIsExporting(false);
      setError(err.message || 'Export request failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-panel w-full max-w-xl rounded-2xl p-6 border border-border shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isExporting}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
          <Download className="w-5 h-5 text-indigo-400" />
          <span>Export Sinhala Subtitles</span>
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          Export subtitles for <span className="text-slate-200 font-medium">{projectTitle}</span> in your desired format.
        </p>

        {/* Format Selection */}
        <div className="space-y-2 mb-6">
          {formats.map((fmt) => {
            const Icon = fmt.icon;
            const isSelected = selectedFormat === fmt.id;
            return (
              <label
                key={fmt.id}
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-sm'
                    : 'border-border/60 bg-surface/50 hover:bg-surface-elevated'
                }`}
              >
                <input
                  type="radio"
                  name="exportFormat"
                  value={fmt.id}
                  checked={isSelected}
                  onChange={() => setSelectedFormat(fmt.id)}
                  className="mt-1 accent-indigo-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-200">{fmt.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700">
                      {fmt.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">{fmt.desc}</p>
                </div>
              </label>
            );
          })}
        </div>

        {/* Progress or Error display */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/60 border border-rose-800/50 text-xs text-rose-300">
            {error}
          </div>
        )}

        {isExporting && exportJob && (
          <div className="mb-4 p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/40 space-y-2">
            <div className="flex items-center justify-between text-xs text-indigo-200">
              <span className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span>Processing video export with FFmpeg...</span>
              </span>
              <span className="font-mono">{Math.round(exportJob.progress)}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${exportJob.progress}%` }}
              />
            </div>
          </div>
        )}

        {exportJob?.status === 'completed' && !isExporting && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/40 flex items-center justify-between text-xs text-emerald-300">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Export ready: {exportJob.output_filename}</span>
            </span>
            <a
              href={exportJob.download_url || '#'}
              download
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
            >
              Download
            </a>
          </div>
        )}

        {/* Footer Actions */}
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
            onClick={handleStartExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Export & Download</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
