import { create } from "zustand";
import type { Project, Clip } from "./types";

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
