"use client";

import React, { useState, useEffect } from "react";
import { Video, Download, Image, Sparkles, Copy, Check, Youtube, Upload, Loader2, ExternalLink, Globe, Lock, EyeOff, ListVideo, RefreshCw, Clock, Sun, Moon, Baby, User, Tag } from "lucide-react";
import { video, youtube } from "@/lib/api";
import type { YoutubeInfo } from "@/lib/types";

const IMAGE_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", desc: "Fast" },
  { id: "gemini-3-pro", name: "Gemini 3 Pro", desc: "High quality" },
  { id: "dall-e-3", name: "DALL-E 3", desc: "OpenAI" },
];

const IMAGE_STYLES = [
  { id: "cartoon", name: "Cartoon", icon: "🎨" },
  { id: "anime", name: "Anime", icon: "🎌" },
  { id: "realistic", name: "Realistic", icon: "📷" },
  { id: "3d_render", name: "3D Render", icon: "🎮" },
  { id: "cinematic", name: "Cinematic", icon: "🎬" },
];

const THUMBNAIL_LANGUAGES = [
  { id: "English", name: "English" },
  { id: "Bengali", name: "বাংলা" },
  { id: "Hindi", name: "हिंदी" },
  { id: "Spanish", name: "Español" },
  { id: "French", name: "Français" },
  { id: "Chinese", name: "中文" },
  { id: "Japanese", name: "日本語" },
  { id: "Arabic", name: "العربية" },
];

const VIDEO_TYPES = [
  { id: "tutorial", name: "Tutorial", icon: "📚" },
  { id: "podcast", name: "Podcast", icon: "🎙️" },
  { id: "story", name: "Story/Narrative", icon: "📖" },
  { id: "motivation", name: "Motivational", icon: "💪" },
  { id: "news", name: "News/Update", icon: "📰" },
  { id: "review", name: "Review", icon: "⭐" },
  { id: "vlog", name: "Vlog", icon: "🎬" },
  { id: "educational", name: "Educational", icon: "🎓" },
  { id: "gaming", name: "Gaming", icon: "🎮" },
  { id: "music", name: "Music", icon: "🎵" },
];

const YOUTUBE_CATEGORIES = [
  { id: "1", name: "Film & Animation" },
  { id: "2", name: "Autos & Vehicles" },
  { id: "10", name: "Music" },
  { id: "15", name: "Pets & Animals" },
  { id: "17", name: "Sports" },
  { id: "19", name: "Travel & Events" },
  { id: "20", name: "Gaming" },
  { id: "22", name: "People & Blogs" },
  { id: "23", name: "Comedy" },
  { id: "24", name: "Entertainment" },
  { id: "25", name: "News & Politics" },
  { id: "26", name: "Howto & Style" },
  { id: "27", name: "Education" },
  { id: "28", name: "Science & Technology" },
  { id: "29", name: "Nonprofits & Activism" },
];

interface FinalVideoSectionProps {
  projectId: string;
  projectStatus: string;
  language: string;
  script: string;
  onGeneratePrompt: (language: string, imageStyle: string, videoType: string) => void;
  onGenerateThumbnailFromPrompt: (prompt: string, model: string, imageStyle: string, videoType: string, title: string) => void;
  onGenerateYoutubeInfo: () => void;
  processing: string;
  thumbnailPrompt: string;
  setThumbnailPrompt: (prompt: string) => void;
  thumbnailTitle: string;
  setThumbnailTitle: (title: string) => void;
  thumbnailGenerated: boolean;
  thumbnailModel: string;
  setThumbnailModel: (model: string) => void;
  youtubeInfo: YoutubeInfo;
  setYoutubeInfo: (info: YoutubeInfo) => void;
  showFinalPreview: boolean;
  setShowFinalPreview: (show: boolean) => void;
  finalVideoTimestamp: number;
}

