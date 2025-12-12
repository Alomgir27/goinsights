"use client";

import React from "react";
import { Plus, Clock, Loader2, Scissors, Play, FileText } from "lucide-react";
import SegmentCard from "./SegmentCard";
import MediaManager from "./MediaManager";
import type { Segment, Voice, MediaAsset } from "@/lib/types";
import { voice, video } from "@/lib/api";

interface SegmentListProps {
  projectId: string;
  projectType: "youtube" | "custom" | "ads" | "wikipedia";
  segments: Segment[];
  voices: Voice[];
  mediaAssets: MediaAsset[];
  selectedVoice: string;
  language: string;
  videoDownloaded: boolean;
  generatingIndex: number | null;
  extractingIndex: number | null;
  previewClip: number | null;
  script?: string;
  saving: boolean;
  lastSaved: Date | null;
  onSegmentUpdate: (index: number, field: string, value: string | number) => void;
  onBatchUpdateSegments: (updates: Array<{ index: number; field: string; value: string | number }>) => void;
  onAddSegment: (position: number) => void;
  onRemoveSegment: (index: number) => void;
  onMoveSegment: (index: number, direction: "up" | "down") => void;
  onGenerateAudio: (index: number) => void;
  onExtractClip: (index: number) => void;
  onExtractAllClips: () => void;
  onGenerateAll: () => void;
  onPreviewToggle: (index: number) => void;
  onMediaChange: (assets: MediaAsset[]) => void;
  onAutoDistributeMedia: (batchSize?: number) => void;
  onAutoDistributeEffects: (mode: "cycle" | "single", effect?: string) => void;
  onApplyVoiceToAll: (voiceId: string) => void;
  onApplySilenceToAll: (mode: "fixed" | "random", value: number, maxValue?: number) => void;
  onSaveNow: () => void;
  onSmartMatchMedia?: () => void;
  processing: string;
}

const EFFECTS = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade" },
  { id: "pop", label: "Pop" },
  { id: "slide", label: "Slide" },
  { id: "zoom", label: "Zoom" },
];

