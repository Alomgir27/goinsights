"use client";

import React, { useState, useRef, useEffect } from "react";
import { Music, X, Play, Pause, Check, Loader2, Search, Youtube } from "lucide-react";
import type { MusicPreset } from "@/lib/types";
import { video } from "@/lib/api";

interface SearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
}

interface MusicSheetProps {
  isOpen: boolean;
  onClose: () => void;
  musicPresets: MusicPreset[];
  selectedMusic: string;
  onSelect: (presetId: string) => void;
  playingPreset: string | null;
  loadingPreview: string | null;
  onPreview: (presetId: string) => void;
  projectId?: string;
}

export default function MusicSheet({
  isOpen, onClose, musicPresets, selectedMusic, onSelect, playingPreset, loadingPreview, onPreview, projectId
}: MusicSheetProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"presets" | "search">("presets");
  const [playingSearch, setPlayingSearch] = useState<string | null>(null);
  const [loadingSearch, setLoadingSearch] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout>();
  const searchAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await video.searchMusic(searchQuery);
        setSearchResults(res.data.results || []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 500);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery]);

  const handleSelectSearch = async (result: SearchResult) => {
    if (!projectId) return;
    setDownloading(result.id);
    try {
      await video.downloadMusic(projectId, result.id);
      onSelect(`yt:${result.id}`);
      onClose();
    } catch (e) { console.error(e); }
    setDownloading(null);
  };

  const handlePreviewSearch = (result: SearchResult) => {
    if (playingSearch === result.id) {
      searchAudioRef.current?.pause();
      setPlayingSearch(null);
      return;
    }
    setLoadingSearch(result.id);
    const url = video.previewSearchMusic(result.id);
    if (searchAudioRef.current) {
      searchAudioRef.current.src = url;
      searchAudioRef.current.oncanplay = () => {
        setLoadingSearch(null);
        setPlayingSearch(result.id);
        searchAudioRef.current?.play();
      };
      searchAudioRef.current.onerror = () => setLoadingSearch(null);
      searchAudioRef.current.load();
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-[#0f0f0f] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-white/10">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-orange-500 px-5 py-4 flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2 text-lg">
            <Youtube className="w-5 h-5" /> Background Music
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setActiveTab("presets")}
            className={`flex-1 py-3 text-sm font-medium transition ${activeTab === "presets" ? "text-white border-b-2 border-red-500" : "text-white/50 hover:text-white/80"}`}
          >
            <Music className="w-4 h-4 inline mr-2" />Mood Presets
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 py-3 text-sm font-medium transition ${activeTab === "search" ? "text-white border-b-2 border-red-500" : "text-white/50 hover:text-white/80"}`}
          >
            <Search className="w-4 h-4 inline mr-2" />Search YouTube
          </button>
        </div>

        {/* Search Tab */}
        {activeTab === "search" && (
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search background music..."
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-red-500/50"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-400 animate-spin" />}
            </div>
            <p className="text-xs text-white/30 mt-2 mb-3">🎵 Royalty-free music from YouTube</p>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {searchResults.length === 0 && !searching && searchQuery.length >= 2 && (
                <p className="text-center text-white/40 py-6">No results found</p>
              )}
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition border border-transparent hover:border-red-500/30"
                >
                  <button
                    onClick={() => handlePreviewSearch(result)}
                    disabled={loadingSearch === result.id}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shrink-0 ${
                      loadingSearch === result.id ? "bg-orange-500/30" :
                      playingSearch === result.id ? "bg-red-600 text-white" :
                      "bg-white/10 hover:bg-white/20 text-white/70"
                    }`}
                  >
                    {loadingSearch === result.id ? <Loader2 className="w-5 h-5 animate-spin text-orange-400" /> :
                     playingSearch === result.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleSelectSearch(result)}>
                    <p className="font-medium text-sm text-white truncate">{result.title}</p>
                    <p className="text-xs text-white/50">{result.artist} • {formatDuration(result.duration)}</p>
                  </div>
                  <button
                    onClick={() => handleSelectSearch(result)}
                    disabled={downloading === result.id}
                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 shrink-0"
                  >
                    {downloading === result.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Use"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Presets Tab */}
        {activeTab === "presets" && (
          <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
            {musicPresets.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-white/50">
                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
              </div>
            ) : (
              musicPresets.map(preset => (
                <div
                  key={preset.id}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer ${
                    selectedMusic === preset.id
                      ? "bg-red-600/20 border border-red-500"
                      : "bg-white/5 hover:bg-white/10 border border-transparent"
                  }`}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); onPreview(preset.id); }}
                    disabled={loadingPreview === preset.id}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      loadingPreview === preset.id ? "bg-orange-500/30" :
                      playingPreset === preset.id ? "bg-red-600 text-white" :
                      "bg-white/10 hover:bg-white/20 text-white/70"
                    }`}
                  >
                    {loadingPreview === preset.id ? <Loader2 className="w-5 h-5 animate-spin text-orange-400" /> :
                     playingPreset === preset.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <div className="flex-1" onClick={() => { onSelect(preset.id); onClose(); }}>
                    <p className="font-medium text-sm text-white">{preset.name}</p>
                    <p className="text-xs text-white/40">{preset.artist || "YouTube"} {preset.cached ? "• ✓ Ready" : ""}</p>
                  </div>
                  {selectedMusic === preset.id && <Check className="w-5 h-5 text-red-400" />}
                </div>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-white/10 px-5 py-3 flex items-center justify-between bg-black/30">
          <span className="text-xs text-white/40">🔄 Auto-loops during video</span>
          <button onClick={onClose} className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition">
            Done
          </button>
        </div>
        <audio ref={searchAudioRef} onEnded={() => setPlayingSearch(null)} className="hidden" />
      </div>
    </div>
  );
}
