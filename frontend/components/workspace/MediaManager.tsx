"use client";

import React, { useState, useRef } from "react";
import { Upload, Sparkles, Trash2, Image, Loader2, X, Wand2, Maximize2 } from "lucide-react";
import { media } from "@/lib/api";

const IMAGE_MODELS = [
  { id: "gemini-2.5-flash", name: "Gemini 2.5", desc: "Fast" },
  { id: "gemini-3-pro", name: "Gemini 3", desc: "High quality" },
  { id: "dall-e-3", name: "DALL-E 3", desc: "OpenAI" },
];

interface MediaAsset {
  id: string;
  type: "image" | "video";
  source: "upload" | "ai_generated";
  path: string;
  duration?: number;
  width?: number;
  height?: number;
  prompt?: string;
  order: number;
  // Timeline assignment
  startTime: number;  // when this media starts in final video
  endTime: number;    // when this media ends
  assignedSegments: number[];  // which segment indices this covers
}

interface Segment {
  text: string;
  speaker?: string;
  start: number;
  end: number;
  duration?: number;
}

interface MediaManagerProps {
  projectId: string;
  mediaAssets: MediaAsset[];
  onMediaChange: (assets: MediaAsset[]) => void;
  script?: string;
  segments?: Segment[];
  totalDuration: number;  // total video length from script
}

export default function MediaManager({ projectId, mediaAssets, onMediaChange, script, segments, totalDuration }: MediaManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash");
  const [showGenerator, setShowGenerator] = useState(false);
  const [imageCount, setImageCount] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [generatedPrompts, setGeneratedPrompts] = useState<{text: string; generating: boolean; generated: boolean}[]>([]);
  const [generatingPrompts, setGeneratingPrompts] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
      const { data } = await media.generateImage(projectId, prompt, mediaAssets.length, selectedModel);
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
      const { data } = await media.suggestPrompt(projectId, segments || [], script || "");
      setPrompt(data.prompt || "");
    } catch (err) {
      console.error("Suggest failed:", err);
    }
    setSuggesting(false);
  };

  // Generate prompts from segments (first step)
  const handleGeneratePrompts = async () => {
    if (!segments || segments.length === 0) return;
    setGeneratingPrompts(true);
    try {
      const count = imageCount > 0 ? imageCount : Math.min(segments.length, 5);
      const { data } = await media.generatePrompts(projectId, segments, count);
      // Handle both string and object formats
      setGeneratedPrompts(data.prompts.map((p: any) => ({ 
        text: typeof p === 'string' ? p : (p.prompt || JSON.stringify(p)), 
        generating: false, 
        generated: false 
      })));
    } catch (err) {
      console.error("Prompt generation failed:", err);
    }
    setGeneratingPrompts(false);
  };

  // Generate single image from prompt with context from previous images
  const handleGenerateSingleImage = async (index: number) => {
    const promptData = generatedPrompts[index];
    if (!promptData || promptData.generating) return;
    
    setGeneratedPrompts(prev => prev.map((p, i) => i === index ? { ...p, generating: true } : p));
    
    try {
      // Get previous prompts for consistency context
      const previousPrompts = generatedPrompts
        .slice(0, index)
        .filter(p => p.generated)
        .map(p => p.text);
      
      // Add context to prompt for consistency
      let enhancedPrompt = promptData.text;
      if (previousPrompts.length > 0) {
        enhancedPrompt = `[STYLE CONTEXT - maintain consistency with previous images: ${previousPrompts.slice(-2).join(' | ')}]\n\n${promptData.text}`;
      }
      
      const { data } = await media.generateImage(projectId, enhancedPrompt, undefined, selectedModel);
      
      // Assign to corresponding segment
      const segIdx = index % (segments?.length || 1);
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
            {asset.type === "image" ? (
              <img src={media.getUrl(asset.id)} alt="" className="w-full h-full object-cover" />
            ) : (
              <video src={media.getUrl(asset.id)} className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button 
                onClick={() => setFullscreenImage(media.getUrl(asset.id))} 
                className="p-2 bg-white/90 rounded-full text-slate-700 hover:bg-white"
                title="View fullscreen"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button onClick={() => handleDelete(asset.id)} className="p-2 bg-red-500 rounded-full text-white hover:bg-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-[10px] bg-black/60 text-white px-1 rounded">#{i+1}</span>
                {asset.source === "ai_generated" && (
                  <span className="text-[10px] bg-yellow-500 text-white px-1 rounded">AI</span>
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
            
            <div className="flex gap-1.5 mb-3">
              {IMAGE_MODELS.map(m => (
                <button key={m.id} onClick={() => setSelectedModel(m.id)}
                  className={`flex-1 py-1.5 px-2 text-xs rounded-lg font-medium transition-all ${
                    selectedModel === m.id ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`} title={m.desc}>{m.name}</button>
              ))}
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
                <p className="text-xs text-slate-500 mb-2">Or generate multiple images from script:</p>
                
                {/* Step 1: Generate Prompts */}
                {generatedPrompts.length === 0 && (
                  <>
                    <div className="flex gap-2 mb-3">
                      {[1, 2].map(n => (
                        <button
                          key={n}
                          onClick={() => setImageCount(n)}
                          className={`flex-1 py-1.5 text-xs rounded-lg font-medium transition-all ${
                            imageCount === n ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {n} {n === 1 ? "Image" : "Images"}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={handleGeneratePrompts}
                      disabled={generatingPrompts || imageCount === 0}
                      className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {generatingPrompts ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Generating {imageCount} prompts...</>
                      ) : (
                        <><Wand2 className="w-4 h-4" /> Generate {imageCount || "Select"} Prompts</>
                      )}
                    </button>
                  </>
                )}
                
                {/* Step 2: Show prompts and generate each image */}
                {generatedPrompts.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700">{generatedPrompts.length} Prompts Ready</span>
                      <button 
                        onClick={() => setGeneratedPrompts([])}
                        className="text-[10px] text-slate-500 hover:text-red-500"
                      >
                        Clear All
                      </button>
                    </div>
                    
                    {generatedPrompts.map((p, i) => (
                      <div key={i} className={`p-2 rounded-lg border ${p.generated ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-medium text-slate-500">#{i + 1}</span>
                          {p.generated && <span className="text-[10px] text-green-600">✓ Generated</span>}
                        </div>
                        <textarea
                          value={p.text}
                          onChange={(e) => handleUpdatePrompt(i, e.target.value)}
                          disabled={p.generating || p.generated}
                          className="w-full text-xs p-2 border border-slate-200 rounded resize-none focus:border-purple-400 focus:outline-none disabled:bg-slate-50"
                          rows={2}
                        />
                        {!p.generated && (
                          <button
                            onClick={() => handleGenerateSingleImage(i)}
                            disabled={p.generating}
                            className="w-full mt-2 py-1.5 text-xs bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1"
                          >
                            {p.generating ? (
                              <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</>
                            ) : (
                              <><Sparkles className="w-3 h-3" /> Generate Image</>
                            )}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Image Modal */}
      {fullscreenImage && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFullscreenImage(null)}
        >
          <button 
            onClick={() => setFullscreenImage(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={fullscreenImage} 
            alt="Fullscreen preview" 
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

