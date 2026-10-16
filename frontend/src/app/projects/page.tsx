'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  FolderHeart,
  Plus,
  Play,
  Download,
  Trash2,
  Clock,
  FileVideo,
  FileAudio,
  Loader2,
  Subtitles,
  Film,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { listProjects, deleteProject, requestExport } from '@/lib/api';
import { ProjectListItem } from '@/lib/types';
import { formatTimeShort, formatBytes } from '@/lib/utils';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      const data = await listProjects();
      setProjects(data);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project and all its files?')) {
      return;
    }
    setDeletingId(id);
    try {
      await deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      console.error('Failed to delete project:', err);
      alert('Failed to delete project.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleQuickDownloadSRT = async (projectId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const exportJob = await requestExport(projectId, 'srt');
      if (exportJob.download_url) {
        window.open(exportJob.download_url, '_blank');
      }
    } catch (err) {
      alert('Could not export SRT for this project.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1 flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2">
            <Film className="w-8 h-8 text-indigo-400" />
            <span>Sinhala Studio Projects</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Reopen video editing projects, resume timeline sequencing, and download exports.
          </p>
        </div>

        <Link
          href="/upload"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 text-sm transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Video Project</span>
        </Link>
      </div>

      {/* Projects List */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 glass-panel rounded-2xl text-center max-w-md mx-auto my-12">
          <Film className="w-12 h-12 text-slate-600 mb-3" />
          <h3 className="text-lg font-bold text-white">No Video Projects Yet</h3>
          <p className="text-xs text-slate-400 mt-1 mb-6">
            Create your first video project to begin editing with multi-tracks and Sinhala subtitles.
          </p>
          <Link
            href="/upload"
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Video Project</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {projects.map((proj) => {
            const isVideo = proj.media_type.startsWith('video');
            return (
              <div
                key={proj.id}
                className="glass-panel glass-panel-hover rounded-2xl p-5 border border-border flex flex-col justify-between group"
              >
                <div>
                  {/* Top Bar: Media icon + Aspect Ratio badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                        {isVideo ? <FileVideo className="w-4 h-4" /> : <FileAudio className="w-4 h-4" />}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 uppercase">
                        {proj.media_type.split('/')[1] || 'video'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                        {proj.aspect_ratio || '16:9'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                          proj.status === 'ready' || proj.status === 'uploaded'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        {proj.status}
                      </span>
                    </div>
                  </div>

                  {/* Title & filename */}
                  <h3 className="font-bold text-white text-base truncate group-hover:text-indigo-300 transition-colors">
                    {proj.title || proj.original_filename}
                  </h3>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {proj.original_filename || 'Video composition'}
                  </p>

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap items-center gap-2 mt-4 text-[11px] text-slate-400 font-mono">
                    {proj.media_duration > 0 && (
                      <span className="flex items-center gap-1 bg-surface-elevated px-2 py-1 rounded">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatTimeShort(proj.media_duration * 1000)}</span>
                      </span>
                    )}

                    {proj.file_size > 0 && (
                      <span className="bg-surface-elevated px-2 py-1 rounded">
                        {formatBytes(proj.file_size)}
                      </span>
                    )}

                    <span className="bg-surface-elevated px-2 py-1 rounded">
                      {proj.cue_count} cues
                    </span>

                    <span className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded">
                      {proj.detected_language || proj.source_language} → si
                    </span>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-2 pt-4 mt-5 border-t border-border/60">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/projects/${proj.id}`}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-colors"
                    >
                      <Film className="w-3.5 h-3.5" />
                      <span>Open Editor</span>
                    </Link>

                    {proj.cue_count > 0 && (
                      <button
                        type="button"
                        onClick={(e) => handleQuickDownloadSRT(proj.id, e)}
                        title="Download SRT Subtitles"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-elevated transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDelete(proj.id, e)}
                    disabled={deletingId === proj.id}
                    title="Delete Project"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  >
                    {deletingId === proj.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
