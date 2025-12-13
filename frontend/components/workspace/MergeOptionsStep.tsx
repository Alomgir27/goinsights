"use client";

import React from "react";
import { Merge, Music, X, Type } from "lucide-react";
import type { MergeOptions, MusicPreset, WatermarkConfig } from "@/lib/types";

interface MergeOptionsStepProps {
  mergeOptions: MergeOptions;
  setMergeOptions: (fn: (prev: MergeOptions) => MergeOptions) => void;
  musicPresets: MusicPreset[];
  onOpenMusicSheet: () => void;
  onRemoveMusic: () => void;
  onMergeAll: () => void;
  processing: string;
  videoDownloaded: boolean;
  projectType: "youtube" | "custom" | "ads" | "wikipedia";
}

const SUBTITLE_STYLES = [
  { id: "karaoke", name: "🎤 Karaoke", desc: "Yellow highlight" },
  { id: "neon", name: "💜 Neon", desc: "Glowing effect" },
  { id: "fire", name: "🔥 Fire", desc: "Orange highlight" },
  { id: "bold", name: "💪 Bold", desc: "Scale up effect" },
  { id: "minimal", name: "✨ Minimal", desc: "Simple fade" },
  { id: "typewriter", name: "⌨️ Typewriter", desc: "Monospace style" },
  { id: "glitch", name: "🌀 Glitch", desc: "Cyberpunk vibe" },
  { id: "bounce", name: "🎾 Bounce", desc: "Pop & bounce" },
  { id: "wave", name: "🌊 Wave", desc: "Warm ocean" },
  { id: "shadow", name: "🌑 Shadow", desc: "3D depth" },
  { id: "gradient", name: "🌈 Gradient", desc: "Color blend" },
  { id: "retro", name: "📺 Retro", desc: "Vintage look" },
];

