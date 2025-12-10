"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Play, FileText, Sparkles, Mic, Scissors, Zap, Youtube } from "lucide-react";
import { youtube } from "@/lib/api";
import { useStore } from "@/lib/store";

export default function Home(): React.ReactElement {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [progress, setProgress] = useState("");
  const [videoPreview, setVideoPreview] = useState<{id: string; title?: string} | null>(null);
  const { setProject, setLoading } = useStore();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Auto-fill URL from query params and start processing
  useEffect(() => {
    const urlParam = searchParams.get("url");
    if (urlParam) {
      setUrl(urlParam);
      // Extract video ID for preview
      const videoId = extractVideoId(urlParam);
      if (videoId) {
        setVideoPreview({ id: videoId });
      }
    }
  }, [searchParams]);

  const extractVideoId = (url: string): string | null => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  };

  const handleExtract = async (): Promise<void> => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      alert("Please enter a YouTube URL");
      return;
    }
    
    if (!trimmedUrl.includes("youtube.com") && !trimmedUrl.includes("youtu.be")) {
      alert("Please enter a valid YouTube URL");
      return;
    }
    
    setStatus("loading");
    setLoading(true);
    setProgress("Extracting video...");
    
    try {
      const { data } = await youtube.extract(trimmedUrl);
      setProgress("Processing...");
      setProject({
        id: data.project_id,
        videoId: data.video_id,
        title: data.title,
        thumbnail: data.thumbnail,
        duration: data.duration,
        transcript: data.transcript || [],
        clips: [],
        status: "extracted"
      });
      router.push(`/workspace/${data.project_id}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to extract video";
      alert(`Error: ${message}. Please check the URL and try again.`);
      setStatus("idle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="pt-16 pb-20 px-6">
        <div className="container text-center">
          {/* Badge */}
          <div className="badge mb-8 animate-fade-in">
            <Play className="w-3.5 h-3.5 text-red-500" />
            <span>AI Video Analysis</span>
          </div>

          {/* Main Heading - Mobbin style */}
          <h1 className="text-[52px] md:text-[64px] lg:text-[72px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[#1a1a1a] mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            Transform YouTube videos<br />
            into engaging content.
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-[#666] max-w-xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Extract transcripts, generate AI scripts, create clips, and add voiceovers — all in one place.
          </p>

          {/* Video Preview */}
          {videoPreview && (
            <div className="max-w-lg mx-auto mb-8 animate-fade-in" style={{ animationDelay: '0.25s' }}>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="flex gap-4 items-center">
                  <div className="relative w-32 aspect-video rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                    <img 
                      src={`https://img.youtube.com/vi/${videoPreview.id}/mqdefault.jpg`}
                      alt="Video thumbnail"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Youtube className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Selected video</p>
                    <p className="text-sm font-medium text-slate-900 truncate">Ready to transform</p>
                    <button
                      onClick={() => { setUrl(""); setVideoPreview(null); router.replace("/"); }}
                      className="text-xs text-red-600 hover:underline mt-1"
                    >
                      Change video
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-2 w-full max-w-md">
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  const vid = extractVideoId(e.target.value);
                  setVideoPreview(vid ? { id: vid } : null);
                }}
                placeholder="Paste YouTube URL here..."
                className="input flex-1"
                onKeyDown={(e) => e.key === "Enter" && status !== "loading" && handleExtract()}
                disabled={status === "loading"}
              />
              <button 
                onClick={handleExtract} 
                disabled={status === "loading" || !url.trim()}
                className="btn-primary whitespace-nowrap disabled:opacity-50"
              >
                {status === "loading" ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {progress}</>
                ) : (
                  <>Get started <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </div>

          {/* Sub-CTA */}
          <p className="text-sm text-[#999] animate-fade-in" style={{ animationDelay: '0.4s' }}>
            Free to use • No account required • <a href="/projects/new" className="text-purple-600 hover:underline">Or create a custom script →</a>
          </p>
        </div>
      </section>

      {/* Marquee Text Section */}
      <section className="py-8 overflow-hidden bg-[#fafafa] border-y border-[#e5e5e5]">
        <div className="marquee-row mb-4">
          <div className="marquee-track animate-marquee-left">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-8 mr-8">
                <span className="marquee-text">CREATE</span>
                <span className="marquee-dot">●</span>
                <span className="marquee-text">TRANSFORM</span>
                <span className="marquee-dot">●</span>
                <span className="marquee-text">VIRAL</span>
                <span className="marquee-dot">●</span>
                <span className="marquee-text">SHORTS</span>
                <span className="marquee-dot">●</span>
                <span className="marquee-text">AI POWERED</span>
                <span className="marquee-dot">●</span>
              </div>
            ))}
          </div>
        </div>
        <div className="marquee-row">
          <div className="marquee-track animate-marquee-right">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex items-center gap-8 mr-8">
                <span className="marquee-text-outline">REPURPOSE</span>
                <span className="marquee-dot text-red-500">●</span>
                <span className="marquee-text-outline">ENGAGE</span>
                <span className="marquee-dot text-red-500">●</span>
                <span className="marquee-text-outline">GROW</span>
                <span className="marquee-dot text-red-500">●</span>
                <span className="marquee-text-outline">AUTOMATE</span>
                <span className="marquee-dot text-red-500">●</span>
                <span className="marquee-text-outline">SCALE</span>
                <span className="marquee-dot text-red-500">●</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section className="py-20 px-6 bg-white">
        <div className="container">
          <div className="text-center mb-16">
            <span className="inline-block text-xs font-bold tracking-[0.2em] text-red-500 uppercase mb-4">FEATURES</span>
            <h2 className="text-4xl md:text-5xl font-black text-[#1a1a1a] tracking-tight">Everything you need</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {/* Large Card */}
            <div className="md:col-span-2 bg-gradient-to-br from-[#1a1a1a] to-[#333] rounded-2xl p-8 text-white group hover:scale-[1.02] transition-transform">
              <FileText className="w-10 h-10 mb-6 text-red-400" />
              <h3 className="text-2xl font-bold mb-3">AI Transcription</h3>
              <p className="text-gray-400 leading-relaxed">Automatic transcripts with timestamps, speaker detection, and smart segmentation for any YouTube video.</p>
            </div>
            
            {/* Small Card */}
            <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl p-8 text-white group hover:scale-[1.02] transition-transform">
              <Sparkles className="w-10 h-10 mb-6 opacity-80" />
              <h3 className="text-xl font-bold mb-2">Script Generator</h3>
              <p className="text-white/80 text-sm">AI writes viral scripts from your content.</p>
            </div>
            
            {/* Row 2 */}
            <div className="bg-[#fafafa] rounded-2xl p-8 border border-[#e5e5e5] group hover:border-[#1a1a1a] hover:scale-[1.02] transition-all">
              <Scissors className="w-10 h-10 mb-6 text-[#1a1a1a]" />
              <h3 className="text-xl font-bold text-[#1a1a1a] mb-2">Auto Clips</h3>
              <p className="text-[#666] text-sm">Extract the best moments automatically.</p>
            </div>
            
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl p-8 text-white group hover:scale-[1.02] transition-transform">
              <Mic className="w-10 h-10 mb-6 opacity-80" />
              <h3 className="text-xl font-bold mb-2">Voice Synthesis</h3>
              <p className="text-white/80 text-sm">Natural AI voiceovers in multiple voices.</p>
            </div>
            
            <div className="bg-[#1a1a1a] rounded-2xl p-8 text-white group hover:scale-[1.02] transition-transform">
              <Zap className="w-10 h-10 mb-6 text-yellow-400" />
              <h3 className="text-xl font-bold mb-2">Fast Export</h3>
              <p className="text-gray-400 text-sm">Cloud-powered HD video rendering.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-16 px-6">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#1a1a1a] mb-3">How it works</h2>
            <p className="text-[#666]">Three simple steps to transform your content</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <StepCard num="1" title="Paste URL" desc="Drop any YouTube video link" />
            <StepCard num="2" title="AI Analyzes" desc="Get transcripts, summaries, and more" />
            <StepCard num="3" title="Export" desc="Download clips with voiceover" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-[#1a1a1a]">
        <div className="container text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-[#999] mb-8">Transform your first video in under a minute.</p>
          <button 
            onClick={() => document.querySelector("input")?.focus()} 
            className="bg-white text-[#1a1a1a] px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-all inline-flex items-center gap-2"
          >
            Try it free <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </main>
  );
}

function StepCard({ num, title, desc }: { num: string; title: string; desc: string }): React.ReactElement {
  return (
    <div className="text-center">
      <div className="w-12 h-12 bg-[#1a1a1a] text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-4">
        {num}
      </div>
      <h3 className="font-semibold text-[#1a1a1a] mb-2">{title}</h3>
      <p className="text-sm text-[#666]">{desc}</p>
    </div>
  );
}
