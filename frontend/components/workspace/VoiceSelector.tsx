"use client";

import React from "react";
import { Volume2, Loader2, ChevronDown } from "lucide-react";

interface Voice {
  id: string;
  name: string;
  gender: string;
  style: string;
  accent: string;
  langs: string;
}

interface VoiceSelectorProps {
  voices: Voice[];
  selectedVoice: string;
  onSelect: (voiceId: string) => void;
  onPreview?: (voiceId: string) => void;
  playingDemo?: string | null;
  compact?: boolean;
}

export default function VoiceSelector({ 
  voices, selectedVoice, onSelect, onPreview, playingDemo, compact = false 
}: VoiceSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const selected = voices.find(v => v.id === selectedVoice);

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-xs font-medium transition-all"
        >
          <Volume2 className="w-3 h-3" />
          <span className="max-w-[60px] truncate">{selected?.name || "Voice"}</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[180px] max-h-[250px] overflow-auto">
              {voices.map((v) => (
                <button
                  key={v.id}
                  onClick={() => { onSelect(v.id); setIsOpen(false); }}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2 ${
                    selectedVoice === v.id ? "bg-purple-50 text-purple-700" : ""
                  }`}
                >
                  <span className="font-medium">{v.name}</span>
                  <span className={`text-[10px] px-1 py-0.5 rounded ${
                    v.gender === "Female" ? "bg-pink-100 text-pink-600" : 
                    v.gender === "Non-binary" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
                  }`}>{v.gender[0]}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {voices.map((v) => (
        <label
          key={v.id}
          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all ${
            selectedVoice === v.id
              ? "bg-purple-50 border-purple-300"
              : "bg-slate-50 border-slate-100 hover:border-slate-200"
          }`}
        >
          <input
            type="radio"
            name="voice"
            value={v.id}
            checked={selectedVoice === v.id}
            onChange={() => onSelect(v.id)}
            className="accent-purple-500"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{v.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                v.gender === "Female" ? "bg-pink-100 text-pink-600" : 
                v.gender === "Non-binary" ? "bg-purple-100 text-purple-600" : "bg-blue-100 text-blue-600"
              }`}>{v.gender}</span>
              {v.accent === "Multilingual" && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-600">🌍 Best</span>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate">{v.style} • {v.accent}</p>
          </div>
          {onPreview && (
            <button
              onClick={(e) => { e.preventDefault(); onPreview(v.id); }}
              className="p-1.5 hover:bg-white rounded-full"
            >
              {playingDemo === v.id ? (
                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-slate-400" />
              )}
            </button>
          )}
        </label>
      ))}
    </div>
  );
}

