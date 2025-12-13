export interface Voice {
  id: string;
  name: string;
  gender: string;
  style: string;
  accent: string;
  langs: string;
}

export interface Segment {
  text: string;
  displayText?: string;
  speaker?: string;
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  audioGenerated: boolean;
  clipExtracted: boolean;
  timestamp: number;
  voiceId?: string;
  mediaId?: string;
  mediaIds?: string[];
  mediaType?: string;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
  effect?: "none" | "fade" | "pop" | "slide" | "zoom" | "zoom_out" | "pan_left" | "pan_right" | "shake" | "bounce";
  silence?: number;
}

export interface MediaAsset {
  id: string;
  type: "image" | "video";
  source: "upload" | "ai_generated" | string;
  path: string;
  duration?: number;
  width?: number;
  height?: number;
  prompt?: string;
  order: number;
  startTime: number;
  endTime: number;
  assignedSegments: number[];
}

export interface WatermarkConfig {
  enabled: boolean;
  text: string;
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center" | "bottom-center";
  fontSize: number;
  opacity: number;
}

export interface MergeOptions {
  subtitles: boolean;
  animatedSubtitles: boolean;
  subtitleStyle: string;
  subtitleSize: number;
  subtitlePosition: string;
  dialogueMode: boolean;
  speaker1Position: string;
  speaker2Position: string;
  dialogueBgStyle: string;
  resize: string;
  bgMusic: string;
  bgMusicVolume: number;
  watermark: WatermarkConfig;
}

export interface MusicPreset {
  id: string;
  name: string;
  artist?: string;
  cached: boolean;
}

export interface YoutubeInfo {
  title: string;
  description: string;
  tags: string;
}

export interface Clip {
  start: number;
  end: number;
  path?: string;
}

export interface TranscriptItem {
  start: number;
  duration: number;
  text: string;
}

export interface SegmentData {
  text: string;
  start: number;
  end: number;
  source_start: number;
  source_end: number;
}

export interface Project {
  id: string;
  project_type?: ProjectType;
  video_style?: string;
  language?: string;
  videoId?: string;
  title: string;
  thumbnail?: string;
  duration: number;
  transcript?: TranscriptItem[];
  summary?: string;
  script?: string;
  prompt?: string;
  segments_data?: SegmentData[];
  wiki_data?: { article_title?: string; extract?: string; sections?: any[] };
  clips: Clip[];
  status: string;
  animatedSubtitles?: boolean;
}

export type ProjectType = "youtube" | "custom" | "ads" | "wikipedia" | "inshorts";
export type StepType = "script" | "segments" | "options";

export interface InshortsSegment {
  start: number;
  end: number;
  score: number;
  reason: string;
  transcript?: string;
}

export interface InshortsEffects {
  blur: boolean;
  zoom: "none" | "in" | "out" | "ken_burns";
  animation: "none" | "fade" | "flash" | "pulse" | "letterbox" | "glitch" | "shake" | "rotate" | "mirror_h" | "mirror_v" | "mirror_split";
  vignette: boolean;
  speed: number;
  colorGrade: string;
  overlay: "none" | "grain" | "scanlines" | "vhs" | "sparkle" | "light_leak" | "dust" | "rainbow" | "strobe" | "glow";
}

export interface InshortsOptions {
  subtitles: boolean;
  keepAudio: boolean;
  aspectRatio: "9:16" | "1:1";
  antiCopyright: boolean;
}

export const DEFAULT_INSHORTS_EFFECTS: InshortsEffects = {
  blur: true,
  zoom: "none",
  animation: "none",
  vignette: false,
  speed: 1,
  colorGrade: "none",
  overlay: "none",
};

export const DEFAULT_INSHORTS_OPTIONS: InshortsOptions = {
  subtitles: true,
  keepAudio: true,
  aspectRatio: "9:16",
  antiCopyright: true,
};

export const DEFAULT_MERGE_OPTIONS: MergeOptions = {
  subtitles: false,
  animatedSubtitles: true,
  subtitleStyle: "karaoke",
  subtitleSize: 72,
  subtitlePosition: "bottom",
  dialogueMode: false,
  speaker1Position: "top-left",
  speaker2Position: "top-right",
  dialogueBgStyle: "transparent",
  resize: "16:9",
  bgMusic: "",
  bgMusicVolume: 0.3,
  watermark: { enabled: false, text: "", position: "bottom-right", fontSize: 28, opacity: 0.7 },
};