export default function MergeOptionsStep({
  mergeOptions, setMergeOptions, musicPresets, onOpenMusicSheet, onRemoveMusic,
  onMergeAll, processing, videoDownloaded, projectType
}: MergeOptionsStepProps) {
  return (
    <div className="card">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Merge className="w-4 h-4" /> Step 3: Merge Options
      </h3>
      
      <div className="space-y-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={mergeOptions.subtitles}
            onChange={(e) => setMergeOptions(p => ({ ...p, subtitles: e.target.checked }))}
            className="w-4 h-4"
          />
          <span className="text-sm">Include Subtitles</span>
        </label>

        {mergeOptions.subtitles && (
          <div className="ml-6 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={mergeOptions.animatedSubtitles}
                onChange={(e) => setMergeOptions(p => ({ ...p, animatedSubtitles: e.target.checked }))}
                className="w-4 h-4 accent-purple-500"
              />
              <span className="text-sm text-purple-700">Animated Subtitles</span>
            </label>

            {mergeOptions.animatedSubtitles && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#666] block mb-2">Animation Style</label>
                  <div className="grid grid-cols-3 gap-2">
                    {SUBTITLE_STYLES.map(style => (
                      <button
                        key={style.id}
                        onClick={() => setMergeOptions(p => ({ ...p, subtitleStyle: style.id }))}
                        className={`p-2 rounded-lg text-left transition-all ${
                          mergeOptions.subtitleStyle === style.id
                            ? "bg-purple-100 border-2 border-purple-500"
                            : "bg-[#f5f5f5] border-2 border-transparent hover:border-purple-200"
                        }`}
                      >
                        <span className="text-sm font-medium block">{style.name}</span>
                        <span className="text-[10px] text-[#999]">{style.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-[#666] block mb-1">Font Size: {mergeOptions.subtitleSize}px</label>
                  <input
                    type="range"
                    min={48}
                    max={120}
                    value={mergeOptions.subtitleSize}
                    onChange={(e) => setMergeOptions(p => ({ ...p, subtitleSize: parseInt(e.target.value) }))}
                    className="w-full accent-purple-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>Small</span>
                    <span>Large</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#666] block mb-2">Position</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "top", icon: "⬆️", label: "Top" },
                      { id: "middle", icon: "⏺️", label: "Middle" },
                      { id: "bottom", icon: "⬇️", label: "Bottom" }
                    ].map(pos => (
                      <button
                        key={pos.id}
                        onClick={() => setMergeOptions(p => ({ ...p, subtitlePosition: pos.id }))}
                        className={`p-2 rounded-lg text-center transition-all ${
                          mergeOptions.subtitlePosition === pos.id
                            ? "bg-purple-100 border-2 border-purple-500"
                            : "bg-[#f5f5f5] border-2 border-transparent hover:border-purple-200"
                        }`}
                      >
                        <span className="text-lg block">{pos.icon}</span>
                        <span className="text-xs">{pos.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {(projectType === "custom" || projectType === "ads") && (
                  <div className="border-t border-slate-700 pt-3 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={mergeOptions.dialogueMode}
                        onChange={(e) => setMergeOptions(p => ({ ...p, dialogueMode: e.target.checked }))}
                        className="accent-purple-500"
                      />
                      <span className="text-sm">💬 Dialogue Mode</span>
                    </label>
                    {mergeOptions.dialogueMode && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            value={mergeOptions.speaker1Position}
                            onChange={(e) => setMergeOptions(p => ({ ...p, speaker1Position: e.target.value }))}
                            className="input text-xs"
                          >
                            <option value="top-left">Speaker1: ↖ Top-Left</option>
                            <option value="bottom-left">Speaker1: ↙ Bottom-Left</option>
                          </select>
                          <select
                            value={mergeOptions.speaker2Position}
                            onChange={(e) => setMergeOptions(p => ({ ...p, speaker2Position: e.target.value }))}
                            className="input text-xs"
                          >
                            <option value="top-right">Speaker2: ↗ Top-Right</option>
                            <option value="bottom-right">Speaker2: ↘ Bottom-Right</option>
                          </select>
                        </div>
                        <div className="mt-2">
                          <label className="text-xs text-[#666] block mb-1">Text Background</label>
                          <select
                            value={mergeOptions.dialogueBgStyle}
                            onChange={(e) => setMergeOptions(p => ({ ...p, dialogueBgStyle: e.target.value }))}
                            className="input text-xs w-full"
                          >
                            <option value="none">No Background</option>
                            <option value="transparent">Semi-Transparent</option>
                            <option value="solid">Solid Black</option>
                            <option value="blur">Blur Effect</option>
                            <option value="gradient">Gradient</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-slate-200 pt-3 mt-3">
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={mergeOptions.watermark.enabled}
              onChange={(e) => setMergeOptions(p => ({ ...p, watermark: { ...p.watermark, enabled: e.target.checked } }))}
              className="w-4 h-4 accent-teal-500"
            />
            <Type className="w-4 h-4 text-teal-600" />
            <span className="text-sm">Add Watermark</span>
          </label>

          {mergeOptions.watermark.enabled && (
            <div className="ml-6 space-y-3">
              <div>
                <label className="text-xs text-[#666] block mb-1">Text (Channel Name)</label>
                <input
                  type="text"
                  value={mergeOptions.watermark.text}
                  onChange={(e) => setMergeOptions(p => ({ ...p, watermark: { ...p.watermark, text: e.target.value } }))}
                  placeholder="@YourChannel"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-[#666] block mb-2">Position</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "top-left", icon: "↖", label: "Top Left" },
                    { id: "top-center", icon: "⬆", label: "Top" },
                    { id: "top-right", icon: "↗", label: "Top Right" },
                    { id: "bottom-left", icon: "↙", label: "Bottom Left" },
                    { id: "bottom-center", icon: "⬇", label: "Bottom" },
                    { id: "bottom-right", icon: "↘", label: "Bottom Right" },
                  ].map(pos => (
                    <button
                      key={pos.id}
                      onClick={() => setMergeOptions(p => ({ ...p, watermark: { ...p.watermark, position: pos.id as WatermarkConfig["position"] } }))}
                      className={`p-2 rounded-lg text-center transition-all text-xs ${
                        mergeOptions.watermark.position === pos.id
                          ? "bg-teal-100 border-2 border-teal-500"
                          : "bg-[#f5f5f5] border-2 border-transparent hover:border-teal-200"
                      }`}
                    >
                      <span className="text-base block">{pos.icon}</span>
                      <span>{pos.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#666] block mb-1">Size: {mergeOptions.watermark.fontSize}px</label>
                  <input
                    type="range" min={16} max={48} value={mergeOptions.watermark.fontSize}
                    onChange={(e) => setMergeOptions(p => ({ ...p, watermark: { ...p.watermark, fontSize: parseInt(e.target.value) } }))}
                    className="w-full accent-teal-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#666] block mb-1">Opacity: {Math.round(mergeOptions.watermark.opacity * 100)}%</label>
                  <input
                    type="range" min={0.3} max={1} step={0.1} value={mergeOptions.watermark.opacity}
                    onChange={(e) => setMergeOptions(p => ({ ...p, watermark: { ...p.watermark, opacity: parseFloat(e.target.value) } }))}
                    className="w-full accent-teal-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs text-[#666] block mb-1">Aspect Ratio</label>
          <select
            value={mergeOptions.resize}
            onChange={(e) => setMergeOptions(p => ({ ...p, resize: e.target.value }))}
            className="input"
          >
            <option value="16:9">16:9 (Landscape)</option>
            <option value="9:16">9:16 (Shorts/Vertical)</option>
            <option value="1:1">1:1 (Square)</option>
          </select>
        </div>

        <div className="border-t pt-3">
          <label className="text-xs text-[#666] flex items-center gap-1 mb-2">
            <Music className="w-3 h-3" /> Background Music
          </label>

          {mergeOptions.bgMusic ? (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-3 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-purple-700">
                  🎵 {musicPresets.find(p => p.id === mergeOptions.bgMusic)?.name || mergeOptions.bgMusic}
                </span>
                <button onClick={onRemoveMusic} className="text-red-500 hover:bg-red-50 p-1 rounded">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs text-[#666]">Volume</label>
                  <span className="text-xs font-medium text-purple-600">{Math.round(mergeOptions.bgMusicVolume * 100)}%</span>
                </div>
                <input
                  type="range" min="0.05" max="0.8" step="0.05"
                  value={mergeOptions.bgMusicVolume}
                  onChange={(e) => setMergeOptions(p => ({ ...p, bgMusicVolume: parseFloat(e.target.value) }))}
                  className="w-full accent-purple-500"
                />
              </div>
            </div>
          ) : (
            <button onClick={onOpenMusicSheet} className="w-full py-3 border-2 border-dashed border-[#ccc] rounded-lg text-sm text-[#666] hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all flex items-center justify-center gap-2">
              <Music className="w-4 h-4" /> Choose Background Music
            </button>
          )}
        </div>
      </div>

      <button
        onClick={onMergeAll}
        disabled={(projectType === "youtube" && !videoDownloaded) || !!processing}
        className="btn-primary w-full disabled:opacity-50"
      >
        <Merge className="w-4 h-4" /> Create Final Video
      </button>
    </div>
  );
}