export default function FinalVideoSection({
  projectId, projectStatus, language, script, onGeneratePrompt, onGenerateThumbnailFromPrompt, onGenerateYoutubeInfo,
  processing, thumbnailPrompt, setThumbnailPrompt, thumbnailTitle, setThumbnailTitle, thumbnailGenerated, thumbnailModel, setThumbnailModel,
  youtubeInfo, setYoutubeInfo, showFinalPreview, setShowFinalPreview, finalVideoTimestamp
}: FinalVideoSectionProps) {
  const [copied, setCopied] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishPrivacy, setPublishPrivacy] = useState<"private" | "unlisted" | "public">("private");
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [playlists, setPlaylists] = useState<{ id: string; title: string }[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string>("");
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [connectingYoutube, setConnectingYoutube] = useState(false);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState<"morning" | "evening">("morning");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [madeForKids, setMadeForKids] = useState(false);
  const [categoryId, setCategoryId] = useState("22");
  const [thumbnailLanguage, setThumbnailLanguage] = useState(language || "English");
  const [thumbnailStyle, setThumbnailStyle] = useState("cartoon");
  const [videoType, setVideoType] = useState("tutorial");

  const [playlistError, setPlaylistError] = useState<string>("");

  useEffect(() => {
    setYoutubeConnected(localStorage.getItem("youtube_connected") === "true");
  }, []);
  
  const loadPlaylists = async () => {
    const token = localStorage.getItem("youtube_token");
    if (!token) {
      setPlaylistError("Please connect YouTube first");
      return;
    }
    setLoadingPlaylists(true);
    setPlaylistError("");
    try {
      const { data } = await youtube.getPlaylists(token);
      setPlaylists(data.playlists || []);
      if (data.error) {
        setPlaylistError("Reconnect YouTube to access playlists");
      }
    } catch (e) {
      setPlaylistError("Failed to load playlists");
    }
    setLoadingPlaylists(false);
  };

  const handleConnectYoutube = async () => {
    setConnectingYoutube(true);
    try {
      const { data } = await youtube.getAuthUrl();
      if (data.configured && data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        alert("YouTube OAuth not configured on server.");
      }
    } catch {
      alert("Failed to get auth URL");
    }
    setConnectingYoutube(false);
  };

  useEffect(() => { if (youtubeConnected) loadPlaylists(); }, [youtubeConnected]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(""), 2000);
  };

  const handlePublish = async () => {
    const accessToken = localStorage.getItem("youtube_token");
    if (!accessToken) {
      alert("Please connect your YouTube channel first");
      return;
    }
    if (!youtubeInfo.title) {
      alert("Please generate YouTube info first");
      return;
    }

    setPublishing(true);
    try {
      const schedule = scheduleEnabled ? scheduleTime : null;
      const { data } = await youtube.publish(projectId, youtubeInfo.title, youtubeInfo.description, youtubeInfo.tags, publishPrivacy, selectedPlaylist || null, accessToken, schedule, madeForKids, categoryId);
      if (data.success) {
        setPublishedUrl(data.video_url);
        if (data.scheduled_at) setScheduledAt(data.scheduled_at);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to publish";
      if (msg.includes("quota") || msg.includes("403")) {
        setQuotaExceeded(true);
      } else {
        alert(`Error: ${msg}`);
      }
    }
    setPublishing(false);
  };

  if (projectStatus !== "completed") return null;

  return (
    <div className="space-y-3 pt-3 border-t">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Video className="w-4 h-4 text-emerald-500" /> Final Video
        </h4>
        <button onClick={() => setShowFinalPreview(!showFinalPreview)} className="text-xs text-blue-600 hover:underline">
          {showFinalPreview ? "Hide" : "Show"}
        </button>
      </div>

      {showFinalPreview && (
        <div className="bg-black rounded-xl overflow-hidden shadow-lg">
          <video controls className="w-full aspect-video" key={finalVideoTimestamp} src={video.previewFinal(projectId, finalVideoTimestamp)} />
        </div>
      )}

      <div className="space-y-2">
        <a href={video.downloadFinal(projectId)} className="btn-primary w-full flex items-center justify-center gap-2">
          <Download className="w-4 h-4" /> Download Video
        </a>

        <details className="bg-slate-50 rounded-lg border">
          <summary className="px-3 py-2 cursor-pointer text-xs font-medium text-slate-600 flex items-center gap-2">
            <Image className="w-4 h-4" /> Thumbnail (Optional)
            {thumbnailGenerated && <span className="text-green-600">✓ Generated</span>}
          </summary>
          <div className="px-3 pb-3 space-y-2">
            {/* Video Type, Language & Style Selection */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Type</label>
                <select 
                  value={videoType} 
                  onChange={(e) => setVideoType(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-purple-400 focus:outline-none"
                >
                  {VIDEO_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.icon} {t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Language</label>
                <select 
                  value={thumbnailLanguage} 
                  onChange={(e) => setThumbnailLanguage(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-purple-400 focus:outline-none"
                >
                  {THUMBNAIL_LANGUAGES.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Style</label>
                <select 
                  value={thumbnailStyle} 
                  onChange={(e) => setThumbnailStyle(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-purple-400 focus:outline-none"
                >
                  {IMAGE_STYLES.map(s => (
                    <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button onClick={() => onGeneratePrompt(thumbnailLanguage, thumbnailStyle, videoType)} disabled={!!processing} className="btn-secondary w-full text-xs">
              <Sparkles className="w-3 h-3" /> {thumbnailPrompt ? "Regenerate Prompt" : "Generate Prompt"}
            </button>

        {thumbnailPrompt && (
          <div className="space-y-2">
            {thumbnailTitle && (
              <div>
                <label className="text-xs text-slate-600 font-medium">Title Text (in {thumbnailLanguage}):</label>
                <input
                  value={thumbnailTitle}
                  onChange={(e) => setThumbnailTitle(e.target.value)}
                  className="input text-xs mt-1"
                  placeholder="Title text for thumbnail..."
                />
              </div>
            )}
            <label className="text-xs text-slate-600 font-medium">Image Prompt:</label>
            <textarea
              value={thumbnailPrompt}
              onChange={(e) => setThumbnailPrompt(e.target.value)}
              className="input text-xs min-h-[80px]"
              placeholder="Describe the thumbnail image..."
            />
            <div className="flex gap-1.5">
              {IMAGE_MODELS.map(m => (
                <button key={m.id} onClick={() => setThumbnailModel(m.id)}
                  className={`flex-1 py-1.5 px-2 text-[10px] rounded-lg font-medium transition-all ${
                    thumbnailModel === m.id ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`} title={m.desc}>{m.name}</button>
              ))}
            </div>
            <button 
              onClick={() => onGenerateThumbnailFromPrompt(thumbnailPrompt, thumbnailModel, thumbnailStyle, videoType, thumbnailTitle)} 
              disabled={!!processing || !thumbnailPrompt} 
              className="btn-primary w-full text-xs"
            >
              <Image className="w-3 h-3" /> Generate Thumbnail
            </button>
          </div>
        )}

      {thumbnailGenerated && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-2 rounded-lg border border-purple-200">
          <img src={video.getThumbnail(projectId, Date.now())} alt="Thumbnail" className="w-full rounded-lg shadow-md mb-2" />
          <a href={video.getThumbnail(projectId)} download="thumbnail.jpg" className="w-full btn-secondary text-xs flex items-center justify-center gap-1">
            <Download className="w-3 h-3" /> Download Thumbnail
          </a>
        </div>
      )}
          </div>
        </details>
      </div>

      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold flex items-center gap-1"><Youtube className="w-4 h-4 text-red-500" /> YouTube Info</h4>
          <div className="flex items-center gap-2">
            {!youtubeConnected && (
              <button 
                onClick={handleConnectYoutube} 
                disabled={connectingYoutube}
                className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg hover:bg-red-700 flex items-center gap-1"
              >
                {connectingYoutube ? <Loader2 className="w-3 h-3 animate-spin" /> : <Youtube className="w-3 h-3" />}
                Connect
              </button>
            )}
            {youtubeConnected && (
              <span className="text-[10px] text-green-600 flex items-center gap-1">
                <Check className="w-3 h-3" /> Connected
              </span>
            )}
            <button onClick={onGenerateYoutubeInfo} disabled={!!processing} className="text-xs text-blue-600 hover:underline">
              {youtubeInfo.title ? "Regenerate" : "Generate"}
            </button>
          </div>
        </div>

        {youtubeInfo.title && (
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#666]">Title</label>
                <button onClick={() => copyToClipboard(youtubeInfo.title, "title")} className="text-xs text-blue-600 flex items-center gap-1">
                  {copied === "title" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <input value={youtubeInfo.title} onChange={(e) => setYoutubeInfo({ ...youtubeInfo, title: e.target.value })} className="w-full text-xs p-2 border rounded" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-[#666]">Description</label>
                <button onClick={() => copyToClipboard(youtubeInfo.description, "desc")} className="text-xs text-blue-600 flex items-center gap-1">
                  {copied === "desc" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <textarea value={youtubeInfo.description} onChange={(e) => setYoutubeInfo({ ...youtubeInfo, description: e.target.value })} className="w-full text-xs p-2 border rounded resize-none" rows={3} />
            </div>

            <div>
              <label className="text-xs text-[#666] block mb-1">Tags</label>
              <input value={youtubeInfo.tags} onChange={(e) => setYoutubeInfo({ ...youtubeInfo, tags: e.target.value })} className="w-full text-xs p-2 border rounded" />
            </div>

            <div className="border-t pt-3 mt-3">
              <label className="text-xs text-[#666] block mb-2">Privacy</label>
              <div className="flex gap-2 mb-3">
                {[
                  { id: "private", icon: Lock, label: "Private" },
                  { id: "unlisted", icon: EyeOff, label: "Unlisted" },
                  { id: "public", icon: Globe, label: "Public" },
                ].map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setPublishPrivacy(id as any)}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                      publishPrivacy === id ? (id === "public" ? "bg-red-600 text-white" : "bg-slate-900 text-white") : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Icon className="w-3 h-3" /> {label}
                  </button>
                ))}
              </div>

              <div className="mb-3">
                <label className="text-xs text-[#666] block mb-2">Category</label>
                <div className="relative">
                  <Tag className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full py-2 pl-9 pr-3 text-xs border border-slate-200 rounded-lg bg-white appearance-none cursor-pointer"
                  >
                    {YOUTUBE_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-[#666] flex items-center gap-1">
                    <Baby className="w-3 h-3" /> Made for Kids
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMadeForKids(false)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                        !madeForKids ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <User className="w-3 h-3" /> No
                    </button>
                    <button
                      onClick={() => setMadeForKids(true)}
                      className={`py-1.5 px-3 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                        madeForKids ? "bg-pink-500 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Baby className="w-3 h-3" /> Yes
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[#666]">Playlist</label>
                  <button onClick={loadPlaylists} disabled={loadingPlaylists} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <RefreshCw className={`w-3 h-3 ${loadingPlaylists ? "animate-spin" : ""}`} /> Refresh
                  </button>
                </div>
                {playlistError && (
                  <p className="text-xs text-amber-600 mb-2">{playlistError}</p>
                )}
                <div className="relative">
                  <ListVideo className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={selectedPlaylist}
                    onChange={(e) => setSelectedPlaylist(e.target.value)}
                    className="w-full py-2 pl-9 pr-3 text-xs border border-slate-200 rounded-lg bg-white appearance-none cursor-pointer"
                  >
                    <option value="">None ({playlists.length} available)</option>
                    {playlists.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-[#666] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Schedule Publish
                  </label>
                  <button
                    onClick={() => setScheduleEnabled(!scheduleEnabled)}
                    className={`w-10 h-5 rounded-full transition-colors ${scheduleEnabled ? "bg-blue-600" : "bg-slate-300"}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${scheduleEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
                  </button>
                </div>
                {scheduleEnabled && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setScheduleTime("morning")}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        scheduleTime === "morning" ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Sun className="w-3 h-3" /> Morning (9 AM)
                    </button>
                    <button
                      onClick={() => setScheduleTime("evening")}
                      className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        scheduleTime === "evening" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      <Moon className="w-3 h-3" /> Evening (7 PM)
                    </button>
                  </div>
                )}
                {scheduleEnabled && <p className="text-[10px] text-slate-500 mt-1">Video will go public at least 24h later</p>}
              </div>

              {publishedUrl ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
                    <Check className="w-4 h-4" /> {scheduledAt ? "Scheduled!" : "Published!"}
                  </div>
                  {scheduledAt && (
                    <p className="text-xs text-slate-600 mb-2">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Goes public: {new Date(scheduledAt).toLocaleString()}
                    </p>
                  )}
                  <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> {publishedUrl}
                  </a>
                </div>
              ) : quotaExceeded ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                  ⚠️ YouTube quota exceeded. Use manual upload.
                </div>
              ) : (
                <button onClick={handlePublish} disabled={publishing || !youtubeInfo.title} className="w-full py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {publishing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> {scheduleEnabled ? "Scheduling..." : "Publishing..."}</>
                  ) : (
                    <><Upload className="w-4 h-4" /> {scheduleEnabled ? "Schedule Upload" : "Publish to YouTube"}</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

