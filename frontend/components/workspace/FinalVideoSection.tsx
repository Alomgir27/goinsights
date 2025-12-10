"use client";

import React, { useState, useEffect } from "react";
import { Video, Download, Image, Sparkles, Copy, Check, Youtube, Upload, Loader2, ExternalLink, Globe, Lock, EyeOff, ListVideo, RefreshCw } from "lucide-react";
import { video, youtube } from "@/lib/api";

const IMAGE_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", desc: "Fast" },
  { id: "gemini-3-pro", name: "Gemini 3 Pro", desc: "High quality" },
  { id: "dall-e-3", name: "DALL-E 3", desc: "OpenAI" },
];

interface FinalVideoSectionProps {
  projectId: string;
  projectStatus: string;
  language: string;
  script: string;
  onGeneratePrompt: () => void;
  onGenerateThumbnailFromPrompt: (prompt: string, model: string) => void;
  onGenerateYoutubeInfo: () => void;
  processing: string;
  thumbnailPrompt: string;
  setThumbnailPrompt: (prompt: string) => void;
  thumbnailGenerated: boolean;
  thumbnailModel: string;
  setThumbnailModel: (model: string) => void;
  youtubeInfo: { title: string; description: string; tags: string };
  setYoutubeInfo: (info: { title: string; description: string; tags: string }) => void;
  showFinalPreview: boolean;
  setShowFinalPreview: (show: boolean) => void;
  finalVideoTimestamp: number;
}

export default function FinalVideoSection({
  projectId, projectStatus, language, script, onGeneratePrompt, onGenerateThumbnailFromPrompt, onGenerateYoutubeInfo,
  processing, thumbnailPrompt, setThumbnailPrompt, thumbnailGenerated, thumbnailModel, setThumbnailModel,
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

  const [playlistError, setPlaylistError] = useState<string>("");
  
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

  useEffect(() => { loadPlaylists(); }, []);

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
      const { data } = await youtube.publish(projectId, youtubeInfo.title, youtubeInfo.description, youtubeInfo.tags, publishPrivacy, selectedPlaylist || null, accessToken);
      if (data.success) {
        setPublishedUrl(data.video_url);
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
        <div className="flex gap-2">
          <button onClick={onGeneratePrompt} disabled={!!processing} className="btn-secondary flex-1">
            <Sparkles className="w-4 h-4" /> {thumbnailPrompt ? "Regen Prompt" : "Generate Prompt"}
          </button>
          <a href={video.downloadFinal(projectId)} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Download className="w-4 h-4" /> Download Video
          </a>
        </div>

        {thumbnailPrompt && (
          <div className="space-y-2 p-3 bg-slate-50 rounded-lg border">
            <label className="text-xs text-slate-600 font-medium">Thumbnail Prompt (edit if needed):</label>
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
              onClick={() => onGenerateThumbnailFromPrompt(thumbnailPrompt, thumbnailModel)} 
              disabled={!!processing || !thumbnailPrompt} 
              className="btn-primary w-full"
            >
              <Image className="w-4 h-4" /> Generate Thumbnail
            </button>
          </div>
        )}
      </div>

      {thumbnailGenerated && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-3 rounded-lg border border-purple-200">
          <img src={video.getThumbnail(projectId, Date.now())} alt="Thumbnail" className="w-full rounded-lg shadow-md mb-2" />
          <a href={video.getThumbnail(projectId)} download="thumbnail.jpg" className="w-full btn-secondary text-xs flex items-center justify-center gap-1">
            <Download className="w-3 h-3" /> Download Thumbnail
          </a>
        </div>
      )}

      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold flex items-center gap-1"><Youtube className="w-4 h-4 text-red-500" /> YouTube Info</h4>
          <button onClick={onGenerateYoutubeInfo} disabled={!!processing} className="text-xs text-blue-600 hover:underline">
            {youtubeInfo.title ? "Regenerate" : "Generate"}
          </button>
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

              {publishedUrl ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-700 text-sm font-medium mb-2">
                    <Check className="w-4 h-4" /> Published!
                  </div>
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
                  {publishing ? <><Loader2 className="w-4 h-4 animate-spin" /> Publishing...</> : <><Upload className="w-4 h-4" /> Publish to YouTube</>}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

