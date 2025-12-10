"use client";

import React from "react";
import { Loader2, Scissors, Play, RefreshCw, Video, Trash2, Plus, Image } from "lucide-react";
import VoiceSelector from "./VoiceSelector";

interface Segment {
  text: string;
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  audioGenerated: boolean;
  clipExtracted: boolean;
  timestamp: number;
  voiceId?: string;
  mediaId?: string;
  mediaType?: string;
  duration?: number;
  trimStart?: number;
  trimEnd?: number;
}

interface Voice {
  id: string;
  name: string;
  gender: string;
  style: string;
  accent: string;
  langs: string;
}

interface SegmentCardProps {
  segment: Segment;
  index: number;
  voices: Voice[];
  projectType: "youtube" | "custom";
  videoDownloaded: boolean;
  generatingIndex: number | null;
  extractingIndex: number | null;
  previewClip: number | null;
  projectId: string;
  onUpdate: (field: string, value: string | number) => void;
  onGenerateAudio: () => void;
  onExtractClip: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onPreviewToggle: () => void;
  onAddAfter: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
  previewClipUrl: string;
  previewAudioUrl: string;
  mediaAssets?: any[];
  onAssignMedia?: (mediaId: string | null) => void;
}

export default function SegmentCard({
  segment, index, voices, projectType, videoDownloaded, generatingIndex, extractingIndex,
  previewClip, projectId, onUpdate, onGenerateAudio, onExtractClip, onRemove,
  onMoveUp, onMoveDown, onPreviewToggle, onAddAfter, canMoveUp, canMoveDown, canRemove,
  previewClipUrl, previewAudioUrl, mediaAssets, onAssignMedia
}: SegmentCardProps) {
  const isGenerating = generatingIndex === index;
  const isExtracting = extractingIndex === index;
  const isPreviewing = previewClip === index;

  return (
    <div className={`p-3 border rounded-lg relative group ${
      segment.audioGenerated && (segment.clipExtracted || projectType === "custom")
        ? "border-green-200 bg-green-50/50"
        : segment.audioGenerated || segment.clipExtracted
        ? "border-blue-200 bg-blue-50/50"
        : "border-slate-200 bg-white"
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1">
          <span className="w-5 h-5 flex items-center justify-center bg-slate-900 text-white text-[10px] font-medium rounded">
            {index + 1}
          </span>
          <div className="flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onMoveUp} disabled={!canMoveUp} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
            <button onClick={onMoveDown} disabled={!canMoveDown} className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {projectType === "youtube" ? (
          <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1 bg-blue-50 px-2 py-1 rounded">
              <span className="text-blue-600 font-medium text-[10px]">Source:</span>
              <input type="number" value={segment.sourceStart} onChange={(e) => onUpdate("sourceStart", +e.target.value)}
                className="w-10 px-1 py-0.5 border border-slate-200 rounded text-center text-[10px]" />
              <span className="text-slate-400">-</span>
              <input type="number" value={segment.sourceEnd} onChange={(e) => onUpdate("sourceEnd", +e.target.value)}
                className="w-10 px-1 py-0.5 border border-slate-200 rounded text-center text-[10px]" />
              <span className="text-slate-400 text-[10px]">s</span>
            </div>
            <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded">
              <span className="text-green-600 font-medium text-[10px]">Out:</span>
              <span className="text-[10px]">{segment.start}s - {segment.end}s</span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <div className="flex items-center gap-1 bg-purple-50 px-2 py-1 rounded text-xs">
              <span className="text-purple-600 font-medium text-[10px]">Duration:</span>
              <input type="number" value={segment.duration || 8} onChange={(e) => onUpdate("duration", +e.target.value)}
                className="w-12 px-1 py-0.5 border border-slate-200 rounded text-center text-[10px]" min={3} max={60} />
              <span className="text-slate-400 text-[10px]">s</span>
            </div>
            {mediaAssets && mediaAssets.length > 0 && (
              <select
                value={segment.mediaId || ""}
                onChange={(e) => onAssignMedia?.(e.target.value || null)}
                className="text-[10px] px-2 py-1 border border-slate-200 rounded bg-white"
              >
                <option value="">No media</option>
                {mediaAssets.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.type === "image" ? "🖼️" : "🎬"} {m.prompt?.slice(0, 20) || `Media ${m.order + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <VoiceSelector
          voices={voices}
          selectedVoice={segment.voiceId || "aria"}
          onSelect={(voiceId) => onUpdate("voiceId", voiceId)}
          compact={true}
        />

        <button onClick={onRemove} disabled={!canRemove}
          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all disabled:opacity-30">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <textarea
        value={segment.text}
        onChange={(e) => onUpdate("text", e.target.value)}
        className="w-full text-xs p-2 border border-slate-200 rounded resize-none mb-2 focus:border-slate-400 focus:outline-none"
        rows={2}
        placeholder="Segment text..."
      />

      <div className="grid grid-cols-2 gap-2">
        {projectType === "youtube" && (
          <button onClick={onExtractClip} disabled={isExtracting || isGenerating || !videoDownloaded}
            className={`text-xs py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 font-medium transition-all ${
              isExtracting ? "bg-blue-600 text-white" :
              segment.clipExtracted ? "bg-emerald-500 text-white" :
              "bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40"
            }`}>
            {isExtracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Scissors className="w-3 h-3" />}
            {isExtracting ? "..." : segment.clipExtracted ? "✓" : "Clip"}
          </button>
        )}
        <button onClick={onGenerateAudio} disabled={isGenerating || isExtracting}
          className={`text-xs py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 font-medium transition-all ${
            projectType === "custom" ? "col-span-2" : ""
          } ${
            isGenerating ? "bg-blue-600 text-white" :
            segment.audioGenerated ? "bg-emerald-500 text-white" :
            "bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40"
          }`}>
          {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          {isGenerating ? "..." : segment.audioGenerated ? "✓ Audio" : "Audio"}
        </button>
      </div>

      {segment.clipExtracted && projectType === "youtube" && (
        <button onClick={onPreviewToggle}
          className={`w-full text-[10px] py-1 mt-2 rounded flex items-center justify-center gap-1 ${
            isPreviewing ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-100"
          }`}>
          <Video className="w-3 h-3" />{isPreviewing ? "Hide" : "Preview"}
        </button>
      )}

      {isPreviewing && segment.clipExtracted && (
        <div className="mt-2 bg-black rounded overflow-hidden">
          <video controls autoPlay className="w-full h-32" src={previewClipUrl} />
        </div>
      )}

      {segment.audioGenerated && (
        <div className="flex items-center gap-1 mt-2">
          <audio controls className="flex-1 h-7" key={segment.timestamp} src={previewAudioUrl} />
          <button onClick={onGenerateAudio} disabled={isGenerating}
            className="p-1 rounded hover:bg-slate-100 text-slate-500">
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      )}

      <button onClick={onAddAfter}
        className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100 shadow-sm z-10">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

