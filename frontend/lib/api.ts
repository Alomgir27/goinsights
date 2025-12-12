import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  timeout: 300000  // 5 mins for long video processing
});

interface ClipData { start: number; end: number; }

export const youtube = {
  extract: (url: string) => api.post("/youtube/extract", { url }),
  getAuthUrl: () => api.get("/youtube/auth-url"),
  handleCallback: (code: string) => api.post("/youtube/auth-callback", { code }),
  getChannelVideos: () => api.get("/youtube/channel-videos"),
  getSuggestions: () => api.get("/youtube/suggestions"),
  getTrendingTopics: (style: string, topic: string = "") => 
    api.get(`/youtube/trending-topics?style=${encodeURIComponent(style)}&topic=${encodeURIComponent(topic)}`),
  searchVideos: (query: string) => api.get(`/youtube/search?q=${encodeURIComponent(query)}`),
  searchChannels: (query: string) => api.get(`/youtube/channel/search?q=${encodeURIComponent(query)}`),
  getChannelById: (channelId: string) => api.get(`/youtube/channel/${channelId}/videos`),
  getPlaylists: (accessToken: string) => api.post("/youtube/playlists", { access_token: accessToken }),
  publish: (projectId: string, title: string, description: string, tags: string, privacy: string, playlistId: string | null, accessToken: string, scheduleTime: string | null = null, madeForKids: boolean = false, categoryId: string = "22") =>
    api.post("/youtube/publish", { project_id: projectId, title, description, tags, privacy, playlist_id: playlistId, access_token: accessToken, schedule_time: scheduleTime, made_for_kids: madeForKids, category_id: categoryId }),
};

export const ai = {
  summarize: (projectId: string, style: string) => api.post("/ai/summarize", { project_id: projectId, style }),
  ask: (projectId: string, question: string) => api.post("/ai/ask", { project_id: projectId, question }),
  script: (projectId: string, duration: number, language: string = "English") => 
    api.post("/ai/script", { project_id: projectId, duration_seconds: duration, language }),
  generateYoutubeInfo: (projectId: string, script: string, language: string = "English") => 
    api.post("/ai/youtube-info", { project_id: projectId, script, language }),
  suggestProject: (videoStyle: string, language: string, duration: number, topic: string = "") =>
    api.post("/ai/suggest-project", { video_style: videoStyle, language, duration, topic })
};

export const media = {
  upload: (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append("project_id", projectId);
    formData.append("file", file);
    return api.post("/media/upload", formData, { headers: { "Content-Type": "multipart/form-data" } });
  },
  getOptions: () => api.get("/media/options"),
  generateImage: (projectId: string, prompt: string, options: { model?: string; imageStyle?: string; aspectRatio?: string } = {}) =>
    api.post("/media/generate-image", { 
      project_id: projectId, prompt, 
      model: options.model || "gemini-2.5-flash",
      image_style: options.imageStyle || "cartoon",
      aspect_ratio: options.aspectRatio || "16:9"
    }),
  regenerateImage: (mediaId: string, options: { prompt?: string; model?: string; imageStyle?: string; aspectRatio?: string } = {}) =>
    api.post("/media/regenerate-image", { 
      media_id: mediaId, 
      prompt: options.prompt || "",
      model: options.model || "gemini-2.5-flash",
      image_style: options.imageStyle || "",
      aspect_ratio: options.aspectRatio || ""
    }),
  updatePrompt: (mediaId: string, prompt: string) =>
    api.patch("/media/update-prompt", { media_id: mediaId, prompt }),
  suggestPrompt: (projectId: string, segments: any[], script: string, options: { imageStyle?: string; aspectRatio?: string; promptLanguage?: string } = {}) =>
    api.post("/media/suggest-prompt", { 
      project_id: projectId, segments, script,
      image_style: options.imageStyle || "cartoon",
      aspect_ratio: options.aspectRatio || "16:9",
      prompt_language: options.promptLanguage || "en"
    }),
  generatePrompts: (projectId: string, segments: any[], count: number, options: { language?: string; existingPrompts?: string[]; imageStyle?: string; aspectRatio?: string; promptLanguage?: string } = {}) =>
    api.post("/media/generate-prompts", { 
      project_id: projectId, segments, count, 
      language: options.language || "English", 
      existing_prompts: options.existingPrompts || [],
      image_style: options.imageStyle || "cartoon",
      aspect_ratio: options.aspectRatio || "16:9",
      prompt_language: options.promptLanguage || "en"
    }),
  generateBatch: (projectId: string, segments: any[], options: { model?: string; count?: number; language?: string; imageStyle?: string; aspectRatio?: string; promptLanguage?: string } = {}) =>
    api.post("/media/generate-batch", { 
      project_id: projectId, segments, 
      model: options.model || "gemini-2.5-flash", 
      count: options.count || 0, 
      language: options.language || "English",
      image_style: options.imageStyle || "cartoon",
      aspect_ratio: options.aspectRatio || "16:9",
      prompt_language: options.promptLanguage || "en"
    }),
  imageToVideo: (projectId: string, mediaId: string, duration: number = 5, effect: string = "zoom_in") =>
    api.post("/media/image-to-video", { project_id: projectId, media_id: mediaId, duration, effect }),
  list: (projectId: string) => api.get(`/media/${projectId}`),
  getUrl: (mediaId: string) => `${api.defaults.baseURL}/media/file/${mediaId}`,
  delete: (mediaId: string) => api.delete(`/media/${mediaId}`),
  updateOrder: (projectId: string, mediaOrder: string[]) => 
    api.post("/media/update-order", { project_id: projectId, media_order: mediaOrder }),
  searchStock: (query: string, mediaType: string = "photos", orientation: string = "", page: number = 1) =>
    api.get(`/media/stock/search?query=${encodeURIComponent(query)}&media_type=${mediaType}&orientation=${orientation}&page=${page}`),
  downloadStock: (projectId: string, url: string, source: string = "pexels", mediaType: string = "image") =>
    api.post("/media/stock/download", { project_id: projectId, url, source, media_type: mediaType })
};

