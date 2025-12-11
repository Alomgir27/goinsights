"use client";

import React, { useState } from "react";
import { FileText, Sparkles, Loader2, RefreshCw, Clock, MessageSquare, BookOpen, GraduationCap, Film, Mic, ShoppingBag, Users, Zap, Megaphone } from "lucide-react";
import { script as scriptApi } from "@/lib/api";

const CONTENT_STYLES = [
  { id: "dialogue", label: "Dialogue", desc: "Two speakers conversing", icon: MessageSquare },
  { id: "storytelling", label: "Story", desc: "Narrator telling a story", icon: BookOpen },
  { id: "tutorial", label: "Tutorial", desc: "Step-by-step guide", icon: GraduationCap },
  { id: "documentary", label: "Documentary", desc: "Informative narration", icon: Film },
  { id: "podcast", label: "Podcast", desc: "Casual chat", icon: Mic },
];

const ADS_STYLES = [
  { id: "product_demo", label: "Product Demo", desc: "Showcase features", icon: ShoppingBag },
  { id: "testimonial", label: "Testimonial", desc: "Customer review", icon: Users },
  { id: "social_ad", label: "Social Ad", desc: "Short & punchy", icon: Zap },
  { id: "promo", label: "Promo", desc: "Launch announcement", icon: Megaphone },
];

const ALL_STYLES = [...CONTENT_STYLES, ...ADS_STYLES];

interface CustomScriptEditorProps {
  projectId: string;
  initialPrompt?: string;
  initialScript?: string;
  initialDuration?: number;
  initialVideoStyle?: string;
  language: string;
  onLanguageChange: (lang: string) => void;
  onScriptGenerated: (script: string, segments: any[]) => void;
}

export default function CustomScriptEditor({
  projectId, initialPrompt, initialScript, initialDuration, initialVideoStyle, language, onLanguageChange, onScriptGenerated
}: CustomScriptEditorProps) {
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [scriptText, setScriptText] = useState(initialScript || "");
  const [duration, setDuration] = useState(initialDuration || 60);
  const [customDuration, setCustomDuration] = useState(initialDuration && ![30, 60, 120, 180, 300, 600].includes(initialDuration) ? String(Math.round(initialDuration / 60)) : "");
  const [numSegments, setNumSegments] = useState(0);
  const [videoStyle, setVideoStyle] = useState(initialVideoStyle || "dialogue");
  const [generating, setGenerating] = useState(false);
  
  const isAdsStyle = ADS_STYLES.some(s => s.id === videoStyle);
  const availableStyles = isAdsStyle || ADS_STYLES.some(s => s.id === initialVideoStyle) ? ADS_STYLES : CONTENT_STYLES;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    try {
      const { data } = await scriptApi.generate(projectId, prompt, duration, language, numSegments, videoStyle);
      setScriptText(data.script);
      onScriptGenerated(data.script, data.segments || []);
    } catch (err) {
      console.error("Script generation failed:", err);
    }
    setGenerating(false);
  };

  const handleContinue = () => {
    if (scriptText.trim()) {
      // Split by speaker lines (Name: text) to preserve dialogue integrity
      const lines = scriptText.split(/\n/).filter(s => s.trim());
      const segments = lines.slice(0, 30).map((text, i) => {
        // Extract speaker if present (e.g., "Anna: Hello")
        const match = text.match(/^([A-Z][a-z]+):\s*(.+)$/);
        const speaker = match ? match[1] : "";
        const cleanText = match ? match[2] : text.trim();
        
        return {
          text: cleanText,
          display_text: text.trim(),
          speaker,
          start: i * 5,
          end: (i + 1) * 5,
          duration: 5,
          voice_id: "aria"
        };
      });
      onScriptGenerated(scriptText, segments);
    }
  };

  return (
    <div className="card">
      <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
        <FileText className="w-4 h-4" /> Script Editor
      </h3>

      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-600 block mb-2">What's your video about?</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your video topic... e.g., 'A fun educational video teaching basic English greetings for kids with cartoon characters'"
            className="w-full p-3 border border-slate-200 rounded-lg text-sm resize-none focus:border-purple-400 focus:outline-none"
            rows={3}
          />
        </div>

        <div>
          <label className="text-xs text-slate-600 block mb-2">Video Style</label>
          <div className="flex flex-wrap gap-2">
            {availableStyles.map((style) => (
              <button
                key={style.id}
                onClick={() => setVideoStyle(style.id)}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  videoStyle === style.id 
                    ? isAdsStyle ? "bg-orange-600 text-white" : "bg-purple-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <style.icon className="w-3.5 h-3.5" />
                {style.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">
            {ALL_STYLES.find(s => s.id === videoStyle)?.desc}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-600 block mb-1">
              <Clock className="w-3 h-3 inline mr-1" /> Duration
            </label>
            <div className="flex flex-wrap gap-1 items-center">
              {[30, 60, 120, 180, 300, 600].map(d => (
                <button
                  key={d}
                  onClick={() => { setDuration(d); setCustomDuration(""); }}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                    duration === d && !customDuration ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {d < 60 ? `${d}s` : `${d / 60}m`}
                </button>
              ))}
              <input
                type="number"
                value={customDuration}
                onChange={(e) => {
                  setCustomDuration(e.target.value);
                  if (e.target.value) setDuration(parseInt(e.target.value) * 60);
                }}
                placeholder="..."
                min="1"
                className={`w-12 px-1.5 py-1 rounded text-xs border ${customDuration ? "border-purple-500 bg-purple-50" : "border-slate-200"}`}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-600 block mb-1">Language</label>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="w-full py-1.5 px-2 border border-slate-200 rounded text-xs focus:border-purple-400 focus:outline-none"
            >
              <option value="English">🇺🇸 English</option>
              <option value="Spanish">🇪🇸 Spanish</option>
              <option value="Bengali">🇧🇩 Bengali</option>
              <option value="Hindi">🇮🇳 Hindi</option>
              <option value="Arabic">🇸🇦 Arabic</option>
              <option value="Chinese">🇨🇳 Chinese</option>
              <option value="Japanese">🇯🇵 Japanese</option>
              <option value="Korean">🇰🇷 Korean</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-slate-600 block mb-1">Segments</label>
            <input
              type="number"
              value={numSegments || ""}
              onChange={(e) => setNumSegments(+e.target.value)}
              placeholder="Auto"
              className="w-full py-1.5 px-2 border border-slate-200 rounded text-xs focus:border-purple-400 focus:outline-none"
              min={0}
              max={30}
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || generating}
          className={`w-full py-2.5 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2 ${
            isAdsStyle ? "bg-orange-600 hover:bg-orange-700" : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          {generating ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Generating Script...</>
          ) : (
            <><Sparkles className="w-4 h-4" /> Generate Script</>
          )}
        </button>

        {scriptText && (
          <>
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-600">Generated Script</label>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="text-xs text-purple-600 hover:underline flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </button>
              </div>
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-lg text-xs resize-none focus:border-purple-400 focus:outline-none bg-slate-50"
                rows={6}
              />
            </div>

            <button
              onClick={handleContinue}
              className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 flex items-center justify-center gap-2"
            >
              Continue to Segments →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

