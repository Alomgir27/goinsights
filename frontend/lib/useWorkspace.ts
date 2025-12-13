"use client";

import { useState, useEffect, useCallback } from "react";
import { voice, video, projects } from "./api";
import { useStore } from "./store";
import { useSegments } from "./hooks/useSegments";
import { useAudioGeneration } from "./hooks/useAudioGeneration";
import { useVideoMerge } from "./hooks/useVideoMerge";
import { useThumbnail } from "./hooks/useThumbnail";
import type { MediaAsset, ProjectType, StepType } from "./types";

export function useWorkspace(projectId: string) {
  const { project, setProject, updateProject } = useStore();
  
  const [projectType, setProjectType] = useState<ProjectType>("youtube");
  const [step, setStep] = useState<StepType>("script");
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [videoDownloaded, setVideoDownloaded] = useState(false);
  const [previewClip, setPreviewClip] = useState<number | null>(null);

  // Reset state when projectId changes
  useEffect(() => {
    setProject(null);
    setMediaAssets([]);
    setVideoDownloaded(false);
    setPreviewClip(null);
    setStep("script");
  }, [projectId, setProject]);

  const segmentsHook = useSegments({ projectId, segmentsData: project?.segments_data });
  const { segments, setSegments } = segmentsHook;

  const audioHook = useAudioGeneration({ projectId, segments, setSegments });
  const { processing, setProcessing } = audioHook;

  const videoMergeHook = useVideoMerge({ projectId, projectType, segments, setSegments, mediaAssets, setProcessing, updateProject });
  const thumbnailHook = useThumbnail({ projectId, projectScript: project?.script, projectTitle: project?.title, setProcessing });

  const loadProject = useCallback(async () => {
    try {
      const { data } = await projects.get(projectId);
      setProjectType(data.project_type || "youtube");
      setProject({
        id: data.id, videoId: data.video_id, title: data.title, thumbnail: data.thumbnail_url,
        duration: data.duration, transcript: data.transcript || [], summary: data.summary,
        script: data.script, segments_data: data.segments_data, clips: [], status: data.status,
        prompt: data.prompt, project_type: data.project_type, video_style: data.video_style,
        language: data.language, wiki_data: data.wiki_data
      });
      if (data.script) setStep("segments");
      
      if ((data.project_type === "custom" || data.project_type === "ads" || data.project_type === "wikipedia") && data.media_assets) {
        const segs = data.segments_data || [];
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
            const firstSeg = segs[assignedSegs[0]];
            const lastSeg = segs[assignedSegs[assignedSegs.length - 1]];
            return { ...m, startTime: firstSeg?.start || 0, endTime: lastSeg?.end || 5, duration: (lastSeg?.end || 5) - (firstSeg?.start || 0), assignedSegments: assignedSegs };
          }
          return { ...m, startTime: i * 5, endTime: (i + 1) * 5, duration: 5, assignedSegments: [] };
        });
        setMediaAssets(assignedMedia);
      }
      
      const { data: filesData } = await voice.checkExistingSegments(data.id);
      if (filesData.video_downloaded) setVideoDownloaded(true);
      if (data.thumbnail_generated) {
        thumbnailHook.setThumbnailGenerated(true);
        thumbnailHook.setThumbnailPrompt(data.thumbnail_prompt || "");
      }
      if (data.youtube_info) {
        thumbnailHook.setYoutubeInfo({ title: data.youtube_info.title || "", description: data.youtube_info.description || "", tags: data.youtube_info.tags || "" });
      }
    } catch {}
  }, [projectId, setProject]);

  useEffect(() => {
    if (!project?.id) return;
    const load = async () => {
      let existingAudio: number[] = [], existingClips: number[] = [];
      try {
        const { data } = await voice.checkExistingSegments(project.id);
        existingAudio = data.existing_segments || [];
        existingClips = data.existing_clips || [];
        if (data.video_downloaded) setVideoDownloaded(true);
      } catch {}
      segmentsHook.loadSegments(existingAudio, existingClips);
    };
    load();
  }, [project?.id, project?.segments_data]);

  const handleDownloadVideo = async () => {
    if (!project?.id) return;
    setProcessing("Downloading video...");
    try {
      await video.downloadSource(project.id);
      setVideoDownloaded(true);
    } catch {}
    setProcessing("");
  };

  const handleAutoDistributeMedia = async (batchSize: number = 1) => {
    await segmentsHook.handleAutoDistributeMedia(mediaAssets, batchSize);
  };

  return {
    project, projectType, step, setStep, mediaAssets, setMediaAssets, videoDownloaded, previewClip, setPreviewClip,
    loadProject, updateProject, handleDownloadVideo,
    ...segmentsHook,
    handleAutoDistributeMedia,
    ...audioHook,
    ...videoMergeHook,
    ...thumbnailHook
  };
}
