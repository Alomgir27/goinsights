"use client";

import React, { useState, useRef } from "react";
import { Upload, Sparkles, Loader2, X, Image, Globe, Edit2, RefreshCw } from "lucide-react";
import { media } from "@/lib/api";
import type { MediaAsset, Segment } from "@/lib/types";
import MediaGrid from "./MediaGrid";
import AIGeneratorModal from "./AIGeneratorModal";
import StockMediaModal from "./StockMediaModal";

interface MediaManagerProps {
  projectId: string;
  mediaAssets: MediaAsset[];
  onMediaChange: (assets: MediaAsset[]) => void;
  script?: string;
  segments?: Segment[];
  totalDuration: number;
  language?: string;
}

interface GeneratedPrompt {
  text: string;
  generating: boolean;
  generated: boolean;
  queued?: boolean;
  targetSegments?: number[];
}

export default function MediaManager({ projectId, mediaAssets, onMediaChange, script, segments, language = "English" }: MediaManagerProps) {
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
  const [generatedPrompts, setGeneratedPrompts] = useState<GeneratedPrompt[]>([]);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const [selectedSegments, setSelectedSegments] = useState<Set<number>>(new Set());
  const [showSegmentSelector, setShowSegmentSelector] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const mediaAssetsRef = useRef<MediaAsset[]>(mediaAssets);
  mediaAssetsRef.current = mediaAssets;
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
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [selectedQuality, setSelectedQuality] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingPrompts = mediaAssets.filter(m => m.source === "ai_generated" && m.prompt).map(m => m.prompt as string);

  const getNextTimePosition = (): { startTime: number; endTime: number; assignedSegments: number[] } => {
    if (!segments || segments.length === 0) {
      const lastEnd = mediaAssets.length > 0 ? Math.max(...mediaAssets.map(a => a.endTime || 0)) : 0;
      return { startTime: lastEnd, endTime: lastEnd + 5, assignedSegments: [] };
    }
    const assignedSegments = new Set(mediaAssets.flatMap(a => a.assignedSegments || []));
    for (let i = 0; i < segments.length; i++) {
      if (!assignedSegments.has(i)) {
        const seg = segments[i];
        return { startTime: seg.start, endTime: seg.end, assignedSegments: [i] };
      }
    }
    const lastEnd = mediaAssets.length > 0 ? Math.max(...mediaAssets.map(a => a.endTime || 0)) : 0;
    return { startTime: lastEnd, endTime: lastEnd + 5, assignedSegments: [] };
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const { data } = await media.upload(projectId, file);
        const pos = getNextTimePosition();
        onMediaChange([...mediaAssets, { ...data, order: mediaAssets.length, startTime: pos.startTime, endTime: pos.endTime, duration: pos.endTime - pos.startTime, assignedSegments: pos.assignedSegments }]);
      }
    } catch {}
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerateImage = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const { data } = await media.generateImage(projectId, prompt, { model: selectedModel, imageStyle, aspectRatio });
      const pos = getNextTimePosition();
      onMediaChange([...mediaAssets, { ...data, order: mediaAssets.length, startTime: pos.startTime, endTime: pos.endTime, duration: pos.endTime - pos.startTime, assignedSegments: pos.assignedSegments }]);
      setPrompt("");
      setShowGenerator(false);
    } catch {}
    setGenerating(false);
  };

  const handleRegenerateImage = async (asset: MediaAsset) => {
    if (!asset.prompt) return;
    setRegeneratingId(asset.id);
    try {
      const { data } = await media.regenerateImage(asset.id, { model: selectedModel, imageStyle, aspectRatio });
      onMediaChange(mediaAssets.map(m => m.id === asset.id ? { ...m, ...data } : m));
    } catch {}
    setRegeneratingId(null);
  };

  const handleUpdateImagePrompt = async (mediaId: string, newPrompt: string) => {
    try {
      await media.updatePrompt(mediaId, newPrompt);
      onMediaChange(mediaAssets.map(m => m.id === mediaId ? { ...m, prompt: newPrompt } : m));
      setEditingPromptId(null);
    } catch {}
  };

  const handleDelete = async (mediaId: string) => {
    try {
      await media.delete(mediaId);
      onMediaChange(mediaAssets.filter(m => m.id !== mediaId));
    } catch {}
  };

  const suggestPrompt = async () => {
    if (!script && (!segments || segments.length === 0)) return;
    setSuggesting(true);
    try {
      const { data } = await media.suggestPrompt(projectId, segments || [], script || "", { imageStyle, aspectRatio, promptLanguage });
      setPrompt(data.prompt || "");
    } catch {}
    setSuggesting(false);
  };

  const handleGeneratePrompts = async () => {
    if (!segments || segments.length === 0) return;
    if (selectedSegments.size === 0 && imageCount === 0) return;
    setGeneratingPrompts(true);
    try {
      const selectedIndices = Array.from(selectedSegments).sort((a, b) => a - b);
      const segmentsToUse = selectedIndices.length > 0 ? selectedIndices.map(i => ({ ...segments[i], segmentIndex: i })) : segments.map((s, i) => ({ ...s, segmentIndex: i }));
      const count = imageCount > 0 ? imageCount : selectedIndices.length || 3;
      const { data } = await media.generatePrompts(projectId, segmentsToUse, count, { language, existingPrompts, imageStyle, aspectRatio, promptLanguage });
      setGeneratedPrompts(data.prompts.map((p: any) => ({ text: typeof p === 'string' ? p : (p.prompt || JSON.stringify(p)), generating: false, generated: false, targetSegments: selectedIndices.length > 0 ? selectedIndices : [] })));
      setShowSegmentSelector(false);
    } catch {}
    setGeneratingPrompts(false);
  };

  const handleGenerateSingleImage = async (index: number) => {
    const promptData = generatedPrompts[index];
    if (!promptData || promptData.generating) return;
    setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, generating: true, queued: false } : p));
    try {
      const batchPrompts = generatedPrompts.slice(0, index).filter(p => p.generated).map(p => p.text);
      const allPreviousPrompts = [...existingPrompts, ...batchPrompts];
      let enhancedPrompt = promptData.text;
      if (allPreviousPrompts.length > 0) {
        const contextSamples = allPreviousPrompts.slice(-3).map(p => p.slice(0, 150)).join(' | ');
        enhancedPrompt = `[STYLE MATCH REQUIRED - use exact same visual style, characters, colors as: ${contextSamples}]\n\n${promptData.text}`;
      }
      const { data } = await media.generateImage(projectId, enhancedPrompt, { model: selectedModel, imageStyle, aspectRatio });
      const currentAssets = mediaAssetsRef.current;
      const assignedSet = new Set(currentAssets.flatMap(m => m.assignedSegments || []));
      let segIdx = 0;
      for (let i = 0; i < (segments?.length || 0); i++) { if (!assignedSet.has(i)) { segIdx = i; break; } }
      const seg = segments?.[segIdx];
      const startTime = seg?.start || 0, endTime = seg?.end || startTime + 5;
      const newAsset = { ...data, type: "image", source: "ai_generated", order: currentAssets.length, startTime, endTime, duration: endTime - startTime, assignedSegments: [segIdx], prompt: promptData.text };
      onMediaChange([...currentAssets, newAsset]);
      setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, generating: false, generated: true, queued: false } : p));
    } catch {
      setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, generating: false, queued: false } : p));
    }
  };

  const handleRegenerateSingleImage = async (index: number) => {
    const promptData = generatedPrompts[index];
    if (!promptData || promptData.generating) return;
    const aiAssets = mediaAssets.filter(m => m.source === "ai_generated");
    const assetIndex = aiAssets.length - generatedPrompts.length + index;
    const asset = aiAssets[assetIndex];
    if (!asset) return;
    setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, generating: true } : p));
    try {
      const { data } = await media.regenerateImage(asset.id, { prompt: promptData.text, model: selectedModel, imageStyle, aspectRatio });
      onMediaChange(mediaAssets.map(m => m.id === asset.id ? { ...m, ...data } : m));
      setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, generating: false } : p));
    } catch {
      setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, generating: false } : p));
    }
  };

  const moveMedia = async (index: number, direction: "left" | "right") => {
    const newIndex = direction === "left" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= mediaAssets.length) return;
    const updated = [...mediaAssets];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    const reordered = updated.map((m, i) => ({ ...m, order: i }));
    onMediaChange(reordered);
    try { await media.updateOrder(projectId, reordered.map(m => m.id)); } catch {}
  };

  const handleStockSearch = async (loadMore = false) => {
    if (!stockQuery.trim()) return;
    const page = loadMore ? stockPage + 1 : 1;
    loadMore ? setLoadingMore(true) : setStockSearching(true);
    try {
      const orientation = aspectRatio === "9:16" ? "portrait" : aspectRatio === "1:1" ? "square" : "landscape";
      const { data } = await media.searchStock(stockQuery, stockMediaType, orientation, page);
      setStockResults(loadMore ? [...stockResults, ...(data.results || [])] : data.results || []);
      setStockPage(page);
      setStockHasMore((data.results || []).length >= 15);
    } catch {}
    setStockSearching(false);
    setLoadingMore(false);
  };

  const handleStockDownload = async (item: any, qualityUrl?: string) => {
    setDownloadingStock(item.id);
    try {
      const { data } = await media.downloadStock(projectId, qualityUrl || item.url, "pexels", item.type);
      const pos = getNextTimePosition();
      onMediaChange([...mediaAssets, { ...data, order: mediaAssets.length, startTime: pos.startTime, endTime: pos.endTime, duration: data.duration || (pos.endTime - pos.startTime), assignedSegments: pos.assignedSegments }]);
      setStockResults(stockResults.filter(r => r.id !== item.id));
      setPreviewItem(null);
    } catch {}
    setDownloadingStock(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-2"><Image className="w-4 h-4" /> Media Assets</h4>
        <span className="text-xs text-slate-500">{mediaAssets.length} items</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <MediaGrid
          mediaAssets={mediaAssets}
          regeneratingId={regeneratingId}
          onMove={moveMedia}
          onFullscreen={(url, type) => setFullscreenMedia({ url, type })}
          onRegenerate={handleRegenerateImage}
          onEditPrompt={(asset) => { setEditingPromptId(asset.id); setEditPromptText(asset.prompt || ""); }}
          onDelete={handleDelete}
        />

        <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="aspect-video border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 transition-all">
          {uploading ? <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> : <><Upload className="w-5 h-5 text-slate-400" /><span className="text-[10px] text-slate-500">Upload</span></>}
        </button>

        <button onClick={() => setShowGenerator(true)} className="aspect-video border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-purple-400 hover:bg-purple-50 transition-all">
          <Sparkles className="w-5 h-5 text-slate-400" /><span className="text-[10px] text-slate-500">AI Generate</span>
        </button>

        <button onClick={() => setShowStockSearch(true)} className="aspect-video border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-teal-400 hover:bg-teal-50 transition-all">
          <Globe className="w-5 h-5 text-slate-400" /><span className="text-[10px] text-slate-500">Free Stock</span>
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleUpload} className="hidden" />

      {showGenerator && (
        <AIGeneratorModal
          onClose={() => setShowGenerator(false)}
          prompt={prompt} setPrompt={setPrompt}
          selectedModel={selectedModel} setSelectedModel={setSelectedModel}
          imageStyle={imageStyle} setImageStyle={setImageStyle}
          aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
          promptLanguage={promptLanguage} setPromptLanguage={setPromptLanguage}
          generating={generating} suggesting={suggesting}
          segments={segments} mediaAssetsCount={mediaAssets.length} existingPromptsCount={existingPrompts.length}
          generatedPrompts={generatedPrompts} generatingPrompts={generatingPrompts}
          imageCount={imageCount} setImageCount={setImageCount}
          selectedSegments={selectedSegments} showSegmentSelector={showSegmentSelector} setShowSegmentSelector={setShowSegmentSelector}
          onGenerateImage={handleGenerateImage} onSuggestPrompt={suggestPrompt} onGeneratePrompts={handleGeneratePrompts}
          onToggleSegmentSelection={(i) => { const next = new Set(selectedSegments); next.has(i) ? next.delete(i) : next.add(i); setSelectedSegments(next); }}
          onSelectAllSegments={() => segments && setSelectedSegments(new Set(segments.map((_, i) => i)))}
          onSelectUnassignedSegments={() => { if (!segments) return; const assigned = new Set(mediaAssets.flatMap(m => m.assignedSegments || [])); setSelectedSegments(new Set(segments.map((_, i) => i).filter(i => !assigned.has(i)))); }}
          onClearSegmentSelection={() => setSelectedSegments(new Set())}
          onGenerateSingleImage={handleGenerateSingleImage}
          onRegenerateSingleImage={handleRegenerateSingleImage}
          onUpdatePrompt={(i, text) => setGeneratedPrompts(prev => prev.map((p, idx) => idx === i ? { ...p, text } : p))}
          onClearPrompts={() => setGeneratedPrompts([])}
          onGenerateAllImages={async () => {
            const pending = generatedPrompts.map((p, i) => ({ ...p, queued: !p.generated && !p.generating }));
            setGeneratedPrompts(pending);
            for (let i = 0; i < pending.length; i++) {
              if (pending[i].queued) await handleGenerateSingleImage(i);
            }
          }}
          hasScript={!!(script || (segments && segments.length > 0))}
        />
      )}

      {fullscreenMedia && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setFullscreenMedia(null)}>
          <button onClick={() => setFullscreenMedia(null)} className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"><X className="w-6 h-6" /></button>
          {fullscreenMedia.type === "video" ? <video src={fullscreenMedia.url} className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} controls autoPlay /> : <img src={fullscreenMedia.url} alt="Fullscreen preview" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />}
        </div>
      )}

      {editingPromptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingPromptId(null)} />
          <div className="relative bg-white rounded-xl w-full max-w-md p-5 shadow-2xl">
            <button onClick={() => setEditingPromptId(null)} className="absolute top-3 right-3 p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Edit2 className="w-5 h-5 text-blue-500" /> Edit Image Prompt</h3>
            <textarea value={editPromptText} onChange={(e) => setEditPromptText(e.target.value)} className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none focus:border-blue-400 focus:outline-none" rows={4} />
            <div className="flex gap-2 mt-4">
              <button onClick={() => handleUpdateImagePrompt(editingPromptId, editPromptText)} className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2">Save Prompt</button>
              <button onClick={async () => { await handleUpdateImagePrompt(editingPromptId, editPromptText); const asset = mediaAssets.find(m => m.id === editingPromptId); if (asset) { setEditingPromptId(null); handleRegenerateImage({ ...asset, prompt: editPromptText }); } }}
                className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" /> Save & Regenerate</button>
            </div>
          </div>
        </div>
      )}

      {showStockSearch && (
        <StockMediaModal
          onClose={() => setShowStockSearch(false)}
          stockQuery={stockQuery} setStockQuery={setStockQuery}
          stockMediaType={stockMediaType} setStockMediaType={setStockMediaType}
          stockResults={stockResults} stockSearching={stockSearching} stockHasMore={stockHasMore} loadingMore={loadingMore} downloadingStock={downloadingStock}
          previewItem={previewItem} selectedQuality={selectedQuality} setSelectedQuality={setSelectedQuality}
          onSearch={handleStockSearch}
          onPreview={(item) => { setPreviewItem(item); setSelectedQuality(item.url); }}
          onClosePreview={() => setPreviewItem(null)}
          onDownload={handleStockDownload}
        />
      )}
    </div>
  );
}