export const clips = {
  extract: (projectId: string, clipsData: ClipData[]) => api.post("/clips/extract", { project_id: projectId, clips: clipsData })
};

export const voice = {
  generateSegment: (projectId: string, segmentIndex: number, text: string, voiceId: string, speed: number = 1.0, stability: number = 0.5, model: string = "v2") =>
    api.post("/voice/generate-segment", { project_id: projectId, segment_index: segmentIndex, text, voice: voiceId, speed, stability, model }),
  
  mergeSegments: (projectId: string, segmentCount: number, silences: number[] = []) =>
    api.post("/voice/merge-segments", { project_id: projectId, segment_count: segmentCount, silences }),
  
  checkExistingSegments: (projectId: string) => api.get(`/voice/check-segments/${projectId}`),
  
  preview: (projectId: string, t?: number) => `${api.defaults.baseURL}/voice/preview/${projectId}?t=${t || Date.now()}`,
  previewSegment: (projectId: string, index: number, t?: number) => `${api.defaults.baseURL}/voice/preview-segment/${projectId}/${index}?t=${t || Date.now()}`,
  getVoices: () => api.get("/voice/voices"),
  demoUrl: (voiceId: string) => `${api.defaults.baseURL}/voice/voice-demo/${voiceId}`
};

export const video = {
  downloadSource: (projectId: string) => api.post("/video/download-source", { project_id: projectId }),
  extractClip: (projectId: string, index: number, start: number, end: number) =>
    api.post("/video/extract-clip", { project_id: projectId, index, start, end }),
  previewClip: (projectId: string, index: number, t?: number) => `${api.defaults.baseURL}/video/preview-clip/${projectId}/${index}?t=${t || Date.now()}`,
  mergeWithOptions: (projectId: string, segments: any[], options: { subtitles: boolean; animatedSubtitles: boolean; subtitleStyle: string; resize: string; bgMusic: string; bgMusicVolume: number }) =>
    api.post("/video/merge", { project_id: projectId, segments, subtitles: options.subtitles, animated_subtitles: options.animatedSubtitles, subtitle_style: options.subtitleStyle, resize: options.resize, bg_music: options.bgMusic, bg_music_volume: options.bgMusicVolume }),
  generateThumbnailPrompt: (projectId: string, script: string, language: string = "English", imageStyle: string = "cartoon", videoType: string = "tutorial") => 
    api.post("/video/thumbnail-prompt", { project_id: projectId, script, language, image_style: imageStyle, video_type: videoType }),
  generateThumbnailFromPrompt: (projectId: string, prompt: string, model: string = "gemini-3-pro", imageStyle: string = "cartoon", videoType: string = "tutorial", title: string = "", titlePosition: string = "") => 
    api.post("/video/thumbnail-from-prompt", { project_id: projectId, prompt, model, image_style: imageStyle, video_type: videoType, title, title_position: titlePosition }),
  uploadThumbnail: (projectId: string, file: File) => {
    const formData = new FormData();
    formData.append("project_id", projectId);
    formData.append("file", file);
    return api.post("/video/upload-thumbnail", formData, { headers: { "Content-Type": "multipart/form-data" } });
  },
  setThumbnailFromMedia: (projectId: string, mediaId: string, options?: { title?: string; fontSize?: string; fontStyle?: string; position?: string; textColor?: string; strokeColor?: string; strokeWidth?: number; effect?: string }) =>
    api.post("/video/set-thumbnail-from-media", { 
      project_id: projectId, 
      media_id: mediaId,
      title: options?.title || "",
      font_size: options?.fontSize || "medium",
      font_style: options?.fontStyle || "bold",
      position: options?.position || "bottom",
      text_color: options?.textColor || "#FFFFFF",
      stroke_color: options?.strokeColor || "#000000",
      stroke_width: options?.strokeWidth || 3,
      effect: options?.effect || "glow"
    }),
  getThumbnail: (projectId: string, t?: number) => `${api.defaults.baseURL}/video/thumbnail/${projectId}?t=${t || Date.now()}`,
  downloadFinal: (projectId: string) => `${api.defaults.baseURL}/video/download/${projectId}`,
  previewFinal: (projectId: string, t?: number) => `${api.defaults.baseURL}/video/preview/${projectId}?t=${t || Date.now()}`,
  getMusicLibrary: () => api.get("/video/music-library"),
  searchMusic: (query: string) => api.get(`/video/search-music?q=${encodeURIComponent(query)}`),
  previewSearchMusic: (videoId: string) => `${api.defaults.baseURL}/video/preview-search-music/${videoId}`,
  downloadMusic: (projectId: string, videoId: string) => api.post("/video/download-music", { project_id: projectId, video_id: videoId }),
  generateMusic: (projectId: string, presetId: string) => api.post("/video/generate-music", { project_id: projectId, preset_id: presetId }),
  musicPreview: (presetId: string) => `${api.defaults.baseURL}/video/music-preview/${presetId}`,
  createFromMedia: (projectId: string, mediaTimeline: any[], options: { subtitles: boolean; animatedSubtitles: boolean; subtitleStyle: string; subtitleSize: number; subtitlePosition?: string; dialogueMode?: boolean; speaker1Position?: string; speaker2Position?: string; dialogueBgStyle?: string; resize: string; bgMusic?: boolean; bgMusicVolume?: number }) =>
    api.post("/video/create-with-bubbles", { 
      project_id: projectId, 
      bubble_positions: [], 
      media_timeline: mediaTimeline, 
      resize: options.resize,
      subtitles: options.subtitles,
      animated_subtitles: options.animatedSubtitles,
      subtitle_style: options.subtitleStyle,
      subtitle_size: options.subtitleSize,
      subtitle_position: options.subtitlePosition || "bottom",
      dialogue_mode: options.dialogueMode || false,
      speaker1_position: options.speaker1Position || "top-left",
      speaker2_position: options.speaker2Position || "top-right",
      dialogue_bg_style: options.dialogueBgStyle || "transparent",
      bg_music: options.bgMusic || false,
      bg_music_volume: options.bgMusicVolume || 0.3
    })
};

