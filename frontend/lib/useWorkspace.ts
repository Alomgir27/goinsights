"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { voice, video, projects, ai, youtube } from "./api";
import { useStore } from "./store";
import type { Segment, MediaAsset, MergeOptions, MusicPreset, YoutubeInfo, ProjectType, StepType } from "./types";
import { DEFAULT_MERGE_OPTIONS } from "./types";

export function useWorkspace(projectId: string) {
  const { project, setProject, updateProject } = useStore();
  
  const [projectType, setProjectType] = useState<ProjectType>("youtube");
  const [step, setStep] = useState<StepType>("script");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [processing, setProcessing] = useState("");
  
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [extractingIndex, setExtractingIndex] = useState<number | null>(null);
  const [previewClip, setPreviewClip] = useState<number | null>(null);
  const [videoDownloaded, setVideoDownloaded] = useState(false);
  
  const [mergeOptions, setMergeOptions] = useState<MergeOptions>(DEFAULT_MERGE_OPTIONS);
  const [musicPresets, setMusicPresets] = useState<MusicPreset[]>([]);
  const [showMusicSheet, setShowMusicSheet] = useState(false);
  
  const [youtubeInfo, setYoutubeInfo] = useState<YoutubeInfo>({ title: "", description: "", tags: "" });
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");
  const [thumbnailTitle, setThumbnailTitle] = useState("");
  const [thumbnailGenerated, setThumbnailGenerated] = useState(false);
  const [thumbnailModel, setThumbnailModel] = useState("gemini-3-pro");
  
  const [showFinalPreview, setShowFinalPreview] = useState(false);
  const [finalVideoTimestamp, setFinalVideoTimestamp] = useState(0);
  
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save segments
  useEffect(() => {
    if (!project?.id || segments.length === 0) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await projects.saveSegments(project.id, segments);
        setLastSaved(new Date());
      } catch {} finally {
        setSaving(false);
      }
    }, 800);
    
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [segments, project?.id]);

  const saveSegmentsNow = async () => {
    if (!project?.id || segments.length === 0) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    try {
      setSaving(true);
      await projects.saveSegments(project.id, segments);
      setLastSaved(new Date());
    } catch {} finally {
      setSaving(false);
    }
  };

  const loadProject = useCallback(async () => {
    try {
      const { data } = await projects.get(projectId);
      setProjectType(data.project_type || "youtube");
      setProject({
        id: data.id, videoId: data.video_id, title: data.title, thumbnail: data.thumbnail_url,
        duration: data.duration, transcript: data.transcript || [], summary: data.summary,
        script: data.script, segments_data: data.segments_data, clips: [], status: data.status,
        prompt: data.prompt, project_type: data.project_type, video_style: data.video_style,
        language: data.language
      });
      if (data.script) setStep("segments");
      
      if ((data.project_type === "custom" || data.project_type === "ads") && data.media_assets) {
        const segs = data.segments_data || [];
        // Reconstruct media assignments from saved segment data
        const mediaAssignments: Record<string, number[]> = {};
        segs.forEach((seg: any, idx: number) => {
          const mediaId = seg.media_id;
          if (mediaId) {
            if (!mediaAssignments[mediaId]) mediaAssignments[mediaId] = [];
            mediaAssignments[mediaId].push(idx);
          }
        });
        
        const assignedMedia = data.media_assets.map((m: MediaAsset, i: number) => {
          const assignedSegs = mediaAssignments[m.id] || [];
          if (assignedSegs.length > 0) {
            // Use actual segment timing
            const firstSeg = segs[assignedSegs[0]];
            const lastSeg = segs[assignedSegs[assignedSegs.length - 1]];
            return { 
              ...m, 
              startTime: firstSeg?.start || 0, 
              endTime: lastSeg?.end || 5, 
              duration: (lastSeg?.end || 5) - (firstSeg?.start || 0),
              assignedSegments: assignedSegs 
            };
          }
          // Fallback for unassigned media
          return { ...m, startTime: i * 5, endTime: (i + 1) * 5, duration: 5, assignedSegments: [] };
        });
        setMediaAssets(assignedMedia);
      }
      
      const { data: filesData } = await voice.checkExistingSegments(data.id);
      if (filesData.video_downloaded) setVideoDownloaded(true);
      if (data.thumbnail_generated) { setThumbnailGenerated(true); setThumbnailPrompt(data.thumbnail_prompt || ""); }
      if (data.youtube_info) {
        setYoutubeInfo({ title: data.youtube_info.title || "", description: data.youtube_info.description || "", tags: data.youtube_info.tags || "" });
      }
    } catch {}
  }, [projectId, setProject]);

  // Load segments from project data
  useEffect(() => {
    if (!project?.id) return;
    
    const loadSegments = async () => {
      let existingAudio: number[] = [], existingClips: number[] = [];
      try {
        const { data } = await voice.checkExistingSegments(project.id);
        existingAudio = data.existing_segments || [];
        existingClips = data.existing_clips || [];
        if (data.video_downloaded) setVideoDownloaded(true);
      } catch {}
      
      if (project.segments_data && project.segments_data.length > 0) {
        const loadedSegments = project.segments_data.map((s: any, i: number) => {
          let text = s.text || "", speaker = s.speaker || "", displayText = s.display_text || s.text || "";
          if (!speaker && text.match(/^[A-Z][a-z]+:/)) {
            const colonIdx = text.indexOf(":");
            speaker = text.substring(0, colonIdx).trim();
            text = text.substring(colonIdx + 1).trim();
            displayText = s.text;
          }
          const start = s.start || 0;
          const end = s.end || 8;
          const savedDuration = s.duration || (end - start) || 8;
          const hasAudio = s.audio_generated || existingAudio.includes(i);
          // If audio was generated, duration should be end - start (which reflects actual audio length)
          const duration = hasAudio ? (end - start) : savedDuration;
          return {
            text, displayText, speaker, start, end, sourceStart: s.source_start || 0, sourceEnd: s.source_end || 10,
            audioGenerated: hasAudio, clipExtracted: existingClips.includes(i), timestamp: Date.now(),
            voiceId: s.voice_id || "aria", mediaId: s.media_id, mediaType: s.media_type, duration: Math.round(duration * 10) / 10,
            trimStart: s.trim_start, trimEnd: s.trim_end, effect: s.effect || "none"
          };
        });
        setSegments(loadedSegments);
      }
    };
    loadSegments();
  }, [project?.id, project?.segments_data]);

  const handleUpdateSegment = (index: number, field: string, value: string | number) => {
    setSegments(prev => prev.map((s, i) => {
      if (i !== index) return s;
      if (field === "text") return { ...s, text: value as string, audioGenerated: false, timestamp: 0 };
      if (field === "sourceStart" || field === "sourceEnd") return { ...s, [field]: value, clipExtracted: false };
      return { ...s, [field]: value };
    }));
  };

  const handleBatchUpdateSegments = (updates: Array<{ index: number; field: string; value: string | number }>) => {
    setSegments(prev => prev.map((s, i) => {
      const update = updates.find(u => u.index === i);
      if (!update) return s;
      if (update.field === "text") return { ...s, text: update.value as string, audioGenerated: false, timestamp: 0 };
      return { ...s, [update.field]: update.value };
    }));
  };

  const handleAddSegment = (position: number, currentTime: number = 0, selectedVoice: string = "aria") => {
    const newSegment: Segment = {
      text: "New segment text...", start: 0, end: 8, sourceStart: Math.floor(currentTime), sourceEnd: Math.floor(currentTime) + 10,
      audioGenerated: false, clipExtracted: false, timestamp: 0, voiceId: selectedVoice, duration: 8
    };
    setSegments(prev => {
      const updated = [...prev];
      updated.splice(position, 0, newSegment);
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
    if (segments.length <= 1) return;
    setSegments(prev => {
      const updated = prev.filter((_, i) => i !== index);
      let time = 0;
      return updated.map(s => {
        const duration = s.end - s.start || 8;
        const start = time, end = time + duration;
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
      let time = 0;
      return updated.map(s => {
        const duration = s.end - s.start || 8;
        const start = time, end = time + duration;
        time = end;
        return { ...s, start, end };
      });
    });
  };

  const handleGenerateSegment = async (index: number, voiceId: string, speed: number, stability: number, model: string) => {
    if (!project?.id) return;
    setGeneratingIndex(index);
    try {
      const { data } = await voice.generateSegment(project.id, index, segments[index].text, voiceId, speed, stability, model);
      const audioDuration = data.duration || 5;
      setSegments(prev => {
        const updated = [...prev];
        const seg = updated[index];
        const newEnd = seg.start + audioDuration;
        updated[index] = { ...seg, audioGenerated: true, timestamp: Date.now(), duration: audioDuration, end: newEnd };
        // Recalculate subsequent segment starts
        for (let i = index + 1; i < updated.length; i++) {
          const prevEnd = updated[i - 1].end;
          const dur = updated[i].duration || (updated[i].end - updated[i].start);
          updated[i] = { ...updated[i], start: prevEnd, end: prevEnd + dur };
        }
        return updated;
      });
    } catch {}
    setGeneratingIndex(null);
  };

  const handleGenerateAll = async (selectedVoice: string, speed: number, stability: number, model: string) => {
    if (!project?.id) return;
    setProcessing("Generating all audio...");
    for (let i = 0; i < segments.length; i++) {
      if (!segments[i].audioGenerated) {
        setGeneratingIndex(i);
        try {
          const segmentVoice = segments[i].voiceId || selectedVoice;
          const { data } = await voice.generateSegment(project.id, i, segments[i].text, segmentVoice, speed, stability, model);
          const audioDuration = data.duration || 5;
          setSegments(prev => {
            const updated = [...prev];
            const seg = updated[i];
            const newEnd = seg.start + audioDuration;
            updated[i] = { ...seg, audioGenerated: true, timestamp: Date.now(), duration: audioDuration, end: newEnd };
            // Recalculate subsequent segment starts
            for (let j = i + 1; j < updated.length; j++) {
              const prevEnd = updated[j - 1].end;
              const dur = updated[j].duration || (updated[j].end - updated[j].start);
              updated[j] = { ...updated[j], start: prevEnd, end: prevEnd + dur };
            }
            return updated;
          });
        } catch {}
      }
    }
    setGeneratingIndex(null);
    setProcessing("");
  };

  const handleExtractClip = async (index: number) => {
    if (!project?.id || !videoDownloaded) return;
    setExtractingIndex(index);
    try {
      await video.extractClip(project.id, index, segments[index].sourceStart, segments[index].sourceEnd);
      setSegments(prev => prev.map((s, i) => i === index ? { ...s, clipExtracted: true } : s));
    } catch {}
    setExtractingIndex(null);
  };

  const handleExtractAllClips = async () => {
    if (!project?.id || !videoDownloaded) return;
    setProcessing("Extracting clips...");
    for (let i = 0; i < segments.length; i++) {
      if (!segments[i].clipExtracted) {
        setExtractingIndex(i);
        try {
          await video.extractClip(project.id, i, segments[i].sourceStart, segments[i].sourceEnd);
          setSegments(prev => prev.map((s, idx) => idx === i ? { ...s, clipExtracted: true } : s));
        } catch {}
      }
    }
    setExtractingIndex(null);
    setProcessing("");
  };

  const handleMergeAll = async () => {
    if (!project?.id) return;
    setProcessing("Saving segments...");
    try {
      // Force save segments before merge to ensure media_id is persisted
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      await projects.saveSegments(project.id, segments);
      setLastSaved(new Date());
      
      setProcessing("Merging audio segments...");
      const { data: mergeData } = await voice.mergeSegments(project.id, segments.length);
      if (mergeData.timing?.length > 0) {
        const updatedSegs = segments.map((seg, i) => ({ 
          ...seg, 
          start: mergeData.timing[i]?.start ?? seg.start, 
          end: mergeData.timing[i]?.end ?? seg.end 
        }));
        setSegments(updatedSegs);
        // Save updated timing
        await projects.saveSegments(project.id, updatedSegs);
      }
      if (mergeOptions.bgMusic) {
        setProcessing("Generating background music...");
        await video.generateMusic(project.id, mergeOptions.bgMusic);
      }
      setProcessing("Creating video...");
      if ((projectType === "custom" || projectType === "ads") && mediaAssets.length > 0) {
        const mediaTimeline = mediaAssets.map(m => ({ id: m.id, startTime: m.startTime || 0, endTime: m.endTime || 5, assignedSegments: m.assignedSegments || [] }));
        await video.createFromMedia(project.id, mediaTimeline, {
          subtitles: mergeOptions.subtitles, animatedSubtitles: mergeOptions.animatedSubtitles, subtitleStyle: mergeOptions.subtitleStyle,
          subtitleSize: mergeOptions.subtitleSize, subtitlePosition: mergeOptions.subtitlePosition, dialogueMode: mergeOptions.dialogueMode,
          speaker1Position: mergeOptions.speaker1Position, speaker2Position: mergeOptions.speaker2Position,
          dialogueBgStyle: mergeOptions.dialogueBgStyle, resize: mergeOptions.resize
        });
      } else {
        await video.mergeWithOptions(project.id, segments, mergeOptions);
      }
      updateProject({ status: "completed" });
      setFinalVideoTimestamp(Date.now());
      setShowFinalPreview(true);
    } catch {}
    setProcessing("");
  };

  const handleDownloadVideo = async () => {
    if (!project?.id) return;
    setProcessing("Downloading video...");
    try {
      await video.downloadSource(project.id);
      setVideoDownloaded(true);
    } catch {}
    setProcessing("");
  };

  const handleOpenMusicSheet = async () => {
    setShowMusicSheet(true);
    try {
      const { data } = await video.getMusicLibrary();
      setMusicPresets(data.tracks.map((t: any) => ({ id: t.id, name: t.name, desc: t.prompt?.slice(0, 30) || "", cached: t.cached })));
    } catch {}
  };

  const handleGeneratePrompt = async (language: string, imageStyle: string = "cartoon", videoType: string = "tutorial") => {
    if (!project?.id) return;
    setProcessing("Generating thumbnail prompt...");
    try {
      const { data } = await video.generateThumbnailPrompt(project.id, project.script || "", language, imageStyle, videoType);
      setThumbnailPrompt(data.prompt || "");
      setThumbnailTitle(data.title || "");
    } catch {}
    setProcessing("");
  };

  const handleGenerateThumbnailFromPrompt = async (prompt: string, model: string, imageStyle: string = "cartoon", videoType: string = "tutorial", title: string = "") => {
    if (!project?.id) return;
    setProcessing(`Generating thumbnail with ${model}...`);
    try {
      const { data } = await video.generateThumbnailFromPrompt(project.id, prompt, model, imageStyle, videoType, title);
      setThumbnailGenerated(data.generated || false);
    } catch {}
    setProcessing("");
  };

  const handleGenerateYoutubeInfo = async (language: string) => {
    if (!project?.id) return;
    setProcessing(`Generating YouTube info in ${language}...`);
    try {
      const { data } = await ai.generateYoutubeInfo(project.id, project.script || "", language);
      setYoutubeInfo({ title: data.title || project.title, description: data.description || "", tags: data.tags || "" });
    } catch {
      setYoutubeInfo({ title: project?.title || "", description: project?.script?.slice(0, 200) + "..." || "", tags: "shorts,viral,trending" });
    }
    setProcessing("");
  };

  const handleAutoDistributeMedia = async (batchSize: number = 1) => {
    if (!project?.id || mediaAssets.length === 0 || segments.length === 0) return;
    const updated = segments.map((seg, i) => {
      const mediaIndex = Math.floor(i / batchSize) % mediaAssets.length;
      return { ...seg, mediaId: mediaAssets[mediaIndex].id };
    });
    setSegments(updated);
    // Immediate save after media distribution
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    try {
      setSaving(true);
      await projects.saveSegments(project.id, updated);
      setLastSaved(new Date());
    } catch {} finally {
      setSaving(false);
    }
  };

  const EFFECTS = ["none", "fade", "pop", "slide", "zoom"] as const;
  const handleAutoDistributeEffects = (mode: "cycle" | "single", effect?: string) => {
    if (segments.length === 0) return;
    const updated = segments.map((seg, i) => ({
      ...seg,
      effect: mode === "single" ? (effect as typeof EFFECTS[number]) : EFFECTS[i % EFFECTS.length]
    }));
    setSegments(updated);
  };

  const handleApplyVoiceToAll = (voiceId: string) => {
    if (segments.length === 0) return;
    const updated = segments.map(seg => ({ ...seg, voiceId, audioGenerated: false, timestamp: 0 }));
    setSegments(updated);
  };

  const allAudioGenerated = segments.length > 0 && segments.every(s => s.audioGenerated);
  const allClipsExtracted = segments.length > 0 && segments.every(s => s.clipExtracted);

  return {
    project, projectType, step, setStep, segments, setSegments, mediaAssets, setMediaAssets, processing, setProcessing,
    generatingIndex, extractingIndex, previewClip, setPreviewClip, videoDownloaded, mergeOptions, setMergeOptions,
    musicPresets, showMusicSheet, setShowMusicSheet, youtubeInfo, setYoutubeInfo, thumbnailPrompt, setThumbnailPrompt,
    thumbnailTitle, setThumbnailTitle, thumbnailGenerated, thumbnailModel, setThumbnailModel, showFinalPreview, setShowFinalPreview, finalVideoTimestamp,
    saving, lastSaved, allAudioGenerated, allClipsExtracted, loadProject, updateProject, saveSegmentsNow,
    handleUpdateSegment, handleBatchUpdateSegments, handleAddSegment, handleRemoveSegment, handleMoveSegment,
    handleGenerateSegment, handleGenerateAll, handleExtractClip, handleExtractAllClips, handleMergeAll,
    handleDownloadVideo, handleOpenMusicSheet, handleGeneratePrompt, handleGenerateThumbnailFromPrompt,
    handleGenerateYoutubeInfo, handleAutoDistributeMedia, handleAutoDistributeEffects, handleApplyVoiceToAll
  };
}

