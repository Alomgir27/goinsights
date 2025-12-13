"use client";

import React from "react";
import { X, Loader2, Sparkles, Wand2, CheckSquare, Square } from "lucide-react";
import PromptCard from "./PromptCard";
import { IMAGE_MODELS, IMAGE_STYLES, ASPECT_RATIOS, PROMPT_LANGUAGES } from "@/lib/constants";
import type { Segment } from "@/lib/types";

interface GeneratedPrompt {
  text: string;
  generating: boolean;
  generated: boolean;
  queued?: boolean;
  targetSegments?: number[];
}

interface AIGeneratorModalProps {
  onClose: () => void;
  prompt: string;
  setPrompt: (val: string) => void;
  selectedModel: string;
  setSelectedModel: (val: string) => void;
  imageStyle: string;
  setImageStyle: (val: string) => void;
  aspectRatio: string;
  setAspectRatio: (val: string) => void;
  promptLanguage: string;
  setPromptLanguage: (val: string) => void;
  generating: boolean;
  suggesting: boolean;
  segments?: Segment[];
  mediaAssetsCount: number;
  existingPromptsCount: number;
  generatedPrompts: GeneratedPrompt[];
  generatingPrompts: boolean;
  imageCount: number;
  setImageCount: (val: number) => void;
  selectedSegments: Set<number>;
  showSegmentSelector: boolean;
  setShowSegmentSelector: (val: boolean) => void;
  onGenerateImage: () => void;
  onSuggestPrompt: () => void;
  onGeneratePrompts: () => void;
  onToggleSegmentSelection: (index: number) => void;
  onSelectAllSegments: () => void;
  onSelectUnassignedSegments: () => void;
  onClearSegmentSelection: () => void;
  onGenerateSingleImage: (index: number) => void;
  onRegenerateSingleImage: (index: number) => void;
  onUpdatePrompt: (index: number, text: string) => void;
  onClearPrompts: () => void;
  onGenerateAllImages: () => void;
  hasScript: boolean;
}

