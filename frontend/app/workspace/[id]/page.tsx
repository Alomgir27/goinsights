"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import ReactPlayer from "react-player";
import { Clock, Sparkles, Loader2, FileText, Play, RefreshCw, Video, Scissors, ArrowLeft, Plus, Trash2, Download } from "lucide-react";
import Link from "next/link";
import { ai, voice, video, projects, youtube } from "@/lib/api";
import { useStore } from "@/lib/store";
import VoiceSelector from "@/components/workspace/VoiceSelector";
import MediaManager from "@/components/workspace/MediaManager";
import CustomScriptEditor from "@/components/workspace/CustomScriptEditor";
import MergeOptionsStep from "@/components/workspace/MergeOptionsStep";
import FinalVideoSection from "@/components/workspace/FinalVideoSection";
import MusicSheet from "@/components/workspace/MusicSheet";
import VoiceSettings from "@/components/workspace/VoiceSettings";

interface MusicPreset { id: string; name: string; desc: string; cached: boolean; }

interface MediaAsset {
  id: string;
  type: "image" | "video";
  source: "upload" | "ai_generated";
  path: string;
  duration?: number;
  prompt?: string;
  order: number;
  startTime: number;
  endTime: number;
  assignedSegments: number[];
}

interface Segment { 
  text: string;  // Clean text for TTS
  displayText?: string;  // Text with speaker for UI display
  speaker?: string;  // Speaker name for dialogue
  start: number;
  end: number; 
  sourceStart: number;
  sourceEnd: number;
  audioGenerated: boolean; 
  clipExtracted: boolean; 
  timestamp: number; 
  voiceId?: string;
  mediaId?: string;
  mediaType?: string;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
  effect?: "none" | "fade" | "pop" | "slide" | "zoom";
}

