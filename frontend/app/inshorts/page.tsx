"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Search, Play, Smartphone, Home } from "lucide-react";
import Link from "next/link";
import { inshorts } from "@/lib/api";

interface VideoResult {
  id: string;
  title: string;
  thumbnail: string;
  duration: number;
  duration_formatted: string;
  channel: string;
  views: number;
}

export default function InshortsPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<VideoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await inshorts.create(url);
      router.push(`/inshorts/${data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create project");
    }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { data } = await inshorts.search(searchQuery);
      setSearchResults(data.videos || []);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  };

  const selectVideo = async (videoId: string) => {
    setLoading(true);
    setError("");
    try {
      const ytUrl = `https://youtube.com/watch?v=${videoId}`;
      const { data } = await inshorts.create(ytUrl);
      router.push(`/inshorts/${data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create project");
    }
    setLoading(false);
  };

  const formatViews = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}K`;
    return n.toString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 py-8 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-white/80 rounded-lg transition-colors">
              <Home className="w-5 h-5 text-[#666]" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-[#1a1a1a]">Inshorts</h1>
                <p className="text-sm text-[#666]">Create viral shorts from YouTube videos</p>
              </div>
            </div>
          </div>
          <Link href="/projects/new" className="btn-secondary">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* URL Input */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-pink-100">
            <h2 className="font-semibold text-[#1a1a1a] mb-4 flex items-center gap-2">
              <Play className="w-4 h-4 text-pink-600" /> Paste YouTube URL
            </h2>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-4 py-3 rounded-lg border border-[#ddd] focus:border-pink-400 focus:outline-none mb-4"
            />
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={loading || !url.trim()}
              className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-lg font-medium hover:from-pink-600 hover:to-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
              {loading ? "Creating..." : "Create Short"}
            </button>
          </div>

          {/* Search */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-pink-100">
            <h2 className="font-semibold text-[#1a1a1a] mb-4 flex items-center gap-2">
              <Search className="w-4 h-4 text-pink-600" /> Search YouTube
            </h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search for videos..."
                className="flex-1 px-4 py-3 rounded-lg border border-[#ddd] focus:border-pink-400 focus:outline-none"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="px-4 py-3 bg-pink-100 text-pink-700 rounded-lg hover:bg-pink-200 disabled:opacity-50"
              >
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-8">
            <h3 className="font-semibold text-[#1a1a1a] mb-4">Search Results</h3>
            <div className="grid md:grid-cols-3 gap-4">
              {searchResults.map((video) => (
                <button
                  key={video.id}
                  onClick={() => selectVideo(video.id)}
                  disabled={loading}
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-pink-100 hover:border-pink-300 transition-all text-left disabled:opacity-50"
                >
                  <div className="relative aspect-video bg-gray-100">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                      {video.duration_formatted}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-[#1a1a1a] line-clamp-2">{video.title}</p>
                    <p className="text-xs text-[#666] mt-1">{video.channel}</p>
                    <p className="text-xs text-[#999] mt-0.5">{formatViews(video.views)} views</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

