"use client";

import { useState, useCallback, useRef } from "react";
import { voice, video, projects } from "../api";
import type { Segment, MediaAsset, MergeOptions, MusicPreset, ProjectType } from "../types";

interface UseVideoMergeOptions {
  projectId: string;
  projectType: ProjectType;
  segments: Segment[];
  setSegments: React.Dispatch<React.SetStateAction<Segment[]>>;
  mediaAssets: MediaAsset[];
  setProcessing: (val: string) => void;
  updateProject: (updates: any) => void;
}

export function useVideoMerge({ projectId, projectType, segments, setSegments, mediaAssets, setProcessing, updateProject }: UseVideoMergeOptions) {
  const [mergeOptions, setMergeOptions] = useState<MergeOptions>({
    subtitles: false, animatedSubtitles: true, subtitleStyle: "karaoke", subtitleSize: 72, subtitlePosition: "bottom",
    dialogueMode: false, speaker1Position: "top-left", speaker2Position: "top-right", dialogueBgStyle: "transparent",
    resize: "16:9", bgMusic: "", bgMusicVolume: 0.3,
    watermark: { enabled: false, text: "", position: "bottom-right", fontSize: 28, opacity: 0.7 }
  });
  const [musicPresets, setMusicPresets] = useState<MusicPreset[]>([]);
  const [showMusicSheet, setShowMusicSheet] = useState(false);
  const [showFinalPreview, setShowFinalPreview] = useState(false);
  const [finalVideoTimestamp, setFinalVideoTimestamp] = useState(0);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleOpenMusicSheet = useCallback(async () => {
    setShowMusicSheet(true);
    try {
      const { data } = await video.getMusicLibrary();
      setMusicPresets(data.tracks.map((t: any) => ({ id: t.id, name: t.name, artist: t.artist || "", cached: t.cached })));
    } catch {}
  }, []);

  const handleMergeAll = useCallback(async () => {
    if (!projectId) return;
    setProcessing("Saving segments...");
    try {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      await projects.saveSegments(projectId, segments);
      
      setProcessing("Merging audio segments...");
      const silences = segments.map(s => s.silence || 0);
      const { data: mergeData } = await voice.mergeSegments(projectId, segments.length, silences);
      if (mergeData.timing?.length > 0) {
        const updatedSegs = segments.map((seg, i) => ({ ...seg, start: mergeData.timing[i]?.start ?? seg.start, end: mergeData.timing[i]?.end ?? seg.end }));
        setSegments(updatedSegs);
        await projects.saveSegments(projectId, updatedSegs);
      }
      if (mergeOptions.bgMusic && !mergeOptions.bgMusic.startsWith("yt:")) {
        setProcessing("Generating background music...");
        await video.generateMusic(projectId, mergeOptions.bgMusic);
      }
      setProcessing("Creating video...");
      if ((projectType === "custom" || projectType === "ads" || projectType === "wikipedia") && mediaAssets.length > 0) {
        const mediaTimeline = mediaAssets.map(m => ({ id: m.id, startTime: m.startTime || 0, endTime: m.endTime || 5, assignedSegments: m.assignedSegments || [] }));
        await video.createFromMedia(projectId, mediaTimeline, {
          subtitles: mergeOptions.subtitles, animatedSubtitles: mergeOptions.animatedSubtitles, subtitleStyle: mergeOptions.subtitleStyle,
          subtitleSize: mergeOptions.subtitleSize, subtitlePosition: mergeOptions.subtitlePosition, dialogueMode: mergeOptions.dialogueMode,
          speaker1Position: mergeOptions.speaker1Position, speaker2Position: mergeOptions.speaker2Position,
          dialogueBgStyle: mergeOptions.dialogueBgStyle, resize: mergeOptions.resize,
          bgMusic: !!mergeOptions.bgMusic, bgMusicVolume: mergeOptions.bgMusicVolume,
          watermark: mergeOptions.watermark
        });
      } else {
        await video.mergeWithOptions(projectId, segments, mergeOptions);
      }
      updateProject({ status: "completed" });
      setFinalVideoTimestamp(Date.now());
      setShowFinalPreview(true);
    } catch {}
    setProcessing("");
  }, [projectId, projectType, segments, setSegments, mediaAssets, mergeOptions, setProcessing, updateProject]);

  return {
    mergeOptions, setMergeOptions, musicPresets, showMusicSheet, setShowMusicSheet,
    showFinalPreview, setShowFinalPreview, finalVideoTimestamp,
    handleOpenMusicSheet, handleMergeAll
  };
}

