"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Loader2, Play, FileText, Mic, Scissors, Zap, Youtube, Image, Music, Wand2, MessageSquare, Type } from "lucide-react";
import { youtube } from "@/lib/api";
import { useStore } from "@/lib/store";
import Navbar from "@/components/Navbar";

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
    <>
      <Navbar />
      <main className="min-h-screen bg-white">
        {/* Hero Section */}
      <section className="pt-24 pb-20 px-6">
        <div className="container text-center">
          {/* Badge */}
          <div className="badge mb-8 animate-fade-in">
            <Play className="w-3.5 h-3.5 text-red-500" />
            <span>AI Video Analysis</span>
          </div>

          {/* Main Heading - Mobbin style */}
          <h1 className="text-[52px] md:text-[64px] lg:text-[72px] font-extrabold leading-[1.05] tracking-[-0.02em] text-[#1a1a1a] mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
            AI-powered video <br /> creation studio.
          </h1>

          {/* Subtitle */}
          <p className="text-lg text-[#666] max-w-xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            Generate scripts, voiceovers, thumbnails, and full videos — from YouTube or your own ideas.
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
                <span className="marquee-text">SCRIPTS</span>
                <span className="marquee-dot">●</span>
                <span className="marquee-text">VOICEOVER</span>
                <span className="marquee-dot">●</span>
                <span className="marquee-text">THUMBNAILS</span>
                <span className="marquee-dot">●</span>
                <span className="marquee-text">SUBTITLES</span>
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
                <span className="marquee-text-outline">YOUTUBE</span>
                <span className="marquee-dot text-red-500">●</span>
                <span className="marquee-text-outline">SHORTS</span>
                <span className="marquee-dot text-red-500">●</span>
                <span className="marquee-text-outline">MUSIC</span>
                <span className="marquee-dot text-red-500">●</span>
                <span className="marquee-text-outline">DIALOGUE</span>
                <span className="marquee-dot text-red-500">●</span>
                <span className="marquee-text-outline">EXPORT</span>
                <span className="marquee-dot text-red-500">●</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6">
        <div className="container">
          <div className="text-center mb-14">
            <p className="text-sm text-[#888] mb-3">What you get</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a1a]">Everything you need</h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <FeatureCard 
              icon={<Wand2 className="w-5 h-5" />}
              title="AI Script Writer"
              desc="Generate scripts from any topic or prompt instantly."
            />
            <FeatureCard 
              icon={<Mic className="w-5 h-5" />}
              title="Voice Synthesis"
              desc="Natural AI voices with 20+ styles and languages."
            />
            <FeatureCard 
              icon={<Image className="w-5 h-5" />}
              title="AI Thumbnails"
              desc="Generate eye-catching thumbnails with Gemini & DALL-E."
            />
            <FeatureCard 
              icon={<Type className="w-5 h-5" />}
              title="Animated Subtitles"
              desc="12+ subtitle styles: karaoke, neon, fire, glitch & more."
            />
            <FeatureCard 
              icon={<Music className="w-5 h-5" />}
              title="Background Music"
              desc="AI-generated music tracks for any mood."
            />
            <FeatureCard 
              icon={<MessageSquare className="w-5 h-5" />}
              title="Dialogue Mode"
              desc="Two-speaker videos with speech bubbles."
            />
            <FeatureCard 
              icon={<Youtube className="w-5 h-5" />}
              title="YouTube Import"
              desc="Extract and repurpose any YouTube video."
            />
            <FeatureCard 
              icon={<Scissors className="w-5 h-5" />}
              title="Auto Clips"
              desc="Extract the best moments automatically."
            />
            <FeatureCard 
              icon={<Zap className="w-5 h-5" />}
              title="Fast Export"
              desc="Cloud-powered HD video rendering."
            />
          </div>
        </div>
      </section>

      {/* How it Works - Visual Flow */}
      <section className="py-20 px-6 bg-gradient-to-b from-white to-[#fafafa]">
        <div className="container max-w-5xl">
          <div className="text-center mb-16">
            <p className="text-sm text-[#888] mb-3">How it works</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a1a]">Create in seconds</h2>
          </div>

          {/* Single Flow */}
          <div className="relative">
            {/* Connection Line */}
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-[2px] bg-gradient-to-r from-red-200 via-[#e5e5e5] to-purple-200" />
            
            <div className="grid md:grid-cols-4 gap-8 md:gap-4">
              <FlowStep 
                num="01"
                icon={<Youtube className="w-5 h-5" />}
                color="red"
                title="Input"
                desc="Paste YouTube URL or describe your idea"
              />
              <FlowStep 
                num="02"
                icon={<FileText className="w-5 h-5" />}
                color="gray"
                title="Script"
                desc="AI extracts or generates your script"
              />
              <FlowStep 
                num="03"
                icon={<Mic className="w-5 h-5" />}
                color="gray"
                title="Voice & Media"
                desc="Add voiceover, music, thumbnails"
              />
              <FlowStep 
                num="04"
                icon={<Zap className="w-5 h-5" />}
                color="purple"
                title="Export"
                desc="Download HD video ready to publish"
              />
            </div>
          </div>

        </div>
      </section>

      {/* Demo Video Section */}
      <section className="py-20 px-6 bg-white">
        <div className="container max-w-5xl">
          <div className="text-center mb-10">
            <div className="badge mb-4">
              <Play className="w-3.5 h-3.5 text-red-500" />
              <span>Watch Demo</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] mb-3">See it in action</h2>
            <p className="text-[#666] max-w-lg mx-auto">Watch how easy it is to create professional videos with GoInsights</p>
          </div>

          <div className="relative w-full max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-2xl bg-black">
            <div className="aspect-video">
              <iframe
                src="https://www.youtube.com/embed/sWpq0i_NtaU?rel=0&modestbranding=1"
                title="GoInsights Demo - How to use"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
          </div>

          <p className="text-center text-sm text-[#888] mt-6">
            Create your first video in under 2 minutes
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6 bg-[#f5f5f5]">
        <div className="container text-center">
          <h2 className="text-2xl font-bold text-[#1a1a1a] mb-3">Ready to get started?</h2>
          <p className="text-[#666] mb-6 text-sm">Transform your first video in under a minute.</p>
          <button 
            onClick={() => document.querySelector("input")?.focus()} 
            className="btn-primary"
          >
            Try it free <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
      </main>
    </>
  );
}

function FlowStep({ num, icon, color, title, desc }: { num: string; icon: React.ReactNode; color: string; title: string; desc: string }): React.ReactElement {
  const colorMap: Record<string, string> = {
    red: "bg-red-500 text-white",
    purple: "bg-purple-600 text-white",
    gray: "bg-white text-[#1a1a1a] border border-[#eee]"
  };
  return (
    <div className="relative flex flex-col items-center text-center">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${colorMap[color]}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold text-[#ccc] tracking-wider mb-1">{num}</span>
      <h4 className="font-semibold text-[#1a1a1a] text-sm mb-1">{title}</h4>
      <p className="text-xs text-[#888] leading-relaxed">{desc}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }): React.ReactElement {
  return (
    <div className="p-5 rounded-xl bg-[#fafafa] hover:bg-[#f5f5f5] transition-colors">
      <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center text-[#1a1a1a] mb-4 border border-[#eee]">
        {icon}
      </div>
      <h3 className="font-semibold text-[#1a1a1a] mb-1">{title}</h3>
      <p className="text-sm text-[#666] leading-relaxed">{desc}</p>
    </div>
  );
}
