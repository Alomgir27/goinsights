"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Play, Wand2 } from "lucide-react";
import Link from "next/link";
import { youtube, projects } from "@/lib/api";

export default function NewProject() {
  const router = useRouter();
  const [projectType, setProjectType] = useState<"youtube" | "custom" | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [duration, setDuration] = useState(60);
  const [customDuration, setCustomDuration] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      const { data } = await projects.createCustom(customTitle, customPrompt, duration);
      router.push(`/workspace/${data.id}`);
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to create project");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white py-8 px-6">
      <div className="container">
        {/* Header - matches Projects page */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a1a]">New Project</h1>
            <p className="text-sm text-[#666] mt-1">Choose how you want to create your video</p>
          </div>
          <Link href="/projects" className="btn-secondary">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        </div>

        {!projectType ? (
          <div className="grid md:grid-cols-2 gap-5 max-w-3xl">
            {/* YouTube Card */}
            <button
              onClick={() => setProjectType("youtube")}
              className="p-6 bg-gradient-to-br from-red-500 to-red-600 rounded-xl text-left hover:from-red-600 hover:to-red-700 transition-colors"
            >
              <div className="w-11 h-11 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <Play className="w-5 h-5 text-white fill-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">YouTube Remix</h3>
              <p className="text-white/80 text-sm mb-4">
                Transform any YouTube video with AI voiceover
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["Transcript", "AI Script", "Clips"].map((tag) => (
                  <span key={tag} className="px-2 py-0.5 bg-white/20 text-white/90 rounded text-xs">{tag}</span>
                ))}
              </div>
            </button>

            {/* Custom Card */}
            <button
              onClick={() => setProjectType("custom")}
              className="p-6 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl text-left hover:from-purple-600 hover:to-purple-700 transition-colors"
            >
              <div className="w-11 h-11 bg-white/20 rounded-lg flex items-center justify-center mb-4">
                <Wand2 className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">From Scratch</h3>
              <p className="text-white/80 text-sm mb-4">
                Create with AI scripts & generated images
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["AI Script", "Images", "Multi-Voice"].map((tag) => (
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
          <div className="max-w-md">
            <button onClick={() => setProjectType(null)} className="flex items-center gap-1.5 text-[#666] hover:text-[#1a1a1a] mb-5 text-sm">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>

            <div className="card">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#1a1a1a]">Custom Project</h3>
                  <p className="text-xs text-[#666]">Create from scratch</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Project Title</label>
                  <input
                    type="text"
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="My awesome video..."
                    className="input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-1">Script Prompt <span className="text-[#999] font-normal">(optional)</span></label>
                  <textarea
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Describe what your video should be about..."
                    className="input resize-none"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#1a1a1a] mb-2">Duration</label>
                  <div className="flex flex-wrap gap-2">
                    {[30, 60, 120, 180, 300, 600].map((d) => (
                      <button
                        key={d}
                        onClick={() => { setDuration(d); setCustomDuration(""); }}
                        className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                          duration === d && !customDuration ? "bg-purple-600 text-white" : "bg-[#f5f5f5] text-[#666] hover:bg-[#eee]"
                        }`}
                      >
                        {d < 60 ? `${d}s` : `${d / 60}m`}
                      </button>
                    ))}
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
                  </div>
                </div>
              </div>

              {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

              <button
                onClick={handleCreateCustom}
                disabled={loading || !customTitle.trim()}
                className="btn-primary w-full mt-5"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : "Create Project"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
