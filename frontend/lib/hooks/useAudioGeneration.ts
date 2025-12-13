"use client";

import { useState, useCallback } from "react";
import { voice, video, projects } from "../api";
import type { Segment } from "../types";

interface UseAudioGenerationOptions {
  projectId: string;
  segments: Segment[];
  setSegments: React.Dispatch<React.SetStateAction<Segment[]>>;
}

export function useAudioGeneration({ projectId, segments, setSegments }: UseAudioGenerationOptions) {
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [extractingIndex, setExtractingIndex] = useState<number | null>(null);
  const [processing, setProcessing] = useState("");

  const handleGenerateSegment = useCallback(async (index: number, voiceId: string, speed: number, stability: number, model: string) => {
    if (!projectId) return;
    setGeneratingIndex(index);
    try {
      const { data } = await voice.generateSegment(projectId, index, segments[index].text, voiceId, speed, stability, model);
      const audioDuration = data.duration || 5;
      setSegments(prev => {
        const updated = [...prev];
        const seg = updated[index];
        const newEnd = seg.start + audioDuration;
        updated[index] = { ...seg, audioGenerated: true, timestamp: Date.now(), duration: audioDuration, end: newEnd };
        for (let i = index + 1; i < updated.length; i++) {
          const prevEnd = updated[i - 1].end;
          const dur = updated[i].duration || (updated[i].end - updated[i].start);
          updated[i] = { ...updated[i], start: prevEnd, end: prevEnd + dur };
        }
        return updated;
      });
    } catch {}
    setGeneratingIndex(null);
  }, [projectId, segments, setSegments]);

  const handleGenerateAll = useCallback(async (selectedVoice: string, speed: number, stability: number, model: string) => {
    if (!projectId) return;
    setProcessing("Generating all audio...");
    for (let i = 0; i < segments.length; i++) {
      if (!segments[i].audioGenerated) {
        setGeneratingIndex(i);
        try {
          const segmentVoice = segments[i].voiceId || selectedVoice;
          const { data } = await voice.generateSegment(projectId, i, segments[i].text, segmentVoice, speed, stability, model);
          const audioDuration = data.duration || 5;
          setSegments(prev => {
            const updated = [...prev];
            const seg = updated[i];
            const newEnd = seg.start + audioDuration;
            updated[i] = { ...seg, audioGenerated: true, timestamp: Date.now(), duration: audioDuration, end: newEnd };
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
  }, [projectId, segments, setSegments]);

  const handleExtractClip = useCallback(async (index: number, videoDownloaded: boolean) => {
    if (!projectId || !videoDownloaded) return;
    setExtractingIndex(index);
    try {
      await video.extractClip(projectId, index, segments[index].sourceStart, segments[index].sourceEnd);
      setSegments(prev => prev.map((s, i) => i === index ? { ...s, clipExtracted: true } : s));
    } catch {}
    setExtractingIndex(null);
  }, [projectId, segments, setSegments]);

  const handleExtractAllClips = useCallback(async (videoDownloaded: boolean) => {
    if (!projectId || !videoDownloaded) return;
    setProcessing("Extracting clips...");
    for (let i = 0; i < segments.length; i++) {
      if (!segments[i].clipExtracted) {
        setExtractingIndex(i);
        try {
          await video.extractClip(projectId, i, segments[i].sourceStart, segments[i].sourceEnd);
          setSegments(prev => prev.map((s, idx) => idx === i ? { ...s, clipExtracted: true } : s));
        } catch {}
      }
    }
    setExtractingIndex(null);
    setProcessing("");
  }, [projectId, segments, setSegments]);

  return {
    generatingIndex, extractingIndex, processing, setProcessing,
    handleGenerateSegment, handleGenerateAll, handleExtractClip, handleExtractAllClips
  };
}