export const projects = {
  list: () => api.get("/projects"),
  get: (id: string) => api.get(`/projects/${id}`),
  delete: (id: string) => api.delete(`/projects/${id}`),
  update: (id: string, data: { language?: string; video_style?: string }) => api.patch(`/projects/${id}`, data),
  saveSegments: (id: string, segments: any[]) => api.post(`/projects/${id}/segments`, { segments }),
  createCustom: (title: string, prompt: string = "", duration: number = 60, videoStyle: string = "dialogue", language: string = "English") =>
    api.post("/projects/custom", { title, prompt, duration, video_style: videoStyle, language })
};

export const auth = {
  login: (email: string, password: string) => api.post("/auth/login", { email, password }),
  signup: (name: string, email: string, password: string) => api.post("/auth/signup", { name, email, password }),
  me: (token: string) => api.get(`/auth/me?token=${token}`)
};

export const wikipedia = {
  onThisDay: (lang: string = "en") => api.get(`/wikipedia/on-this-day?lang=${lang}`),
  search: (query: string, lang: string = "en") => api.get(`/wikipedia/search?q=${encodeURIComponent(query)}&lang=${lang}`),
  categories: () => api.get("/wikipedia/categories"),
  article: (title: string, lang: string = "en") => api.get(`/wikipedia/article/${encodeURIComponent(title)}?lang=${lang}`),
  createProject: (title: string, articleTitle: string, extract: string, sections: any[], duration: number, language: string) =>
    api.post("/wikipedia/create-project", { title, article_title: articleTitle, extract, sections, duration, language }),
  collectMedia: (projectId: string, media: any[]) =>
    api.post("/wikipedia/collect-media", { project_id: projectId, media })
};

export const script = {
  generate: (projectId: string, prompt: string, duration: number, language: string, numSegments: number, videoStyle: string) =>
    api.post("/script/generate", { project_id: projectId, prompt, duration_seconds: duration, language, num_segments: numSegments, video_style: videoStyle }),
  generateWiki: (projectId: string, duration: number, language: string) =>
    api.post("/script/generate-wiki", { project_id: projectId, duration_seconds: duration, language }),
  reassignMedia: (projectId: string) =>
    api.post("/script/reassign-media", { project_id: projectId })
};

export default api;
