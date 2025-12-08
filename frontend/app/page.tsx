"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Play, FileText, Sparkles, Mic, MessageSquare, Scissors, Zap, BookOpen, Globe, Cpu, Microscope, History, MapPin, Film, Lightbulb } from "lucide-react";
import { youtube } from "@/lib/api";
import { useStore } from "@/lib/store";

const TRUSTED_LOGOS = ["YouTube", "TikTok", "Instagram", "Reels", "Shorts"];

const VIDEO_CATEGORIES = [
  {
    id: "documentary",
    name: "Documentaries",
    icon: Film,
    color: "bg-red-500",
    desc: "Nature, wildlife, history docs",
    videos: [
      { title: "Inside the World's Largest Cave", id: "87Jor5G_NBs", channel: "Real Science", duration: "16:42" },
      { title: "How Deep Is The Ocean Really", id: "PaErPyEnDvk", channel: "RealLifeLore", duration: "12:10" },
      { title: "The Most Dangerous Place on Earth", id: "kO-FS9V0q0w", channel: "Aperture", duration: "21:34" },
    ]
  },
  {
    id: "science",
    name: "Science & Space",
    icon: Microscope,
    color: "bg-purple-500",
    desc: "Physics, astronomy, biology",
    videos: [
      { title: "Why Black Holes Could Delete The Universe", id: "yWO-cvGETRQ", channel: "Kurzgesagt", duration: "10:05" },
      { title: "What If Earth Got Kicked Out of Solar System", id: "gLZJlf5rHVs", channel: "Kurzgesagt", duration: "10:14" },
      { title: "The Largest Black Hole in the Universe", id: "0FH9cgRhQ-k", channel: "Kurzgesagt", duration: "11:52" },
    ]
  },
  {
    id: "tech",
    name: "Tech Explained",
    icon: Cpu,
    color: "bg-blue-500",
    desc: "AI, gadgets, innovations",
    videos: [
      { title: "How AI Image Generators Work", id: "1CIpzeNxIhU", channel: "Vox", duration: "8:42" },
      { title: "The Insane Engineering of the SR-71", id: "3hYSnyVLmGE", channel: "Real Engineering", duration: "16:21" },
      { title: "How Does a Quantum Computer Work?", id: "g_IaVepNDT4", channel: "Veritasium", duration: "12:05" },
    ]
  },
  {
    id: "history",
    name: "History & Culture",
    icon: History,
    color: "bg-amber-500",
    desc: "Ancient civilizations, events",
    videos: [
      { title: "The Rise and Fall of the Roman Empire", id: "oPf27gAup9U", channel: "Kings and Generals", duration: "24:15" },
      { title: "How Egypt Built the Pyramids", id: "lotbZQ55SgU", channel: "History Channel", duration: "18:30" },
      { title: "The Lost City of Atlantis", id: "U5kEzxOb-3c", channel: "History Explained", duration: "14:22" },
    ]
  },
  {
    id: "geography",
    name: "Geography & Travel",
    icon: MapPin,
    color: "bg-green-500",
    desc: "Countries, landscapes, cultures",
    videos: [
      { title: "Why 94% of China Lives East of This Line", id: "OhNJP1t4xEA", channel: "RealLifeLore", duration: "9:15" },
      { title: "The Country With 7000 Islands", id: "P5aIDGLG9jE", channel: "Geography Now", duration: "15:42" },
      { title: "Why Nobody Lives in These Countries", id: "L9REjkKLYHU", channel: "RealLifeLore", duration: "11:08" },
    ]
  },
  {
    id: "educational",
    name: "Educational",
    icon: BookOpen,
    color: "bg-indigo-500",
    desc: "TED talks, explainers, learning",
    videos: [
      { title: "How to Speak So People Want to Listen", id: "eIho2S0ZahI", channel: "TED", duration: "9:58" },
      { title: "The Psychology of Money", id: "TJDcGv5Lx-I", channel: "Ali Abdaal", duration: "22:15" },
      { title: "Why We Procrastinate", id: "arj7oStGLkU", channel: "TED-Ed", duration: "5:25" },
    ]
  },
];

