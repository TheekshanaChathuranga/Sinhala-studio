'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';
import Link from 'next/link';

import {
  getProject,
  getJobStatus,
  updateCue,
  addCue,
  deleteCue,
  generateSubtitles,
  addProjectAsset,
  deleteProjectAsset,
  updateProjectTimeline,
  getMediaUrl,
} from '@/lib/api';
import {
  Project,
  SubtitleCue,
  MediaAsset,
  TimelineTrack,
  TimelineClip,
  SubtitleStyling,
  AspectRatio,
  ClipTransform,
  TextOverlaySettings,
} from '@/lib/types';
import { SUBTITLE_PRESETS, TEXT_OVERLAY_PRESETS } from '@/lib/presets';

import EditorNavbar from '@/components/editor/EditorNavbar';
import LeftSidebar from '@/components/editor/LeftSidebar';
import PreviewPlayer, { PreviewPlayerRef } from '@/components/editor/PreviewPlayer';
import PropertiesPanel from '@/components/editor/PropertiesPanel';
import TimelineEditor from '@/components/editor/TimelineEditor';
import VideoExportModal from '@/components/editor/VideoExportModal';

export default function SinhalaStudioEditorPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const playerRef = useRef<PreviewPlayerRef | null>(null);

  // Project state
  const [project, setProject] = useState<Project | null>(null);
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [tracks, setTracks] = useState<TimelineTrack[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [durationMs, setDurationMs] = useState<number>(10000);

  // Playhead & Playback state
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  // Selection state
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [selectedCueId, setSelectedCueId] = useState<string | null>(null);

  // Subtitle styling
  const [subtitleStyling, setSubtitleStyling] = useState<SubtitleStyling>(
    SUBTITLE_PRESETS[0].styling
  );

  // Editor states
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGeneratingSubtitles, setIsGeneratingSubtitles] = useState<boolean>(false);
  const [subtitlesJobStatus, setSubtitlesJobStatus] = useState<string>('idle');
  const [subtitlesJobProgress, setSubtitlesJobProgress] = useState<number>(0);
  const [subtitlesJobMessage, setSubtitlesJobMessage] = useState<string>('');
  const [subtitlesMetrics, setSubtitlesMetrics] = useState<Record<string, any> | undefined>(undefined);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // Undo / Redo history stacks
  const [undoStack, setUndoStack] = useState<TimelineTrack[][]>([]);
  const [redoStack, setRedoStack] = useState<TimelineTrack[][]>([]);

  // 1. Initial Load
  const fetchProjectData = async () => {
    try {
      const data = await getProject(projectId);
      setProject(data);
      setAssets(data.assets || []);
      setCues(data.cues || []);

      const timeline = data.timeline_data;
      if (timeline && timeline.tracks) {
        setTracks(timeline.tracks);
        setAspectRatio(data.aspect_ratio || timeline.aspect_ratio || '16:9');
        setDurationMs(timeline.duration_ms || Math.round(data.media_duration * 1000) || 10000);
        if (timeline.subtitle_styling) {
          setSubtitleStyling(timeline.subtitle_styling);
        }
      } else {
        // Build initial tracks from uploaded media
        const dur = Math.round(data.media_duration * 1000) || 10000;
        setDurationMs(dur);
        const defaultTracks: TimelineTrack[] = [
          {
            id: 'track_text',
            type: 'text',
            name: 'Text & Titles',
            order: 0,
            muted: false,
            visible: true,
            locked: false,
            clips: [],
          },
          {
            id: 'track_video_main',
            type: 'video',
            name: 'Main Video',
            order: 1,
            muted: false,
            visible: true,
            locked: false,
            clips: data.stored_filename
              ? [
                  {
                    id: `clip_init_${data.id.substring(0, 6)}`,
                    name: data.original_filename || 'Main Clip',
                    type: 'video',
                    timeline_start_ms: 0,
                    duration_ms: dur,
                    source_start_ms: 0,
                    source_end_ms: dur,
                    playback_rate: 1.0,
                    volume: 1.0,
                    transform: { scale: 1.0, x: 0.0, y: 0.0, rotation: 0.0, opacity: 1.0 },
                  },
                ]
              : [],
          },
          {
            id: 'track_video_overlay',
            type: 'overlay',
            name: 'Overlay / B-Roll',
            order: 2,
            muted: false,
            visible: true,
            locked: false,
            clips: [],
          },
          {
            id: 'track_audio',
            type: 'audio',
            name: 'Background Audio',
            order: 3,
            muted: false,
            visible: true,
            locked: false,
            clips: [],
          },
        ];
        setTracks(defaultTracks);
      }
      setIsLoading(false);
      return data;
    } catch (err) {
      console.error('Failed to load project:', err);
      setIsLoading(false);
      return null;
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  // Push to undo stack
  const recordHistory = (newTracks: TimelineTrack[]) => {
    setUndoStack((prev) => [...prev.slice(-25), tracks]);
    setRedoStack([]);
  };

  // 2. Debounced Autosave
  useEffect(() => {
    if (!project || isLoading) return;

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await updateProjectTimeline(
          projectId,
          {
            aspect_ratio: aspectRatio,
            duration_ms: durationMs,
            tracks,
            subtitle_styling: subtitleStyling,
          },
          aspectRatio
        );
        setSaveStatus('saved');
      } catch (err) {
        console.error('Autosave error:', err);
        setSaveStatus('error');
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [tracks, aspectRatio, durationMs, subtitleStyling]);

  // Undo / Redo
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, tracks]);
    setTracks(previous);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, tracks]);
    setTracks(next);
  };

  // Add Asset to Timeline
  const handleAddAssetToTimeline = (asset: MediaAsset) => {
    recordHistory(tracks);
    const assetDurationMs = Math.round(asset.duration * 1000) || 5000;
    const isAudio = asset.asset_type === 'audio';
    const targetTrackType = isAudio ? 'audio' : 'video';

    setTracks((prev) =>
      prev.map((track) => {
        if (track.type === targetTrackType) {
          const lastClip = track.clips[track.clips.length - 1];
          const startMs = lastClip ? lastClip.timeline_start_ms + lastClip.duration_ms : 0;
          const newClip: TimelineClip = {
            id: `clip_${Date.now()}`,
            asset_id: asset.id,
            name: asset.name,
            type: isAudio ? 'audio' : 'video',
            timeline_start_ms: startMs,
            duration_ms: assetDurationMs,
            source_start_ms: 0,
            source_end_ms: assetDurationMs,
            playback_rate: 1.0,
            volume: 1.0,
            transform: { scale: 1.0, x: 0.0, y: 0.0, rotation: 0.0, opacity: 1.0 },
          };
          return { ...track, clips: [...track.clips, newClip] };
        }
        return track;
      })
    );

    setDurationMs((prev) => Math.max(prev, currentTimeMs + assetDurationMs));
  };

  // Add Text Title Preset
  const handleAddTextPreset = (presetId: string) => {
    const preset = TEXT_OVERLAY_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    recordHistory(tracks);
    const newClip: TimelineClip = {
      id: `text_${Date.now()}`,
      name: preset.name,
      type: 'text',
      timeline_start_ms: currentTimeMs,
      duration_ms: 3500,
      source_start_ms: 0,
      source_end_ms: 3500,
      playback_rate: 1.0,
      volume: 1.0,
      text_settings: { ...preset.defaultSettings },
    };

    setTracks((prev) =>
      prev.map((track) => {
        if (track.type === 'text') {
          return { ...track, clips: [...track.clips, newClip] };
        }
        return track;
      })
    );
    setSelectedClipId(newClip.id);
  };

  // Upload Asset
  const handleUploadAsset = async (file: File) => {
    const created = await addProjectAsset(projectId, file);
    setAssets((prev) => [created, ...prev]);
    handleAddAssetToTimeline(created);
  };

  // Delete Asset
  const handleDeleteAsset = async (assetId: string) => {
    await deleteProjectAsset(projectId, assetId);
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
  };

  // Split Clip at Playhead
  const handleSplitAtPlayhead = () => {
    if (!selectedClipId) return;

    let targetTrack: TimelineTrack | null = null;
    let targetClip: TimelineClip | null = null;

    for (const t of tracks) {
      const c = t.clips.find((clip) => clip.id === selectedClipId);
      if (c) {
        targetTrack = t;
        targetClip = c;
        break;
      }
    }

    if (!targetTrack || !targetClip) return;

    const clipStart = targetClip.timeline_start_ms;
    const clipEnd = clipStart + targetClip.duration_ms;

    // Check if playhead is strictly inside the clip
    if (currentTimeMs <= clipStart + 200 || currentTimeMs >= clipEnd - 200) {
      alert('Move the playhead inside the selected clip to split it.');
      return;
    }

    recordHistory(tracks);
    const firstDuration = currentTimeMs - clipStart;
    const secondDuration = clipEnd - currentTimeMs;

    const firstClip: TimelineClip = {
      ...targetClip,
      duration_ms: firstDuration,
      source_end_ms: targetClip.source_start_ms + firstDuration,
    };

    const secondClip: TimelineClip = {
      ...targetClip,
      id: `clip_${Date.now()}`,
      timeline_start_ms: currentTimeMs,
      duration_ms: secondDuration,
      source_start_ms: targetClip.source_start_ms + firstDuration,
      source_end_ms: targetClip.source_end_ms,
    };

    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === targetTrack!.id) {
          return {
            ...t,
            clips: t.clips.flatMap((c) => (c.id === targetClip!.id ? [firstClip, secondClip] : [c])),
          };
        }
        return t;
      })
    );
    setSelectedClipId(secondClip.id);
  };

  // Delete Selected Clip
  const handleDeleteSelectedClip = () => {
    if (!selectedClipId) return;
    recordHistory(tracks);
    setTracks((prev) =>
      prev.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== selectedClipId),
      }))
    );
    setSelectedClipId(null);
  };

  // Apply Visual Effect
  const handleApplyEffect = (
    effectType: 'brightness' | 'contrast' | 'saturation' | 'blur',
    value: number
  ) => {
    recordHistory(tracks);
    setTracks((prev) =>
      prev.map((t) => {
        if (t.type === 'video') {
          return {
            ...t,
            clips: t.clips.map((clip) => {
              const currentEffects = clip.effects || [];
              const filtered = currentEffects.filter((e) => e.type !== effectType);
              return { ...clip, effects: [...filtered, { type: effectType, value }] };
            }),
          };
        }
        return t;
      })
    );
  };

  // Generate Subtitles AI Pipeline with Real-Time Progress & Telemetry
  const handleGenerateSubtitles = async () => {
    setIsGeneratingSubtitles(true);
    setSubtitlesJobStatus('processing');
    setSubtitlesJobProgress(10);
    setSubtitlesJobMessage('Initializing AI pipeline...');

    try {
      const job = await generateSubtitles(projectId, {
        source_language: project?.source_language || 'si',
        target_language: 'si',
        translation_style: project?.translation_style || 'conversational',
      });

      // Poll job progress every 700ms
      const interval = setInterval(async () => {
        try {
          const jobUpdate = await getJobStatus(job.id);
          setSubtitlesJobProgress(jobUpdate.progress || 10);
          setSubtitlesJobMessage(jobUpdate.stage_message || 'Processing audio...');

          if (jobUpdate.status === 'completed' || jobUpdate.status === 'failed') {
            clearInterval(interval);
            setIsGeneratingSubtitles(false);
            setSubtitlesJobStatus(jobUpdate.status);

            if (jobUpdate.timing_metrics) {
              setSubtitlesMetrics(jobUpdate.timing_metrics);
            }

            if (jobUpdate.status === 'completed') {
              const updatedProject = await getProject(projectId);
              setCues(updatedProject.cues || []);
            } else if (jobUpdate.status === 'failed') {
              alert(jobUpdate.error_message || 'Subtitle generation failed');
            }
          }
        } catch (e) {
          console.error('Job polling error:', e);
        }
      }, 700);
    } catch (err: any) {
      setIsGeneratingSubtitles(false);
      setSubtitlesJobStatus('failed');
      alert(err.message || 'Failed to start AI subtitle generation.');
    }
  };

  // Active items at current playhead
  const activeSubtitle = cues.find(
    (c) => currentTimeMs >= c.start_time && currentTimeMs <= c.end_time
  );

  const activeTextOverlays = tracks
    .filter((t) => t.type === 'text')
    .flatMap((t) => t.clips)
    .filter(
      (c) =>
        currentTimeMs >= c.timeline_start_ms &&
        currentTimeMs <= c.timeline_start_ms + c.duration_ms
    );

  // Selected object lookup
  const selectedClip = tracks
    .flatMap((t) => t.clips)
    .find((c) => c.id === selectedClipId) || null;

  const selectedCue = cues.find((c) => c.id === selectedCueId) || null;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-xs text-slate-400">Loading Sinhala Studio Editor...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-2xl text-center max-w-md">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white">Project Not Found</h2>
          <Link
            href="/projects"
            className="mt-4 inline-block px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* 1. Top CapCut Toolbar */}
      <EditorNavbar
        projectTitle={project.title || 'Untitled Project'}
        aspectRatio={aspectRatio}
        saveStatus={saveStatus}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onTitleChange={(title) => setProject({ ...project, title })}
        onAspectRatioChange={setAspectRatio}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onOpenExport={() => setIsExportOpen(true)}
      />

      {/* 2. Main Middle Workspace: Left Sidebar + Center Monitor + Right Properties */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <LeftSidebar
          assets={assets}
          cues={cues}
          isGeneratingSubtitles={isGeneratingSubtitles}
          subtitlesJobStatus={subtitlesJobStatus}
          subtitlesJobProgress={subtitlesJobProgress}
          subtitlesJobMessage={subtitlesJobMessage}
          subtitlesMetrics={subtitlesMetrics}
          onUploadAsset={handleUploadAsset}
          onDeleteAsset={handleDeleteAsset}
          onAddAssetToTimeline={handleAddAssetToTimeline}
          onAddTextPreset={handleAddTextPreset}
          onGenerateSubtitles={handleGenerateSubtitles}
          onSelectCue={(cueId, timeMs) => {
            setSelectedCueId(cueId);
            setSelectedClipId(null);
            setCurrentTimeMs(timeMs);
            playerRef.current?.seekTo(timeMs);
          }}
          onApplyEffect={handleApplyEffect}
        />

        {/* Center Preview Player Canvas */}
        <PreviewPlayer
          ref={playerRef}
          mediaUrl={getMediaUrl(project.id)}
          aspectRatio={aspectRatio}
          currentTimeMs={currentTimeMs}
          durationMs={durationMs}
          isPlaying={isPlaying}
          activeSubtitle={activeSubtitle}
          activeTextOverlays={activeTextOverlays}
          subtitleStyling={subtitleStyling}
          onTimeUpdate={(ms) => setCurrentTimeMs(ms)}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
        />

        {/* Right Properties Inspector */}
        <PropertiesPanel
          selectedClip={selectedClip}
          selectedCue={selectedCue}
          subtitleStyling={subtitleStyling}
          onUpdateSubtitleStyling={setSubtitleStyling}
          onUpdateSelectedCue={async (cueId, text) => {
            setCues((prev) => prev.map((c) => (c.id === cueId ? { ...c, sinhala_text: text } : c)));
            await updateCue(projectId, cueId, { sinhala_text: text });
          }}
          onUpdateClipTransform={(clipId, transform) => {
            setTracks((prev) =>
              prev.map((t) => ({
                ...t,
                clips: t.clips.map((c) =>
                  c.id === clipId ? { ...c, transform: { ...(c.transform || {} as any), ...transform } } : c
                ),
              }))
            );
          }}
          onUpdateClipSpeed={(clipId, speed) => {
            setTracks((prev) =>
              prev.map((t) => ({
                ...t,
                clips: t.clips.map((c) => (c.id === clipId ? { ...c, playback_rate: speed } : c)),
              }))
            );
          }}
          onUpdateClipVolume={(clipId, volume) => {
            setTracks((prev) =>
              prev.map((t) => ({
                ...t,
                clips: t.clips.map((c) => (c.id === clipId ? { ...c, volume } : c)),
              }))
            );
          }}
          onUpdateTextSettings={(clipId, settings) => {
            setTracks((prev) =>
              prev.map((t) => ({
                ...t,
                clips: t.clips.map((c) =>
                  c.id === clipId
                    ? { ...c, text_settings: { ...(c.text_settings || {} as any), ...settings } }
                    : c
                ),
              }))
            );
          }}
        />
      </div>

      {/* 3. Bottom Multi-Track Timeline */}
      <TimelineEditor
        tracks={tracks}
        cues={cues}
        currentTimeMs={currentTimeMs}
        durationMs={durationMs}
        selectedClipId={selectedClipId}
        onSeek={(ms) => {
          setCurrentTimeMs(ms);
          playerRef.current?.seekTo(ms);
        }}
        onSelectClip={(clip) => {
          setSelectedClipId(clip ? clip.id : null);
          setSelectedCueId(null);
        }}
        onSelectCue={(cue) => {
          setSelectedCueId(cue.id);
          setSelectedClipId(null);
          setCurrentTimeMs(cue.start_time);
          playerRef.current?.seekTo(cue.start_time);
        }}
        onSplitAtPlayhead={handleSplitAtPlayhead}
        onDeleteSelectedClip={handleDeleteSelectedClip}
        onToggleTrackMute={(trackId) => {
          setTracks((prev) =>
            prev.map((t) => (t.id === trackId ? { ...t, muted: !t.muted } : t))
          );
        }}
        onToggleTrackVisible={(trackId) => {
          setTracks((prev) =>
            prev.map((t) => (t.id === trackId ? { ...t, visible: !t.visible } : t))
          );
        }}
      />

      {/* 4. Export Video Modal */}
      <VideoExportModal
        projectId={project.id}
        projectTitle={project.title || 'Untitled Project'}
        aspectRatio={aspectRatio}
        subtitleStyling={subtitleStyling}
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
}
