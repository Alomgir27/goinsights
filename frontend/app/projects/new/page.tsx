"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Play, Wand2, MessageSquare, BookOpen, GraduationCap, Film, Mic, Globe, Sparkles, Megaphone, ShoppingBag, Users, Zap, Home } from "lucide-react";
import Link from "next/link";
import { youtube, projects, ai } from "@/lib/api";

type ProjectType = "youtube" | "custom" | "ads" | null;

interface Suggestion {
  title: string;
  description: string;
}

export default function NewProject() {
  const router = useRouter();
  const [projectType, setProjectType] = useState<ProjectType>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [duration, setDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState("");
  const [videoStyle, setVideoStyle] = useState("dialogue");
  const [language, setLanguage] = useState("English");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestPrompt, setSuggestPrompt] = useState("");

  const LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Bengali", "Hindi", "Chinese", "Japanese", "Korean", "Arabic", "Russian"];

  const CONTENT_STYLES = [
    { id: "dialogue", label: "Dialogue", desc: "Two speakers conversing", icon: MessageSquare },
    { id: "storytelling", label: "Storytelling", desc: "Single narrator story", icon: BookOpen },
    { id: "tutorial", label: "Tutorial", desc: "Step-by-step guide", icon: GraduationCap },
    { id: "documentary", label: "Documentary", desc: "Informative narration", icon: Film },
    { id: "podcast", label: "Podcast", desc: "Casual conversation", icon: Mic },
  ];

  const ADS_STYLES = [
    { id: "product_demo", label: "Product Demo", desc: "Showcase features", icon: ShoppingBag },
    { id: "testimonial", label: "Testimonial", desc: "Customer review", icon: Users },
    { id: "social_ad", label: "Social Ad", desc: "Short & punchy", icon: Zap },
    { id: "promo", label: "Promo/Trailer", desc: "Launch announcement", icon: Megaphone },
  ];

  const ADS_DURATIONS = [15, 30, 60];
  const CONTENT_DURATIONS = [30, 60, 120, 180, 300, 600];

  const handleCreateYoutube = async () => {
    if (!youtubeUrl.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await youtube.extract(youtubeUrl);
      router.push(`/workspace/${data.project_id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to extract video");
    }
    setLoading(false);
  };

  const handleCreateCustom = async () => {
    if (!customTitle.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await projects.createCustom(customTitle, customPrompt, duration, videoStyle, language);
      router.push(`/workspace/${data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create project");
    }
    setLoading(false);
  };

  const handleGetSuggestions = async () => {
    setSuggestLoading(true);
    try {
      const prompt = suggestPrompt.trim() || customPrompt;
      const { data } = await ai.suggestProject(videoStyle, language, duration, prompt);
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([]);
    }
    setSuggestLoading(false);
  };

  const applySuggestion = (s: Suggestion) => {
    setCustomTitle(s.title);
    setCustomPrompt(s.description);
  };

  const isAdsType = projectType === "ads";
  const currentStyles = isAdsType ? ADS_STYLES : CONTENT_STYLES;
  const currentDurations = isAdsType ? ADS_DURATIONS : CONTENT_DURATIONS;

  const renderProjectForm = () => (
    <div className="flex gap-6">
      {/* Left: Form */}
      <div className="flex-1 max-w-md">
        <button onClick={() => { setProjectType(null); setSuggestions([]); setVideoStyle(isAdsType ? "product_demo" : "dialogue"); }} className="flex items-center gap-1.5 text-[#666] hover:text-[#1a1a1a] mb-5 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="card">
          <div className="flex items-center gap-3 mb-5">
            <div className={`w-10 h-10 ${isAdsType ? "bg-orange-100" : "bg-purple-100"} rounded-lg flex items-center justify-center`}>
              {isAdsType ? <Megaphone className="w-5 h-5 text-orange-600" /> : <Wand2 className="w-5 h-5 text-purple-600" />}
            </div>
            <div>
              <h3 className="font-semibold text-[#1a1a1a]">{isAdsType ? "Ads / Promo" : "Custom Project"}</h3>
              <p className="text-xs text-[#666]">{isAdsType ? "Create promotional content" : "Create from scratch"}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Project Title</label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={isAdsType ? "My product launch video..." : "My awesome video..."}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-1">
                {isAdsType ? "Product/Topic" : "Script Prompt"} <span className="text-[#999] font-normal">(optional)</span>
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder={isAdsType ? "Describe your product or what you're promoting..." : "Describe what your video should be about..."}
                className="input resize-none"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Duration</label>
              <div className="flex flex-wrap gap-2">
                {currentDurations.map((d) => (
                  <button
                    key={d}
                    onClick={() => { setDuration(d); setCustomDuration(""); }}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      duration === d && !customDuration 
                        ? isAdsType ? "bg-orange-600 text-white" : "bg-purple-600 text-white"
                        : "bg-[#f5f5f5] text-[#666] hover:bg-[#eee]"
                    }`}
                  >
                    {d < 60 ? `${d}s` : `${d / 60}m`}
                  </button>
                ))}
                {!isAdsType && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={customDuration}
                      onChange={(e) => {
                        setCustomDuration(e.target.value);
                        if (e.target.value) setDuration(parseInt(e.target.value) * 60);
                      }}
                      placeholder="Custom"
                      min="1"
                      className={`w-20 px-2 py-1.5 rounded text-sm border transition-colors ${
                        customDuration ? "border-purple-500 bg-purple-50" : "border-[#ddd] bg-[#f5f5f5]"
                      }`}
                    />
                    <span className="text-xs text-[#666]">min</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Video Style</label>
              <div className="grid grid-cols-2 gap-2">
                {currentStyles.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setVideoStyle(style.id)}
                    className={`p-3 rounded-lg text-left border transition-all ${
                      videoStyle === style.id 
                        ? isAdsType 
                          ? "border-orange-500 bg-orange-50 ring-1 ring-orange-500"
                          : "border-purple-500 bg-purple-50 ring-1 ring-purple-500"
                        : "border-[#ddd] hover:border-purple-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <style.icon className={`w-4 h-4 ${videoStyle === style.id ? (isAdsType ? "text-orange-600" : "text-purple-600") : "text-[#666]"}`} />
                      <span className={`text-sm font-medium ${videoStyle === style.id ? (isAdsType ? "text-orange-700" : "text-purple-700") : "text-[#333]"}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#666] mt-1">{style.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1a1a1a] mb-2">
                <Globe className="w-4 h-4 inline mr-1" /> Language
              </label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      language === lang 
                        ? isAdsType ? "bg-orange-600 text-white" : "bg-purple-600 text-white"
                        : "bg-[#f5f5f5] text-[#666] hover:bg-[#eee]"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

          <button
            onClick={handleCreateCustom}
            disabled={loading || !customTitle.trim()}
            className={`w-full mt-5 ${isAdsType ? "btn-primary bg-orange-600 hover:bg-orange-700" : "btn-primary"}`}
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Project"}
          </button>
        </div>
      </div>

      {/* Right: AI Suggestions */}
      <div className="w-72 shrink-0">
        <div className="card sticky top-8">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className={`w-5 h-5 ${isAdsType ? "text-orange-500" : "text-purple-500"}`} />
            <h4 className="font-semibold text-[#1a1a1a]">AI Suggestions</h4>
          </div>
          <p className="text-xs text-[#666] mb-3">Get AI-generated title and description ideas.</p>
          
          <input
            type="text"
            value={suggestPrompt}
            onChange={(e) => setSuggestPrompt(e.target.value)}
            placeholder="Topic or keyword (optional)"
            className="w-full px-3 py-2 rounded-lg text-sm border border-[#ddd] mb-3 focus:border-purple-400 focus:outline-none"
          />
          
          <button
            onClick={handleGetSuggestions}
            disabled={suggestLoading}
            className={`w-full mb-4 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              isAdsType 
                ? "bg-orange-100 text-orange-700 hover:bg-orange-200"
                : "bg-purple-100 text-purple-700 hover:bg-purple-200"
            } disabled:opacity-50`}
          >
            {suggestLoading ? <><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Generating...</> : "Generate Ideas"}
          </button>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => applySuggestion(s)}
                  className="w-full p-3 rounded-lg border border-[#eee] hover:border-purple-300 hover:bg-purple-50/50 text-left transition-all"
                >
                  <p className="text-sm font-medium text-[#1a1a1a] line-clamp-2">{s.title}</p>
                  <p className="text-xs text-[#666] mt-1 line-clamp-2">{s.description}</p>
                </button>
              ))}
            </div>
          )}

          {suggestions.length === 0 && !suggestLoading && (
            <p className="text-xs text-[#999] text-center py-4">Click &quot;Generate Ideas&quot; to get suggestions</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white py-8 px-6">
      <div className="container">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
              <Home className="w-5 h-5 text-[#666]" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[#1a1a1a]">New Project</h1>
              <p className="text-sm text-[#666] mt-1">Choose how you want to create your video</p>
            </div>
          </div>
          <Link href="/projects" className="btn-secondary">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>

        {!projectType ? (
          <div className="grid md:grid-cols-3 gap-5 max-w-4xl">
            {/* YouTube Card */}
            <button
              onClick={() => setProjectType("youtube")}
              className="p-6 bg-gradient-to-br from-red-500 to-red-600 rounded-xl text-left hover:from-red-600 hover:to-red-700 transition-colors"
            >
              <div className="w-11 h-11 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">YouTube Remix</h3>
              <p className="text-white/80 text-sm mb-4">Transform any YouTube video with AI voiceover</p>
              <div className="flex flex-wrap gap-1.5">
                {["Transcript", "AI Script", "Clips"].map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-white/20 text-white/90 rounded text-xs">{tag}</span>
                ))}
              </div>
            </button>

            {/* Custom Card */}
            <button
              onClick={() => { setProjectType("custom"); setVideoStyle("dialogue"); setDuration(60); }}
              className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl text-left hover:from-purple-600 hover:to-purple-700 transition-colors"
            >
              <div className="w-11 h-11 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <Wand2 className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">From Scratch</h3>
              <p className="text-white/80 text-sm mb-4">Create with AI scripts & generated images</p>
              <div className="flex flex-wrap gap-1.5">
                {["AI Script", "Images", "Multi-Voice"].map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-white/20 text-white/90 rounded text-xs">{tag}</span>
                ))}
              </div>
            </button>

            {/* Ads Card */}
            <button
              onClick={() => { setProjectType("ads"); setVideoStyle("product_demo"); setDuration(30); }}
              className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl text-left hover:from-orange-600 hover:to-orange-700 transition-colors"
            >
              <div className="w-11 h-11 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <Megaphone className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">Ads / Promo</h3>
              <p className="text-white/80 text-sm mb-4">Create ads, promos & promotional content</p>
              <div className="flex flex-wrap gap-1.5">
                {["15s/30s/60s", "CTA Focus", "Fast-Paced"].map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-white/20 text-white/90 rounded text-xs">{tag}</span>
                ))}
              </div>
            </button>
          </div>
        ) : projectType === "youtube" ? (
          <div className="max-w-md">
            <button onClick={() => setProjectType(null)} className="flex items-center gap-1.5 text-[#666] hover:text-[#1a1a1a] mb-5 text-sm">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="card">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Play className="w-5 h-5 text-red-600 fill-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#1a1a1a]">YouTube Video</h3>
                  <p className="text-xs text-[#666]">Paste a YouTube URL</p>
                </div>
              </div>

              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="input mb-4"
              />

              {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

              <button
                onClick={handleCreateYoutube}
                disabled={loading || !youtubeUrl.trim()}
                className="btn-primary w-full"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Extracting...</> : "Create Project"}
              </button>
            </div>
          </div>
        ) : (
          renderProjectForm()
        )}
      </div>
    </div>
  );
}
