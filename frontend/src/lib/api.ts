import {
  Project,
  ProjectListItem,
  SubtitleCue,
  ProcessingJob,
  ExportJob,
  TimelineValidation,
  SubtitleStyling,
  MediaAsset,
  TimelineData,
  AspectRatio,
} from './types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/v1';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}

export async function createProject(data: {
  title?: string;
  aspect_ratio?: AspectRatio;
  source_language?: string;
  target_language?: string;
  translation_style?: string;
  preserve_technical_terms?: boolean;
}): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create project');
  return res.json();
}

export async function uploadMedia(
  projectId: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<Project> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.open('POST', `${API_BASE}/projects/${projectId}/upload`);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        try {
          const errData = JSON.parse(xhr.responseText);
          reject(new Error(errData.detail || 'Upload failed'));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during media upload.'));
    xhr.send(formData);
  });
}

export async function addProjectAsset(
  projectId: string,
  file: File
): Promise<MediaAsset> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/projects/${projectId}/assets`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to upload asset' }));
    throw new Error(err.detail);
  }
  return res.json();
}

export async function listProjectAssets(projectId: string): Promise<MediaAsset[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/assets`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to list assets');
  return res.json();
}

export async function deleteProjectAsset(projectId: string, assetId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/assets/${assetId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete asset');
}

export async function updateProjectTimeline(
  projectId: string,
  timelineData: TimelineData,
  aspectRatio?: AspectRatio
): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/timeline`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeline_data: timelineData,
      aspect_ratio: aspectRatio || timelineData.aspect_ratio,
    }),
  });
  if (!res.ok) throw new Error('Failed to update timeline');
  return res.json();
}

export async function generateSubtitles(
  projectId: string,
  options?: {
    source_language?: string;
    target_language?: string;
    translation_style?: string;
    preserve_technical_terms?: boolean;
    asr_model?: string;
    max_chars_per_line?: number;
    max_lines?: number;
  }
): Promise<ProcessingJob> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to start generation' }));
    throw new Error(err.detail);
  }
  return res.json();
}

export async function getProject(projectId: string): Promise<Project> {
  const res = await fetch(`${API_BASE}/projects/${projectId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch project');
  return res.json();
}

export async function listProjects(): Promise<ProjectListItem[]> {
  const res = await fetch(`${API_BASE}/projects`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to list projects');
  return res.json();
}

export async function deleteProject(projectId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${projectId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete project');
}

export async function getJobStatus(jobId: string): Promise<ProcessingJob> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to check job status');
  return res.json();
}

export async function addCue(
  projectId: string,
  cue: {
    sequence_number: number;
    start_time: number;
    end_time: number;
    source_text: string;
    sinhala_text: string;
  }
): Promise<SubtitleCue> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/subtitles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cue),
  });
  if (!res.ok) throw new Error('Failed to add subtitle cue');
  return res.json();
}

export async function updateCue(
  projectId: string,
  cueId: string,
  data: Partial<SubtitleCue>
): Promise<SubtitleCue> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/subtitles/${cueId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update subtitle cue');
  return res.json();
}

export async function deleteCue(projectId: string, cueId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/subtitles/${cueId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete subtitle cue');
}

export async function validateTimeline(projectId: string): Promise<TimelineValidation> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/validate`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to validate timeline');
  return res.json();
}

export async function requestExport(
  projectId: string,
  format: string,
  styling?: SubtitleStyling
): Promise<ExportJob> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, styling }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to request export' }));
    throw new Error(err.detail);
  }
  return res.json();
}

export async function renderVideoExport(
  projectId: string,
  options: {
    format?: string;
    resolution?: string;
    styling?: SubtitleStyling;
    hardcode_subtitles?: boolean;
  }
): Promise<ExportJob> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      format: options.format || 'mp4_rendered',
      resolution: options.resolution || '1080p',
      styling: options.styling,
      hardcode_subtitles: options.hardcode_subtitles !== false,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to request video render' }));
    throw new Error(err.detail);
  }
  return res.json();
}

export async function getExportStatus(exportId: string): Promise<ExportJob> {
  const res = await fetch(`${API_BASE}/exports/${exportId}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to check export status');
  return res.json();
}

export function getMediaUrl(projectId: string): string {
  return `${API_BASE}/projects/${projectId}/media`;
}

export function getExportDownloadUrl(exportId: string): string {
  return `${API_BASE}/exports/${exportId}/download`;
}

export async function convertProjectSubtitlesToSinhala(projectId: string): Promise<SubtitleCue[]> {
  const res = await fetch(`${API_BASE}/projects/${projectId}/subtitles/convert-sinhala`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    throw new Error('Failed to convert subtitles to Sinhala script');
  }
  return res.json();
}
