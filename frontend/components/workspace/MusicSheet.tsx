"use client";

import React from "react";
import { Music, X, Play, Pause, Check, Loader2, Volume2 } from "lucide-react";
import type { MusicPreset } from "@/lib/types";

interface MusicSheetProps {
  isOpen: boolean;
  onClose: () => void;
  musicPresets: MusicPreset[];
  selectedMusic: string;
  onSelect: (presetId: string) => void;
  playingPreset: string | null;
  loadingPreview: string | null;
  onPreview: (presetId: string) => void;
}

export default function MusicSheet({
  isOpen, onClose, musicPresets, selectedMusic, onSelect, playingPreset, loadingPreview, onPreview
}: MusicSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Music className="w-5 h-5" /> AI Background Music
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#666] px-5 py-3 bg-[#f5f5f5] border-b flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5" /> Click play to preview
        </p>

        <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
          {musicPresets.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-[#999]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
            </div>
          ) : (
            musicPresets.map(preset => (
              <div
                key={preset.id}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  selectedMusic === preset.id
                    ? "bg-purple-100 border-2 border-purple-500"
                    : "bg-[#f5f5f5] hover:bg-[#eee] border-2 border-transparent"
                }`}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onPreview(preset.id); }}
                  disabled={loadingPreview === preset.id}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-all ${
                    loadingPreview === preset.id ? "bg-yellow-100" :
                    playingPreset === preset.id ? "bg-purple-600 text-white animate-pulse" :
                    "bg-white hover:bg-purple-100"
                  }`}
                >
                  {loadingPreview === preset.id ? <Loader2 className="w-5 h-5 animate-spin text-yellow-600" /> :
                   playingPreset === preset.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
                <div className="flex-1 cursor-pointer" onClick={() => { onSelect(preset.id); onClose(); }}>
                  <p className="font-medium text-sm">{preset.name}</p>
                  <p className="text-xs text-[#999]">{preset.cached ? "✓ Ready" : "Will generate"}</p>
                </div>
                {selectedMusic === preset.id && <Check className="w-5 h-5 text-purple-500" />}
              </div>
            ))
          )}
        </div>

        <div className="border-t px-5 py-3 flex items-center justify-between bg-[#fafafa]">
          <span className="text-xs text-[#999]">🔄 Auto-loops</span>
          <button onClick={onClose} className="px-5 py-2 bg-[#1a1a1a] text-white text-sm font-medium rounded-lg hover:bg-[#333]">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

