import { create } from "zustand";

interface Clip {
  start: number;
  end: number;
  path?: string;
}

interface TranscriptItem {
  start: number;
  duration: number;
  text: string;
}

interface SegmentData {
  text: string;
  start: number;
  end: number;
  source_start: number;
  source_end: number;
}

interface Project {
  id: string;
  project_type?: "youtube" | "custom";
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
  clips: Clip[];
  status: string;
  animatedSubtitles?: boolean;
}

interface AppStore {
  project: Project | null;
  loading: boolean;
  setProject: (project: Project | null) => void;
  setLoading: (loading: boolean) => void;
  updateProject: (updates: Partial<Project>) => void;
  addClip: (clip: Clip) => void;
  removeClip: (index: number) => void;
}

export const useStore = create<AppStore>((set) => ({
  project: null,
  loading: false,
  setProject: (project: Project | null) => set({ project }),
  setLoading: (loading: boolean) => set({ loading }),
  updateProject: (updates: Partial<Project>) =>
    set((state) => ({
      project: state.project ? { ...state.project, ...updates } : null
    })),
  addClip: (clip: Clip) =>
    set((state) => ({
      project: state.project
        ? { ...state.project, clips: [...state.project.clips, clip] }
        : null
    })),
  removeClip: (index: number) =>
    set((state) => ({
      project: state.project
        ? { ...state.project, clips: state.project.clips.filter((_, i) => i !== index) }
        : null
    }))
}));
