import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  timeout: 120000
});

interface ClipData { start: number; end: number; }

export const youtube = {
  extract: (url: string) => api.post("/youtube/extract", { url }),
  transcribe: (projectId: string) => api.post(`/youtube/transcribe/${projectId}`),
  getTranscriptionStatus: (projectId: string) => api.get(`/youtube/transcription-status/${projectId}`)
};

export const ai = {
  summarize: (projectId: string, style: string) => api.post("/ai/summarize", { project_id: projectId, style }),
  ask: (projectId: string, question: string) => api.post("/ai/ask", { project_id: projectId, question }),
  script: (projectId: string, duration: number) => api.post("/ai/script", { project_id: projectId, duration_seconds: duration }),
  generateYoutubeInfo: (projectId: string, script: string) => api.post("/ai/youtube-info", { project_id: projectId, script })
};

export const clips = {
  extract: (projectId: string, clipsData: ClipData[]) => api.post("/clips/extract", { project_id: projectId, clips: clipsData })
};

export const voice = {
  generateSegment: (projectId: string, segmentIndex: number, text: string, voiceId: string, speed: number = 1.0, stability: number = 0.5) =>
    api.post("/voice/generate-segment", { project_id: projectId, segment_index: segmentIndex, text, voice: voiceId, speed, stability }),
  
  mergeSegments: (projectId: string, segmentCount: number) =>
    api.post("/voice/merge-segments", { project_id: projectId, segment_count: segmentCount }),
  
  checkExistingSegments: (projectId: string) => api.get(`/voice/check-segments/${projectId}`),
  
  preview: (projectId: string, t?: number) => `${api.defaults.baseURL}/voice/preview/${projectId}?t=${t || Date.now()}`,
  previewSegment: (projectId: string, index: number, t?: number) => `${api.defaults.baseURL}/voice/preview-segment/${projectId}/${index}?t=${t || Date.now()}`,
  listVoices: () => api.get("/voice/voices")
};

export const video = {
  downloadSource: (projectId: string) => api.post("/video/download-source", { project_id: projectId }),
  extractClip: (projectId: string, index: number, start: number, end: number) =>
    api.post("/video/extract-clip", { project_id: projectId, index, start, end }),
  previewClip: (projectId: string, index: number, t?: number) => `${api.defaults.baseURL}/video/preview-clip/${projectId}/${index}?t=${t || Date.now()}`,
  mergeWithOptions: (projectId: string, segments: any[], options: { subtitles: boolean; resize: string; bgMusic: string; bgMusicVolume: number }) =>
    api.post("/video/merge", { project_id: projectId, segments, subtitles: options.subtitles, resize: options.resize, bg_music: options.bgMusic, bg_music_volume: options.bgMusicVolume }),
  generateThumbnail: (projectId: string, script: string) => api.post("/video/thumbnail", { project_id: projectId, script }),
  getThumbnail: (projectId: string, t?: number) => `${api.defaults.baseURL}/video/thumbnail/${projectId}?t=${t || Date.now()}`,
  downloadFinal: (projectId: string) => `${api.defaults.baseURL}/video/download/${projectId}`,
  getMusicLibrary: () => api.get("/video/music-library"),
  generateMusic: (projectId: string, presetId: string) => api.post("/video/generate-music", { project_id: projectId, preset_id: presetId }),
  musicPreview: (presetId: string) => `${api.defaults.baseURL}/video/music-preview/${presetId}`
};

export const projects = {
  list: () => api.get("/projects"),
  get: (id: string) => api.get(`/projects/${id}`),
  delete: (id: string) => api.delete(`/projects/${id}`)
};

export default api;