export default function Workspace(): React.ReactElement {
  const { id } = useParams();
  const { project, setProject, updateProject } = useStore();
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState("aria");
  const [selectedModel, setSelectedModel] = useState("v2");
  const [voices, setVoices] = useState<{id: string; name: string; gender: string; style: string; accent: string; langs: string}[]>([]);
  const [playingDemo, setPlayingDemo] = useState<string | null>(null);
  const demoAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [processing, setProcessing] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [extractingIndex, setExtractingIndex] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1.0);
  const [stability, setStability] = useState(0.5);
  const [videoDownloaded, setVideoDownloaded] = useState(false);
  const [mergeOptions, setMergeOptions] = useState<{subtitles: boolean; animatedSubtitles: boolean; subtitleStyle: string; subtitleSize: number; dialogueMode: boolean; speaker1Position: string; speaker2Position: string; dialogueBgStyle: string; resize: string; bgMusic: string; bgMusicVolume: number}>({ subtitles: false, animatedSubtitles: true, subtitleStyle: "karaoke", subtitleSize: 72, dialogueMode: false, speaker1Position: "top-left", speaker2Position: "top-right", dialogueBgStyle: "transparent", resize: "16:9", bgMusic: "", bgMusicVolume: 0.3 });
  const [showMusicSheet, setShowMusicSheet] = useState(false);
  const [youtubeInfo, setYoutubeInfo] = useState({ title: "", description: "", tags: "" });
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");
  const [thumbnailGenerated, setThumbnailGenerated] = useState(false);
  const [thumbnailModel, setThumbnailModel] = useState("gemini-3-pro");
  const [copied, setCopied] = useState("");
  const [step, setStep] = useState<"script" | "segments" | "options">("script");
  const [previewClip, setPreviewClip] = useState<number | null>(null);
  const [targetDuration, setTargetDuration] = useState(120);
  const [language, setLanguage] = useState("English");
  const [playingPreset, setPlayingPreset] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [musicPresets, setMusicPresets] = useState<MusicPreset[]>([]);
  const [showFinalPreview, setShowFinalPreview] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [finalVideoTimestamp, setFinalVideoTimestamp] = useState(0);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishPrivacy, setPublishPrivacy] = useState<"private" | "unlisted" | "public">("private");
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [projectType, setProjectType] = useState<"youtube" | "custom">("youtube");
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);

  // Auto-save segments when they change
  useEffect(() => {
    if (!project?.id || segments.length === 0) return;
    
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Debounced save - wait 2 seconds after last change
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await projects.saveSegments(project.id, segments);
        setLastSaved(new Date());
      } catch (e) {
        console.error("Failed to save segments:", e);
      } finally {
        setSaving(false);
      }
    }, 2000);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [segments, project?.id]);

  useEffect(() => { 
    if (id) {
      // Reset state when navigating to a different project
      setProject(null);
      setProjectType("youtube");
      setSegments([]);
      setStep("script");
      setMediaAssets([]);
      loadProject();
    }
    const animPref = localStorage.getItem("animated_subtitles");
    if (animPref !== null) setMergeOptions(p => ({ ...p, animatedSubtitles: animPref === "true" }));
  }, [id]);

  useEffect(() => {
    voice.getVoices().then(({ data }) => setVoices(data.voices || [])).catch(() => {});
  }, []);

  const playVoiceDemo = async (voiceId: string) => {
    if (demoAudioRef.current) {
      demoAudioRef.current.pause();
      demoAudioRef.current = null;
    }
    if (playingDemo === voiceId) {
      setPlayingDemo(null);
      return;
    }
    setPlayingDemo(voiceId);
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const audio = new Audio(`${baseUrl}/voice/voice-demo/${voiceId}`);
    demoAudioRef.current = audio;
    audio.onended = () => setPlayingDemo(null);
    audio.onerror = () => setPlayingDemo(null);
    audio.play();
  };

  const loadProject = useCallback(async () => {
    try {
      const { data } = await projects.get(id as string);
      setProjectType(data.project_type || "youtube");
      setProject({
        id: data.id, videoId: data.video_id, title: data.title, thumbnail: data.thumbnail_url,
        duration: data.duration, transcript: data.transcript || [], summary: data.summary,
        script: data.script, segments_data: data.segments_data, clips: [], status: data.status,
        prompt: data.prompt, project_type: data.project_type
      });
      if (data.script) setStep("segments");
      
      // Load media assets for custom projects and auto-assign to segments
      if (data.project_type === "custom" && data.media_assets) {
        const segs = data.segments_data || [];
        const assignedMedia = data.media_assets.map((m: any, i: number) => {
          // If already has timeline data, use it
          if (m.startTime !== undefined && m.assignedSegments?.length > 0) return m;
          // Otherwise auto-assign to segment by index
          const segIdx = i < segs.length ? i : i % Math.max(segs.length, 1);
          const seg = segs[segIdx];
          return {
            ...m,
            startTime: seg?.start || i * 5,
            endTime: seg?.end || (i + 1) * 5,
            duration: seg ? (seg.end - seg.start) : 5,
            assignedSegments: seg ? [segIdx] : []
          };
        });
        setMediaAssets(assignedMedia);
      }
      
      // Check existing files
      const { data: filesData } = await voice.checkExistingSegments(data.id);
      if (filesData.video_downloaded) setVideoDownloaded(true);
      
      if (data.thumbnail_generated) {
        setThumbnailGenerated(true);
        setThumbnailPrompt(data.thumbnail_prompt || "Previously generated");
      }
      
      if (data.youtube_info) {
        setYoutubeInfo({
          title: data.youtube_info.title || "",
          description: data.youtube_info.description || "",
          tags: data.youtube_info.tags || ""
        });
      }
    } catch {}
  }, [id, setProject]);

  // Load segments from DB when project data is available
  useEffect(() => {
    if (!project?.id) return;
      
    const loadSegments = async () => {
      // Get existing audio/clip status
      let existingAudio: number[] = [];
      let existingClips: number[] = [];
      try {
        const { data } = await voice.checkExistingSegments(project.id);
        existingAudio = data.existing_segments || [];
        existingClips = data.existing_clips || [];
        if (data.video_downloaded) setVideoDownloaded(true);
      } catch {}
      
      // Load segments from DB
      if (project.segments_data && project.segments_data.length > 0) {
        const loadedSegments = project.segments_data.map((s: any, i: number) => {
          let text = s.text || "";
          let speaker = s.speaker || "";
          let displayText = s.display_text || s.text || "";
          
          // Extract speaker from text if not in speaker field
          if (!speaker && text.match(/^[A-Z][a-z]+:/)) {
            const colonIdx = text.indexOf(":");
            speaker = text.substring(0, colonIdx).trim();
            text = text.substring(colonIdx + 1).trim();
            displayText = s.text;
          }
          
          return {
            text,
            displayText,
            speaker,
          start: s.start || 0,
          end: s.end || 8,
          sourceStart: s.source_start || 0,
          sourceEnd: s.source_end || 10,
          audioGenerated: existingAudio.includes(i),
          clipExtracted: existingClips.includes(i),
            timestamp: Date.now(),
            voiceId: s.voice_id || "aria",
            mediaId: s.media_id,
            mediaType: s.media_type,
            duration: s.duration || 8,
            trimStart: s.trim_start,
            trimEnd: s.trim_end,
            effect: s.effect || "none"
        };
      });
        setSegments(loadedSegments);
      }
    };
    
    loadSegments();
  }, [project?.id, project?.segments_data]);

  if (!project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#1a1a1a]" />
        <span className="text-sm text-[#666]">Loading project...</span>
      </div>
    );
  }

  const handleScript = async () => {
    setProcessing(`Generating ${targetDuration}s script in ${language}...`);
    try {
      const { data } = await ai.script(project.id, targetDuration, language);
      updateProject({ script: data.script });
      
      // Use AI-generated segments
      if (data.segments && data.segments.length > 0) {
        const aiSegments = data.segments.map((s: any) => ({
          text: s.text,
          start: s.start || 0,
          end: s.end || 8,
          sourceStart: s.source_start || 0,
          sourceEnd: s.source_end || 10,
          audioGenerated: false,
          clipExtracted: false,
          timestamp: Date.now(),
          voiceId: s.voice_id || "aria",
          duration: s.duration || 8
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
      const segmentVoice = segments[index].voiceId || selectedVoice;
      await voice.generateSegment(project.id, index, segments[index].text, segmentVoice, speed, stability, selectedModel);
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
          const segmentVoice = segments[i].voiceId || selectedVoice;
          await voice.generateSegment(project.id, i, segments[i].text, segmentVoice, speed, stability, selectedModel);
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

  const handleAddSegment = (position: number) => {
    const newSegment: Segment = {
      text: "New segment text...",
      start: 0,
      end: 8,
      sourceStart: Math.floor(currentTime),
      sourceEnd: Math.floor(currentTime) + 10,
      audioGenerated: false,
      clipExtracted: false,
      timestamp: 0,
      voiceId: selectedVoice,
      duration: 8
    };
    
    setSegments(prev => {
      const updated = [...prev];
      updated.splice(position, 0, newSegment);
      // Recalculate output timeline
      let time = 0;
      return updated.map(s => {
        const duration = s.end - s.start || 8;
        const start = time;
        const end = time + duration;
        time = end;
        return { ...s, start, end };
      });
    });
  };

  const handleRemoveSegment = (index: number) => {
    if (segments.length <= 1) return; // Keep at least one segment
    setSegments(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Recalculate output timeline
      let time = 0;
      return updated.map(s => {
        const duration = s.end - s.start || 8;
        const start = time;
        const end = time + duration;
        time = end;
        return { ...s, start, end };
      });
    });
  };

  const handleMoveSegment = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === segments.length - 1) return;
    
    setSegments(prev => {
      const updated = [...prev];
      const newIndex = direction === "up" ? index - 1 : index + 1;
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      // Recalculate output timeline
      let time = 0;
      return updated.map(s => {
        const duration = s.end - s.start || 8;
        const start = time;
        const end = time + duration;
        time = end;
        return { ...s, start, end };
      });
    });
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
      const { data: mergeData } = await voice.mergeSegments(project.id, segments.length);
      
      // Update segments with actual timing from audio
      if (mergeData.timing && mergeData.timing.length > 0) {
        setSegments(prev => prev.map((seg, i) => ({
          ...seg,
          start: mergeData.timing[i]?.start ?? seg.start,
          end: mergeData.timing[i]?.end ?? seg.end
        })));
      }
      
      // Generate background music with ElevenLabs if selected
      if (mergeOptions.bgMusic) {
        setProcessing("Generating background music...");
        await video.generateMusic(project.id, mergeOptions.bgMusic);
      }
      
      setProcessing("Merging video...");
      
      if (projectType === "custom" && mediaAssets.length > 0) {
        // For custom projects: create video from media assets
        const mediaTimeline = mediaAssets.map(m => ({
          id: m.id,
          startTime: m.startTime || 0,
          endTime: m.endTime || 5,
          assignedSegments: m.assignedSegments || []
        }));
        await video.createFromMedia(project.id, mediaTimeline, {
          subtitles: mergeOptions.subtitles,
          animatedSubtitles: mergeOptions.animatedSubtitles,
          subtitleStyle: mergeOptions.subtitleStyle,
          subtitleSize: mergeOptions.subtitleSize,
          dialogueMode: mergeOptions.dialogueMode,
          speaker1Position: mergeOptions.speaker1Position,
          speaker2Position: mergeOptions.speaker2Position,
          dialogueBgStyle: mergeOptions.dialogueBgStyle,
          resize: mergeOptions.resize
        });
      } else {
        // For YouTube projects: merge video clips
      await video.mergeWithOptions(project.id, segments, mergeOptions);
      }
      
      updateProject({ status: "completed" });
      setFinalVideoTimestamp(Date.now());
      setShowFinalPreview(true);
    } catch (err) {
      console.error("Merge failed:", err);
    }
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
  
  const handleGeneratePrompt = async () => {
    setProcessing("Generating thumbnail prompt...");
    try { 
      const { data } = await video.generateThumbnailPrompt(project.id, project.script || "", language);
      setThumbnailPrompt(data.prompt || "");
    } catch {}
    setProcessing("");
  };

  const handleGenerateThumbnailFromPrompt = async (prompt: string, model: string) => {
    setProcessing(`Generating thumbnail with ${model}...`);
    try { 
      const { data } = await video.generateThumbnailFromPrompt(project.id, prompt, model);
      setThumbnailGenerated(data.generated || false);
    } catch {}
    setProcessing("");
  };

  const handleGenerateYoutubeInfo = async () => {
    setProcessing(`Generating YouTube info in ${language}...`);
    try {
      const { data } = await ai.generateYoutubeInfo(project.id, project.script || "", language);
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

  const handlePublish = async () => {
    const accessToken = localStorage.getItem("youtube_token");
    if (!accessToken) {
      alert("Please connect your YouTube channel first (from the Connect page)");
      return;
    }
    
    if (!youtubeInfo.title) {
      alert("Please generate YouTube info first");
      return;
    }
    
    setPublishing(true);
    setProcessing("Publishing to YouTube...");
    
    try {
      const { data } = await youtube.publish(
        project.id,
        youtubeInfo.title,
        youtubeInfo.description,
        youtubeInfo.tags,
        publishPrivacy,
        null,
        accessToken
      );
      
      if (data.success) {
        setPublishedUrl(data.video_url);
        alert(`✅ Video published successfully!\n\nVideo URL: ${data.video_url}\nThumbnail: ${data.thumbnail_uploaded ? "Uploaded" : "Not uploaded"}\nPrivacy: ${data.privacy}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail || "Failed to publish";
      if (msg.includes("quota") || msg.includes("403")) {
        setQuotaExceeded(true);
      } else if (msg.includes("401") || msg.includes("invalid_grant")) {
        alert("YouTube session expired. Please reconnect your channel from the Connect page.");
        localStorage.removeItem("youtube_token");
        localStorage.removeItem("youtube_connected");
      } else {
        alert(`Error: ${msg}`);
      }
    }
    
    setPublishing(false);
    setProcessing("");
  };
  
  const handleCopyAll = () => {
    const all = `Title:\n${youtubeInfo.title}\n\nDescription:\n${youtubeInfo.description}\n\nTags:\n${youtubeInfo.tags}`;
    navigator.clipboard.writeText(all);
    setCopied("all");
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
              <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-[#1a1a1a] truncate max-w-sm">{project.title}</h1>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  projectType === "custom" ? "bg-purple-100 text-purple-600" : "bg-red-100 text-red-600"
                }`}>
                  {projectType === "custom" ? "Custom" : "YouTube"}
                </span>
              </div>
              <p className="text-xs text-[#999]">
                {project.duration ? `${project.duration}s` : ""}
                {project.duration && project.videoId ? " • " : ""}
                {project.videoId || (projectType === "custom" ? "Script-based project" : "")}
              </p>
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
            {projectType === "youtube" ? (
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
            ) : (
              <div className="card p-6 bg-gradient-to-br from-purple-50 to-blue-50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Custom Script Project</h3>
                    <p className="text-xs text-slate-500">Create video from scratch</p>
                </div>
                        </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white p-3 rounded-lg">
                    <span className="text-2xl font-bold text-purple-600">{segments.length}</span>
                    <p className="text-xs text-slate-500">Segments</p>
                      </div>
                  <div className="bg-white p-3 rounded-lg">
                    <span className="text-2xl font-bold text-blue-600">{mediaAssets.length}</span>
                    <p className="text-xs text-slate-500">Media</p>
                </div>
                </div>
              </div>
            )}

            {step !== "script" && (
              <VoiceSettings
                voices={voices}
                selectedVoice={selectedVoice}
                onSelectVoice={setSelectedVoice}
                selectedModel={selectedModel}
                onSelectModel={setSelectedModel}
                speed={speed}
                onSpeedChange={setSpeed}
                stability={stability}
                onStabilityChange={setStability}
                playingDemo={playingDemo}
                onPlayDemo={playVoiceDemo}
              />
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

            {step === "script" && projectType === "custom" && (
              <CustomScriptEditor
                projectId={project.id}
                initialPrompt={project.prompt}
                initialScript={project.script}
                initialDuration={project.duration}
                onScriptGenerated={(script, segs) => {
                  updateProject({ script });
                  const newSegments = segs.map((s: any) => ({
                    text: s.text,  // Clean text for TTS
                    displayText: s.display_text || s.text,  // Text with speaker for UI
                    speaker: s.speaker || "",  // Speaker name
                    start: s.start || 0, end: s.end || 8,
                    sourceStart: 0, sourceEnd: 0, audioGenerated: false, clipExtracted: true,
                    timestamp: Date.now(), voiceId: s.voice_id || "aria", duration: s.duration || 8
                  }));
                  setSegments(newSegments);
                  setStep("segments");
                }}
              />
            )}

            {step === "script" && projectType === "youtube" && (
              <div className="card">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Step 1: Generate Script</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-[#666] block mb-2">Target Duration</label>
                    <div className="flex flex-wrap gap-2">
                      {[60, 120, 180, 300, 600].map(d => (
                        <button key={d} onClick={() => setTargetDuration(d)}
                          className={`py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all ${
                            targetDuration === d ? 'bg-[#1a1a1a] text-white' : 'bg-[#f5f5f5] text-[#666] hover:bg-[#e5e5e5]'
                          }`}>
                          {d < 60 ? `${d}s` : `${Math.floor(d / 60)}m`}
                        </button>
                      ))}
                      <input 
                        type="number" 
                        value={targetDuration} 
                        onChange={(e) => setTargetDuration(Math.max(30, Math.min(900, +e.target.value)))}
                        className="w-16 py-1.5 px-2 rounded-lg text-xs font-medium text-center border border-[#e5e5e5] focus:border-[#1a1a1a] focus:outline-none"
                        placeholder="Custom"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#666] block mb-2">Output Language</label>
                    <select 
                      value={language} 
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full py-2 px-3 rounded-lg text-sm border border-[#e5e5e5] focus:border-[#1a1a1a] focus:outline-none bg-white"
                    >
                      <option value="English">🇺🇸 English</option>
                      <option value="Spanish">🇪🇸 Spanish</option>
                      <option value="Bengali">🇧🇩 Bengali</option>
                      <option value="Hindi">🇮🇳 Hindi</option>
                      <option value="Arabic">🇸🇦 Arabic</option>
                      <option value="Chinese">🇨🇳 Chinese</option>
                      <option value="Japanese">🇯🇵 Japanese</option>
                      <option value="Korean">🇰🇷 Korean</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-[#999] mb-4">Original: {Math.floor((project.duration || 0) / 60)}m {(project.duration || 0) % 60}s → Output: {Math.floor(targetDuration / 60)}m {targetDuration % 60}s in {language}</p>

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
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Step 2: Segments</h3>
                    <span className="text-[10px] text-slate-400">
                      {saving ? (
                        <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>
                      ) : lastSaved ? (
                        <span className="text-green-600">✓ Saved</span>
                      ) : null}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {projectType === "youtube" && (
                    <button onClick={handleExtractAllClips} disabled={!!processing || !videoDownloaded || allClipsExtracted} 
                      className={`text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
                        allClipsExtracted ? 'bg-emerald-500 text-white' : 'bg-[#1a1a1a] text-white hover:bg-[#333] disabled:opacity-40'
                      }`}>
                      <Scissors className="w-3.5 h-3.5" /> {allClipsExtracted ? "All Clips ✓" : "All Clips"}
                    </button>
                    )}
                    <button onClick={handleGenerateAll} disabled={!!processing || allAudioGenerated} 
                      className={`text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
                        allAudioGenerated ? 'bg-emerald-500 text-white' : 'bg-[#1a1a1a] text-white hover:bg-[#333] disabled:opacity-40'
                      }`}>
                      <Play className="w-3.5 h-3.5" /> {allAudioGenerated ? "All Audio ✓" : "All Audio"}
                    </button>
                  </div>
                </div>
                
                {project.script && (
                  <div className="mb-3">
                    <button onClick={() => setShowScript(!showScript)}
                      className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 flex items-center justify-between transition-all">
                      <span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> View Full Script</span>
                      <span className="text-slate-400">{showScript ? "▲" : "▼"}</span>
                    </button>
                    {showScript && (
                      <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                        <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{project.script}</pre>
                      </div>
                    )}
                  </div>
                )}
                
                {projectType === "custom" && (
                  <div className="mb-4 space-y-3">
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <MediaManager
                        projectId={project.id}
                        mediaAssets={mediaAssets}
                        onMediaChange={setMediaAssets}
                        script={project.script}
                        segments={segments}
                        totalDuration={segments.reduce((acc, s) => Math.max(acc, s.end), 0)}
                      />
                    </div>
                    
                    {mediaAssets.length > 0 && segments.length > 0 && (
                      <button
                        onClick={() => {
                          // Auto-distribute media across segments
                          const updated = segments.map((seg, i) => {
                            const mediaIndex = i % mediaAssets.length;
                            return { ...seg, mediaId: mediaAssets[mediaIndex].id };
                          });
                          setSegments(updated);
                        }}
                        className="w-full py-2 text-xs font-medium bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all flex items-center justify-center gap-1"
                      >
                        🔄 Auto-Distribute Media to Segments
                      </button>
                    )}
                  </div>
                )}
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {/* Add segment at start */}
                  <button 
                    onClick={() => handleAddSegment(0)}
                    className="w-full py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add segment at start
                  </button>

                  {segments.map((seg, i) => (
                    <div key={i} className={`p-3 border rounded-lg relative group ${seg.audioGenerated && seg.clipExtracted ? 'border-green-200 bg-green-50/50' : seg.audioGenerated || seg.clipExtracted ? 'border-blue-200 bg-blue-50/50' : 'border-slate-200 bg-white'}`}>
                      {/* Segment header with number and controls */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex items-center gap-1">
                          <span className="w-5 h-5 flex items-center justify-center bg-slate-900 text-white text-[10px] font-medium rounded">{i + 1}</span>
                          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleMoveSegment(i, "up")} 
                              disabled={i === 0}
                              className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                            </button>
                            <button 
                              onClick={() => handleMoveSegment(i, "down")} 
                              disabled={i === segments.length - 1}
                              className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
                            <span className="text-blue-600 font-medium text-[10px]">Source:</span>
                            <input type="number" value={seg.sourceStart} onChange={(e) => handleUpdateSegment(i, "sourceStart", +e.target.value)}
                              className="w-10 px-1 py-0.5 border border-slate-200 rounded text-center text-[10px]" />
                            <span className="text-slate-400">-</span>
                            <input type="number" value={seg.sourceEnd} onChange={(e) => handleUpdateSegment(i, "sourceEnd", +e.target.value)}
                              className="w-10 px-1 py-0.5 border border-slate-200 rounded text-center text-[10px]" />
                            <span className="text-slate-400 text-[10px]">s</span>
                          </div>
                          <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
                            <span className="text-green-600 font-medium text-[10px]">Out:</span>
                            <span className="text-[10px]">{seg.start}s - {seg.end}s</span>
                          </div>
                        </div>
                        
                        <button onClick={() => { handleUpdateSegment(i, "sourceStart", Math.floor(currentTime)); }}
                          className="text-[10px] text-blue-600 hover:underline shrink-0 px-1.5 py-0.5 bg-blue-50 rounded">Set</button>
                        
                        <VoiceSelector
                          voices={voices}
                          selectedVoice={seg.voiceId || selectedVoice}
                          onSelect={(voiceId) => handleUpdateSegment(i, "voiceId", voiceId)}
                          compact={true}
                        />
                        
                        <button 
                          onClick={() => handleRemoveSegment(i)}
                          disabled={segments.length <= 1}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30"
                          title="Remove segment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      {seg.speaker && (
                        <span className="inline-block text-[10px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded mb-1">
                          {seg.speaker}
                        </span>
                      )}
                      <textarea value={seg.text} onChange={(e) => handleUpdateSegment(i, "text", e.target.value)}
                        className="w-full text-xs p-2 border border-slate-200 rounded resize-none mb-2 focus:border-slate-400 focus:outline-none" rows={2} placeholder="Segment text..." />
                      
                      {/* Media & Effect Row - only for custom projects */}
                      {projectType === "custom" && (
                        <div className="flex items-center gap-2 mb-2">
                          {mediaAssets.length > 0 && (
                            <select
                              value={seg.mediaId || ""}
                              onChange={(e) => handleUpdateSegment(i, "mediaId", e.target.value)}
                              className="text-[10px] px-2 py-1.5 border border-slate-200 rounded bg-white flex-1"
                            >
                              <option value="">🖼️ Default Image</option>
                              {mediaAssets.map((m, mi) => (
                                <option key={m.id} value={m.id}>
                                  🖼️ {m.source === "ai_generated" ? "AI" : "Upload"} #{mi + 1}
                                </option>
                              ))}
                            </select>
                          )}
                          <select
                            value={seg.effect || "none"}
                            onChange={(e) => handleUpdateSegment(i, "effect", e.target.value)}
                            className="text-[10px] px-2 py-1.5 border border-slate-200 rounded bg-white flex-1"
                          >
                            <option value="none">✨ No Effect</option>
                            <option value="fade">✨ Fade In/Out</option>
                            <option value="pop">✨ Pop In</option>
                            <option value="slide">✨ Slide</option>
                            <option value="zoom">✨ Zoom</option>
                          </select>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleExtractClip(i)} disabled={extractingIndex !== null || generatingIndex !== null || !videoDownloaded}
                          className={`text-xs py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 font-medium transition-all ${
                            extractingIndex === i ? 'bg-blue-600 text-white' :
                            seg.clipExtracted ? 'bg-emerald-500 text-white' : 
                            'bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40'
                          }`}>
                          {extractingIndex === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
                          {extractingIndex === i ? "..." : seg.clipExtracted ? "✓" : "Clip"}
                        </button>
                        <button onClick={() => handleGenerateSegment(i)} disabled={generatingIndex !== null || extractingIndex !== null}
                          className={`text-xs py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 font-medium transition-all ${
                            generatingIndex === i ? 'bg-blue-600 text-white' :
                            seg.audioGenerated ? 'bg-emerald-500 text-white' : 
                            'bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40'
                          }`}>
                          {generatingIndex === i ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          {generatingIndex === i ? "..." : seg.audioGenerated ? "✓" : "Audio"}
                        </button>
                      </div>
                      
                      {seg.clipExtracted && (
                        <button onClick={() => setPreviewClip(previewClip === i ? null : i)} 
                          className={`w-full text-[10px] py-1 mt-2 rounded flex items-center justify-center gap-1 ${previewClip === i ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>
                          <Video className="w-3 h-3" />{previewClip === i ? "Hide" : "Preview"}
                        </button>
                      )}
                      {previewClip === i && seg.clipExtracted && (
                        <div className="mt-2 bg-black rounded overflow-hidden">
                          <video controls autoPlay className="w-full h-32" src={video.previewClip(project.id, i, seg.timestamp)} />
                        </div>
                      )}
                      {seg.audioGenerated && (
                        <div className="flex items-center gap-1 mt-2">
                          <audio controls className="flex-1 h-7" key={seg.timestamp} src={voice.previewSegment(project.id, i, seg.timestamp)} />
                          <button onClick={() => handleGenerateSegment(i)} disabled={generatingIndex !== null} 
                            className="p-1 rounded hover:bg-slate-100 text-slate-500" title="Regenerate">
                            <RefreshCw className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      
                      {/* Add segment after this one */}
                      <button 
                        onClick={() => handleAddSegment(i + 1)}
                        className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100 shadow-sm z-10"
                        title="Add segment here"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setStep("options")} disabled={!allAudioGenerated || (projectType === "youtube" && !allClipsExtracted)} className="btn-primary w-full mt-3 disabled:opacity-50">
                  Continue to Options →
                </button>
              </div>
            )}

            {step === "options" && (
              <>
                <MergeOptionsStep
                  mergeOptions={mergeOptions}
                  setMergeOptions={setMergeOptions}
                  musicPresets={musicPresets}
                  onOpenMusicSheet={handleOpenMusicSheet}
                  onRemoveMusic={handleRemoveMusic}
                  onMergeAll={handleMergeAll}
                  processing={processing}
                  videoDownloaded={videoDownloaded}
                  projectType={projectType}
                />
                
                <FinalVideoSection
                  projectId={project.id}
                  projectStatus={project.status}
                  language={language}
                  script={project.script || ""}
                  onGeneratePrompt={handleGeneratePrompt}
                  onGenerateThumbnailFromPrompt={handleGenerateThumbnailFromPrompt}
                  setThumbnailPrompt={setThumbnailPrompt}
                  onGenerateYoutubeInfo={handleGenerateYoutubeInfo}
                  processing={processing}
                  thumbnailPrompt={thumbnailPrompt}
                  thumbnailGenerated={thumbnailGenerated}
                  thumbnailModel={thumbnailModel}
                  setThumbnailModel={setThumbnailModel}
                  youtubeInfo={youtubeInfo}
                  setYoutubeInfo={setYoutubeInfo}
                  showFinalPreview={showFinalPreview}
                  setShowFinalPreview={setShowFinalPreview}
                  finalVideoTimestamp={finalVideoTimestamp}
                />
              </>
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

      <MusicSheet
        isOpen={showMusicSheet}
        onClose={() => { audioRef.current?.pause(); setPlayingPreset(null); setShowMusicSheet(false); }}
        musicPresets={musicPresets}
        selectedMusic={mergeOptions.bgMusic}
        onSelect={(presetId) => setMergeOptions(p => ({ ...p, bgMusic: presetId }))}
        playingPreset={playingPreset}
        loadingPreview={loadingPreview}
        onPreview={handlePreviewMusic}
      />
    </div>
  );
}
