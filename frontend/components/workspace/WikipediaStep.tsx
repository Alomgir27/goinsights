"use client";

import React, { useState } from "react";
import { Loader2, Sparkles, Globe, Image as ImageIcon, Clock, FileText, Download } from "lucide-react";
import { script, media, wikipedia } from "@/lib/api";
import type { MediaAsset, Segment } from "@/lib/types";

interface WikipediaStepProps {
  projectId: string;
  wikiData: { article_title?: string; extract?: string; sections?: any[] } | null;
  mediaAssets: MediaAsset[];
  language: string;
  projectDuration: number;
  onLanguageChange: (lang: string) => void;
  onScriptGenerated: (script: string, segments: Segment[]) => void;
  onMediaUpdated: () => void;
  processing: string;
  setProcessing: (msg: string) => void;
}

const LANGUAGES = ["English", "Spanish", "French", "German", "Bengali", "Hindi", "Chinese", "Japanese"];
const DURATIONS = [30, 60, 120, 180, 300];

export default function WikipediaStep({
  projectId, wikiData, mediaAssets, language, projectDuration, onLanguageChange, onScriptGenerated, onMediaUpdated, processing, setProcessing
}: WikipediaStepProps) {
  const [duration, setDuration] = useState(projectDuration || 60);
  const [customDuration, setCustomDuration] = useState("");

  const handleFetchMedia = async () => {
    if (!wikiData?.article_title) return;
    setProcessing("Fetching media from Wikipedia...");
    try {
      const { data: article } = await wikipedia.article(wikiData.article_title);
      const allMedia = article.media || [...(article.images || []), ...(article.videos || [])];
      if (allMedia.length > 0) {
        await wikipedia.collectMedia(projectId, allMedia);
        onMediaUpdated();
      }
    } catch { }
    setProcessing("");
  };

  const handleGenerateScript = async () => {
    setProcessing("Generating documentary script...");
    try {
      const { data } = await script.generateWiki(projectId, duration, language);
      const newSegments = (data.segments || []).map((s: any) => ({
        text: s.text,
        start: s.start || 0,
        end: s.end || 8,
        sourceStart: 0,
        sourceEnd: 0,
        audioGenerated: false,
        clipExtracted: true,
        timestamp: Date.now(),
        voiceId: s.voice_id || "aria",
        mediaIds: s.media_ids || (s.media_id ? [s.media_id] : []),
        duration: s.duration || 7,
        type: s.type || "content"
      }));
      onScriptGenerated(data.script || "", newSegments);
    } catch { }
    setProcessing("");
  };

  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">Generate Documentary Script</h3>
          <p className="text-xs text-slate-500">AI will create a narration from Wikipedia content</p>
        </div>
      </div>

      {wikiData?.extract && (
        <div className="bg-slate-50 rounded-lg p-3 mb-4 max-h-32 overflow-auto">
          <p className="text-xs text-slate-600">{wikiData.extract.slice(0, 500)}...</p>
        </div>
      )}

      {mediaAssets.length > 0 ? (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon className="w-4 h-4 text-slate-500" />
            <span className="text-xs text-slate-500">
              {mediaAssets.length} media collected
              {mediaAssets.filter(a => a.type === "video").length > 0 && (
                <span className="text-teal-600 ml-1">• {mediaAssets.filter(a => a.type === "video").length} videos</span>
              )}
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {mediaAssets.slice(0, 10).map((asset) => (
              asset.type === "video" ? (
                <div key={asset.id} className="w-14 h-14 rounded bg-slate-800 flex items-center justify-center shrink-0">
                  <span className="text-white text-[8px] font-medium">VIDEO</span>
                </div>
              ) : (
                <img key={asset.id} src={media.getUrl(asset.id)} alt=""
                  className="w-14 h-14 rounded object-cover shrink-0 border border-slate-200" />
              )
            ))}
            {mediaAssets.length > 10 && (
              <div className="w-14 h-14 rounded bg-slate-100 flex items-center justify-center shrink-0">
                <span className="text-xs text-slate-500">+{mediaAssets.length - 10}</span>
              </div>
            )}
          </div>
        </div>
      ) : wikiData?.article_title && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700 mb-2">No media collected yet for this topic.</p>
          <button onClick={handleFetchMedia} disabled={!!processing}
            className="px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded hover:bg-amber-700 flex items-center gap-1">
            <Download className="w-3 h-3" /> Fetch Media from Wikipedia
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs text-slate-500 block mb-2 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Duration
          </label>
          <div className="flex flex-wrap gap-1.5 items-center">
            {DURATIONS.map((d) => (
              <button key={d} onClick={() => { setDuration(d); setCustomDuration(""); }}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors ${
                  duration === d && !customDuration ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}>
                {d < 60 ? `${d}s` : `${d / 60}m`}
              </button>
            ))}
            <input type="number" placeholder="min" min="1" max="60"
              value={customDuration}
              onChange={(e) => { setCustomDuration(e.target.value); if (e.target.value) setDuration(parseInt(e.target.value) * 60); }}
              className={`w-14 px-1.5 py-1 rounded text-xs border ${customDuration ? "border-emerald-500 bg-emerald-50" : "border-slate-200"}`}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500 block mb-2 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5" /> Language
          </label>
          <select value={language} onChange={(e) => onLanguageChange(e.target.value)}
            className="w-full py-2 px-3 rounded-lg text-sm border border-slate-200 focus:border-emerald-400 focus:outline-none bg-white">
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <button onClick={handleGenerateScript} disabled={!!processing}
        className="w-full btn-primary bg-emerald-600 hover:bg-emerald-700">
        {processing ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
        ) : (
          <><Sparkles className="w-4 h-4" /> Generate Documentary Script</>
        )}
      </button>
    </div>
  );
}