export default function SegmentList({
  projectId, projectType, segments, voices, mediaAssets, selectedVoice, language,
  videoDownloaded, generatingIndex, extractingIndex, previewClip, script,
  saving, lastSaved, onSegmentUpdate, onBatchUpdateSegments, onAddSegment, onRemoveSegment,
  onMoveSegment, onGenerateAudio, onExtractClip, onExtractAllClips,
  onGenerateAll, onPreviewToggle, onMediaChange, onAutoDistributeMedia, onAutoDistributeEffects, onApplyVoiceToAll, onApplySilenceToAll, onSaveNow, onSmartMatchMedia, processing
}: SegmentListProps) {
  const [showScript, setShowScript] = React.useState(false);
  const [selectedEffect, setSelectedEffect] = React.useState("fade");
  const [bulkVoice, setBulkVoice] = React.useState(selectedVoice);
  const [oddVoice, setOddVoice] = React.useState(voices[0]?.id || "");
  const [evenVoice, setEvenVoice] = React.useState(voices[1]?.id || voices[0]?.id || "");
  const [silenceValue, setSilenceValue] = React.useState(0.5);
  const [silenceMax, setSilenceMax] = React.useState(1.5);
  
  React.useEffect(() => {
    if (voices.length >= 1 && !oddVoice) setOddVoice(voices[0]?.id);
    if (voices.length >= 2 && !evenVoice) setEvenVoice(voices[1]?.id);
  }, [voices]);
  
  const allAudioGenerated = segments.length > 0 && segments.every(s => s.audioGenerated);
  const allClipsExtracted = segments.length > 0 && segments.every(s => s.clipExtracted);

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" /> Step 2: Segments
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">
              {saving ? (
                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Saving...</span>
              ) : lastSaved ? (
                <span className="text-green-600">✓ Saved</span>
              ) : null}
            </span>
            <button
              onClick={onSaveNow}
              disabled={saving}
              className="text-[10px] px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {projectType === "youtube" && (
            <button 
              onClick={onExtractAllClips} 
              disabled={!!processing || !videoDownloaded || allClipsExtracted}
              className={`text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
                allClipsExtracted ? "bg-emerald-500 text-white" : "bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40"
              }`}
            >
              <Scissors className="w-3.5 h-3.5" /> {allClipsExtracted ? "All Clips ✓" : "All Clips"}
            </button>
          )}
          <button 
            onClick={onGenerateAll} 
            disabled={!!processing || allAudioGenerated}
            className={`text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 font-medium transition-all ${
              allAudioGenerated ? "bg-emerald-500 text-white" : "bg-slate-900 text-white hover:bg-slate-700 disabled:opacity-40"
            }`}
          >
            <Play className="w-3.5 h-3.5" /> {allAudioGenerated ? "All Audio ✓" : "All Audio"}
          </button>
        </div>
      </div>

      {script && (
        <div className="mb-3">
          <button
            onClick={() => setShowScript(!showScript)}
            className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 flex items-center justify-between transition-all"
          >
            <span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> View Full Script</span>
            <span className="text-slate-400">{showScript ? "▲" : "▼"}</span>
          </button>
          {showScript && (
            <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
              <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">{script}</pre>
            </div>
          )}
        </div>
      )}

      {(projectType === "custom" || projectType === "ads" || projectType === "wikipedia") && (
        <div className="mb-4 space-y-3">
          <div className={`p-3 rounded-lg border ${projectType === "wikipedia" ? "bg-emerald-50 border-emerald-200" : "bg-purple-50 border-purple-200"}`}>
            <MediaManager
              projectId={projectId}
              mediaAssets={mediaAssets}
              onMediaChange={onMediaChange}
              script={script}
              segments={segments}
              totalDuration={segments.reduce((acc, s) => Math.max(acc, s.end), 0)}
              language={language}
            />
          </div>
          {mediaAssets.length > 0 && segments.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-purple-600 font-medium">Media:</span>
                {[1, 2, 3, 4].map(batch => (
                  <button
                    key={batch}
                    onClick={() => onAutoDistributeMedia(batch)}
                    className="py-1 px-2 text-[10px] font-medium bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-all"
                    title={batch === 1 ? "1 image per segment" : `1 image per ${batch} segments`}
                  >
                    {batch === 1 ? "1:1" : `1:${batch}`}
                  </button>
                ))}
                <select
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val > 0) onAutoDistributeMedia(val);
                  }}
                  className="text-[10px] px-1 py-1 border border-purple-200 rounded bg-white text-purple-700"
                  defaultValue=""
                >
                  <option value="" disabled>Custom...</option>
                  {[5, 6, 8, 10, 15, 20].map(n => (
                    <option key={n} value={n}>1:{n}</option>
                  ))}
                </select>
                {onSmartMatchMedia && (
                  <button
                    onClick={onSmartMatchMedia}
                    disabled={processing === "smart-match"}
                    className="py-1 px-2 text-[10px] font-medium bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200 transition-all disabled:opacity-50"
                    title="AI matches media to segments by content"
                  >
                    {processing === "smart-match" ? "⏳ Matching..." : "🧠 Smart Match"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-500">Effects:</span>
                {EFFECTS.map((e, i) => (
                  <button
                    key={e.id}
                    onClick={() => { setSelectedEffect(e.id); onAutoDistributeEffects("single", e.id); }}
                    className={`py-1 px-2 text-[10px] font-medium rounded-lg transition-all flex items-center gap-1 ${
                      selectedEffect === e.id 
                        ? "bg-blue-600 text-white" 
                        : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
                  >
                    <span className="opacity-60">#{i + 1}</span> {e.label}
                  </button>
                ))}
                <button
                  onClick={() => onAutoDistributeEffects("cycle")}
                  className="py-1 px-2 text-[10px] font-medium bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-all"
                  title="Cycle through different effects"
                >
                  🔄 Cycle
                </button>
              </div>
              {voices.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-orange-600 font-medium">Voice:</span>
                  <select
                    value={bulkVoice}
                    onChange={(e) => setBulkVoice(e.target.value)}
                    className="text-[10px] px-2 py-1 border border-orange-200 rounded bg-white"
                  >
                    {voices.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => onApplyVoiceToAll(bulkVoice)}
                    className="text-[10px] px-2 py-1 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
                  >
                    Apply All
                  </button>
                  {voices.length >= 2 && (
                    <>
                      <span className="text-[10px] text-orange-400">|</span>
                      <span className="text-[10px] text-orange-500">Odd:</span>
                      <select
                        value={oddVoice}
                        onChange={(e) => setOddVoice(e.target.value)}
                        className="text-[10px] px-1 py-0.5 border border-orange-200 rounded bg-white"
                      >
                        {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                      <span className="text-[10px] text-orange-500">Even:</span>
                      <select
                        value={evenVoice}
                        onChange={(e) => setEvenVoice(e.target.value)}
                        className="text-[10px] px-1 py-0.5 border border-orange-200 rounded bg-white"
                      >
                        {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                      <button
                        onClick={() => {
                          onBatchUpdateSegments(segments.map((_, i) => ({ index: i, field: "voiceId", value: i % 2 === 0 ? oddVoice : evenVoice })));
                        }}
                        className="text-[10px] px-2 py-0.5 bg-orange-500 text-white rounded hover:bg-orange-600"
                      >
                        Apply
                      </button>
                    </>
                  )}
                </div>
              )}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-amber-600 font-medium">⏸ Pause:</span>
                <input type="number" value={silenceValue} onChange={(e) => setSilenceValue(Math.max(0, +e.target.value))}
                  className="w-12 text-[10px] px-1 py-0.5 border border-amber-200 rounded text-center" min={0} max={5} step={0.5} />
                <button onClick={() => onApplySilenceToAll("fixed", silenceValue)}
                  className="text-[10px] px-2 py-1 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600">
                  All Same
                </button>
                <span className="text-[10px] text-amber-400">|</span>
                <span className="text-[10px] text-amber-500">Range:</span>
                <input type="number" value={silenceValue} onChange={(e) => setSilenceValue(Math.max(0, +e.target.value))}
                  className="w-10 text-[10px] px-1 py-0.5 border border-amber-200 rounded text-center" min={0} max={5} step={0.5} />
                <span className="text-[10px] text-amber-400">-</span>
                <input type="number" value={silenceMax} onChange={(e) => setSilenceMax(Math.max(silenceValue, +e.target.value))}
                  className="w-10 text-[10px] px-1 py-0.5 border border-amber-200 rounded text-center" min={0} max={5} step={0.5} />
                <button onClick={() => onApplySilenceToAll("random", silenceValue, silenceMax)}
                  className="text-[10px] px-2 py-0.5 bg-amber-600 text-white rounded hover:bg-amber-700">
                  🎲 Random
                </button>
                <button onClick={() => onApplySilenceToAll("fixed", 0)}
                  className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300">
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {projectType === "youtube" && voices.length > 0 && segments.length > 0 && (
        <div className="mb-3 p-2 bg-orange-50 rounded-lg border border-orange-200 space-y-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-orange-600 font-medium">Voice:</span>
            <select
              value={bulkVoice}
              onChange={(e) => setBulkVoice(e.target.value)}
              className="text-[10px] px-2 py-1 border border-orange-200 rounded bg-white"
            >
              {voices.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <button
              onClick={() => onApplyVoiceToAll(bulkVoice)}
              className="text-[10px] px-2 py-1 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700"
            >
              Apply All
            </button>
            {voices.length >= 2 && (
              <>
                <span className="text-[10px] text-orange-400">|</span>
                <span className="text-[10px] text-orange-500">Odd:</span>
                <select
                  value={oddVoice}
                  onChange={(e) => setOddVoice(e.target.value)}
                  className="text-[10px] px-1 py-0.5 border border-orange-200 rounded bg-white"
                >
                  {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <span className="text-[10px] text-orange-500">Even:</span>
                <select
                  value={evenVoice}
                  onChange={(e) => setEvenVoice(e.target.value)}
                  className="text-[10px] px-1 py-0.5 border border-orange-200 rounded bg-white"
                >
                  {voices.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <button
                  onClick={() => {
                    onBatchUpdateSegments(segments.map((_, i) => ({ index: i, field: "voiceId", value: i % 2 === 0 ? oddVoice : evenVoice })));
                  }}
                  className="text-[10px] px-2 py-0.5 bg-orange-500 text-white rounded hover:bg-orange-600"
                >
                  Apply
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-amber-600 font-medium">⏸ Pause:</span>
            <input type="number" value={silenceValue} onChange={(e) => setSilenceValue(Math.max(0, +e.target.value))}
              className="w-12 text-[10px] px-1 py-0.5 border border-amber-200 rounded text-center" min={0} max={5} step={0.5} />
            <button onClick={() => onApplySilenceToAll("fixed", silenceValue)}
              className="text-[10px] px-2 py-1 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600">
              All
            </button>
            <span className="text-[10px] text-amber-400">|</span>
            <input type="number" value={silenceValue} onChange={(e) => setSilenceValue(Math.max(0, +e.target.value))}
              className="w-10 text-[10px] px-1 py-0.5 border border-amber-200 rounded text-center" min={0} max={5} step={0.5} />
            <span className="text-[10px] text-amber-400">-</span>
            <input type="number" value={silenceMax} onChange={(e) => setSilenceMax(Math.max(silenceValue, +e.target.value))}
              className="w-10 text-[10px] px-1 py-0.5 border border-amber-200 rounded text-center" min={0} max={5} step={0.5} />
            <button onClick={() => onApplySilenceToAll("random", silenceValue, silenceMax)}
              className="text-[10px] px-2 py-0.5 bg-amber-600 text-white rounded hover:bg-amber-700">
              🎲
            </button>
            <button onClick={() => onApplySilenceToAll("fixed", 0)}
              className="text-[10px] px-2 py-0.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300">
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        <button
          onClick={() => onAddSegment(0)}
          className="w-full py-1.5 border border-dashed border-slate-300 rounded-lg text-xs text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-1"
        >
          <Plus className="w-3 h-3" /> Add segment at start
        </button>

        {segments.map((seg, i) => (
          <SegmentCard
            key={i}
            segment={seg}
            index={i}
            voices={voices}
            projectType={projectType}
            videoDownloaded={videoDownloaded}
            generatingIndex={generatingIndex}
            extractingIndex={extractingIndex}
            previewClip={previewClip}
            projectId={projectId}
            onUpdate={(field, value) => onSegmentUpdate(i, field, value)}
            onGenerateAudio={() => onGenerateAudio(i)}
            onExtractClip={() => onExtractClip(i)}
            onRemove={() => onRemoveSegment(i)}
            onMoveUp={() => onMoveSegment(i, "up")}
            onMoveDown={() => onMoveSegment(i, "down")}
            onPreviewToggle={() => onPreviewToggle(i)}
            onAddAfter={() => onAddSegment(i + 1)}
            canMoveUp={i > 0}
            canMoveDown={i < segments.length - 1}
            canRemove={segments.length > 1}
            previewClipUrl={video.previewClip(projectId, i, seg.timestamp)}
            previewAudioUrl={voice.previewSegment(projectId, i, seg.timestamp)}
            mediaAssets={mediaAssets}
            onAssignMedia={(mediaId) => onSegmentUpdate(i, "mediaId", mediaId || "")}
          />
        ))}
      </div>
    </div>
  );
}

