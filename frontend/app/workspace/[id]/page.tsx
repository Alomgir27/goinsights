"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import ReactPlayer from "react-player";
import { Download, Clock, Sparkles, Loader2, FileText, Play, Pause, RefreshCw, Merge, Video, Image, Settings, Scissors, ArrowLeft, Music, Copy, Check, Youtube, X, Volume2 } from "lucide-react";
import Link from "next/link";
import { ai, voice, video, projects } from "@/lib/api";
import { useStore } from "@/lib/store";

interface MusicPreset { id: string; name: string; desc: string; cached: boolean; }

interface Segment { 
  text: string; 
  start: number;  // Output video timeline
  end: number; 
  sourceStart: number;  // Original video clip source
  sourceEnd: number;
  audioGenerated: boolean; 
  clipExtracted: boolean; 
  timestamp: number; 
}

export default function Workspace(): React.ReactElement {
  const { id } = useParams();
  const { project, setProject, updateProject } = useStore();
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState("sarah");
  const [processing, setProcessing] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [extractingIndex, setExtractingIndex] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1.0);
  const [stability, setStability] = useState(0.5);
  const [videoDownloaded, setVideoDownloaded] = useState(false);
  const [mergeOptions, setMergeOptions] = useState({ subtitles: false, resize: "16:9", bgMusic: "", bgMusicVolume: 0.3 });
  const [showMusicSheet, setShowMusicSheet] = useState(false);
  const [youtubeInfo, setYoutubeInfo] = useState({ title: "", description: "", tags: "" });
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");
  const [thumbnailGenerated, setThumbnailGenerated] = useState(false);
  const [copied, setCopied] = useState("");
  const [step, setStep] = useState<"script" | "segments" | "options">("script");
  const [previewClip, setPreviewClip] = useState<number | null>(null);
  const [targetDuration, setTargetDuration] = useState(60);
  const [playingPreset, setPlayingPreset] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [musicPresets, setMusicPresets] = useState<MusicPreset[]>([]);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => { if (id && !project) loadProject(); }, [id]);

  const loadProject = useCallback(async () => {
    try {
      const { data } = await projects.get(id as string);
      setProject({
        id: data.id, videoId: data.video_id, title: data.title, thumbnail: data.thumbnail_url,
        duration: data.duration, transcript: data.transcript || [], summary: data.summary,
        script: data.script, segments_data: data.segments_data, clips: [], status: data.status
      });
      if (data.script) setStep("segments");
      
      // Check existing files
      const { data: filesData } = await voice.checkExistingSegments(data.id);
      if (filesData.video_downloaded) setVideoDownloaded(true);
    } catch {}
  }, [id, setProject]);

  useEffect(() => {
    const initSegments = async () => {
      if (!project?.script || segments.length > 0) return;
      
      // Check for existing audio/clip files first
      let existingAudio: number[] = [];
      let existingClips: number[] = [];
      try {
        const { data } = await voice.checkExistingSegments(project.id);
        existingAudio = data.existing_segments || [];
        existingClips = data.existing_clips || [];
        if (data.video_downloaded) setVideoDownloaded(true);
      } catch {}
      
      // Use AI-generated segments from DB if available
      if (project.segments_data && project.segments_data.length > 0) {
        const aiSegments = project.segments_data.map((s: any, i: number) => ({
          text: s.text,
          start: s.start || 0,
          end: s.end || 8,
          sourceStart: s.source_start || 0,
          sourceEnd: s.source_end || 10,
          audioGenerated: existingAudio.includes(i),
          clipExtracted: existingClips.includes(i),
          timestamp: Date.now()
        }));
        setSegments(aiSegments);
        return;
      }
      
      // Fallback: split script into sentences (only if no AI segments)
      const parts = project.script.split(/(?<=[.!?])\s+/).filter((s: string) => s.trim());
      const videoDur = project.duration || 300;
      const segDur = Math.max(6, Math.floor(targetDuration / Math.min(parts.length, 10)));
      
      let currentTime = 0;
      const newSegments = parts.slice(0, 10).map((text: string, i: number) => {
        const start = currentTime;
        const end = start + segDur;
        currentTime = end;
        return {
          text,
          start,
          end,
          sourceStart: Math.floor((i / 10) * videoDur),
          sourceEnd: Math.floor(((i + 1) / 10) * videoDur),
          audioGenerated: existingAudio.includes(i),
          clipExtracted: existingClips.includes(i),
          timestamp: Date.now()
        };
      });
      setSegments(newSegments);
    };
    
    initSegments();
  }, [project?.script, project?.segments_data]);

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1a1a]" />
        <span className="text-sm text-[#666]">Loading project...</span>
      </div>
    );
  }

  const handleScript = async () => {
    setProcessing(`Generating ${targetDuration}s script...`);
    try {
      const { data } = await ai.script(project.id, targetDuration);
      updateProject({ script: data.script });
      
      // Use AI-generated segments
      if (data.segments && data.segments.length > 0) {
        const aiSegments = data.segments.map((s: any) => ({
          text: s.text,
          start: s.start || 0,           // Output timeline
          end: s.end || 8,
          sourceStart: s.source_start || 0,  // Original video source
          sourceEnd: s.source_end || 10,
          audioGenerated: false,
          clipExtracted: false,
          timestamp: Date.now()
        }));
        setSegments(aiSegments);
      }
      setStep("segments");
    } catch {}
    setProcessing("");
  };

  const handleDownloadVideo = async () => {
    setProcessing("Downloading video...");
    try {
      await video.downloadSource(project.id);
      setVideoDownloaded(true);
    } catch {}
    setProcessing("");
  };

  const handleGenerateSegment = async (index: number) => {
    setGeneratingIndex(index);
    try {
      await voice.generateSegment(project.id, index, segments[index].text, selectedVoice, speed, stability);
      setSegments(prev => prev.map((s, i) => i === index ? { ...s, audioGenerated: true, timestamp: Date.now() } : s));
    } catch {}
    setGeneratingIndex(null);
  };

  const handleGenerateAll = async () => {
    setProcessing("Generating all audio...");
    for (let i = 0; i < segments.length; i++) {
      if (!segments[i].audioGenerated) {
        setGeneratingIndex(i);
        try {
          await voice.generateSegment(project.id, i, segments[i].text, selectedVoice, speed, stability);
          setSegments(prev => prev.map((s, idx) => idx === i ? { ...s, audioGenerated: true, timestamp: Date.now() } : s));
        } catch {}
      }
    }
    setGeneratingIndex(null);
    setProcessing("");
  };

  const handleUpdateSegment = (index: number, field: string, value: string | number) => {
    setSegments(prev => prev.map((s, i) => {
      if (i !== index) return s;
      if (field === "text") return { ...s, text: value as string, audioGenerated: false, timestamp: 0 };
      if (field === "sourceStart" || field === "sourceEnd") return { ...s, [field]: value, clipExtracted: false };
      return { ...s, [field]: value };
    }));
  };

  const handleExtractClip = async (index: number) => {
    if (!videoDownloaded) return;
    setExtractingIndex(index);
    try {
      // Extract from SOURCE video timestamps
      await video.extractClip(project.id, index, segments[index].sourceStart, segments[index].sourceEnd);
      setSegments(prev => prev.map((s, i) => i === index ? { ...s, clipExtracted: true } : s));
    } catch {}
    setExtractingIndex(null);
  };

  const handleExtractAllClips = async () => {
    if (!videoDownloaded) return;
    setProcessing("Extracting clips from source video...");
    for (let i = 0; i < segments.length; i++) {
      if (!segments[i].clipExtracted) {
        setExtractingIndex(i);
        try {
          // Extract from SOURCE video timestamps
          await video.extractClip(project.id, i, segments[i].sourceStart, segments[i].sourceEnd);
          setSegments(prev => prev.map((s, idx) => idx === i ? { ...s, clipExtracted: true } : s));
        } catch {}
      }
    }
    setExtractingIndex(null);
    setProcessing("");
  };

  const handleMergeAll = async () => {
    setProcessing("Creating final video...");
    try {
      await voice.mergeSegments(project.id, segments.length);
      
      // Generate background music with ElevenLabs if selected
      if (mergeOptions.bgMusic) {
        setProcessing("Generating background music...");
        await video.generateMusic(project.id, mergeOptions.bgMusic);
      }
      
      setProcessing("Merging video...");
      await video.mergeWithOptions(project.id, segments, mergeOptions);
      updateProject({ status: "completed" });
    } catch {}
    setProcessing("");
  };

  const handleSelectMusic = (preset: MusicPreset) => {
    setMergeOptions(p => ({ ...p, bgMusic: preset.id }));
    setShowMusicSheet(false);
  };

  const handleRemoveMusic = () => {
    setMergeOptions(p => ({ ...p, bgMusic: "" }));
  };

  const handleOpenMusicSheet = async () => {
    setShowMusicSheet(true);
    try {
      const { data } = await video.getMusicLibrary();
      setMusicPresets(data.tracks.map((t: any) => ({ id: t.id, name: t.name, desc: t.prompt?.slice(0, 30) || "", cached: t.cached })));
    } catch {}
  };

  const handlePreviewMusic = async (presetId: string) => {
    if (playingPreset === presetId) {
      audioRef.current?.pause();
      setPlayingPreset(null);
      return;
    }
    
    const preset = musicPresets.find(p => p.id === presetId);
    if (!preset?.cached) setLoadingPreview(presetId);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = video.musicPreview(presetId);
      audioRef.current.oncanplay = () => {
        setLoadingPreview(null);
        setMusicPresets(prev => prev.map(p => p.id === presetId ? { ...p, cached: true } : p));
      };
      audioRef.current.play().catch(() => setLoadingPreview(null));
      setPlayingPreset(presetId);
    }
  };
  
  const handleGenerateThumbnail = async () => {
    setProcessing("Generating AI thumbnail...");
    try { 
      const { data } = await video.generateThumbnail(project.id, project.script || ""); 
      setThumbnailPrompt(data.thumbnail_prompt || "");
      setThumbnailGenerated(data.generated || false);
    } catch {}
    setProcessing("");
  };

  const handleGenerateYoutubeInfo = async () => {
    setProcessing("Generating YouTube info...");
    try {
      const { data } = await ai.generateYoutubeInfo(project.id, project.script || "");
      setYoutubeInfo({
        title: data.title || project.title,
        description: data.description || "",
        tags: data.tags || ""
      });
    } catch {
      // Fallback
      setYoutubeInfo({
        title: project.title,
        description: project.script?.slice(0, 200) + "..." || "",
        tags: "shorts,viral,trending"
      });
    }
    setProcessing("");
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(""), 2000);
  };

  const allAudioGenerated = segments.length > 0 && segments.every(s => s.audioGenerated);
  const allClipsExtracted = segments.length > 0 && segments.every(s => s.clipExtracted);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="bg-white border-b border-[#e5e5e5] fixed top-0 left-0 right-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects" className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-[#666]" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-[#1a1a1a] truncate max-w-sm">{project.title}</h1>
              <p className="text-xs text-[#999]">{project.duration}s • {project.videoId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {project.status === "completed" && (
              <a href={video.downloadFinal(project.id)} className="btn-primary text-sm"><Download className="w-4 h-4" /> Download</a>
            )}
          </div>
        </div>
      </header>
      
      <div className="pt-32 max-w-6xl mx-auto px-6 pb-6">

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="card p-0 overflow-hidden">
              <div className="aspect-video bg-black">
                <ReactPlayer url={`https://youtube.com/watch?v=${project.videoId}`} width="100%" height="100%" controls
                  onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)} />
              </div>
              <div className="p-3 bg-[#f5f5f5] flex items-center justify-between">
                <span className="text-xs text-[#666]">Current: {Math.floor(currentTime)}s</span>
                <button onClick={handleDownloadVideo} disabled={videoDownloaded || !!processing}
                  className={`btn-secondary text-xs ${videoDownloaded ? 'bg-green-100 text-green-700' : ''}`}>
                  <Video className="w-3.5 h-3.5" /> {videoDownloaded ? "Downloaded ✓" : "Download Video"}
                </button>
              </div>
            </div>

            {step !== "script" && (
              <div className="card">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Settings className="w-4 h-4" /> Voice Settings</h3>
                <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} className="input mb-2">
                  <option value="sarah">Sarah (Female)</option>
                  <option value="alice">Alice (Female)</option>
                  <option value="laura">Laura (Female)</option>
                  <option value="roger">Roger (Male)</option>
                  <option value="charlie">Charlie (Male)</option>
                  <option value="george">George (Male)</option>
                  <option value="liam">Liam (Male)</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-[#666]">Speed: {speed.toFixed(1)}x</label>
                    <input type="range" min="0.5" max="2" step="0.1" value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} className="w-full" />
                  </div>
                  <div>
                    <label className="text-xs text-[#666]">Stability: {(stability * 100).toFixed(0)}%</label>
                    <input type="range" min="0" max="1" step="0.1" value={stability} onChange={(e) => setStability(parseFloat(e.target.value))} className="w-full" />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {processing && (
              <div className="card bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <Loader2 className="w-4 h-4 animate-spin" /> {processing}
                </div>
              </div>
            )}

            {step === "script" && (
              <div className="card">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Step 1: Generate Script</h3>
                
                <div className="mb-4">
                  <label className="text-xs text-[#666] block mb-2">Target Duration (seconds)</label>
                  <div className="flex gap-2">
                    {[30, 60, 90].map(d => (
                      <button key={d} onClick={() => setTargetDuration(d)}
                        className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                          targetDuration === d ? 'bg-[#1a1a1a] text-white' : 'bg-[#f5f5f5] text-[#666] hover:bg-[#e5e5e5]'
                        }`}>
                        {d}s
                      </button>
                    ))}
                    <input 
                      type="number" 
                      value={targetDuration} 
                      onChange={(e) => setTargetDuration(Math.max(15, Math.min(300, +e.target.value)))}
                      className="w-20 py-2 px-3 rounded-lg text-sm font-medium text-center border border-[#e5e5e5] focus:border-[#1a1a1a] focus:outline-none"
                      placeholder="Custom"
                    />
                  </div>
                  <p className="text-xs text-[#999] mt-2">Original: {project.duration}s → Output: {targetDuration}s</p>
                </div>

                {project.script ? (
                  <div className="space-y-3">
                    <div className="bg-[#f5f5f5] rounded-lg p-3 max-h-40 overflow-auto">
                      <p className="text-xs text-[#1a1a1a] whitespace-pre-wrap">{project.script}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleScript} disabled={!!processing} className="btn-secondary flex-1">
                        <RefreshCw className="w-4 h-4" /> Regenerate
                      </button>
                      <button onClick={() => setStep("segments")} className="btn-primary flex-1">
                        Continue →
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={handleScript} disabled={!!processing} className="btn-primary w-full">
                    <Sparkles className="w-4 h-4" /> Generate Script
                  </button>
                )}
              </div>
            )}

            {step === "segments" && (
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Step 2: Segments</h3>
                  <div className="flex gap-2">
                    <button onClick={handleExtractAllClips} disabled={!!processing || !videoDownloaded || allClipsExtracted} 
                      className={`text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
                        allClipsExtracted ? 'bg-emerald-500 text-white' : 'bg-[#1a1a1a] text-white hover:bg-[#333] disabled:opacity-40'
                      }`}>
                      <Scissors className="w-3.5 h-3.5" /> {allClipsExtracted ? "All Clips ✓" : "All Clips"}
                    </button>
                    <button onClick={handleGenerateAll} disabled={!!processing || allAudioGenerated} 
                      className={`text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
                        allAudioGenerated ? 'bg-emerald-500 text-white' : 'bg-[#1a1a1a] text-white hover:bg-[#333] disabled:opacity-40'
                      }`}>
                      <Play className="w-3.5 h-3.5" /> {allAudioGenerated ? "All Audio ✓" : "All Audio"}
                    </button>
                  </div>
                </div>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {segments.map((seg, i) => (
                    <div key={i} className={`p-3 border rounded-lg ${seg.audioGenerated && seg.clipExtracted ? 'border-green-300 bg-green-50' : seg.audioGenerated || seg.clipExtracted ? 'border-blue-300 bg-blue-50' : 'border-[#e5e5e5]'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-6 h-6 flex items-center justify-center bg-[#1a1a1a] text-white text-xs rounded shrink-0">{i + 1}</span>
                        <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                            <span className="text-blue-600 font-medium">Source:</span>
                            <input type="number" value={seg.sourceStart} onChange={(e) => handleUpdateSegment(i, "sourceStart", +e.target.value)}
                              className="w-12 px-1 py-0.5 border rounded text-center" />
                            <span>-</span>
                            <input type="number" value={seg.sourceEnd} onChange={(e) => handleUpdateSegment(i, "sourceEnd", +e.target.value)}
                              className="w-12 px-1 py-0.5 border rounded text-center" />
                            <span className="text-[#999]">s</span>
                          </div>
                          <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
                            <span className="text-green-600 font-medium">Output:</span>
                            <span>{seg.start}s - {seg.end}s</span>
                            <span className="text-[#999]">({seg.end - seg.start}s)</span>
                          </div>
                        </div>
                        <button onClick={() => { handleUpdateSegment(i, "sourceStart", Math.floor(currentTime)); }}
                          className="text-xs text-blue-600 hover:underline shrink-0">Set</button>
                      </div>
                      <textarea value={seg.text} onChange={(e) => handleUpdateSegment(i, "text", e.target.value)}
                        className="w-full text-xs p-2 border rounded resize-none mb-2" rows={2} />
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleExtractClip(i)} disabled={extractingIndex !== null || generatingIndex !== null || !videoDownloaded}
                          className={`text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 font-medium transition-all ${
                            extractingIndex === i ? 'bg-blue-600 text-white' :
                            seg.clipExtracted ? 'bg-emerald-500 text-white shadow-sm' : 
                            'bg-[#1a1a1a] text-white hover:bg-[#333] disabled:opacity-40'
                          }`}>
                          {extractingIndex === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scissors className="w-3.5 h-3.5" />}
                          {extractingIndex === i ? "Cutting..." : seg.clipExtracted ? "Clip ✓" : "Cut Clip"}
                        </button>
                        <button onClick={() => handleGenerateSegment(i)} disabled={generatingIndex !== null || extractingIndex !== null}
                          className={`text-xs py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 font-medium transition-all ${
                            generatingIndex === i ? 'bg-blue-600 text-white' :
                            seg.audioGenerated ? 'bg-emerald-500 text-white shadow-sm' : 
                            'bg-[#1a1a1a] text-white hover:bg-[#333] disabled:opacity-40'
                          }`}>
                          {generatingIndex === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                          {generatingIndex === i ? "Generating..." : seg.audioGenerated ? "Audio ✓" : "Generate"}
                        </button>
                      </div>
                      {seg.clipExtracted && (
                        <button onClick={() => setPreviewClip(previewClip === i ? null : i)} 
                          className={`w-full text-xs py-1 mt-2 rounded flex items-center justify-center gap-1 ${previewClip === i ? 'bg-blue-100 text-blue-700' : 'text-[#666] hover:bg-[#f5f5f5]'}`}>
                          <Video className="w-3 h-3" />{previewClip === i ? "Hide Preview" : "Show Clip Preview"}
                        </button>
                      )}
                      {previewClip === i && seg.clipExtracted && (
                        <div className="mt-2 bg-black rounded-lg overflow-hidden">
                          <video controls autoPlay className="w-full h-40" src={video.previewClip(project.id, i, seg.timestamp)} />
                        </div>
                      )}
                      {seg.audioGenerated && (
                        <div className="flex items-center gap-2 mt-2">
                          <audio controls className="flex-1 h-8" key={seg.timestamp} src={voice.previewSegment(project.id, i, seg.timestamp)} />
                          <button onClick={() => handleGenerateSegment(i)} disabled={generatingIndex !== null} 
                            className="p-1.5 rounded hover:bg-[#f5f5f5] text-[#666]" title="Regenerate audio">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={() => setStep("options")} disabled={!allAudioGenerated || !allClipsExtracted} className="btn-primary w-full mt-3 disabled:opacity-50">
                  Continue to Options →
                </button>
              </div>
            )}

            {step === "options" && (
              <div className="card">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Merge className="w-4 h-4" /> Step 3: Merge Options</h3>
                <div className="space-y-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={mergeOptions.subtitles} onChange={(e) => setMergeOptions(p => ({ ...p, subtitles: e.target.checked }))} className="w-4 h-4" />
                    <span className="text-sm">Include Subtitles</span>
                  </label>
                  
                  <div>
                    <label className="text-xs text-[#666] block mb-1">Aspect Ratio</label>
                    <select value={mergeOptions.resize} onChange={(e) => setMergeOptions(p => ({ ...p, resize: e.target.value }))} className="input">
                      <option value="16:9">16:9 (Landscape)</option>
                      <option value="9:16">9:16 (Shorts/Vertical)</option>
                      <option value="1:1">1:1 (Square)</option>
                    </select>
                  </div>

                  <div className="border-t pt-3">
                    <label className="text-xs text-[#666] flex items-center gap-1 mb-2"><Music className="w-3 h-3" /> Background Music (Royalty-Free)</label>
                    
                    {mergeOptions.bgMusic ? (
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-3 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-purple-700">
                            🎵 {musicPresets.find(p => p.id === mergeOptions.bgMusic)?.name || mergeOptions.bgMusic}
                          </span>
                          <button onClick={handleRemoveMusic} className="text-red-500 hover:bg-red-50 p-1 rounded"><X className="w-4 h-4" /></button>
                        </div>
                        <div>
                          <label className="text-xs text-[#666]">Volume: {Math.round(mergeOptions.bgMusicVolume * 100)}%</label>
                          <input type="range" min="0.1" max="0.5" step="0.05" value={mergeOptions.bgMusicVolume} 
                            onChange={(e) => setMergeOptions(p => ({ ...p, bgMusicVolume: parseFloat(e.target.value) }))} className="w-full accent-purple-500" />
                        </div>
                        <p className="text-[10px] text-purple-500 mt-1">🔄 Music will loop automatically to match video length</p>
                      </div>
                    ) : (
                      <button onClick={handleOpenMusicSheet} 
                        className="w-full py-3 border-2 border-dashed border-[#ccc] rounded-lg text-sm text-[#666] hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all flex items-center justify-center gap-2">
                        <Music className="w-4 h-4" /> Choose Background Music
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <button onClick={handleMergeAll} disabled={!videoDownloaded || !!processing} className="btn-primary w-full disabled:opacity-50">
                    <Merge className="w-4 h-4" /> Create Final Video
                  </button>
                  
                  {project.status === "completed" && (
                    <div className="space-y-3 pt-3 border-t">
                      <div className="flex gap-2">
                        <button onClick={handleGenerateThumbnail} disabled={!!processing} className="btn-secondary flex-1">
                          <Image className="w-4 h-4" /> {thumbnailPrompt ? "Regen" : "AI Thumbnail"}
                        </button>
                        <a href={video.downloadFinal(project.id)} className="btn-primary flex-1 flex items-center justify-center gap-2">
                          <Download className="w-4 h-4" /> Download
                        </a>
                      </div>
                      
                      {thumbnailPrompt && (
                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-3 rounded-lg border border-purple-200">
                          {thumbnailGenerated && (
                            <div className="mb-3">
                              <img 
                                src={video.getThumbnail(project.id, Date.now())} 
                                alt="Generated Thumbnail" 
                                className="w-full rounded-lg shadow-md"
                              />
                              <a 
                                href={video.getThumbnail(project.id)} 
                                download="thumbnail.jpg"
                                className="mt-2 w-full btn-secondary text-xs flex items-center justify-center gap-1"
                              >
                                <Download className="w-3 h-3" /> Download Thumbnail
                              </a>
                            </div>
                          )}
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-medium text-purple-700 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> {thumbnailGenerated ? "Generated with AI" : "AI Prompt (manual use)"}
                            </label>
                            <button onClick={() => copyToClipboard(thumbnailPrompt, "thumbnail")} className="text-xs text-purple-600 flex items-center gap-1">
                              {copied === "thumbnail" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              {copied === "thumbnail" ? "Copied!" : "Copy Prompt"}
                            </button>
                          </div>
                          <details className="text-xs text-[#666]">
                            <summary className="cursor-pointer text-purple-600 hover:underline">View prompt</summary>
                            <p className="mt-2 leading-relaxed">{thumbnailPrompt}</p>
                          </details>
                        </div>
                      )}
                      
                      <div className="border-t pt-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold flex items-center gap-1"><Youtube className="w-4 h-4 text-red-500" /> YouTube Upload Info</h4>
                          <button onClick={handleGenerateYoutubeInfo} disabled={!!processing} className="text-xs text-blue-600 hover:underline">
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
                                  {copied === "title" ? "Copied!" : "Copy"}
                                </button>
                              </div>
                              <input value={youtubeInfo.title} onChange={(e) => setYoutubeInfo(p => ({ ...p, title: e.target.value }))}
                                className="w-full text-xs p-2 border rounded" />
                            </div>
                            
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs text-[#666]">Description</label>
                                <button onClick={() => copyToClipboard(youtubeInfo.description, "desc")} className="text-xs text-blue-600 flex items-center gap-1">
                                  {copied === "desc" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  {copied === "desc" ? "Copied!" : "Copy"}
                                </button>
                              </div>
                              <textarea value={youtubeInfo.description} onChange={(e) => setYoutubeInfo(p => ({ ...p, description: e.target.value }))}
                                className="w-full text-xs p-2 border rounded resize-none" rows={4} />
                            </div>
                            
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs text-[#666]">Tags (comma separated)</label>
                                <button onClick={() => copyToClipboard(youtubeInfo.tags, "tags")} className="text-xs text-blue-600 flex items-center gap-1">
                                  {copied === "tags" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  {copied === "tags" ? "Copied!" : "Copy"}
                                </button>
                              </div>
                              <input value={youtubeInfo.tags} onChange={(e) => setYoutubeInfo(p => ({ ...p, tags: e.target.value }))}
                                className="w-full text-xs p-2 border rounded" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              {step !== "script" && <button onClick={() => setStep("script")} className="btn-secondary flex-1 text-xs">← Script</button>}
              {step === "script" && segments.length > 0 && <button onClick={() => setStep("segments")} className="btn-secondary flex-1 text-xs">Segments →</button>}
              {step === "segments" && allAudioGenerated && <button onClick={() => setStep("options")} className="btn-secondary flex-1 text-xs">Options →</button>}
            </div>
          </div>
        </div>
      </div>

      {/* Hidden audio element for previews */}
      <audio ref={audioRef} onEnded={() => setPlayingPreset(null)} />

      {/* Music Selection Modal */}
      {showMusicSheet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { audioRef.current?.pause(); setPlayingPreset(null); setShowMusicSheet(false); }} />
          <div className="relative bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-fade-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-4 flex items-center justify-between">
              <h3 className="font-bold text-white flex items-center gap-2"><Music className="w-5 h-5" /> AI Background Music</h3>
              <button onClick={() => { audioRef.current?.pause(); setPlayingPreset(null); setShowMusicSheet(false); }} className="p-2 hover:bg-white/20 rounded-full text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-[#666] px-5 py-3 bg-[#f5f5f5] border-b flex items-center gap-2">
              <Volume2 className="w-3.5 h-3.5" /> Click play to preview • Powered by ElevenLabs
            </p>
            
            {/* Preset List */}
            <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto">
              {musicPresets.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-[#999]">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading...
                </div>
              ) : musicPresets.map(preset => (
                <div key={preset.id} 
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    mergeOptions.bgMusic === preset.id 
                      ? 'bg-purple-100 border-2 border-purple-500' 
                      : 'bg-[#f5f5f5] hover:bg-[#eee] border-2 border-transparent'
                  }`}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handlePreviewMusic(preset.id); }}
                    disabled={loadingPreview === preset.id}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm transition-all ${
                      loadingPreview === preset.id ? 'bg-yellow-100' :
                      playingPreset === preset.id ? 'bg-purple-600 text-white animate-pulse' : 
                      'bg-white hover:bg-purple-100'
                    }`}>
                    {loadingPreview === preset.id ? <Loader2 className="w-5 h-5 animate-spin text-yellow-600" /> :
                     playingPreset === preset.id ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                  </button>
                  <div className="flex-1 cursor-pointer" onClick={() => handleSelectMusic(preset)}>
                    <p className="font-medium text-sm">{preset.name}</p>
                    <p className="text-xs text-[#999]">{preset.cached ? "✓ Ready" : "Will generate on play"}</p>
                  </div>
                  {mergeOptions.bgMusic === preset.id && <Check className="w-5 h-5 text-purple-500" />}
                </div>
              ))}
            </div>
            
            {/* Footer */}
            <div className="border-t px-5 py-3 flex items-center justify-between bg-[#fafafa]">
              <span className="text-xs text-[#999]">🔄 Auto-loops to match video</span>
              <button onClick={() => { audioRef.current?.pause(); setPlayingPreset(null); setShowMusicSheet(false); }}
                className="px-5 py-2 bg-[#1a1a1a] text-white text-sm font-medium rounded-lg hover:bg-[#333]">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