export default function Home(): React.ReactElement {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [progress, setProgress] = useState("");
  const { setProject, setLoading } = useStore();
  const router = useRouter();

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

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center gap-2 w-full max-w-md">
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
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
            Free to use • No account required
          </p>
        </div>
      </section>

      {/* Trusted By - Logo Strip */}
      <section className="py-8 border-y border-[#e5e5e5] bg-[#fafafa]">
        <div className="container">
          <p className="text-center text-sm text-[#999] mb-6">Perfect for creating content on</p>
          <div className="flex items-center justify-center gap-10 flex-wrap">
            {TRUSTED_LOGOS.map((name) => (
              <span key={name} className="text-[#999] font-semibold text-sm tracking-wide">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section - Mobbin style */}
      <section className="py-16 px-6">
        <div className="container">
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto text-center">
            <div>
              <div className="text-4xl font-bold text-[#1a1a1a] mb-1">10x</div>
              <div className="text-sm text-[#666]">Faster creation</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#1a1a1a] mb-1">HD</div>
              <div className="text-sm text-[#666]">Video quality</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-[#1a1a1a] mb-1">AI</div>
              <div className="text-sm text-[#666]">Powered tools</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid - Mobbin style */}
      <section className="py-16 px-6 bg-[#fafafa]">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#1a1a1a] mb-3">Everything you need</h2>
            <p className="text-[#666]">Powerful AI tools for content creators</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            <FeatureCard 
              icon={<FileText className="w-5 h-5" />}
              title="Smart Transcription"
              desc="Get accurate transcripts with speaker detection and timestamps"
            />
            <FeatureCard 
              icon={<Sparkles className="w-5 h-5" />}
              title="AI Summaries"
              desc="Generate scripts and summaries in seconds"
            />
            <FeatureCard 
              icon={<MessageSquare className="w-5 h-5" />}
              title="Ask AI"
              desc="Chat about video content and get instant answers"
            />
            <FeatureCard 
              icon={<Scissors className="w-5 h-5" />}
              title="Auto Clips"
              desc="Extract key moments automatically"
            />
            <FeatureCard 
              icon={<Mic className="w-5 h-5" />}
              title="Voice Over"
              desc="Generate natural AI narration"
            />
            <FeatureCard 
              icon={<Zap className="w-5 h-5" />}
              title="Fast Export"
              desc="Cloud-powered video rendering"
            />
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

      {/* Discover Videos Section */}
      <DiscoverSection url={url} setUrl={setUrl} onExtract={handleExtract} status={status} />

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

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }): React.ReactElement {
  return (
    <div className="card">
      <div className="w-10 h-10 bg-[#f5f5f5] rounded-lg flex items-center justify-center mb-4 text-[#1a1a1a]">
        {icon}
      </div>
      <h3 className="font-semibold text-[#1a1a1a] mb-2">{title}</h3>
      <p className="text-sm text-[#666]">{desc}</p>
    </div>
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

interface DiscoverProps {
  url: string;
  setUrl: (url: string) => void;
  onExtract: () => void;
  status: "idle" | "loading";
}

function DiscoverSection({ setUrl, onExtract }: DiscoverProps): React.ReactElement {
  const [activeCategory, setActiveCategory] = useState(VIDEO_CATEGORIES[0].id);
  const category = VIDEO_CATEGORIES.find(c => c.id === activeCategory) || VIDEO_CATEGORIES[0];

  const handleVideoClick = (videoId: string) => {
    setUrl(`https://www.youtube.com/watch?v=${videoId}`);
    onExtract();
  };

  return (
    <section className="py-20 px-6 bg-gradient-to-b from-[#fafafa] to-white">
      <div className="container">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <Lightbulb className="w-4 h-4" />
            Best for Short Videos
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] mb-3">Discover trending videos</h2>
          <p className="text-[#666] max-w-lg mx-auto">Curated educational content perfect for creating engaging short-form videos and summaries</p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {VIDEO_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeCategory === cat.id
                    ? `${cat.color} text-white shadow-lg scale-105`
                    : 'bg-white text-[#666] border border-[#e5e5e5] hover:border-[#ccc] hover:shadow'
                }`}
              >
                <Icon className="w-4 h-4" />
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Category Description */}
        <p className="text-center text-sm text-[#999] mb-6">{category.desc}</p>

        {/* Video Grid */}
        <div className="grid md:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {category.videos.map((video) => (
            <div
              key={video.id}
              onClick={() => handleVideoClick(video.id)}
              className="group cursor-pointer bg-white rounded-xl overflow-hidden border border-[#e5e5e5] hover:border-[#ccc] hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className="relative aspect-video bg-[#1a1a1a]">
                <img
                  src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                  <div className="w-14 h-14 bg-white/95 rounded-full flex items-center justify-center shadow-lg">
                    <Play className="w-6 h-6 text-[#1a1a1a] ml-1" fill="currentColor" />
                  </div>
                </div>
                <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded font-medium">
                  {video.duration}
                </span>
              </div>
              <div className="p-4">
                <h4 className="font-semibold text-[#1a1a1a] text-sm mb-1.5 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {video.title}
                </h4>
                <p className="text-xs text-[#999]">{video.channel}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tip */}
        <div className="mt-10 text-center">
          <p className="text-sm text-[#666] bg-[#f5f5f5] inline-block px-5 py-3 rounded-lg">
            💡 <strong>Tip:</strong> Documentaries, explainers, and educational videos work best for creating engaging short summaries
          </p>
        </div>
      </div>
    </section>
  );
}
