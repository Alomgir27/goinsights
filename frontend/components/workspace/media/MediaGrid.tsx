"use client";

import React from "react";
import { Trash2, Loader2, Maximize2, RefreshCw, Edit2, Film } from "lucide-react";
import { media } from "@/lib/api";
import type { MediaAsset } from "@/lib/types";

interface MediaGridProps {
  mediaAssets: MediaAsset[];
  regeneratingId: string | null;
  onMove: (index: number, direction: "left" | "right") => void;
  onFullscreen: (url: string, type: string) => void;
  onRegenerate: (asset: MediaAsset) => void;
  onEditPrompt: (asset: MediaAsset) => void;
  onDelete: (mediaId: string) => void;
}

export default function MediaGrid({ mediaAssets, regeneratingId, onMove, onFullscreen, onRegenerate, onEditPrompt, onDelete }: MediaGridProps) {
  return (
    <>
      {mediaAssets.map((asset, i) => (
        <div key={asset.id} className="relative group aspect-video bg-slate-100 rounded-lg overflow-hidden">
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
              <button onClick={() => onMove(i, "left")} disabled={i === 0} className="p-1.5 bg-white/90 rounded-full text-slate-700 hover:bg-white disabled:opacity-30" title="Move left">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button onClick={() => onFullscreen(media.getUrl(asset.id), asset.type)} className="p-1.5 bg-white/90 rounded-full text-slate-700 hover:bg-white" title="View fullscreen">
                <Maximize2 className="w-3 h-3" />
              </button>
              {asset.source === "ai_generated" && asset.prompt && (
                <>
                  <button onClick={() => onRegenerate(asset)} disabled={regeneratingId === asset.id} className="p-1.5 bg-purple-500 rounded-full text-white hover:bg-purple-600" title="Regenerate">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button onClick={() => onEditPrompt(asset)} className="p-1.5 bg-blue-500 rounded-full text-white hover:bg-blue-600" title="Edit prompt">
                    <Edit2 className="w-3 h-3" />
                  </button>
                </>
              )}
              <button onClick={() => onDelete(asset.id)} className="p-1.5 bg-red-500 rounded-full text-white hover:bg-red-600">
                <Trash2 className="w-3 h-3" />
              </button>
              <button onClick={() => onMove(i, "right")} disabled={i === mediaAssets.length - 1} className="p-1.5 bg-white/90 rounded-full text-slate-700 hover:bg-white disabled:opacity-30" title="Move right">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
          <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-[10px] bg-black/60 text-white px-1 rounded">#{i+1}</span>
              {asset.type === "video" && <span className="text-[10px] bg-blue-500 text-white px-1 rounded flex items-center gap-0.5"><Film className="w-2.5 h-2.5" /></span>}
              {asset.source === "ai_generated" && <span className="text-[10px] bg-yellow-500 text-white px-1 rounded">AI</span>}
              {asset.source?.startsWith("stock_") && <span className="text-[10px] bg-teal-500 text-white px-1 rounded">Stock</span>}
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={() => onMove(i, "left")} disabled={i === 0} className="p-0.5 bg-black/60 hover:bg-black/80 rounded text-white disabled:opacity-30" title="Move left">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <span className="text-[10px] bg-black/60 text-white px-1 rounded">{asset.duration || 5}s</span>
              <button onClick={() => onMove(i, "right")} disabled={i === mediaAssets.length - 1} className="p-0.5 bg-black/60 hover:bg-black/80 rounded text-white disabled:opacity-30" title="Move right">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

