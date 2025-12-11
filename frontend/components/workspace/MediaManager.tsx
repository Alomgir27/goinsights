"use client";

import React, { useState, useRef, useEffect } from "react";
import { Upload, Sparkles, Trash2, Image, Loader2, X, Wand2, Maximize2, CheckSquare, Square, RefreshCw, Edit2, Search, Globe, Film } from "lucide-react";
import { media } from "@/lib/api";
import type { MediaAsset, Segment } from "@/lib/types";

const IMAGE_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5", desc: "Fast" },
  { id: "gemini-3-pro", name: "Gemini 3", desc: "High quality" },
  { id: "dall-e-3", name: "DALL-E 3", desc: "OpenAI" },
];

const IMAGE_STYLES = [
  { id: "cartoon", name: "Cartoon", icon: "🎨" },
  { id: "anime", name: "Anime", icon: "🎌" },
  { id: "realistic", name: "Realistic", icon: "📷" },
  { id: "3d_render", name: "3D Render", icon: "🎮" },
  { id: "watercolor", name: "Watercolor", icon: "🖼️" },
  { id: "flat_vector", name: "Flat Vector", icon: "📐" },
  { id: "cinematic", name: "Cinematic", icon: "🎬" },
];

const ASPECT_RATIOS = [
  { id: "16:9", name: "16:9", desc: "Landscape" },
  { id: "9:16", name: "9:16", desc: "Portrait" },
  { id: "1:1", name: "1:1", desc: "Square" },
  { id: "4:3", name: "4:3", desc: "Standard" },
];

const PROMPT_LANGUAGES = [
  { id: "en", name: "English" },
  { id: "bn", name: "Bengali" },
  { id: "hi", name: "Hindi" },
  { id: "es", name: "Spanish" },
  { id: "fr", name: "French" },
  { id: "zh", name: "Chinese" },
  { id: "ja", name: "Japanese" },
  { id: "ar", name: "Arabic" },
];

