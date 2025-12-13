"use client";

import React, { useState } from "react";
import { Loader2, Sparkles, RefreshCw } from "lucide-react";

interface PromptCardProps {
  index: number;
  prompt: { text: string; generating: boolean; generated: boolean; queued?: boolean };
  onUpdate: (text: string) => void;
  onGenerate: () => void;
  onRegenerate?: () => void;
}

export default function PromptCard({ index, prompt, onUpdate, onGenerate, onRegenerate }: PromptCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`rounded-lg border ${prompt.generated ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full p-2 flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${prompt.generated ? "bg-green-500 text-white" : prompt.generating ? "bg-purple-500 text-white" : prompt.queued ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-600"}`}>
            #{index + 1}
          </span>
          {prompt.generated && <span className="text-[10px] text-green-600">✓ Generated</span>}
          {prompt.generating && <><Loader2 className="w-3 h-3 animate-spin text-purple-500" /><span className="text-[10px] text-purple-600">Generating...</span></>}
          {prompt.queued && !prompt.generating && <span className="text-[10px] text-amber-600">⏳ Queued</span>}
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
              {prompt.generating ? <><Loader2 className="w-3 h-3 animate-spin" /> Regenerating...</> : <><RefreshCw className="w-3 h-3" /> Regenerate Image</>}
            </button>
          ) : (
            <button
              onClick={onGenerate}
              disabled={prompt.generating}
              className="w-full mt-2 py-1.5 text-xs bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {prompt.generating ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating...</> : <><Sparkles className="w-3 h-3" /> Generate Image</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

