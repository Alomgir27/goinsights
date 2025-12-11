"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Youtube, Check, LogOut, Loader2, Play, RefreshCw, Search, Heart, Eye, ThumbsUp, Clock, Calendar, X, Plus, Pause, ArrowLeft } from "lucide-react";
import { youtube } from "@/lib/api";
import Link from "next/link";

interface Video {
  id: string;
  title: string;
  description?: string;
  thumbnail: string;
  duration: string;
  views: string;
  likes?: string;
  channel: string;
  channelId?: string;
  publishedAt?: string;
}

interface FavoriteChannel {
  id: string;
  name: string;
  thumbnail?: string;
}

export default function ConnectPage(): React.ReactElement {
  const router = useRouter();
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [channelSearch, setChannelSearch] = useState("");
  const [searchedChannels, setSearchedChannels] = useState<FavoriteChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [favoriteChannels, setFavoriteChannels] = useState<FavoriteChannel[]>([]);
  const [showChannelSearch, setShowChannelSearch] = useState(false);
  const [activeTab, setActiveTab] = useState<"trending" | "favorites">("trending");
  const [selectedChannel, setSelectedChannel] = useState<FavoriteChannel | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const isConnected = localStorage.getItem("youtube_connected") === "true";
    setConnected(isConnected);
    
    const savedFavorites = localStorage.getItem("favorite_channels");
    if (savedFavorites) {
      setFavoriteChannels(JSON.parse(savedFavorites));
    }
    
    loadTrending();
  }, []);

  // Auto-search channels as user types
  useEffect(() => {
    if (channelSearch.trim().length >= 2) {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
        searchForChannels();
      }, 300);
    } else {
      setSearchedChannels([]);
    }
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [channelSearch]);

  const loadTrending = async () => {
    setLoadingVideos(true);
    setSelectedChannel(null);
    try {
      const { data } = await youtube.getSuggestions();
      setVideos(data.videos || []);
    } catch {
      setVideos([]);
    }
    setLoadingVideos(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoadingVideos(true);
    setSelectedChannel(null);
    try {
      const { data } = await youtube.searchVideos(searchQuery);
      setVideos(data.videos || []);
    } catch {
      setVideos([]);
    }
    setLoadingVideos(false);
  };

  const searchForChannels = async () => {
    if (!channelSearch.trim()) return;
    setLoadingChannels(true);
    try {
      const { data } = await youtube.searchChannels(channelSearch);
      setSearchedChannels(data.channels || []);
    } catch {
      setSearchedChannels([]);
    }
    setLoadingChannels(false);
  };

  const addToFavorites = (channel: FavoriteChannel) => {
    const exists = favoriteChannels.find(c => c.id === channel.id);
    if (!exists) {
      const updated = [...favoriteChannels, channel];
      setFavoriteChannels(updated);
      localStorage.setItem("favorite_channels", JSON.stringify(updated));
    }
    setShowChannelSearch(false);
    setChannelSearch("");
    setSearchedChannels([]);
  };

  const removeFromFavorites = (channelId: string) => {
    const updated = favoriteChannels.filter(c => c.id !== channelId);
    setFavoriteChannels(updated);
    localStorage.setItem("favorite_channels", JSON.stringify(updated));
    if (selectedChannel?.id === channelId) {
      loadTrending();
    }
  };

  const loadChannelVideos = async (channel: FavoriteChannel) => {
    setLoadingVideos(true);
    setSelectedChannel(channel);
    setActiveTab("favorites");
    try {
      const { data } = await youtube.getChannelById(channel.id);
      setVideos(data.videos || []);
    } catch {
      setVideos([]);
    }
    setLoadingVideos(false);
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      const { data } = await youtube.getAuthUrl();
      if (data.configured && data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        alert("YouTube OAuth not configured.");
        setLoading(false);
      }
    } catch {
      alert("Connection failed.");
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem("youtube_connected");
    localStorage.removeItem("youtube_token");
    setConnected(false);
  };

  const handleVideoSelect = (videoId: string) => {
    router.push(`/?url=https://www.youtube.com/watch?v=${videoId}`);
  };

  const togglePreview = (videoId: string) => {
    setPreviewVideo(previewVideo === videoId ? null : videoId);
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 py-5">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
                  <Youtube className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Discover Videos</h1>
                  <p className="text-slate-400 text-xs">Find videos to transform</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowChannelSearch(true)}
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-all flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add Channel
              </button>
              
              {!connected ? (
                <button
                  onClick={handleConnect}
                  disabled={loading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-all flex items-center gap-1.5 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Youtube className="w-4 h-4" />}
                  Connect
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                    <Check className="w-3.5 h-3.5" /> Connected
                  </span>
                  <button onClick={handleDisconnect} className="text-slate-400 hover:text-red-500 p-1.5">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Tabs */}
      <div className="bg-white border-b border-slate-100 py-3 sticky top-0 z-10">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex gap-3 items-center">
            {/* Search */}
            <div className="relative flex-1 max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Search videos..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg focus:outline-none focus:border-slate-300 text-sm text-slate-900 placeholder-slate-400"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={loadingVideos || !searchQuery.trim()}
              className="px-5 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              Search
            </button>
            
            {/* Tabs */}
            <div className="flex gap-1.5 ml-auto">
              <button
                onClick={() => { setActiveTab("trending"); loadTrending(); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "trending" && !selectedChannel
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🔥 Trending
              </button>
              <button
                onClick={() => setActiveTab("favorites")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === "favorites"
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                ❤️ Favorites
              </button>
            </div>
          </div>

          {/* Favorite Channels Pills */}
          {activeTab === "favorites" && favoriteChannels.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {favoriteChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => loadChannelVideos(channel)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedChannel?.id === channel.id
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {channel.name}
                  <X 
                    className="w-3 h-3 opacity-60 hover:opacity-100" 
                    onClick={(e) => { e.stopPropagation(); removeFromFavorites(channel.id); }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Video Grid */}
      <div className="max-w-[1800px] mx-auto px-6 py-6">
        {selectedChannel && (
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{selectedChannel.name}</h2>
            <button onClick={loadTrending} className="text-slate-400 text-xs hover:text-slate-600">
              ← Back
            </button>
          </div>
        )}
        
        {loadingVideos ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Loading...</span>
          </div>
        ) : videos.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {videos.map((video) => (
              <VideoCard 
                key={video.id} 
                video={video} 
                onSelect={handleVideoSelect} 
                onFavoriteChannel={addToFavorites}
                isPreview={previewVideo === video.id}
                onTogglePreview={togglePreview}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-slate-400">
            <Youtube className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">No videos found</p>
            <p className="text-xs">Try searching or add favorite channels</p>
          </div>
        )}
      </div>

      {/* Channel Search Modal */}
      {showChannelSearch && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Add Favorite Channel</h3>
              <button onClick={() => { setShowChannelSearch(false); setChannelSearch(""); setSearchedChannels([]); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={channelSearch}
                  onChange={(e) => setChannelSearch(e.target.value)}
                  placeholder="Start typing channel name..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-300"
                  autoFocus
                />
                {loadingChannels && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />
                )}
              </div>
            </div>
            
            <div className="max-h-72 overflow-y-auto border-t border-slate-100">
              {searchedChannels.length > 0 ? (
                searchedChannels.map((channel) => (
                  <button
                    key={channel.id}
                    onClick={() => addToFavorites(channel)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 transition-all text-left border-b border-slate-50 last:border-0"
                  >
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {channel.thumbnail ? (
                        <img 
                          src={channel.thumbnail.replace("s88", "s176")} 
                          alt="" 
                          className="w-full h-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <Youtube className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{channel.name}</p>
                    </div>
                    <Heart className="w-4 h-4 text-slate-300" />
                  </button>
                ))
              ) : channelSearch.length >= 2 && !loadingChannels ? (
                <p className="text-center text-slate-400 text-sm py-8">No channels found</p>
              ) : (
                <p className="text-center text-slate-400 text-sm py-8">Type to search channels...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

interface VideoCardProps {
  video: Video;
  onSelect: (id: string) => void;
  onFavoriteChannel: (channel: FavoriteChannel) => void;
  isPreview: boolean;
  onTogglePreview: (id: string) => void;
}

function VideoCard({ video, onSelect, onFavoriteChannel, isPreview, onTogglePreview }: VideoCardProps): React.ReactElement {
  return (
    <div className="group">
      <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden mb-2">
        {isPreview ? (
          <iframe
            src={`https://www.youtube.com/embed/${video.id}?autoplay=1`}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : (
          <>
            <img 
              src={video.thumbnail} 
              alt={video.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { e.currentTarget.src = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`; }}
            />
            <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
              <button
                onClick={() => onTogglePreview(video.id)}
                className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              >
                <Play className="w-4 h-4 text-slate-900 ml-0.5" fill="currentColor" />
              </button>
              <button
                onClick={() => onSelect(video.id)}
                className="px-3 py-2 bg-red-600 text-white text-xs font-semibold rounded-full shadow-lg hover:bg-red-700 transition-colors"
              >
                Use This
              </button>
            </div>
          </>
        )}
        {video.duration && !isPreview && (
          <span className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
            {video.duration}
          </span>
        )}
        {isPreview && (
          <button
            onClick={() => onTogglePreview(video.id)}
            className="absolute top-2 right-2 w-8 h-8 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (video.channelId) {
              onFavoriteChannel({ id: video.channelId, name: video.channel });
            }
          }}
          className="w-7 h-7 bg-slate-100 rounded-full flex-shrink-0 flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-colors"
          title="Add to favorites"
        >
          <Heart className="w-3 h-3" />
        </button>
        
        <div className="flex-1 min-w-0">
          <h4 
            onClick={() => onSelect(video.id)}
            className="font-medium text-slate-900 text-xs line-clamp-2 hover:text-red-600 transition-colors cursor-pointer leading-tight"
          >
            {video.title}
          </h4>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">
            {video.channel}
          </p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
            {video.views && (
              <span className="flex items-center gap-0.5">
                <Eye className="w-2.5 h-2.5" />
                {video.views}
              </span>
            )}
            {video.likes && (
              <span className="flex items-center gap-0.5">
                <ThumbsUp className="w-2.5 h-2.5" />
                {video.likes}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
