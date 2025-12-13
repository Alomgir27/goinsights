"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { projects, voice } from "../api";
import type { Segment } from "../types";

interface UseSegmentsOptions {
  projectId: string;
  segmentsData?: any[];
}

export function useSegments({ projectId, segmentsData }: UseSegmentsOptions) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentProjectIdRef = useRef<string>(projectId);
  const justChangedProjectRef = useRef<boolean>(false);

  // Reset segments when projectId changes
  useEffect(() => {
    if (currentProjectIdRef.current !== projectId) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      justChangedProjectRef.current = true;
      setSegments([]);
      setLastSaved(null);
      currentProjectIdRef.current = projectId;
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId || segments.length === 0) return;
    if (justChangedProjectRef.current) {
      justChangedProjectRef.current = false;
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        setSaving(true);
        await projects.saveSegments(projectId, segments);
        setLastSaved(new Date());
      } catch {} finally {
        setSaving(false);
      }
    }, 800);
    
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current); };
  }, [segments, projectId]);

  const saveSegmentsNow = useCallback(async () => {
    if (!projectId || segments.length === 0) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    try {
      setSaving(true);
      await projects.saveSegments(projectId, segments);
      setLastSaved(new Date());
    } catch {} finally {
      setSaving(false);
    }
  }, [projectId, segments]);

  const loadSegments = useCallback(async (existingAudio: number[] = [], existingClips: number[] = []) => {
    if (!segmentsData || segmentsData.length === 0) return;
    
    const loadedSegments = segmentsData.map((s: any, i: number) => {
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
      const duration = hasAudio ? (end - start) : savedDuration;
      return {
        text, displayText, speaker, start, end, sourceStart: s.source_start || 0, sourceEnd: s.source_end || 10,
        audioGenerated: hasAudio, clipExtracted: existingClips.includes(i), timestamp: Date.now(),
        voiceId: s.voice_id || "aria", mediaId: s.media_id, mediaType: s.media_type, duration: Math.round(duration * 10) / 10,
        trimStart: s.trim_start, trimEnd: s.trim_end, effect: s.effect || "none", silence: s.silence || 0
      };
    });
    setSegments(loadedSegments);
  }, [segmentsData]);

  const handleUpdateSegment = useCallback((index: number, field: string, value: string | number) => {
    setSegments(prev => prev.map((s, i) => {
      if (i !== index) return s;
      if (field === "text") return { ...s, text: value as string, audioGenerated: false, timestamp: 0 };
      if (field === "sourceStart" || field === "sourceEnd") return { ...s, [field]: value, clipExtracted: false };
      return { ...s, [field]: value };
    }));
  }, []);

  const handleBatchUpdateSegments = useCallback((updates: Array<{ index: number; field: string; value: string | number }>) => {
    setSegments(prev => prev.map((s, i) => {
      const update = updates.find(u => u.index === i);
      if (!update) return s;
      if (update.field === "text") return { ...s, text: update.value as string, audioGenerated: false, timestamp: 0 };
      return { ...s, [update.field]: update.value };
    }));
  }, []);

  const handleAddSegment = useCallback((position: number, currentTime: number = 0, selectedVoice: string = "aria") => {
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
        const start = time, end = time + duration;
        time = end;
        return { ...s, start, end };
      });
    });
  }, []);

  const handleRemoveSegment = useCallback((index: number) => {
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
  }, [segments.length]);

  const handleMoveSegment = useCallback((index: number, direction: "up" | "down") => {
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
  }, [segments.length]);

  const handleAutoDistributeMedia = useCallback(async (mediaAssets: any[], batchSize: number = 1) => {
    if (mediaAssets.length === 0 || segments.length === 0) return;
    const updated = segments.map((seg, i) => {
      const mediaIndex = Math.floor(i / batchSize) % mediaAssets.length;
      const mediaId = mediaAssets[mediaIndex].id;
      return { ...seg, mediaId, mediaIds: [mediaId] };
    });
    setSegments(updated);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    try {
      setSaving(true);
      await projects.saveSegments(projectId, updated);
      setLastSaved(new Date());
    } catch {} finally {
      setSaving(false);
    }
  }, [segments, projectId]);

  const handleToggleMedia = useCallback((index: number, mediaId: string) => {
    setSegments(prev => prev.map((seg, i) => {
      if (i !== index) return seg;
      const currentIds = seg.mediaIds || (seg.mediaId ? [seg.mediaId] : []);
      const isSelected = currentIds.includes(mediaId);
      const newIds = isSelected ? currentIds.filter(id => id !== mediaId) : [...currentIds, mediaId];
      return { ...seg, mediaIds: newIds, mediaId: newIds[0] || "" };
    }));
  }, []);

  const handleAutoDistributeEffects = useCallback((mode: "cycle" | "single", effect?: string) => {
    const EFFECTS = ["none", "fade", "pop", "slide", "zoom", "zoom_out", "pan_left", "pan_right", "shake", "bounce"] as const;
    if (segments.length === 0) return;
    setSegments(prev => prev.map((seg, i) => ({
      ...seg,
      effect: mode === "single" ? (effect as typeof EFFECTS[number]) : EFFECTS[i % EFFECTS.length]
    })));
  }, [segments.length]);

  const handleApplyVoiceToAll = useCallback((voiceId: string) => {
    if (segments.length === 0) return;
    setSegments(prev => prev.map(seg => ({ ...seg, voiceId, audioGenerated: false, timestamp: 0 })));
  }, [segments.length]);

  const handleApplySilenceToAll = useCallback((mode: "fixed" | "random", value: number, maxValue?: number) => {
    if (segments.length === 0) return;
    setSegments(prev => prev.map(seg => ({
      ...seg,
      silence: mode === "fixed" ? value : Math.round((value + Math.random() * ((maxValue || value) - value)) * 10) / 10
    })));
  }, [segments.length]);

  return {
    segments, setSegments, saving, lastSaved, loadSegments, saveSegmentsNow,
    handleUpdateSegment, handleBatchUpdateSegments, handleAddSegment, handleRemoveSegment, handleMoveSegment,
    handleToggleMedia, handleAutoDistributeMedia, handleAutoDistributeEffects, handleApplyVoiceToAll, handleApplySilenceToAll,
    allAudioGenerated: segments.length > 0 && segments.every(s => s.audioGenerated),
    allClipsExtracted: segments.length > 0 && segments.every(s => s.clipExtracted)
  };
}