export default function AIGeneratorModal(props: AIGeneratorModalProps) {
  const {
    onClose, prompt, setPrompt, selectedModel, setSelectedModel, imageStyle, setImageStyle,
    aspectRatio, setAspectRatio, promptLanguage, setPromptLanguage, generating, suggesting,
    segments, mediaAssetsCount, existingPromptsCount, generatedPrompts, generatingPrompts,
    imageCount, setImageCount, selectedSegments, showSegmentSelector, setShowSegmentSelector,
    onGenerateImage, onSuggestPrompt, onGeneratePrompts, onToggleSegmentSelection,
    onSelectAllSegments, onSelectUnassignedSegments, onClearSegmentSelection,
    onGenerateSingleImage, onRegenerateSingleImage, onUpdatePrompt, onClearPrompts,
    onGenerateAllImages, hasScript
  } = props;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 right-3 p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
        
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" /> Generate AI Image
        </h3>
        
        <div className="flex gap-1.5 mb-3">
          {IMAGE_MODELS.map(m => (
            <button key={m.id} onClick={() => setSelectedModel(m.id)}
              className={`flex-1 py-1.5 px-2 text-xs rounded-lg font-medium transition-all ${selectedModel === m.id ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`} title={m.desc}>{m.name}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">Image Style</label>
            <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-purple-400 focus:outline-none">
              {IMAGE_STYLES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">Aspect Ratio</label>
            <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value)} className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:border-purple-400 focus:outline-none">
              {ASPECT_RATIOS.map(r => <option key={r.id} value={r.id}>{r.name} ({r.desc})</option>)}
            </select>
          </div>
        </div>

        <div className="mb-3">
          <label className="text-[10px] text-slate-500 mb-1 block">Prompt Language</label>
          <div className="flex flex-wrap gap-1">
            {PROMPT_LANGUAGES.map(l => (
              <button key={l.id} onClick={() => setPromptLanguage(l.id)}
                className={`px-2 py-1 text-[10px] rounded font-medium transition-all ${promptLanguage === l.id ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{l.name}</button>
            ))}
          </div>
        </div>
        
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the image you want to generate..." className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none focus:border-purple-400 focus:outline-none" rows={3} />
        
        {hasScript && (
          <button onClick={onSuggestPrompt} disabled={suggesting} className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 mt-2 disabled:opacity-50">
            {suggesting ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating prompt...</> : <><Wand2 className="w-3 h-3" /> AI Suggest from script</>}
          </button>
        )}
        
        <button onClick={onGenerateImage} disabled={!prompt.trim() || generating} className="w-full mt-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2">
          {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4" /> Generate Image</>}
        </button>

        {segments && segments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">Generate images from script:</p>
              {mediaAssetsCount > 0 && <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded">{mediaAssetsCount} images ({existingPromptsCount} with prompts)</span>}
            </div>
            
            {generatedPrompts.length === 0 && (
              <>
                <button onClick={() => { setShowSegmentSelector(!showSegmentSelector); if (!showSegmentSelector) onSelectUnassignedSegments(); }}
                  className="w-full mb-3 py-2 text-xs border border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center gap-2">
                  {showSegmentSelector ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  {showSegmentSelector ? `${selectedSegments.size}/${segments.length} segments selected` : "Select segments for new images"}
                </button>

                {showSegmentSelector && (
                  <div className="mb-3 p-2 bg-slate-50 rounded-lg max-h-40 overflow-y-auto">
                    <div className="flex justify-between mb-2">
                      <button onClick={onSelectAllSegments} className="text-[10px] text-blue-600 hover:underline">Select All</button>
                      <button onClick={onSelectUnassignedSegments} className="text-[10px] text-emerald-600 hover:underline">Select Unassigned</button>
                      <button onClick={onClearSegmentSelection} className="text-[10px] text-slate-500 hover:underline">Clear</button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {segments.map((seg, i) => (
                        <button key={i} onClick={() => onToggleSegmentSelection(i)}
                          className={`px-2 py-1 text-[10px] rounded font-medium transition-all ${selectedSegments.has(i) ? "bg-blue-600 text-white" : "bg-white text-slate-600 border"}`}
                          title={`Seg ${i+1}: ${(seg.text || "").slice(0, 40)}...`}>{i + 1}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {[1, 2, 3, 4, 5, 6, 8, 10].filter(n => n <= Math.max(segments.length, 3)).map(n => (
                    <button key={n} onClick={() => setImageCount(n)}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${imageCount === n ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{n}</button>
                  ))}
                  <input type="number" min="1" max={Math.min(segments.length, 20)} value={imageCount || ""} onChange={(e) => setImageCount(Math.min(parseInt(e.target.value) || 0, 20))} placeholder="Custom"
                    className={`w-16 px-2 py-1 text-xs rounded-lg border text-center ${imageCount > 10 ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`} />
                </div>
                <button onClick={onGeneratePrompts} disabled={generatingPrompts || (imageCount === 0 && selectedSegments.size === 0)}
                  className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {generatingPrompts ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating prompts...</> : <><Wand2 className="w-4 h-4" /> Generate {imageCount || selectedSegments.size || "?"} Prompts</>}
                </button>
              </>
            )}
            
            {generatedPrompts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-700">{generatedPrompts.filter(p => p.generated).length}/{generatedPrompts.length} Generated</span>
                  <div className="flex gap-2">
                    {generatedPrompts.some(p => !p.generated && !p.generating) && (
                      <button onClick={onGenerateAllImages} className="text-[10px] text-emerald-600 hover:text-emerald-700 font-medium">Generate All</button>
                    )}
                    <button onClick={onClearPrompts} className="text-[10px] text-slate-500 hover:text-red-500">Clear</button>
                  </div>
                </div>
                <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
                  {generatedPrompts.map((p, i) => (
                    <PromptCard key={i} index={i} prompt={p} onUpdate={(text) => onUpdatePrompt(i, text)} onGenerate={() => onGenerateSingleImage(i)} onRegenerate={() => onRegenerateSingleImage(i)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

