"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sparkles, Play, Download, Check, Smartphone, Home, Wand2, Eye, Clock, Scissors, Layers, Upload, Youtube, Edit2, Trash2 } from "lucide-react";
import Link from "next/link";
import { inshorts } from "@/lib/api";
import { InshortsEffects, InshortsOptions, DEFAULT_INSHORTS_EFFECTS, DEFAULT_INSHORTS_OPTIONS } from "@/lib/types";

interface BatchShort {
  id: string;
  start: number;
  end: number;
  title: string;
  description: string;
  tags: string;
  effects: InshortsEffects;
  status: "pending" | "processing" | "completed" | "failed" | "uploaded";
  youtube_id?: string;
}

interface Segment {
  start: number;
  end: number;
  score: number;
  reason: string;
  transcript?: string;
}

interface ProjectData {
  id: string;
  title: string;
  thumbnail_url: string;
  duration: number;
  video_id: string;
  transcript: any[];
  inshorts_segments: Segment[];
  inshorts_selected: { start: number; end: number } | null;
  inshorts_effects: InshortsEffects;
  inshorts_options: InshortsOptions;
  status: string;
}

export default function InshortsWorkspace() {
  const { id } = useParams();
  const router = useRouter();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [customStart, setCustomStart] = useState(0);
  const [customEnd, setCustomEnd] = useState(60);
  const [effects, setEffects] = useState<InshortsEffects>(DEFAULT_INSHORTS_EFFECTS);
  const [options, setOptions] = useState<InshortsOptions>(DEFAULT_INSHORTS_OPTIONS);
  const [videoReady, setVideoReady] = useState(false);
  const [mode, setMode] = useState<"single" | "batch">("single");
  const [batchShorts, setBatchShorts] = useState<BatchShort[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchCount, setBatchCount] = useState(5);
  const [editingShort, setEditingShort] = useState<string | null>(null);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [uploadingShort, setUploadingShort] = useState<string | null>(null);
  const [singleTitle, setSingleTitle] = useState("");
  const [singleDescription, setSingleDescription] = useState("");
  const [singleTags, setSingleTags] = useState("");
  const [generatingMeta, setGeneratingMeta] = useState(false);
  const [uploadingSingle, setUploadingSingle] = useState(false);

  useEffect(() => {
    setYoutubeConnected(localStorage.getItem("youtube_connected") === "true");
    
    // Listen for storage changes (when YouTube is connected in popup)
    const handleStorage = () => {
      setYoutubeConnected(localStorage.getItem("youtube_connected") === "true");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      const { data } = await inshorts.get(id as string);
      setProject(data);
      setVideoReady(false); // Reset until we confirm video exists
      if (data.inshorts_effects) setEffects({ ...DEFAULT_INSHORTS_EFFECTS, ...data.inshorts_effects });
      if (data.inshorts_options) setOptions({ ...DEFAULT_INSHORTS_OPTIONS, ...data.inshorts_options });
      if (data.inshorts_selected) {
        setCustomStart(data.inshorts_selected.start);
        setCustomEnd(data.inshorts_selected.end);
      }
      setVideoReady(data.status === "completed");
    } catch {
      router.push("/inshorts");
    }
    setLoading(false);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { data } = await inshorts.analyze(id as string, 15, 90);
      setProject(prev => prev ? { ...prev, inshorts_segments: data.segments } : prev);
    } catch {}
    setAnalyzing(false);
  };

  const selectSegment = (seg: Segment) => {
    setSelectedSegment(seg);
    setCustomStart(seg.start);
    setCustomEnd(seg.end);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setVideoReady(false);
    try {
      await inshorts.generate(id as string, {
        segment_start: customStart,
        segment_end: customEnd,
        effects,
        options
      });
      pollStatus();
    } catch {
      setGenerating(false);
    }
  };

  const pollStatus = async () => {
    const interval = setInterval(async () => {
      try {
        const { data } = await inshorts.status(id as string);
        if (data.status === "completed" && data.has_video) {
          setVideoReady(true);
          setGenerating(false);
          clearInterval(interval);
        } else if (data.status === "failed") {
          setGenerating(false);
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
        setGenerating(false);
      }
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const suggestBatchShorts = async () => {
    setBatchLoading(true);
    try {
      const { data } = await inshorts.batchSuggest(id as string, batchCount, 15, 60);
      setBatchShorts(data.shorts || []);
    } catch (e) {
      console.error(e);
    }
    setBatchLoading(false);
  };

  const loadBatchShorts = async () => {
    try {
      const { data } = await inshorts.batchGet(id as string);
      if (data.shorts?.length) setBatchShorts(data.shorts);
    } catch {}
  };

  const generateBatchShorts = async () => {
    const pendingIds = batchShorts.filter(s => s.status === "pending").map(s => s.id);
    if (!pendingIds.length) return;
    
    // Save shorts with their effects first
    try {
      await inshorts.batchUpdate(id as string, batchShorts);
    } catch {}
    
    setBatchLoading(true);
    try {
      await inshorts.batchGenerate(id as string, pendingIds, DEFAULT_INSHORTS_EFFECTS, options);
      pollBatchStatus();
    } catch (e) {
      console.error(e);
      setBatchLoading(false);
    }
  };

  const pollBatchStatus = () => {
    const interval = setInterval(async () => {
      try {
        const { data } = await inshorts.batchGet(id as string);
        setBatchShorts(data.shorts || []);
        const allDone = data.shorts?.every((s: BatchShort) => s.status !== "processing" && s.status !== "pending");
        if (allDone) {
          clearInterval(interval);
          setBatchLoading(false);
        }
      } catch {
        clearInterval(interval);
        setBatchLoading(false);
      }
    }, 3000);
  };

  const connectYoutube = () => {
    const popup = window.open("/connect", "_blank", "width=500,height=600");
    // Poll for popup close and check connection
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        setYoutubeConnected(localStorage.getItem("youtube_connected") === "true");
      }
    }, 500);
  };

  const uploadToYoutube = async (short: BatchShort) => {
    // Check for token (try both keys for compatibility)
    let token = localStorage.getItem("youtube_token") || localStorage.getItem("youtube_access_token");
    
    if (!token || token.length < 20) {
      setYoutubeConnected(false);
      alert("YouTube not connected. Please click 'Connect YouTube' button and complete the authentication.");
      return;
    }
    
    setUploadingShort(short.id);
    try {
      const { data } = await inshorts.batchUpload(id as string, {
        short_id: short.id,
        title: short.title,
        description: short.description,
        tags: short.tags,
        access_token: token,
        privacy: "public"
      });
      setBatchShorts(prev => prev.map(s => s.id === short.id ? { ...s, status: "uploaded", youtube_id: data.video_id } : s));
    } catch (e: any) {
      alert(e.response?.data?.detail || "Upload failed");
    }
    setUploadingShort(null);
  };

  const updateShort = (shortId: string, updates: Partial<BatchShort>) => {
    setBatchShorts(prev => prev.map(s => s.id === shortId ? { ...s, ...updates } : s));
  };

  const removeShort = (shortId: string) => {
    setBatchShorts(prev => prev.filter(s => s.id !== shortId));
  };

  useEffect(() => {
    if (mode === "batch") loadBatchShorts();
  }, [mode]);

  const generateSingleMeta = async () => {
    if (!project) return;
    setGeneratingMeta(true);
    try {
      const { data } = await inshorts.batchSuggest(id as string, 1, customEnd - customStart, customEnd - customStart + 5);
      if (data.shorts?.[0]) {
        setSingleTitle(data.shorts[0].title || "");
        setSingleDescription(data.shorts[0].description || "");
        setSingleTags(data.shorts[0].tags || "");
      }
    } catch (e) {
      console.error(e);
    }
    setGeneratingMeta(false);
  };

  const uploadSingleToYoutube = async () => {
    const token = localStorage.getItem("youtube_token") || localStorage.getItem("youtube_access_token");
    if (!token) {
      alert("Please connect YouTube first");
      return;
    }
    if (!singleTitle) {
      alert("Please add a title first");
      return;
    }
    setUploadingSingle(true);
    try {
      const { data } = await inshorts.batchUpload(id as string, {
        short_id: "single",
        title: singleTitle,
        description: singleDescription,
        tags: singleTags,
        access_token: token,
        privacy: "public"
      });
      alert(`Uploaded! https://youtube.com/shorts/${data.video_id}`);
    } catch (e: any) {
      alert(e.response?.data?.detail || "Upload failed");
    }
    setUploadingSingle(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-white to-rose-50">
        <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
      </div>
    );
  }

  if (!project) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50 py-6 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-white/80 rounded-lg transition-colors">
              <Home className="w-5 h-5 text-[#666]" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-lg flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[#1a1a1a] line-clamp-1">{project.title}</h1>
                <p className="text-xs text-[#666]">Duration: {formatTime(project.duration)}</p>
              </div>
            </div>
          </div>
          <Link href="/inshorts" className="btn-secondary text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setMode("single")}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              mode === "single" ? "bg-pink-600 text-white" : "bg-white text-[#666] border border-pink-100"
            }`}
          >
            <Scissors className="w-4 h-4" /> Single Short
          </button>
          <button
            onClick={() => setMode("batch")}
            className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
              mode === "batch" ? "bg-pink-600 text-white" : "bg-white text-[#666] border border-pink-100"
            }`}
          >
            <Layers className="w-4 h-4" /> Batch Mode
          </button>
        </div>

        {mode === "batch" ? (
          /* Batch Mode UI */
          <div className="space-y-4">
            {/* YouTube Connect */}
            <div className="bg-white rounded-xl p-3 shadow-sm border border-pink-100 flex items-center justify-between">
              <span className="text-sm text-[#666]">
                {youtubeConnected ? "✓ YouTube connected" : "Connect YouTube to upload shorts"}
              </span>
              <button
                onClick={connectYoutube}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 ${
                  youtubeConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}
              >
                <Youtube className="w-4 h-4" />
                {youtubeConnected ? "Reconnect" : "Connect YouTube"}
              </button>
            </div>

            {/* Batch Controls */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-pink-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-[#1a1a1a] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-600" /> AI Batch Suggestions
                </h2>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-[#666]">
                    Count:
                    <select
                      value={batchCount}
                      onChange={(e) => setBatchCount(Number(e.target.value))}
                      className="ml-2 px-2 py-1 border rounded text-sm"
                    >
                      {[3, 5, 7, 10].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </label>
                  <button
                    onClick={suggestBatchShorts}
                    disabled={batchLoading}
                    className="btn-primary text-sm"
                  >
                    {batchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    Generate Suggestions
                  </button>
                </div>
              </div>

              {batchShorts.length === 0 ? (
                <p className="text-center text-[#999] py-8">Click "Generate Suggestions" to get AI-recommended shorts</p>
              ) : (
                <div className="space-y-3">
                  {batchShorts.map((short, idx) => (
                    <div key={short.id} className={`p-3 rounded-lg border ${
                      short.status === "completed" ? "border-green-200 bg-green-50" :
                      short.status === "uploaded" ? "border-blue-200 bg-blue-50" :
                      short.status === "processing" ? "border-yellow-200 bg-yellow-50" :
                      "border-pink-100 bg-white"
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {editingShort === short.id ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-2">
                                <input type="text" value={short.title} onChange={(e) => updateShort(short.id, { title: e.target.value })} className="px-2 py-1.5 border rounded text-sm font-medium" placeholder="Title" />
                                <div className="flex gap-2">
                                  <input type="number" value={short.start} onChange={(e) => updateShort(short.id, { start: Number(e.target.value) })} className="w-20 px-2 py-1.5 border rounded text-sm" />
                                  <span className="py-1.5 text-[#999]">-</span>
                                  <input type="number" value={short.end} onChange={(e) => updateShort(short.id, { end: Number(e.target.value) })} className="w-20 px-2 py-1.5 border rounded text-sm" />
                                </div>
                              </div>
                              <textarea value={short.description} onChange={(e) => updateShort(short.id, { description: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Description" rows={2} />
                              <input type="text" value={short.tags} onChange={(e) => updateShort(short.id, { tags: e.target.value })} className="w-full px-2 py-1.5 border rounded text-sm" placeholder="Tags" />
                              
                              {/* Same effects layout as single mode */}
                              <div className="pt-2 border-t space-y-3">
                                <label className="flex items-center justify-between">
                                  <span className="text-sm">Background Blur</span>
                                  <input type="checkbox" checked={short.effects?.blur ?? true} onChange={(e) => updateShort(short.id, { effects: { ...short.effects, blur: e.target.checked } })} className="w-4 h-4 accent-pink-500" />
                                </label>
                                <label className="flex items-center justify-between">
                                  <span className="text-sm">Vignette</span>
                                  <input type="checkbox" checked={short.effects?.vignette ?? false} onChange={(e) => updateShort(short.id, { effects: { ...short.effects, vignette: e.target.checked } })} className="w-4 h-4 accent-pink-500" />
                                </label>
                                <div>
                                  <label className="text-sm block mb-1">Zoom</label>
                                  <div className="grid grid-cols-4 gap-1">
                                    {["none", "in", "out", "ken_burns"].map(z => (
                                      <button key={z} onClick={() => updateShort(short.id, { effects: { ...short.effects, zoom: z as any } })} className={`py-1.5 rounded text-xs font-medium ${short.effects?.zoom === z ? "bg-pink-600 text-white" : "bg-gray-100"}`}>{z === "ken_burns" ? "Ken Burns" : z.charAt(0).toUpperCase() + z.slice(1)}</button>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm block mb-1">Animation</label>
                                  <div className="grid grid-cols-4 gap-1">
                                    {["none", "fade", "pulse", "glitch", "shake", "mirror_h", "mirror_v", "letterbox"].map(a => (
                                      <button key={a} onClick={() => updateShort(short.id, { effects: { ...short.effects, animation: a as any } })} className={`py-1.5 rounded text-xs font-medium ${short.effects?.animation === a ? "bg-pink-600 text-white" : "bg-gray-100"}`}>{a === "none" ? "None" : a.replace("_", " ").split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</button>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm block mb-1">Color</label>
                                  <div className="grid grid-cols-4 gap-1">
                                    {["none", "cinematic", "warm", "cool", "vintage", "vibrant", "bw", "sepia"].map(c => (
                                      <button key={c} onClick={() => updateShort(short.id, { effects: { ...short.effects, colorGrade: c as any } })} className={`py-1.5 rounded text-xs font-medium ${short.effects?.colorGrade === c ? "bg-pink-600 text-white" : "bg-gray-100"}`}>{c === "bw" ? "B&W" : c.charAt(0).toUpperCase() + c.slice(1)}</button>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm block mb-1">Overlay</label>
                                  <div className="grid grid-cols-5 gap-1">
                                    {["none", "grain", "sparkle", "light_leak", "rainbow", "vhs", "glow", "dust", "strobe", "scanlines"].map(o => (
                                      <button key={o} onClick={() => updateShort(short.id, { effects: { ...short.effects, overlay: o as any } })} className={`py-1.5 rounded text-xs font-medium ${short.effects?.overlay === o ? "bg-pink-600 text-white" : "bg-gray-100"}`}>{o === "light_leak" ? "Leak" : o.charAt(0).toUpperCase() + o.slice(1)}</button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <button onClick={() => setEditingShort(null)} className="w-full py-2 bg-pink-600 text-white rounded-lg text-sm font-medium">✓ Done</button>
                            </div>
                          ) : (
                            <>
                              <h3 className="font-medium text-[#1a1a1a]">#{idx + 1} {short.title}</h3>
                              <p className="text-xs text-[#666] mt-1">{short.description}</p>
                              <p className="text-xs text-pink-600 mt-1">{short.tags}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-[#999]">{formatTime(short.start)} - {formatTime(short.end)} ({Math.round(short.end - short.start)}s)</p>
                                <span className="text-xs text-[#ccc]">•</span>
                                <p className="text-xs text-purple-500">
                                  {[
                                    short.effects?.blur && "Blur",
                                    short.effects?.vignette && "Vignette",
                                    short.effects?.zoom !== "none" && short.effects?.zoom,
                                    short.effects?.animation !== "none" && short.effects?.animation,
                                    short.effects?.colorGrade !== "none" && short.effects?.colorGrade,
                                    short.effects?.overlay !== "none" && short.effects?.overlay
                                  ].filter(Boolean).join(", ") || "No effects"}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {short.status === "completed" && (
                            <>
                              <a
                                href={inshorts.batchVideoUrl(id as string, short.id)}
                                target="_blank"
                                className="p-1.5 bg-green-100 rounded text-green-600 hover:bg-green-200"
                                title="Preview"
                              >
                                <Play className="w-4 h-4" />
                              </a>
                              <button
                                onClick={() => {
                                  updateShort(short.id, { status: "pending" });
                                }}
                                className="p-1.5 bg-orange-100 rounded text-orange-600 hover:bg-orange-200"
                                title="Regenerate"
                              >
                                <Wand2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => uploadToYoutube(short)}
                                disabled={uploadingShort === short.id}
                                className="p-1.5 bg-red-100 rounded text-red-600 hover:bg-red-200 disabled:opacity-50"
                                title="Upload to YouTube"
                              >
                                {uploadingShort === short.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Youtube className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                          {short.status === "uploaded" && (
                            <a
                              href={`https://youtube.com/shorts/${short.youtube_id}`}
                              target="_blank"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View on YouTube
                            </a>
                          )}
                          {short.status === "processing" && <Loader2 className="w-4 h-4 animate-spin text-yellow-600" />}
                          {editingShort !== short.id && (
                            <button onClick={() => setEditingShort(short.id)} className="p-1.5 hover:bg-gray-100 rounded">
                              <Edit2 className="w-4 h-4 text-[#666]" />
                            </button>
                          )}
                          <button onClick={() => removeShort(short.id)} className="p-1.5 hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {batchShorts.length > 0 && (
                <div className="mt-4 space-y-3">
                  {/* Batch Options */}
                  <div className="flex items-center gap-4 py-2 px-3 bg-gray-50 rounded-lg">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={options.antiCopyright}
                        onChange={(e) => setOptions({ ...options, antiCopyright: e.target.checked })}
                        className="w-4 h-4 accent-pink-500"
                      />
                      <span>Anti-Copyright (Pitch Shift)</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={options.keepAudio}
                        onChange={(e) => setOptions({ ...options, keepAudio: e.target.checked })}
                        className="w-4 h-4 accent-pink-500"
                      />
                      <span>Keep Audio</span>
                    </label>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-[#666]">
                      {batchShorts.filter(s => s.status === "pending").length} pending, {batchShorts.filter(s => s.status === "completed").length} completed
                    </p>
                    <button
                      onClick={generateBatchShorts}
                      disabled={batchLoading || !batchShorts.some(s => s.status === "pending")}
                      className="btn-primary"
                    >
                      {batchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Generate All Shorts
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>
        ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Segments */}
          <div className="lg:col-span-2 space-y-4">
            {/* Source Video Preview */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-pink-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-[#1a1a1a] flex items-center gap-2">
                  <Play className="w-4 h-4 text-pink-600" /> Source Video
                </h2>
                <a
                  href={`https://youtube.com/watch?v=${project.video_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-pink-600 hover:underline"
                >
                  Watch on YouTube
                </a>
              </div>
              <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                <img src={project.thumbnail_url} alt={project.title} className="w-full h-full object-cover" />
              </div>
            </div>

            {/* AI Segments */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-pink-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-[#1a1a1a] flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-600" /> AI Suggested Segments
                </h2>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="px-3 py-1.5 bg-pink-100 text-pink-700 rounded-lg text-sm font-medium hover:bg-pink-200 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {analyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                  {analyzing ? "Analyzing..." : "Analyze Video"}
                </button>
              </div>

              {project.inshorts_segments?.length ? (
                <div className="space-y-2">
                  {project.inshorts_segments.map((seg, i) => (
                    <button
                      key={i}
                      onClick={() => selectSegment(seg)}
                      className={`w-full p-3 rounded-lg border text-left transition-all ${
                        selectedSegment === seg
                          ? "border-pink-500 bg-pink-50 ring-1 ring-pink-500"
                          : "border-gray-200 hover:border-pink-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[#1a1a1a]">
                          {formatTime(seg.start)} - {formatTime(seg.end)}
                        </span>
                        <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full">
                          Score: {seg.score}
                        </span>
                      </div>
                      <p className="text-xs text-[#666]">{seg.reason}</p>
                      {seg.transcript && <p className="text-xs text-[#999] mt-1 line-clamp-1">{seg.transcript}</p>}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#666] text-center py-6">
                  Click "Analyze Video" to get AI-suggested segments
                </p>
              )}

              {/* Custom Segment */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-medium text-[#1a1a1a] mb-3 flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-pink-600" /> Custom Segment
                </h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-[#666] block mb-1">Start</label>
                    <input
                      type="number"
                      value={customStart}
                      onChange={(e) => setCustomStart(Number(e.target.value))}
                      min={0}
                      max={project.duration}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-[#666] block mb-1">End</label>
                    <input
                      type="number"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(Number(e.target.value))}
                      min={customStart}
                      max={project.duration}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    />
                  </div>
                  <div className="pt-5">
                    <span className="text-xs text-pink-600 font-medium">
                      {customEnd - customStart}s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Effects & Options */}
          <div className="space-y-4">
            {/* Effects */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-pink-100">
              <h2 className="font-semibold text-[#1a1a1a] mb-4 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-pink-600" /> Effects
              </h2>

              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-[#1a1a1a]">Background Blur</span>
                  <input
                    type="checkbox"
                    checked={effects.blur}
                    onChange={(e) => setEffects({ ...effects, blur: e.target.checked })}
                    className="w-4 h-4 accent-pink-500"
                  />
                </label>

                <div>
                  <label className="text-sm text-[#1a1a1a] block mb-1.5">Zoom</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: "none", label: "None" },
                      { id: "in", label: "In" },
                      { id: "out", label: "Out" },
                      { id: "ken_burns", label: "Ken Burns" }
                    ].map((z) => (
                      <button
                        key={z.id}
                        onClick={() => setEffects({ ...effects, zoom: z.id as any })}
                        className={`py-1.5 rounded text-xs font-medium ${
                          effects.zoom === z.id ? "bg-pink-600 text-white" : "bg-gray-100 text-[#666]"
                        }`}
                      >
                        {z.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[#1a1a1a] block mb-1.5">Animation</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: "none", label: "None" },
                      { id: "fade", label: "Fade" },
                      { id: "pulse", label: "Pulse" },
                      { id: "letterbox", label: "Cinema" },
                      { id: "flash", label: "Flash" },
                      { id: "glitch", label: "Glitch" },
                      { id: "shake", label: "Shake" },
                      { id: "rotate", label: "Rotate" },
                      { id: "mirror_h", label: "Flip H" },
                      { id: "mirror_v", label: "Flip V" },
                      { id: "mirror_split", label: "Mirror" }
                    ].map((a) => (
                      <button
                        key={a.id}
                        onClick={() => setEffects({ ...effects, animation: a.id as any })}
                        className={`py-1.5 rounded text-xs font-medium ${
                          effects.animation === a.id ? "bg-pink-600 text-white" : "bg-gray-100 text-[#666]"
                        }`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[#1a1a1a] block mb-1.5">Color Grade</label>
                  <div className="grid grid-cols-4 gap-1">
                    {[
                      { id: "none", label: "None" },
                      { id: "cinematic", label: "Cinema" },
                      { id: "warm", label: "Warm" },
                      { id: "cool", label: "Cool" },
                      { id: "vintage", label: "Vintage" },
                      { id: "vibrant", label: "Vibrant" },
                      { id: "bw", label: "B&W" },
                      { id: "sepia", label: "Sepia" }
                    ].map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setEffects({ ...effects, colorGrade: c.id })}
                        className={`py-1.5 rounded text-xs font-medium ${
                          effects.colorGrade === c.id ? "bg-pink-600 text-white" : "bg-gray-100 text-[#666]"
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm text-[#1a1a1a] block mb-1.5">Overlay / Light Effects</label>
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { id: "none", label: "None" },
                      { id: "grain", label: "Grain" },
                      { id: "scanlines", label: "Scanline" },
                      { id: "vhs", label: "VHS" },
                      { id: "dust", label: "Dust" },
                      { id: "sparkle", label: "Sparkle" },
                      { id: "light_leak", label: "Light Leak" },
                      { id: "rainbow", label: "Rainbow" },
                      { id: "strobe", label: "Strobe" },
                      { id: "glow", label: "Glow" }
                    ].map((o) => (
                      <button
                        key={o.id}
                        onClick={() => setEffects({ ...effects, overlay: o.id as any })}
                        className={`py-1.5 rounded text-xs font-medium ${
                          effects.overlay === o.id ? "bg-pink-600 text-white" : "bg-gray-100 text-[#666]"
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={effects.vignette}
                      onChange={(e) => setEffects({ ...effects, vignette: e.target.checked })}
                      className="w-4 h-4 accent-pink-500"
                    />
                    <span className="text-sm text-[#1a1a1a]">Vignette</span>
                  </label>
                </div>

                <div>
                  <label className="text-sm text-[#1a1a1a] block mb-1.5">Speed: {effects.speed}x</label>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={effects.speed}
                    onChange={(e) => setEffects({ ...effects, speed: Number(e.target.value) })}
                    className="w-full accent-pink-500"
                  />
                </div>
              </div>
            </div>

            {/* Options */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-pink-100">
              <h2 className="font-semibold text-[#1a1a1a] mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-pink-600" /> Options
              </h2>

              <div className="space-y-3">
                <label className="flex items-center justify-between">
                  <span className="text-sm text-[#1a1a1a]">Auto Subtitles</span>
                  <input
                    type="checkbox"
                    checked={options.subtitles}
                    onChange={(e) => setOptions({ ...options, subtitles: e.target.checked })}
                    className="w-4 h-4 accent-pink-500"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-sm text-[#1a1a1a]">Keep Original Audio</span>
                  <input
                    type="checkbox"
                    checked={options.keepAudio}
                    onChange={(e) => setOptions({ ...options, keepAudio: e.target.checked })}
                    className="w-4 h-4 accent-pink-500"
                  />
                </label>

                <label className="flex items-center justify-between">
                  <span className="text-sm text-[#1a1a1a]">Anti-Copyright (Pitch Shift)</span>
                  <input
                    type="checkbox"
                    checked={options.antiCopyright}
                    onChange={(e) => setOptions({ ...options, antiCopyright: e.target.checked })}
                    className="w-4 h-4 accent-pink-500"
                  />
                </label>

                <div>
                  <label className="text-sm text-[#1a1a1a] block mb-1.5">Aspect Ratio</label>
                  <div className="flex gap-2">
                    {["9:16", "1:1"].map((r) => (
                      <button
                        key={r}
                        onClick={() => setOptions({ ...options, aspectRatio: r as any })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                          options.aspectRatio === r ? "bg-pink-600 text-white" : "bg-gray-100 text-[#666] hover:bg-gray-200"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={generating || customEnd - customStart < 5}
              className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-xl font-semibold hover:from-pink-600 hover:to-rose-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Generating Short...
                </>
              ) : (
                <>
                  <Smartphone className="w-5 h-5" /> Generate Short ({customEnd - customStart}s)
                </>
              )}
            </button>

            {/* Video Preview & Download */}
            {videoReady && mode === "single" && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-200">
                <h2 className="font-semibold text-[#1a1a1a] mb-3 flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-600" /> Preview
                </h2>
                <div className="aspect-[9/16] max-h-[400px] bg-black rounded-lg overflow-hidden mb-3">
                  <video
                    key={videoReady ? "ready" : "loading"}
                    src={`http://localhost:8000/api/inshorts/${id}/video`}
                    controls
                    autoPlay
                    muted
                    preload="auto"
                    className="w-full h-full object-contain"
                    playsInline
                    onError={(e) => setVideoReady(false)}
                  />
                </div>
                <a
                  href={`http://localhost:8000/api/inshorts/${id}/video?download=true`}
                  download="short.mp4"
                  className="w-full py-3 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 flex items-center justify-center gap-2 mb-4"
                >
                  <Download className="w-5 h-5" /> Download Short
                </a>

                {/* YouTube Upload Section */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-[#1a1a1a]">Upload to YouTube</h3>
                    <button
                      onClick={generateSingleMeta}
                      disabled={generatingMeta}
                      className="text-xs px-2 py-1 bg-pink-100 text-pink-700 rounded flex items-center gap-1"
                    >
                      {generatingMeta ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      AI Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    value={singleTitle}
                    onChange={(e) => setSingleTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <textarea
                    value={singleDescription}
                    onChange={(e) => setSingleDescription(e.target.value)}
                    placeholder="Description"
                    rows={2}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={singleTags}
                    onChange={(e) => setSingleTags(e.target.value)}
                    placeholder="#tags #shorts"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <button
                    onClick={uploadSingleToYoutube}
                    disabled={uploadingSingle || !singleTitle}
                    className="w-full py-3 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploadingSingle ? <Loader2 className="w-5 h-5 animate-spin" /> : <Youtube className="w-5 h-5" />}
                    {uploadingSingle ? "Uploading..." : "Upload to YouTube"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