function PromptCard({ index, prompt, onUpdate, onGenerate, onRegenerate }: {
  index: number;
  prompt: { text: string; generating: boolean; generated: boolean };
  onUpdate: (text: string) => void;
  onGenerate: () => void;
  onRegenerate?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`rounded-lg border ${prompt.generated ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-2 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${prompt.generated ? "bg-green-500 text-white" : "bg-slate-200 text-slate-600"}`}>
            #{index + 1}
          </span>
          {prompt.generated && <span className="text-[10px] text-green-600">✓ Generated</span>}
          {prompt.generating && <Loader2 className="w-3 h-3 animate-spin text-purple-500" />}
        </div>
        <span className="text-[10px] text-slate-400">{expanded ? "▲" : "▼"}</span>
      </button>
      
      {expanded && (
        <div className="px-2 pb-2">
          <textarea
            value={prompt.text}
            onChange={(e) => onUpdate(e.target.value)}
            disabled={prompt.generating}
            className="w-full text-xs p-2 border border-slate-200 rounded resize-none focus:border-purple-400 focus:outline-none disabled:bg-slate-50"
            rows={2}
          />
          {prompt.generated ? (
            <button
              onClick={onRegenerate}
              disabled={prompt.generating}
              className="w-full mt-2 py-1.5 text-xs bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {prompt.generating ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Regenerating...</>
              ) : (
                <><RefreshCw className="w-3 h-3" /> Regenerate Image</>
              )}
            </button>
          ) : (
            <button
              onClick={onGenerate}
              disabled={prompt.generating}
              className="w-full mt-2 py-1.5 text-xs bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {prompt.generating ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-3 h-3" /> Generate Image</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface MediaManagerProps {
  projectId: string;
  mediaAssets: MediaAsset[];
  onMediaChange: (assets: MediaAsset[]) => void;
  script?: string;
  segments?: Segment[];
  totalDuration: number;
  language?: string;
}

export default function MediaManager({ projectId, mediaAssets, onMediaChange, script, segments, totalDuration, language = "English" }: MediaManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [imageStyle, setImageStyle] = useState("cartoon");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [promptLanguage, setPromptLanguage] = useState("en");
  const [showGenerator, setShowGenerator] = useState(false);
  const [imageCount, setImageCount] = useState(0);
  const [fullscreenMedia, setFullscreenMedia] = useState<{ url: string; type: string } | null>(null);
  const [generatedPrompts, setGeneratedPrompts] = useState<{text: string; generating: boolean; generated: boolean; targetSegments?: number[]}[]>([]);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<Set<number>>(new Set());
  const [showSegmentSelector, setShowSegmentSelector] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editPromptText, setEditPromptText] = useState("");
  const [showStockSearch, setShowStockSearch] = useState(false);
  const [stockQuery, setStockQuery] = useState("");
  const [stockResults, setStockResults] = useState<any[]>([]);
  const [stockSearching, setStockSearching] = useState(false);
  const [stockMediaType, setStockMediaType] = useState<"photos" | "videos">("photos");
  const [downloadingStock, setDownloadingStock] = useState<string | null>(null);
  const [stockPage, setStockPage] = useState(1);
  const [stockHasMore, setStockHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get ALL AI-generated image prompts for style consistency
  const aiGeneratedCount = mediaAssets.filter(m => m.source === "ai_generated").length;
  const existingPrompts = mediaAssets
    .filter(m => m.source === "ai_generated" && m.prompt)
    .map(m => m.prompt as string);

  const toggleSegmentSelection = (index: number) => {
    setSelectedSegments(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  // Select all segments (for generating images for all)
  const selectAllSegments = () => {
    if (!segments) return;
    setSelectedSegments(new Set(segments.map((_, i) => i)));
  };

  // Select only segments without images
  const selectUnassignedSegments = () => {
    if (!segments) return;
    const assignedSet = new Set(mediaAssets.flatMap(m => m.assignedSegments || []));
    const unassigned = segments.map((_, i) => i).filter(i => !assignedSet.has(i));
    setSelectedSegments(new Set(unassigned));
  };
  
  // Get segment time info for smart assignment
  const getSegmentInfo = (segIndex: number) => {
    if (!segments || segIndex >= segments.length) return { start: 0, end: 5, duration: 5 };
    const seg = segments[segIndex];
    return { start: seg.start, end: seg.end, duration: seg.end - seg.start };
  };

  // Calculate next unassigned segment index
  const getNextUnassignedSegment = (): number => {
    if (!segments || segments.length === 0) return 0;
    const assignedSegments = new Set(mediaAssets.flatMap(a => a.assignedSegments || []));
    for (let i = 0; i < segments.length; i++) {
      if (!assignedSegments.has(i)) return i;
    }
    return segments.length; // All assigned
  };

  // Calculate time position for next media based on segments
  const getNextTimePosition = (): { startTime: number; endTime: number; assignedSegments: number[] } => {
    const nextSegIdx = getNextUnassignedSegment();
    if (!segments || nextSegIdx >= segments.length) {
      // All segments assigned, add after last media
      const lastEnd = mediaAssets.length > 0 ? Math.max(...mediaAssets.map(a => a.endTime || 0)) : 0;
      return { startTime: lastEnd, endTime: lastEnd + 5, assignedSegments: [] };
    }
    const seg = segments[nextSegIdx];
    return { 
      startTime: seg.start, 
      endTime: seg.end, 
      assignedSegments: [nextSegIdx] 
    };
  };
  
  // Update media timeline
  const updateMediaTimeline = (mediaId: string, updates: Partial<MediaAsset>) => {
    onMediaChange(mediaAssets.map(m => m.id === mediaId ? { ...m, ...updates } : m));
  };
  
  // Auto-assign segments based on time range
  const getSegmentsForTimeRange = (start: number, end: number): number[] => {
    if (!segments) return [];
    return segments
      .map((s, i) => ({ index: i, ...s }))
      .filter(s => s.start < end && s.end > start)
      .map(s => s.index);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { data } = await media.upload(projectId, file);
        const pos = getNextTimePosition();
        const duration = pos.endTime - pos.startTime;
        const newAsset: MediaAsset = {
          ...data,
          order: mediaAssets.length,
          startTime: pos.startTime,
          endTime: pos.endTime,
          duration,
          assignedSegments: pos.assignedSegments
        };
        onMediaChange([...mediaAssets, newAsset]);
      }
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const { data } = await media.generateImage(projectId, prompt, { 
        model: selectedModel, imageStyle, aspectRatio 
      });
      const pos = getNextTimePosition();
      const duration = pos.endTime - pos.startTime;
      const newAsset: MediaAsset = {
        ...data,
        order: mediaAssets.length,
        startTime: pos.startTime,
        endTime: pos.endTime,
        duration,
        assignedSegments: pos.assignedSegments
      };
      onMediaChange([...mediaAssets, newAsset]);
      setPrompt("");
      setShowGenerator(false);
    } catch (err) {
      console.error("Image generation failed:", err);
    }
    setGenerating(false);
  };

  const handleRegenerateImage = async (asset: MediaAsset) => {
    if (!asset.prompt) return;
    setRegeneratingId(asset.id);
    try {
      const { data } = await media.regenerateImage(asset.id, {
        model: selectedModel, imageStyle, aspectRatio
      });
      onMediaChange(mediaAssets.map(m => m.id === asset.id ? { ...m, ...data } : m));
    } catch (err) {
      console.error("Regenerate failed:", err);
    }
    setRegeneratingId(null);
  };

  const handleUpdateImagePrompt = async (mediaId: string, newPrompt: string) => {
    try {
      await media.updatePrompt(mediaId, newPrompt);
      onMediaChange(mediaAssets.map(m => m.id === mediaId ? { ...m, prompt: newPrompt } : m));
      setEditingPromptId(null);
    } catch (err) {
      console.error("Update prompt failed:", err);
    }
  };

  const handleDelete = async (mediaId: string) => {
    try {
      await media.delete(mediaId);
      onMediaChange(mediaAssets.filter(m => m.id !== mediaId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const suggestPrompt = async () => {
    if (!script && (!segments || segments.length === 0)) return;
    setSuggesting(true);
    try {
      const { data } = await media.suggestPrompt(projectId, segments || [], script || "", {
        imageStyle, aspectRatio, promptLanguage
      });
      setPrompt(data.prompt || "");
    } catch (err) {
      console.error("Suggest failed:", err);
    }
    setSuggesting(false);
  };

  // Generate prompts from selected segments (uses existing images as style reference)
  const handleGeneratePrompts = async () => {
    if (!segments || segments.length === 0) return;
    if (selectedSegments.size === 0 && imageCount === 0) return;
    
    setGeneratingPrompts(true);
    try {
      // Get segments user selected for new image generation
      const selectedIndices = Array.from(selectedSegments).sort((a, b) => a - b);
      const segmentsToUse = selectedIndices.length > 0 
        ? selectedIndices.map(i => ({ ...segments[i], segmentIndex: i }))
        : segments.map((s, i) => ({ ...s, segmentIndex: i }));
      
      // Number of images = user choice OR number of selected segments
      const count = imageCount > 0 ? imageCount : selectedIndices.length || 3;
      
      const { data } = await media.generatePrompts(projectId, segmentsToUse, count, {
        language, existingPrompts, imageStyle, aspectRatio, promptLanguage
      });
      
      // Store which segments each prompt is for
      setGeneratedPrompts(data.prompts.map((p: any, idx: number) => ({ 
        text: typeof p === 'string' ? p : (p.prompt || JSON.stringify(p)), 
        generating: false, 
        generated: false,
        targetSegments: selectedIndices.length > 0 ? selectedIndices : []
      })));
      setShowSegmentSelector(false);
    } catch (err) {
      console.error("Prompt generation failed:", err);
    }
    setGeneratingPrompts(false);
  };

  // Generate single image from prompt with context from ALL previous images
  const handleGenerateSingleImage = async (index: number) => {
    const promptData = generatedPrompts[index];
    if (!promptData || promptData.generating) return;
    
    setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, generating: true } : p));
    
    try {
      // Combine: existing AI images + newly generated in this batch
      const batchPrompts = generatedPrompts.slice(0, index).filter(p => p.generated).map(p => p.text);
      const allPreviousPrompts = [...existingPrompts, ...batchPrompts];
      
      // Add strong context to prompt for consistency
      let enhancedPrompt = promptData.text;
      if (allPreviousPrompts.length > 0) {
        const contextSamples = allPreviousPrompts.slice(-3).map(p => p.slice(0, 150)).join(' | ');
        enhancedPrompt = `[STYLE MATCH REQUIRED - use exact same visual style, characters, colors as: ${contextSamples}]\n\n${promptData.text}`;
      }
      
      const { data } = await media.generateImage(projectId, enhancedPrompt, {
        model: selectedModel, imageStyle, aspectRatio
      });
      
      // Calculate next available segment position
      const assignedSet = new Set(mediaAssets.flatMap(m => m.assignedSegments || []));
      let segIdx = 0;
      for (let i = 0; i < (segments?.length || 0); i++) {
        if (!assignedSet.has(i)) { segIdx = i; break; }
      }
      const seg = segments?.[segIdx];
      const startTime = seg?.start || 0;
      const endTime = seg?.end || startTime + 5;
      
      const newAsset = {
        ...data,
        type: "image" as const,
        source: "ai_generated" as const,
        order: mediaAssets.length,
        startTime,
        endTime,
        duration: endTime - startTime,
        assignedSegments: [segIdx],
        prompt: promptData.text // Store original prompt
      };
      onMediaChange([...mediaAssets, newAsset]);
      setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, generating: false, generated: true } : p));
    } catch (err) {
      console.error("Image generation failed:", err);
      setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, generating: false } : p));
    }
  };

  // Update prompt text
  const handleUpdatePrompt = (index: number, text: string) => {
    setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, text } : p));
  };

  // Regenerate image from prompt card (find matching asset and regenerate)
  const handleRegenerateSingleImage = async (index: number) => {
    const promptData = generatedPrompts[index];
    if (!promptData || promptData.generating) return;
    
    // Find the media asset that matches this prompt (by index in generated order)
    const aiAssets = mediaAssets.filter(m => m.source === "ai_generated");
    const assetIndex = aiAssets.length - generatedPrompts.length + index;
    const asset = aiAssets[assetIndex];
    
    if (!asset) {
      console.error("Asset not found for regeneration");
      return;
    }
    
    setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, generating: true } : p));
    
    try {
      const { data } = await media.regenerateImage(asset.id, {
        prompt: promptData.text,
        model: selectedModel,
        imageStyle,
        aspectRatio
      });
      onMediaChange(mediaAssets.map(m => m.id === asset.id ? { ...m, ...data } : m));
      setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, generating: false } : p));
    } catch (err) {
      console.error("Regenerate failed:", err);
      setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, generating: false } : p));
    }
  };

  // Auto-redistribute all media across segments
  const autoDistribute = () => {
    if (!segments || segments.length === 0 || mediaAssets.length === 0) return;
    
    const redistributed = mediaAssets.map((asset, i) => {
      const segIdx = i < segments.length ? i : i % segments.length;
      const seg = segments[segIdx];
      return {
        ...asset,
        startTime: seg.start,
        endTime: seg.end,
        duration: seg.end - seg.start,
        assignedSegments: [segIdx]
      };
    });
    onMediaChange(redistributed);
  };

  const moveMedia = async (index: number, direction: "left" | "right") => {
    const newIndex = direction === "left" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= mediaAssets.length) return;
    const updated = [...mediaAssets];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    const reordered = updated.map((m, i) => ({ ...m, order: i }));
    onMediaChange(reordered);
    // Save order to database
    try {
      await media.updateOrder(projectId, reordered.map(m => m.id));
    } catch (err) {
      console.error("Failed to save media order:", err);
    }
  };

  const handleStockSearch = async (loadMore = false) => {
    if (!stockQuery.trim()) return;
    const page = loadMore ? stockPage + 1 : 1;
    loadMore ? setLoadingMore(true) : setStockSearching(true);
    try {
      const orientation = aspectRatio === "9:16" ? "portrait" : aspectRatio === "1:1" ? "square" : "landscape";
      const { data } = await media.searchStock(stockQuery, stockMediaType, orientation, page);
      const newResults = data.results || [];
      setStockResults(loadMore ? [...stockResults, ...newResults] : newResults);
      setStockPage(page);
      setStockHasMore(newResults.length >= 15);
    } catch (err) {
      console.error("Stock search failed:", err);
    }
    setStockSearching(false);
    setLoadingMore(false);
  };

  const handleStockDownload = async (item: any) => {
    setDownloadingStock(item.id);
    try {
      const { data } = await media.downloadStock(projectId, item.url, "pexels", item.type);
      const pos = getNextTimePosition();
      const newAsset: MediaAsset = {
        ...data,
        order: mediaAssets.length,
        startTime: pos.startTime,
        endTime: pos.endTime,
        duration: data.duration || (pos.endTime - pos.startTime),
        assignedSegments: pos.assignedSegments
      };
      onMediaChange([...mediaAssets, newAsset]);
      setStockResults(stockResults.filter(r => r.id !== item.id));
    } catch (err) {
      console.error("Stock download failed:", err);
    }
    setDownloadingStock(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Image className="w-4 h-4" /> Media Assets
        </h4>
        <span className="text-xs text-slate-500">{mediaAssets.length} items</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {mediaAssets.map((asset, i) => (
          <div 
            key={asset.id} 
            className="relative group aspect-video bg-slate-100 rounded-lg overflow-hidden"
          >
            {regeneratingId === asset.id && (
              <div className="absolute inset-0 z-10 bg-black/70 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-white" />
              </div>
            )}
            {asset.type === "image" ? (
              <img src={`${media.getUrl(asset.id)}?t=${Date.now()}`} alt="" className="w-full h-full object-cover" />
            ) : (
              <video 
                src={media.getUrl(asset.id)} 
                className="w-full h-full object-cover"
                preload="metadata"
                muted
                playsInline
                onMouseEnter={(e) => e.currentTarget.play()}
                onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
              />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => moveMedia(i, "left")}
                  disabled={i === 0}
                  className="p-1.5 bg-white/90 rounded-full text-slate-700 hover:bg-white disabled:opacity-30"
                  title="Move left"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button 
                  onClick={() => setFullscreenMedia({ url: media.getUrl(asset.id), type: asset.type })} 
                  className="p-1.5 bg-white/90 rounded-full text-slate-700 hover:bg-white"
                  title="View fullscreen"
                >
                  <Maximize2 className="w-3 h-3" />
                </button>
                {asset.source === "ai_generated" && asset.prompt && (
                  <>
                    <button 
                      onClick={() => handleRegenerateImage(asset)}
                      disabled={regeneratingId === asset.id}
                      className="p-1.5 bg-purple-500 rounded-full text-white hover:bg-purple-600"
                      title="Regenerate"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => { setEditingPromptId(asset.id); setEditPromptText(asset.prompt || ""); }}
                      className="p-1.5 bg-blue-500 rounded-full text-white hover:bg-blue-600"
                      title="Edit prompt"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </>
                )}
                <button onClick={() => handleDelete(asset.id)} className="p-1.5 bg-red-500 rounded-full text-white hover:bg-red-600">
                  <Trash2 className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => moveMedia(i, "right")}
                  disabled={i === mediaAssets.length - 1}
                  className="p-1.5 bg-white/90 rounded-full text-slate-700 hover:bg-white disabled:opacity-30"
                  title="Move right"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-[10px] bg-black/60 text-white px-1 rounded">#{i+1}</span>
                {asset.type === "video" && (
                  <span className="text-[10px] bg-blue-500 text-white px-1 rounded flex items-center gap-0.5">
                    <Film className="w-2.5 h-2.5" />
                  </span>
                )}
                {asset.source === "ai_generated" && (
                  <span className="text-[10px] bg-yellow-500 text-white px-1 rounded">AI</span>
                )}
                {asset.source?.startsWith("stock_") && (
                  <span className="text-[10px] bg-teal-500 text-white px-1 rounded">Stock</span>
                )}
              </div>
              <span className="text-[10px] bg-black/60 text-white px-1 rounded">
                {asset.duration || 5}s
              </span>
            </div>
          </div>
        ))}

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="aspect-video border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 transition-all"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
          ) : (
            <>
              <Upload className="w-5 h-5 text-slate-400" />
              <span className="text-[10px] text-slate-500">Upload</span>
            </>
          )}
        </button>

        <button
          onClick={() => setShowGenerator(true)}
          className="aspect-video border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-purple-400 hover:bg-purple-50 transition-all"
        >
          <Sparkles className="w-5 h-5 text-slate-400" />
          <span className="text-[10px] text-slate-500">AI Generate</span>
        </button>

        <button
          onClick={() => setShowStockSearch(true)}
          className="aspect-video border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-teal-400 hover:bg-teal-50 transition-all"
        >
          <Globe className="w-5 h-5 text-slate-400" />
          <span className="text-[10px] text-slate-500">Free Stock</span>
        </button>
      </div>


      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleUpload}
        className="hidden"
      />

      {showGenerator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGenerator(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <button onClick={() => setShowGenerator(false)} className="absolute top-3 right-3 p-1 hover:bg-slate-100 rounded">
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" /> Generate AI Image
            </h3>
            
            {/* Model Selection */}
            <div className="flex gap-1.5 mb-3">
              {IMAGE_MODELS.map(m => (
                <button key={m.id} onClick={() => setSelectedModel(m.id)}
                  className={`flex-1 py-1.5 px-2 text-xs rounded-lg font-medium transition-all ${
                    selectedModel === m.id ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`} title={m.desc}>{m.name}</button>
              ))}
            </div>

            {/* Style & Ratio Row */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Image Style</label>
                <select 
                  value={imageStyle} 
                  onChange={(e) => setImageStyle(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-purple-400 focus:outline-none"
                >
                  {IMAGE_STYLES.map(s => (
                    <option key={s.id} value={s.id}>{s.icon} {s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 mb-1 block">Aspect Ratio</label>
                <select 
                  value={aspectRatio} 
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-purple-400 focus:outline-none"
                >
                  {ASPECT_RATIOS.map(r => (
                    <option key={r.id} value={r.id}>{r.name} ({r.desc})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Prompt Language */}
            <div className="mb-3">
              <label className="text-[10px] text-slate-500 mb-1 block">Prompt Language</label>
              <div className="flex flex-wrap gap-1">
                {PROMPT_LANGUAGES.map(l => (
                  <button 
                    key={l.id} 
                    onClick={() => setPromptLanguage(l.id)}
                    className={`px-2 py-1 text-[10px] rounded font-medium transition-all ${
                      promptLanguage === l.id ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
            
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none focus:border-purple-400 focus:outline-none"
              rows={3}
            />
            
            {(script || (segments && segments.length > 0)) && (
              <button 
                onClick={suggestPrompt} 
                disabled={suggesting}
                className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 mt-2 disabled:opacity-50"
              >
                {suggesting ? (
                  <><Loader2 className="w-3 h-3 animate-spin" /> Generating prompt...</>
                ) : (
                  <><Wand2 className="w-3 h-3" /> AI Suggest from script</>
                )}
              </button>
            )}
            
            <button
              onClick={handleGenerateImage}
              disabled={!prompt.trim() || generating}
              className="w-full mt-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate Image</>
              )}
            </button>

            {segments && segments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-500">Generate images from script:</p>
                  {mediaAssets.length > 0 && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
                      {mediaAssets.length} images ({existingPrompts.length} with prompts)
                    </span>
                  )}
                </div>
                
                {/* Step 1: Generate Prompts */}
                {generatedPrompts.length === 0 && (
                  <>
                    {/* Segment Selection Toggle */}
                    <button
                      onClick={() => { setShowSegmentSelector(!showSegmentSelector); if (!showSegmentSelector) selectUnassignedSegments(); }}
                      className="w-full mb-3 py-2 text-xs border border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center gap-2"
                    >
                      {showSegmentSelector ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      {showSegmentSelector ? `${selectedSegments.size}/${segments.length} segments selected` : "Select segments for new images"}
                    </button>

                    {/* Segment Selector Grid */}
                    {showSegmentSelector && (
                      <div className="mb-3 p-2 bg-slate-50 rounded-lg max-h-40 overflow-y-auto">
                        <div className="flex justify-between mb-2">
                          <button onClick={selectAllSegments} className="text-[10px] text-blue-600 hover:underline">Select All</button>
                          <button onClick={selectUnassignedSegments} className="text-[10px] text-emerald-600 hover:underline">Select Unassigned</button>
                          <button onClick={() => setSelectedSegments(new Set())} className="text-[10px] text-slate-500 hover:underline">Clear</button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {segments.map((seg, i) => {
                            const hasImage = mediaAssets.some(m => m.assignedSegments?.includes(i));
                            return (
                              <button
                                key={i}
                                onClick={() => toggleSegmentSelection(i)}
                                className={`px-2 py-1 text-[10px] rounded font-medium transition-all ${
                                  selectedSegments.has(i) 
                                    ? "bg-blue-600 text-white" 
                                    : hasImage 
                                      ? "bg-green-100 text-green-700" 
                                      : "bg-white text-slate-600 border"
                                }`}
                                title={`Seg ${i+1}: ${(seg.text || "").slice(0, 40)}...`}
                              >
                                {i + 1}{hasImage && "✓"}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5">
                          Green✓ = segment has image assigned | Blue = selected for new images
                        </p>
                        <p className="text-[10px] text-blue-500 mt-1">
                          ✨ {existingPrompts.length > 0 ? `${existingPrompts.length} AI image prompts as style reference` : "No style reference (first batch)"}
                        </p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {[1, 2, 3, 4, 5, 6, 8, 10].filter(n => n <= Math.max(segments.length, 3)).map(n => (
                        <button
                          key={n}
                          onClick={() => setImageCount(n)}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                            imageCount === n ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      <input
                        type="number"
                        min="1"
                        max={Math.min(segments.length, 20)}
                        value={imageCount || ""}
                        onChange={(e) => setImageCount(Math.min(parseInt(e.target.value) || 0, 20))}
                        placeholder="Custom"
                        className={`w-16 px-2 py-1 text-xs rounded-lg border text-center ${
                          imageCount > 10 ? "border-emerald-500 bg-emerald-50" : "border-slate-200"
                        }`}
                      />
                    </div>
                    <button
                      onClick={handleGeneratePrompts}
                      disabled={generatingPrompts || (imageCount === 0 && selectedSegments.size === 0)}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {generatingPrompts ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Generating prompts...</>
                      ) : (
                        <><Wand2 className="w-4 h-4" /> Generate {imageCount || selectedSegments.size || "?"} Prompts {existingPrompts.length > 0 && `(${existingPrompts.length} ref)`}</>
                      )}
                    </button>
                  </>
                )}
                
                {/* Step 2: Show prompts and generate each image */}
                {generatedPrompts.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700">
                        {generatedPrompts.filter(p => p.generated).length}/{generatedPrompts.length} Generated
                      </span>
                      <div className="flex gap-2">
                        {generatedPrompts.some(p => !p.generated && !p.generating) && (
                          <button 
                            onClick={async () => {
                              for (let i = 0; i < generatedPrompts.length; i++) {
                                if (!generatedPrompts[i].generated && !generatedPrompts[i].generating) {
                                  await handleGenerateSingleImage(i);
                                }
                              }
                            }}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium"
                          >
                            Generate All
                          </button>
                        )}
                        <button 
                          onClick={() => setGeneratedPrompts([])}
                          className="text-[10px] text-slate-500 hover:text-red-500"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                    
                    <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
                      {generatedPrompts.map((p, i) => (
                        <PromptCard 
                          key={i} 
                          index={i} 
                          prompt={p} 
                          onUpdate={(text) => handleUpdatePrompt(i, text)}
                          onGenerate={() => handleGenerateSingleImage(i)}
                          onRegenerate={() => handleRegenerateSingleImage(i)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Media Modal */}
      {fullscreenMedia && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreenMedia(null)}
        >
          <button 
            onClick={() => setFullscreenMedia(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          {fullscreenMedia.type === "video" ? (
            <video 
              src={fullscreenMedia.url} 
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
              controls
              autoPlay
            />
          ) : (
            <img 
              src={fullscreenMedia.url} 
              alt="Fullscreen preview" 
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}

      {/* Edit Prompt Modal */}
      {editingPromptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingPromptId(null)} />
          <div className="relative bg-white rounded-xl w-full max-w-md p-5 shadow-2xl">
            <button onClick={() => setEditingPromptId(null)} className="absolute top-3 right-3 p-1 hover:bg-slate-100 rounded">
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-500" /> Edit Image Prompt
            </h3>
            
            <textarea
              value={editPromptText}
              onChange={(e) => setEditPromptText(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none focus:border-blue-400 focus:outline-none"
              rows={4}
            />
            
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => handleUpdateImagePrompt(editingPromptId, editPromptText)}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
              >
                Save Prompt
              </button>
              <button
                onClick={async () => {
                  await handleUpdateImagePrompt(editingPromptId, editPromptText);
                  const asset = mediaAssets.find(m => m.id === editingPromptId);
                  if (asset) {
                    setEditingPromptId(null);
                    handleRegenerateImage({ ...asset, prompt: editPromptText });
                  }
                }}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Save & Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Media Search Modal */}
      {showStockSearch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowStockSearch(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-2xl p-5 shadow-2xl max-h-[85vh] flex flex-col">
            <button onClick={() => setShowStockSearch(false)} className="absolute top-3 right-3 p-1 hover:bg-slate-100 rounded">
              <X className="w-5 h-5" />
            </button>
            
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-teal-500" /> Free Stock Media
              <span className="text-xs font-normal text-slate-400 ml-auto">Powered by Pexels</span>
            </h3>
            
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setStockMediaType("photos")}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium flex items-center gap-1.5 ${
                  stockMediaType === "photos" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                <Image className="w-3.5 h-3.5" /> Photos
              </button>
              <button
                onClick={() => setStockMediaType("videos")}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium flex items-center gap-1.5 ${
                  stockMediaType === "videos" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                <Film className="w-3.5 h-3.5" /> Videos
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={stockQuery}
                onChange={(e) => setStockQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStockSearch(false)}
                placeholder="Search free images & videos..."
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-400 focus:outline-none"
              />
              <button
                onClick={() => handleStockSearch(false)}
                disabled={stockSearching || !stockQuery.trim()}
                className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2"
              >
                {stockSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {stockResults.length > 0 ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {stockResults.map((item) => (
                      <div key={item.id} className="relative group aspect-video bg-slate-100 rounded-lg overflow-hidden">
                        <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                        {item.type === "video" && (
                          <span className="absolute top-1 left-1 text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Film className="w-2.5 h-2.5" /> {item.duration}s
                          </span>
                        )}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            onClick={() => handleStockDownload(item)}
                            disabled={downloadingStock === item.id}
                            className="px-3 py-1.5 bg-teal-500 text-white text-xs rounded-lg font-medium hover:bg-teal-600 disabled:opacity-50"
                          >
                            {downloadingStock === item.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Add"
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {stockHasMore && (
                    <button
                      onClick={() => handleStockSearch(true)}
                      disabled={loadingMore}
                      className="w-full py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                      {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {loadingMore ? "Loading..." : "Load More"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <Globe className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Search for free stock {stockMediaType}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

