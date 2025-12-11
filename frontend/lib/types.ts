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
  mediaType?: string;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
  effect?: "none" | "fade" | "pop" | "slide" | "zoom";
}

export interface MediaAsset {
  id: string;
  type: "image" | "video";
  source: "upload" | "ai_generated";
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
}

export interface MusicPreset {
  id: string;
  name: string;
  desc: string;
  cached: boolean;
}

export interface YoutubeInfo {
  title: string;
  description: string;
  tags: string;
}

export type ProjectType = "youtube" | "custom" | "ads";
export type StepType = "script" | "segments" | "options";

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
};

