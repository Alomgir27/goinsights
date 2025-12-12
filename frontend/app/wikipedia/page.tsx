"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Calendar, FolderOpen, Loader2, Home, Globe, Clock, Check, X, Play, Volume2, Image, Film } from "lucide-react";
import Link from "next/link";
import { wikipedia } from "@/lib/api";

interface WikiEvent {
  year: number;
  text: string;
  title: string;
  description: string;
  thumbnail: string | null;
  extract: string;
  media_count?: number;
  image_count?: number;
  video_count?: number;
  audio_count?: number;
}

interface SearchResult {
  title: string;
  snippet: string;
  pageid: number;
  media_count?: number;
  image_count?: number;
  video_count?: number;
  audio_count?: number;
}

interface Category {
  id: string;
  name: string;
  query: string;
}

interface MediaItem {
  url: string;
  type: "image" | "video" | "audio";
  title?: string;
  description?: string;
  object_name?: string;
  categories?: string;
  artist?: string;
  date?: string;
  width?: number;
  height?: number;
  source?: string;
}

type TabType = "today" | "search" | "categories";
type ViewType = "article" | "media-select";

export default function WikipediaDiscovery() {
  const router = useRouter();
  const [tab, setTab] = useState<TabType>("today");
  const [events, setEvents] = useState<WikiEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [duration, setDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState("");
  const [language, setLanguage] = useState("English");
  const [creating, setCreating] = useState(false);
  const [viewType, setViewType] = useState<ViewType>("article");
  const [selectedMedia, setSelectedMedia] = useState<Set<number>>(new Set());
  const [sortByMedia, setSortByMedia] = useState(false);
  const [loadingMoreMedia, setLoadingMoreMedia] = useState(false);
  const [mediaOffset, setMediaOffset] = useState(0);
  const [hasMoreMedia, setHasMoreMedia] = useState(true);
  const [mediaFilter, setMediaFilter] = useState<"all" | "images" | "videos" | "audio">("all");
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);

  const LANGUAGES = ["English", "Spanish", "French", "German", "Bengali", "Hindi", "Chinese", "Japanese"];
  const LANG_CODES: Record<string, string> = {
    "English": "en", "Spanish": "es", "French": "fr", "German": "de",
    "Bengali": "bn", "Hindi": "hi", "Chinese": "zh", "Japanese": "ja"
  };
  const DURATIONS = [30, 60, 120, 180, 300];

  const getAllMedia = (): MediaItem[] => {
    if (!selectedArticle) return [];
    const images = (selectedArticle.images || []).map((img: any) => ({ ...img, type: "image" as const }));
    const videos = (selectedArticle.videos || []).map((vid: any) => ({ ...vid, type: "video" as const }));
    const audios = (selectedArticle.audios || []).map((aud: any) => ({ ...aud, type: "audio" as const }));
    return [...images, ...videos, ...audios];
  };

  useEffect(() => {
    if (tab === "today") loadOnThisDay();
    if (tab === "categories") loadCategories();
  }, [tab, language]);

  const loadOnThisDay = async () => {
    setLoading(true);
    try {
      const { data } = await wikipedia.onThisDay(LANG_CODES[language] || "en");
      setEvents(data.events || []);
    } catch { setEvents([]); }
    setLoading(false);
  };

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data } = await wikipedia.categories();
      setCategories(data.categories || []);
    } catch { setCategories([]); }
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const { data } = await wikipedia.search(searchQuery, LANG_CODES[language] || "en");
      setSearchResults(data.results || []);
    } catch { setSearchResults([]); }
    setLoading(false);
  };

  const handleCategorySearch = async (query: string) => {
    setSearchQuery(query);
    setTab("search");
    setLoading(true);
    try {
      const { data } = await wikipedia.search(query, LANG_CODES[language] || "en");
      setSearchResults(data.results || []);
    } catch { setSearchResults([]); }
    setLoading(false);
  };

  const handleSelectTopic = async (title: string) => {
    setLoading(true);
    setMediaOffset(0);
    setHasMoreMedia(true);
    try {
      const { data } = await wikipedia.article(title, LANG_CODES[language] || "en");
      setSelectedArticle(data);
      setViewType("article");
      setSelectedMedia(new Set());
    } catch { setSelectedArticle(null); }
    setLoading(false);
  };

  const loadMoreMedia = async () => {
    if (!selectedArticle || loadingMoreMedia) return;
    setLoadingMoreMedia(true);
    try {
      const newOffset = mediaOffset + 50;
      const { data } = await wikipedia.commonsMedia(selectedArticle.title, 50, newOffset, mediaFilter);
      if (data.media && data.media.length > 0) {
        const existingUrls = new Set(getAllMedia().map((m: MediaItem) => m.url));
        const newMedia = data.media.filter((m: any) => !existingUrls.has(m.url));
        setSelectedArticle({
          ...selectedArticle,
          images: [...(selectedArticle.images || []), ...newMedia.filter((m: any) => m.type === "image")],
          videos: [...(selectedArticle.videos || []), ...newMedia.filter((m: any) => m.type === "video")]
        });
        setMediaOffset(newOffset);
        setHasMoreMedia(data.has_more);
      } else {
        setHasMoreMedia(false);
      }
    } catch { setHasMoreMedia(false); }
    setLoadingMoreMedia(false);
  };

  const getSortedResults = () => {
    if (!sortByMedia) return searchResults;
    return [...searchResults].sort((a, b) => (b.media_count || 0) - (a.media_count || 0));
  };

  const handleProceedToMediaSelect = () => {
    const allMedia = getAllMedia();
    setSelectedMedia(new Set(allMedia.map((_, i) => i)));
    setViewType("media-select");
  };

  const toggleMediaSelection = (index: number) => {
    setSelectedMedia(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const handleCreateProject = async () => {
    if (!selectedArticle) return;
    setCreating(true);
    try {
      const { data } = await wikipedia.createProject(
        selectedArticle.title,
        selectedArticle.title,
        selectedArticle.extract,
        selectedArticle.sections || [],
        duration,
        language
      );
      
      const allMedia = getAllMedia();
      const mediaToCollect = allMedia.filter((_, i) => selectedMedia.has(i));
      if (mediaToCollect.length > 0) {
        await wikipedia.collectMedia(data.project_id, mediaToCollect);
      }
      
      router.push(`/workspace/${data.project_id}`);
    } catch { }
    setCreating(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50 py-8 px-6">
      <div className="container max-w-5xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-white rounded-lg transition-colors">
              <Home className="w-5 h-5 text-[#666]" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[#1a1a1a]">Wikipedia History</h1>
              <p className="text-sm text-[#666] mt-1">Create documentaries from historical events</p>
            </div>
          </div>
          <Link href="/projects/new" className="btn-secondary">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>

        {selectedArticle ? (
          viewType === "media-select" ? (
            <div className="card max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setViewType("article")} className="flex items-center gap-1.5 text-[#666] hover:text-[#1a1a1a] text-sm">
                  <ArrowLeft className="w-4 h-4" /> Back to article
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#666]">{selectedMedia.size} of {getAllMedia().length} selected</span>
                  <button onClick={() => setSelectedMedia(new Set(getAllMedia().map((_, i) => i)))}
                    className="text-xs text-emerald-600 hover:underline">Select All</button>
                  <button onClick={() => setSelectedMedia(new Set())}
                    className="text-xs text-red-500 hover:underline">Clear</button>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {(["all", "images", "videos", "audio"] as const).map((f) => (
                  <button key={f} onClick={() => setMediaFilter(f)}
                    className={`px-3 py-1.5 text-xs rounded-lg font-medium capitalize transition-all flex items-center gap-1 ${
                      mediaFilter === f ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}>
                    {f === "images" && <Image className="w-3 h-3" />}
                    {f === "videos" && <Film className="w-3 h-3" />}
                    {f === "audio" && <Volume2 className="w-3 h-3" />}
                    {f === "all" ? "All" : f}
                  </button>
                ))}
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs text-slate-500">
                    {(selectedArticle?.images?.length || 0)} 📷 • {(selectedArticle?.videos?.length || 0)} 🎬 • {(selectedArticle?.audios?.length || 0)} 🔊
                  </span>
                  {selectedArticle?.has_more_commons && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded">+Commons</span>
                  )}
                </div>
              </div>
              
              <h2 className="text-lg font-bold text-[#1a1a1a] mb-4">Select Media for: {selectedArticle.title}</h2>
              
              <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 mb-4 max-h-[400px] overflow-y-auto p-1">
                {getAllMedia()
                  .filter(item => mediaFilter === "all" || mediaFilter === item.type + "s" || (mediaFilter === "images" && item.type === "image") || (mediaFilter === "videos" && item.type === "video") || (mediaFilter === "audio" && item.type === "audio"))
                  .map((item, i) => {
                    const originalIndex = getAllMedia().findIndex(m => m.url === item.url);
                    return (
                      <div key={i} className="relative group">
                        <button onClick={() => toggleMediaSelection(originalIndex)}
                          className={`w-full aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            selectedMedia.has(originalIndex) ? "border-emerald-500 ring-2 ring-emerald-200" : "border-slate-200 hover:border-slate-300"
                          }`}
                          title={item.description || item.title || ""}
                        >
                          {item.type === "video" ? (
                            <div className="w-full h-full bg-purple-900 flex flex-col items-center justify-center">
                              <Play className="w-6 h-6 text-white mb-1" />
                              <span className="text-white text-[9px] font-medium">VIDEO</span>
                            </div>
                          ) : item.type === "audio" ? (
                            <div className="w-full h-full bg-orange-800 flex flex-col items-center justify-center">
                              <Volume2 className="w-6 h-6 text-white mb-1" />
                              <span className="text-white text-[9px] font-medium">AUDIO</span>
                            </div>
                          ) : (
                            <img src={item.url} alt={item.description || ""} className="w-full h-full object-cover" />
                          )}
                          {selectedMedia.has(originalIndex) && (
                            <div className="absolute top-1 right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setPreviewMedia(item); }}
                          className="absolute bottom-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          title="View details"
                        >
                          <Search className="w-3 h-3" />
                        </button>
                        {item.description && (
                          <div className="absolute bottom-0 left-0 right-6 bg-black/70 text-white text-[8px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {item.description.slice(0, 50)}...
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
              
              {hasMoreMedia && (
                <button
                  onClick={loadMoreMedia}
                  disabled={loadingMoreMedia}
                  className="w-full py-2.5 mb-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {loadingMoreMedia ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Loading more media...</>
                  ) : (
                    <>Load More from Commons</>
                  )}
                </button>
              )}
              
              <button onClick={handleCreateProject} disabled={creating || selectedMedia.size === 0}
                className="w-full btn-primary bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : `Create Documentary (${selectedMedia.size} media)`}
              </button>
            </div>
          ) : (
            <div className="card max-w-2xl mx-auto">
              <button onClick={() => setSelectedArticle(null)} className="flex items-center gap-1.5 text-[#666] hover:text-[#1a1a1a] mb-4 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back to topics
              </button>
              
              <div className="flex gap-4 mb-4">
                {selectedArticle.thumbnail && (
                  <img src={selectedArticle.thumbnail} alt="" className="w-24 h-24 rounded-lg object-cover" />
                )}
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-[#1a1a1a]">{selectedArticle.title}</h2>
                  <p className="text-sm text-[#666] mt-1">{selectedArticle.description}</p>
                </div>
              </div>
              
              <p className="text-sm text-[#333] mb-4 line-clamp-4">{selectedArticle.extract}</p>
              
              {getAllMedia().length > 0 && (
                <div className="mb-4 p-3 bg-slate-50 rounded-lg border">
                  <p className="text-xs text-[#666] mb-2">
                    Available: {(selectedArticle.images?.length || 0)} images
                    {selectedArticle.videos?.length > 0 && <span className="text-teal-600"> + {selectedArticle.videos.length} videos</span>}
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {selectedArticle.images?.slice(0, 6).map((img: any, i: number) => (
                      <img key={`img-${i}`} src={img.url} alt="" className="w-14 h-14 rounded object-cover shrink-0 border border-slate-200" />
                    ))}
                    {selectedArticle.videos?.slice(0, 2).map((vid: any, i: number) => (
                      <div key={`vid-${i}`} className="w-14 h-14 rounded bg-slate-800 flex items-center justify-center shrink-0">
                        <Play className="w-4 h-4 text-white" />
                      </div>
                    ))}
                    {getAllMedia().length > 8 && (
                      <div className="w-14 h-14 rounded bg-slate-100 flex items-center justify-center shrink-0 text-xs text-[#666]">
                        +{getAllMedia().length - 8}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Duration</label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {DURATIONS.map((d) => (
                      <button key={d} onClick={() => { setDuration(d); setCustomDuration(""); }}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          duration === d && !customDuration ? "bg-emerald-600 text-white" : "bg-[#f5f5f5] text-[#666] hover:bg-[#eee]"
                        }`}>
                        {d < 60 ? `${d}s` : `${d / 60}m`}
                      </button>
                    ))}
                    <div className="flex items-center gap-1">
                      <input type="number" placeholder="7" min="1" max="60"
                        value={customDuration}
                        onChange={(e) => { setCustomDuration(e.target.value); if (e.target.value) setDuration(parseInt(e.target.value) * 60); }}
                        className={`w-14 px-2 py-1.5 rounded text-sm border text-center ${customDuration ? "border-emerald-500 bg-emerald-50" : "border-[#ccc] bg-white"}`}
                      />
                      <span className="text-xs text-[#666]">min</span>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                    <Globe className="w-4 h-4 inline mr-1" /> Language
                  </label>
                  <select value={language} onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#ddd] text-sm">
                    {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
              
              {getAllMedia().length > 0 ? (
                <button onClick={handleProceedToMediaSelect}
                  className="w-full btn-primary bg-emerald-600 hover:bg-emerald-700">
                  Select Media & Create ({getAllMedia().length} available)
                </button>
              ) : (
                <button onClick={handleCreateProject} disabled={creating}
                  className="w-full btn-primary bg-emerald-600 hover:bg-emerald-700">
                  {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Documentary"}
                </button>
              )}
            </div>
          )
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <div className="flex gap-2">
                <button onClick={() => setTab("today")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    tab === "today" ? "bg-emerald-600 text-white" : "bg-white text-[#666] hover:bg-emerald-50"
                  }`}>
                  <Calendar className="w-4 h-4" /> On This Day
                </button>
                <button onClick={() => setTab("search")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    tab === "search" ? "bg-emerald-600 text-white" : "bg-white text-[#666] hover:bg-emerald-50"
                  }`}>
                  <Search className="w-4 h-4" /> Search
                </button>
                <button onClick={() => setTab("categories")}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                    tab === "categories" ? "bg-emerald-600 text-white" : "bg-white text-[#666] hover:bg-emerald-50"
                  }`}>
                  <FolderOpen className="w-4 h-4" /> Categories
                </button>
              </div>
              <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border">
                <Globe className="w-4 h-4 text-emerald-600" />
                <select value={language} onChange={(e) => setLanguage(e.target.value)}
                  className="text-sm font-medium text-[#333] bg-transparent border-none focus:outline-none cursor-pointer">
                  {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>

            {tab === "search" && (
              <div className="space-y-3 mb-6">
                <div className="flex gap-2">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search Wikipedia..." className="flex-1 input" />
                  <button onClick={handleSearch} disabled={loading} className="btn-primary bg-emerald-600 hover:bg-emerald-700">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
                {searchResults.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSortByMedia(!sortByMedia)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-all ${
                        sortByMedia ? "bg-emerald-600 text-white" : "bg-white text-slate-600 border hover:border-emerald-400"
                      }`}
                    >
                      📸 Sort by Media Count
                    </button>
                    <span className="text-xs text-slate-500">{searchResults.length} results</span>
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
              </div>
            ) : (
              <>
                {tab === "today" && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {events.map((event, i) => (
                      <button key={i} onClick={() => event.title && handleSelectTopic(event.title)}
                        className="card text-left hover:border-emerald-300 hover:shadow-md transition-all">
                        <div className="flex gap-3">
                          {event.thumbnail && (
                            <img src={event.thumbnail} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-sm font-bold text-emerald-700">{event.year}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {(event.image_count || 0) > 0 && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex items-center gap-0.5">
                                    <Image className="w-2.5 h-2.5" />{event.image_count}+
                                  </span>
                                )}
                                {(event.video_count || 0) > 0 && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex items-center gap-0.5">
                                    <Film className="w-2.5 h-2.5" />{event.video_count}
                                  </span>
                                )}
                                {(event.audio_count || 0) > 0 && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 flex items-center gap-0.5">
                                    <Volume2 className="w-2.5 h-2.5" />{event.audio_count}
                                  </span>
                                )}
                              </div>
                            </div>
                            <h3 className="font-semibold text-[#1a1a1a] line-clamp-1">{event.title || "Historical Event"}</h3>
                            <p className="text-sm text-[#666] mt-1 line-clamp-2">{event.text}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {tab === "search" && searchResults.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-4">
                    {getSortedResults().map((result, i) => (
                      <button key={i} onClick={() => handleSelectTopic(result.title)}
                        className="card text-left hover:border-emerald-300 hover:shadow-md transition-all relative">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-[#1a1a1a] mb-1 flex-1">{result.title}</h3>
                          {result.media_count !== undefined && (
                            <div className="flex items-center gap-1 shrink-0">
                              {(result.image_count || 0) > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 flex items-center gap-0.5">
                                  <Image className="w-2.5 h-2.5" />{result.image_count}+
                                </span>
                              )}
                              {(result.video_count || 0) > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 flex items-center gap-0.5">
                                  <Film className="w-2.5 h-2.5" />{result.video_count}
                                </span>
                              )}
                              {(result.audio_count || 0) > 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 flex items-center gap-0.5">
                                  <Volume2 className="w-2.5 h-2.5" />{result.audio_count}
                                </span>
                              )}
                              {result.media_count === 0 && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">0</span>
                              )}
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-[#666] line-clamp-2" 
                           dangerouslySetInnerHTML={{ __html: result.snippet }} />
                      </button>
                    ))}
                  </div>
                )}

                {tab === "categories" && (
                  <div className="grid md:grid-cols-3 gap-4">
                    {categories.map((cat) => (
                      <button key={cat.id} onClick={() => handleCategorySearch(cat.query)}
                        className="card text-left hover:border-emerald-300 hover:shadow-md transition-all py-6">
                        <h3 className="font-semibold text-[#1a1a1a] text-lg">{cat.name}</h3>
                        <p className="text-sm text-[#666] mt-1">Explore {cat.name.toLowerCase()}</p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Media Preview Modal */}
        {previewMedia && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPreviewMedia(null)} />
            <div className="relative bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden">
              <button onClick={() => setPreviewMedia(null)} className="absolute top-3 right-3 z-10 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white">
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col md:flex-row">
                <div className="flex-1 bg-black flex items-center justify-center min-h-[250px] max-h-[350px]">
                  {previewMedia.type === "video" ? (
                    <div className="w-full h-full bg-purple-900 flex flex-col items-center justify-center p-8">
                      <Play className="w-16 h-16 text-white mb-2" />
                      <span className="text-white text-sm font-medium">Video File</span>
                    </div>
                  ) : previewMedia.type === "audio" ? (
                    <div className="w-full h-full bg-orange-800 flex flex-col items-center justify-center p-8">
                      <Volume2 className="w-16 h-16 text-white mb-2" />
                      <span className="text-white text-sm font-medium">Audio File</span>
                    </div>
                  ) : (
                    <img src={previewMedia.url} alt={previewMedia.description || ""} className="max-w-full max-h-full object-contain" />
                  )}
                </div>

                <div className="w-full md:w-72 p-4 bg-slate-50 max-h-[350px] overflow-y-auto">
                  <h4 className="font-semibold text-sm text-[#1a1a1a] mb-3 line-clamp-2">{previewMedia.title || "Media"}</h4>

                  {previewMedia.description && (
                    <div className="mb-3">
                      <label className="text-[10px] text-slate-500 uppercase tracking-wide">Description</label>
                      <p className="text-xs text-[#333] mt-0.5">{previewMedia.description}</p>
                    </div>
                  )}

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-200">
                      <span className="text-slate-500">Type</span>
                      <span className="font-medium capitalize flex items-center gap-1">
                        {previewMedia.type === "image" && <Image className="w-3 h-3" />}
                        {previewMedia.type === "video" && <Film className="w-3 h-3" />}
                        {previewMedia.type === "audio" && <Volume2 className="w-3 h-3" />}
                        {previewMedia.type}
                      </span>
                    </div>
                    {previewMedia.width && previewMedia.height && (
                      <div className="flex justify-between py-1.5 border-b border-slate-200">
                        <span className="text-slate-500">Size</span>
                        <span className="font-medium">{previewMedia.width} × {previewMedia.height}</span>
                      </div>
                    )}
                    {previewMedia.artist && (
                      <div className="flex justify-between py-1.5 border-b border-slate-200">
                        <span className="text-slate-500">Artist</span>
                        <span className="font-medium truncate max-w-[150px]">{previewMedia.artist}</span>
                      </div>
                    )}
                    {previewMedia.date && (
                      <div className="flex justify-between py-1.5 border-b border-slate-200">
                        <span className="text-slate-500">Date</span>
                        <span className="font-medium">{previewMedia.date}</span>
                      </div>
                    )}
                    {previewMedia.source && (
                      <div className="flex justify-between py-1.5 border-b border-slate-200">
                        <span className="text-slate-500">Source</span>
                        <span className="font-medium capitalize">{previewMedia.source}</span>
                      </div>
                    )}
                  </div>

                  {previewMedia.categories && (
                    <div className="mt-3">
                      <label className="text-[10px] text-slate-500 uppercase tracking-wide">Categories</label>
                      <p className="text-[10px] text-slate-600 mt-0.5 line-clamp-3">{previewMedia.categories}</p>
                    </div>
                  )}

                  <button
                    onClick={() => setPreviewMedia(null)}
                    className="w-full mt-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

