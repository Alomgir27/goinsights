"use client";

import { useState, useCallback } from "react";
import { video, ai } from "../api";
import type { YoutubeInfo } from "../types";

interface UseThumbnailOptions {
  projectId: string;
  projectScript?: string;
  projectTitle?: string;
  setProcessing: (val: string) => void;
}

export function useThumbnail({ projectId, projectScript, projectTitle, setProcessing }: UseThumbnailOptions) {
  const [youtubeInfo, setYoutubeInfo] = useState<YoutubeInfo>({ title: "", description: "", tags: "" });
  const [thumbnailPrompt, setThumbnailPrompt] = useState("");
  const [thumbnailTitle, setThumbnailTitle] = useState("");
  const [thumbnailGenerated, setThumbnailGenerated] = useState(false);
  const [thumbnailModel, setThumbnailModel] = useState("gemini-3-pro");

  const handleGeneratePrompt = useCallback(async (language: string, imageStyle: string = "cartoon", videoType: string = "tutorial") => {
    if (!projectId) return;
    setProcessing("Generating thumbnail prompt...");
    try {
      const { data } = await video.generateThumbnailPrompt(projectId, projectScript || "", language, imageStyle, videoType);
      setThumbnailPrompt(data.prompt || "");
      setThumbnailTitle(data.title || "");
    } catch {}
    setProcessing("");
  }, [projectId, projectScript, setProcessing]);

  const handleGenerateThumbnailFromPrompt = useCallback(async (prompt: string, model: string, imageStyle: string = "cartoon", videoType: string = "tutorial", title: string = "", titlePosition: string = "") => {
    if (!projectId) return;
    setProcessing(`Generating thumbnail with ${model}...`);
    try {
      const { data } = await video.generateThumbnailFromPrompt(projectId, prompt, model, imageStyle, videoType, title, titlePosition);
      setThumbnailGenerated(data.generated || false);
    } catch {}
    setProcessing("");
  }, [projectId, setProcessing]);

  const handleUploadThumbnail = useCallback(async (file: File) => {
    if (!projectId) return;
    setProcessing("Uploading thumbnail...");
    try {
      const { data } = await video.uploadThumbnail(projectId, file);
      setThumbnailGenerated(data.uploaded || false);
    } catch {}
    setProcessing("");
  }, [projectId, setProcessing]);

  const handleSelectMediaAsThumbnail = useCallback(async (mediaId: string, options?: { title?: string; fontSize?: string; fontStyle?: string; position?: string; textColor?: string; strokeColor?: string; strokeWidth?: number; effect?: string }) => {
    if (!projectId) return;
    setProcessing("Creating thumbnail...");
    try {
      const { data } = await video.setThumbnailFromMedia(projectId, mediaId, options);
      setThumbnailGenerated(data.success || false);
    } catch {}
    setProcessing("");
  }, [projectId, setProcessing]);

  const handleGenerateYoutubeInfo = useCallback(async (language: string) => {
    if (!projectId) return;
    setProcessing(`Generating YouTube info in ${language}...`);
    try {
      const { data } = await ai.generateYoutubeInfo(projectId, projectScript || "", language);
      setYoutubeInfo({ title: data.title || projectTitle || "", description: data.description || "", tags: data.tags || "" });
    } catch {
      setYoutubeInfo({ title: projectTitle || "", description: (projectScript || "").slice(0, 200) + "...", tags: "shorts,viral,trending" });
    }
    setProcessing("");
  }, [projectId, projectScript, projectTitle, setProcessing]);

  return {
    youtubeInfo, setYoutubeInfo, thumbnailPrompt, setThumbnailPrompt,
    thumbnailTitle, setThumbnailTitle, thumbnailGenerated, setThumbnailGenerated,
    thumbnailModel, setThumbnailModel,
    handleGeneratePrompt, handleGenerateThumbnailFromPrompt, handleUploadThumbnail, handleSelectMediaAsThumbnail, handleGenerateYoutubeInfo
  };
}

