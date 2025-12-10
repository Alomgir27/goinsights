"use client";

import React from "react";
import { Settings, Volume2, Loader2 } from "lucide-react";

interface Voice {
  id: string;
  name: string;
  gender: string;
  style: string;
  accent: string;
  langs: string;
}

interface VoiceSettingsProps {
  voices: Voice[];
  selectedVoice: string;
  onSelectVoice: (voiceId: string) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  stability: number;
  onStabilityChange: (stability: number) => void;
  playingDemo: string | null;
  onPlayDemo: (voiceId: string) => void;
}

export default function VoiceSettings({
  voices, selectedVoice, onSelectVoice, selectedModel, onSelectModel,
  speed, onSpeedChange, stability, onStabilityChange, playingDemo, onPlayDemo
}: VoiceSettingsProps) {
  return (
    <div className="card">
      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
        <Settings className="w-4 h-4" /> Voice Settings
      </h3>

      <div className="mb-3">
        <label className="text-xs text-slate-500 block mb-1">TTS Model</label>
        <div className="flex gap-1">
          {[
            { id: "v2", label: "v2 (29 langs)" },
            { id: "v3", label: "v3 (70+) ✨" },
            { id: "flash", label: "Flash ⚡" },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => onSelectModel(m.id)}
              className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition-all ${
                selectedModel === m.id ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto mb-2">
        {voices.map((v) => (
          <label
            key={v.id}
            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all ${
              selectedVoice === v.id ? "bg-purple-50 border-purple-300" : "bg-slate-50 border-slate-100 hover:border-slate-200"
            }`}
          >
            <input
              type="radio"
              name="voice"
              value={v.id}
              checked={selectedVoice === v.id}
              onChange={() => onSelectVoice(v.id)}
              className="accent-purple-500"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{v.name}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  v.gender === "Female" ? "bg-pink-100 text-pink-600" :
                  v.gender === "Non-binary" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                }`}>{v.gender}</span>
                {v.accent === "Multilingual" && <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-600">🌍</span>}
              </div>
              <p className="text-xs text-slate-500 truncate">{v.style} • {v.accent}</p>
            </div>
            <button
              onClick={(e) => { e.preventDefault(); onPlayDemo(v.id); }}
              className="p-1.5 hover:bg-white rounded-full"
            >
              {playingDemo === v.id ? <Loader2 className="w-4 h-4 animate-spin text-purple-500" /> : <Volume2 className="w-4 h-4 text-slate-400" />}
            </button>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-[#666]">Speed: {speed.toFixed(1)}x</label>
          <input type="range" min="0.5" max="2" step="0.1" value={speed} onChange={(e) => onSpeedChange(parseFloat(e.target.value))} className="w-full" />
        </div>
        <div>
          <label className="text-xs text-[#666]">Stability: {(stability * 100).toFixed(0)}%</label>
          <input type="range" min="0" max="1" step="0.1" value={stability} onChange={(e) => onStabilityChange(parseFloat(e.target.value))} className="w-full" />
        </div>
      </div>
    </div>
  );
}

