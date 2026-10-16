'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  UploadCloud,
  FileVideo,
  FileAudio,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Sparkles,
  Loader2,
  ArrowRight,
  Monitor,
  Smartphone,
  Square,
  Film,
} from 'lucide-react';
import { createProject, uploadMedia, generateSubtitles } from '@/lib/api';
import { AspectRatio } from '@/lib/types';
import { formatBytes } from '@/lib/utils';

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectTitle, setProjectTitle] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [sourceLanguage, setSourceLanguage] = useState<string>('auto');
  const [translationStyle, setTranslationStyle] = useState<string>('conversational');
  const [preserveTechTerms, setPreserveTechTerms] = useState<boolean>(true);
  const [generateSubtitlesNow, setGenerateSubtitlesNow] = useState<boolean>(true);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const aspectOptions: { id: AspectRatio; name: string; desc: string; icon: any }[] = [
    { id: '16:9', name: '16:9 Landscape', desc: 'YouTube, Web, TV', icon: Monitor },
    { id: '9:16', name: '9:16 Vertical', desc: 'TikTok, Shorts, Reels', icon: Smartphone },
    { id: '1:1', name: '1:1 Square', desc: 'Instagram Feed', icon: Square },
    { id: '4:5', name: '4:5 Portrait', desc: 'Social Media', icon: Smartphone },
  ];

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    if (!projectTitle) {
      const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setProjectTitle(nameWithoutExt);
    }
    setErrorMessage(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMessage('Please select a video or audio file to begin editing.');
      return;
    }

    setIsUploading(true);
    setUploadPercent(0);
    setProcessingStage('Initializing Sinhala Studio project...');
    setErrorMessage(null);

    try {
      // 1. Create Project with aspect ratio
      const project = await createProject({
        title: projectTitle || selectedFile.name,
        aspect_ratio: aspectRatio,
        source_language: sourceLanguage,
        target_language: 'si',
        translation_style: translationStyle,
        preserve_technical_terms: preserveTechTerms,
      });

      // 2. Upload Media
      setProcessingStage('Uploading media asset to server...');
      await uploadMedia(project.id, selectedFile, (pct) => {
        setUploadPercent(pct);
      });

      // 3. Optional Subtitles Generation
      if (generateSubtitlesNow) {
        setProcessingStage('Running speech recognition & Sinhala translation...');
        await generateSubtitles(project.id, {
          source_language: sourceLanguage,
          target_language: 'si',
          translation_style: translationStyle,
          preserve_technical_terms: preserveTechTerms,
        });
      }

      // 4. Redirect to Sinhala Studio editor
      router.push(`/projects/${project.id}`);
    } catch (err: any) {
      setIsUploading(false);
      setErrorMessage(err.message || 'An error occurred during upload.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold text-white flex items-center justify-center gap-2">
          <Film className="w-8 h-8 text-indigo-400" />
          <span>New Video Project</span>
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Upload media, select your canvas aspect ratio, and launch the CapCut-style video editing studio.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Aspect Ratio Selection */}
        <div className="glass-panel rounded-2xl p-5 border border-border">
          <label className="text-xs font-semibold text-slate-300 block mb-3">
            Canvas Aspect Ratio
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {aspectOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = aspectRatio === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAspectRatio(opt.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500/15 shadow-sm'
                      : 'border-border/60 bg-surface/50 hover:bg-surface-elevated'
                  }`}
                >
                  <Icon className="w-5 h-5 text-indigo-400 mb-1.5" />
                  <span className="font-bold text-xs text-white block">{opt.name}</span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">{opt.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Upload Dropzone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            selectedFile
              ? 'border-indigo-500 bg-indigo-500/5'
              : 'border-border/80 hover:border-indigo-500/60 bg-surface/40 hover:bg-surface/80'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,audio/*,.mp4,.mov,.mkv,.webm,.mp3,.wav,.m4a,.aac,.flac,.ogg"
            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            className="hidden"
          />

          {selectedFile ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                {selectedFile.type.startsWith('video') ? (
                  <FileVideo className="w-7 h-7" />
                ) : (
                  <FileAudio className="w-7 h-7" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">{selectedFile.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatBytes(selectedFile.size)} • Click to choose a different file
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Media ready for studio</span>
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-surface-elevated text-indigo-400 flex items-center justify-center border border-border">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-semibold text-white text-base">
                  Drag and drop your primary video or audio file
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Supports MP4, MOV, MKV, WebM, MP3, WAV up to 500MB
                </p>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-elevated hover:bg-slate-800 text-slate-200 border border-border transition-colors mt-2"
              >
                Browse Files
              </button>
            </div>
          )}
        </div>

        {/* Project & AI Configuration */}
        <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Project Title
              </label>
              <input
                type="text"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
                placeholder="My Sinhala Studio Project"
                className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Spoken Language */}
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Spoken Language
              </label>
              <select
                value={sourceLanguage}
                onChange={(e) => setSourceLanguage(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="auto">Auto-Detect Language</option>
                <option value="en">English</option>
                <option value="si">Sinhala (සිංහල)</option>
                <option value="hi">Hindi (हिन्दी)</option>
                <option value="ta">Tamil (தமிழ்)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={generateSubtitlesNow}
                onChange={(e) => setGenerateSubtitlesNow(e.target.checked)}
                className="rounded accent-indigo-500 w-4 h-4"
              />
              <span className="text-xs text-slate-300">
                Automatically generate Sinhala subtitles upon project opening
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={preserveTechTerms}
                onChange={(e) => setPreserveTechTerms(e.target.checked)}
                className="rounded accent-indigo-500 w-4 h-4"
              />
              <span className="text-xs text-slate-400">
                Preserve English technical terms
              </span>
            </label>
          </div>
        </div>

        {/* Error Display */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-800/40 space-y-2">
            <div className="flex items-center justify-between text-xs text-indigo-200">
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>{processingStage}</span>
              </span>
              <span className="font-mono">{uploadPercent}%</span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${uploadPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!selectedFile || isUploading}
            className="flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-600/30 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Opening Studio...</span>
              </>
            ) : (
              <>
                <Film className="w-4 h-4" />
                <span>Open in Sinhala Studio</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
