"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import ReactPlayer from "react-player";
import { Clock, Sparkles, Loader2, FileText, Play, RefreshCw, Video, Scissors, ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { ai, voice, video, projects, script } from "@/lib/api";
import { useWorkspace } from "@/lib/useWorkspace";
import type { Voice } from "@/lib/types";
import VoiceSettings from "@/components/workspace/VoiceSettings";
import SegmentList from "@/components/workspace/SegmentList";
import CustomScriptEditor from "@/components/workspace/CustomScriptEditor";
import MergeOptionsStep from "@/components/workspace/MergeOptionsStep";
import FinalVideoSection from "@/components/workspace/FinalVideoSection";
import MusicSheet from "@/components/workspace/MusicSheet";
import WikipediaStep from "@/components/workspace/WikipediaStep";
import { ProcessingIndicator } from "@/components/Toast";

export default function Workspace(): React.ReactElement {
  const { id } = useParams();
  const ws = useWorkspace(id as string);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState("aria");
  const [selectedModel, setSelectedModel] = useState("v2");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [playingDemo, setPlayingDemo] = useState<string | null>(null);
  const demoAudioRef = useRef<HTMLAudioElement | null>(null);
  const [speed, setSpeed] = useState(1.0);
  const [stability, setStability] = useState(0.5);
  const [targetDuration, setTargetDuration] = useState(120);
  const [language, setLanguage] = useState("English");
  const [playingPreset, setPlayingPreset] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { 
    if (id) {
      ws.loadProject();
      const animPref = localStorage.getItem("animated_subtitles");
      if (animPref !== null) ws.setMergeOptions(p => ({ ...p, animatedSubtitles: animPref === "true" }));
      const savedStep = localStorage.getItem(`step_${id}`);
      if (savedStep) ws.setStep(savedStep as "script" | "segments" | "options");
    }
  }, [id]);

  useEffect(() => {
    if (ws.project?.language) {
      setLanguage(ws.project.language);
    } else {
      const savedLang = localStorage.getItem("preferred_language");
      if (savedLang) setLanguage(savedLang);
    }
  }, [ws.project?.language]);

  const handleLanguageChange = async (lang: string) => {
    setLanguage(lang);
    localStorage.setItem("preferred_language", lang);
    if (id) {
      try { await projects.update(id as string, { language: lang }); } catch {}
    }
  };

  const handleStepChange = (newStep: "script" | "segments" | "options") => {
    ws.setStep(newStep);
    localStorage.setItem(`step_${id}`, newStep);
  };

  useEffect(() => {
    voice.getVoices().then(({ data }) => setVoices(data.voices || [])).catch(() => {});
  }, []);

  const playVoiceDemo = async (voiceId: string) => {
    if (demoAudioRef.current) { demoAudioRef.current.pause(); demoAudioRef.current = null; }
    if (playingDemo === voiceId) { setPlayingDemo(null); return; }
    setPlayingDemo(voiceId);
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    const audio = new Audio(`${baseUrl}/voice/voice-demo/${voiceId}`);
    demoAudioRef.current = audio;
    audio.onended = () => setPlayingDemo(null);
    audio.onerror = () => setPlayingDemo(null);
    audio.play();
  };

  const handleScript = async () => {
    if (!ws.project?.id) return;
    ws.setProcessing(`Generating ${targetDuration}s script in ${language}...`);
    try {
      const { data } = await ai.script(ws.project.id, targetDuration, language);
      ws.updateProject({ script: data.script });
      if (data.segments?.length > 0) {
        const aiSegments = data.segments.map((s: any) => ({
          text: s.text, start: s.start || 0, end: s.end || 8, sourceStart: s.source_start || 0, sourceEnd: s.source_end || 10,
          audioGenerated: false, clipExtracted: false, timestamp: Date.now(), voiceId: s.voice_id || "aria", duration: s.duration || 8
        }));
        ws.setSegments(aiSegments);
      }
      handleStepChange("segments");
    } catch {}
    ws.setProcessing("");
  };

  const handlePreviewMusic = async (presetId: string) => {
    if (playingPreset === presetId) { audioRef.current?.pause(); setPlayingPreset(null); return; }
    const preset = ws.musicPresets.find(p => p.id === presetId);
    if (!preset?.cached) setLoadingPreview(presetId);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = video.musicPreview(presetId);
      audioRef.current.oncanplay = () => { setLoadingPreview(null); };
      audioRef.current.play().catch(() => setLoadingPreview(null));
      setPlayingPreset(presetId);
    }
  };

  const handleSmartMatchMedia = async () => {
    if (!ws.project?.id) return;
    ws.setProcessing("smart-match");
    try {
      await script.reassignMedia(ws.project.id);
      await ws.loadProject();
    } catch {}
    ws.setProcessing("");
  };
  
  if (!ws.project) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-slate-900" />
        <span className="text-sm text-slate-500">Loading project...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 fixed top-0 left-0 right-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-slate-500" />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold text-slate-900 truncate max-w-sm">{ws.project.title}</h1>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  ws.projectType === "ads" ? "bg-orange-100 text-orange-600" : 
                  ws.projectType === "custom" ? "bg-purple-100 text-purple-600" :
                  ws.projectType === "wikipedia" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"
                }`}>
                  {ws.projectType === "ads" ? "Ads" : ws.projectType === "custom" ? "Custom" : ws.projectType === "wikipedia" ? "Wikipedia" : "YouTube"}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {ws.project.duration ? `${ws.project.duration}s` : ""}
                {ws.project.duration && ws.project.videoId ? " • " : ""}
                {ws.project.videoId || ((ws.projectType === "custom" || ws.projectType === "ads") ? "Script-based project" : "")}
              </p>
            </div>
          </div>
          {ws.project.status === "completed" && (
            <a href={video.downloadFinal(ws.project.id)} className="btn-primary text-sm">
              <Download className="w-4 h-4" /> Download
            </a>
          )}
        </div>
      </header>
      
      <div className="pt-32 max-w-6xl mx-auto px-6 pb-6">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {ws.projectType === "youtube" ? (
            <div className="card p-0 overflow-hidden">
              <div className="aspect-video bg-black">
                  <ReactPlayer url={`https://youtube.com/watch?v=${ws.project.videoId}`} width="100%" height="100%" controls
                  onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)} />
              </div>
                <div className="p-3 bg-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Current: {Math.floor(currentTime)}s</span>
                  <button onClick={ws.handleDownloadVideo} disabled={ws.videoDownloaded || !!ws.processing}
                    className={`btn-secondary text-xs ${ws.videoDownloaded ? "bg-green-100 text-green-700" : ""}`}>
                    <Video className="w-3.5 h-3.5" /> {ws.videoDownloaded ? "Downloaded ✓" : "Download Video"}
                </button>
              </div>
            </div>
            ) : ws.projectType === "wikipedia" ? (
              <div className="card p-6 bg-gradient-to-br from-emerald-50 to-teal-50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-100">
                    <FileText className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">Wikipedia Documentary</h3>
                    <p className="text-xs text-slate-500">Historical content video</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white p-3 rounded-lg">
                    <span className="text-2xl font-bold text-emerald-600">{ws.segments.length}</span>
                    <p className="text-xs text-slate-500">Segments</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <span className="text-2xl font-bold text-teal-600">{ws.mediaAssets.length}</span>
                    <p className="text-xs text-slate-500">Images</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className={`card p-6 bg-gradient-to-br ${ws.projectType === "ads" ? "from-orange-50 to-amber-50" : "from-purple-50 to-blue-50"}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${ws.projectType === "ads" ? "bg-orange-100" : "bg-purple-100"}`}>
                    <Sparkles className={`w-6 h-6 ${ws.projectType === "ads" ? "text-orange-600" : "text-purple-600"}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{ws.projectType === "ads" ? "Ads / Promo Project" : "Custom Script Project"}</h3>
                    <p className="text-xs text-slate-500">{ws.projectType === "ads" ? "Create promotional content" : "Create video from scratch"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="bg-white p-3 rounded-lg">
                    <span className={`text-2xl font-bold ${ws.projectType === "ads" ? "text-orange-600" : "text-purple-600"}`}>{ws.segments.length}</span>
                    <p className="text-xs text-slate-500">Segments</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg">
                    <span className="text-2xl font-bold text-blue-600">{ws.mediaAssets.length}</span>
                    <p className="text-xs text-slate-500">Media</p>
                  </div>
                </div>
              </div>
            )}

            {ws.step !== "script" && (
              <VoiceSettings voices={voices} selectedVoice={selectedVoice} onSelectVoice={setSelectedVoice}
                selectedModel={selectedModel} onSelectModel={setSelectedModel} speed={speed} onSpeedChange={setSpeed}
                stability={stability} onStabilityChange={setStability} playingDemo={playingDemo} onPlayDemo={playVoiceDemo} />
            )}
          </div>

          <div className="space-y-4">
            <ProcessingIndicator message={ws.processing} />

            {ws.step === "script" && (ws.projectType === "custom" || ws.projectType === "ads") && (
              <CustomScriptEditor projectId={ws.project.id} initialPrompt={ws.project.prompt} initialScript={ws.project.script}
                initialDuration={ws.project.duration} initialVideoStyle={ws.project.video_style}
                language={language} onLanguageChange={handleLanguageChange}
                onScriptGenerated={(script, segs) => {
                  ws.updateProject({ script });
                  const newSegments = segs.map((s: any) => ({
                    text: s.text, displayText: s.display_text || s.text, speaker: s.speaker || "", start: s.start || 0, end: s.end || 8,
                    sourceStart: 0, sourceEnd: 0, audioGenerated: false, clipExtracted: true, timestamp: Date.now(),
                    voiceId: s.voice_id || "aria", duration: s.duration || 8
                  }));
                  ws.setSegments(newSegments);
                  handleStepChange("segments");
                }} />
            )}

            {ws.step === "script" && ws.projectType === "wikipedia" && (
              <WikipediaStep projectId={ws.project.id} wikiData={ws.project.wiki_data || null}
                mediaAssets={ws.mediaAssets} language={language} projectDuration={ws.project.duration || 60}
                onLanguageChange={handleLanguageChange}
                processing={ws.processing} setProcessing={ws.setProcessing}
                onMediaUpdated={ws.loadProject}
                onScriptGenerated={(script, segs) => {
                  ws.updateProject({ script });
                  ws.setSegments(segs);
                  handleStepChange("segments");
                }} />
            )}

            {ws.step === "script" && ws.projectType === "youtube" && (
              <div className="card">
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> Step 1: Generate Script</h3>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-slate-500 block mb-2">Target Duration</label>
                    <div className="flex flex-wrap gap-2">
                      {[60, 120, 180, 300, 600].map(d => (
                        <button key={d} onClick={() => setTargetDuration(d)}
                          className={`py-1.5 px-2.5 rounded-lg text-xs font-medium transition-all ${
                            targetDuration === d ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}>
                          {d < 60 ? `${d}s` : `${Math.floor(d / 60)}m`}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 block mb-2">Output Language</label>
                    <select value={language} onChange={(e) => handleLanguageChange(e.target.value)}
                      className="w-full py-2 px-3 rounded-lg text-sm border border-slate-200 focus:border-slate-400 focus:outline-none bg-white">
                      <option value="English">🇺🇸 English</option>
                      <option value="Spanish">🇪🇸 Spanish</option>
                      <option value="Bengali">🇧🇩 Bengali</option>
                      <option value="Hindi">🇮🇳 Hindi</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  Original: {Math.floor((ws.project.duration || 0) / 60)}m {(ws.project.duration || 0) % 60}s → Output: {Math.floor(targetDuration / 60)}m {targetDuration % 60}s
                </p>
                {ws.project.script ? (
                  <div className="space-y-3">
                    <div className="bg-slate-100 rounded-lg p-3 max-h-40 overflow-auto">
                      <p className="text-xs text-slate-900 whitespace-pre-wrap">{ws.project.script}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleScript} disabled={!!ws.processing} className="btn-secondary flex-1">
                        <RefreshCw className="w-4 h-4" /> Regenerate
                      </button>
                      <button onClick={() => handleStepChange("segments")} className="btn-primary flex-1">Continue →</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={handleScript} disabled={!!ws.processing} className="btn-primary w-full">
                    <Sparkles className="w-4 h-4" /> Generate Script
                  </button>
                )}
              </div>
            )}

            {ws.step === "segments" && (
              <>
                <SegmentList
                  projectId={ws.project.id}
                  projectType={ws.projectType}
                  segments={ws.segments}
                  voices={voices}
                  mediaAssets={ws.mediaAssets}
                  selectedVoice={selectedVoice}
                  language={language}
                  videoDownloaded={ws.videoDownloaded}
                  generatingIndex={ws.generatingIndex}
                  extractingIndex={ws.extractingIndex}
                  previewClip={ws.previewClip}
                  script={ws.project.script}
                  saving={ws.saving}
                  lastSaved={ws.lastSaved}
                  processing={ws.processing}
                  onSegmentUpdate={ws.handleUpdateSegment}
                  onBatchUpdateSegments={ws.handleBatchUpdateSegments}
                  onAddSegment={(pos) => ws.handleAddSegment(pos, currentTime, selectedVoice)}
                  onRemoveSegment={ws.handleRemoveSegment}
                  onMoveSegment={ws.handleMoveSegment}
                  onGenerateAudio={(i) => ws.handleGenerateSegment(i, ws.segments[i].voiceId || selectedVoice, speed, stability, selectedModel)}
                  onExtractClip={ws.handleExtractClip}
                  onExtractAllClips={ws.handleExtractAllClips}
                  onGenerateAll={() => ws.handleGenerateAll(selectedVoice, speed, stability, selectedModel)}
                  onPreviewToggle={(i) => ws.setPreviewClip(ws.previewClip === i ? null : i)}
                  onMediaChange={ws.setMediaAssets}
                  onAutoDistributeMedia={ws.handleAutoDistributeMedia}
                  onAutoDistributeEffects={ws.handleAutoDistributeEffects}
                  onApplyVoiceToAll={ws.handleApplyVoiceToAll}
                  onApplySilenceToAll={ws.handleApplySilenceToAll}
                  onSaveNow={ws.saveSegmentsNow}
                  onSmartMatchMedia={handleSmartMatchMedia}
                />
                <button onClick={() => handleStepChange("options")} disabled={!ws.allAudioGenerated || (ws.projectType === "youtube" && !ws.allClipsExtracted)}
                  className="btn-primary w-full disabled:opacity-50">
                  Continue to Options →
                </button>
              </>
            )}

            {ws.step === "options" && (
              <>
                <MergeOptionsStep mergeOptions={ws.mergeOptions} setMergeOptions={ws.setMergeOptions} musicPresets={ws.musicPresets}
                  onOpenMusicSheet={ws.handleOpenMusicSheet} onRemoveMusic={() => ws.setMergeOptions(p => ({ ...p, bgMusic: "" }))}
                  onMergeAll={ws.handleMergeAll} processing={ws.processing} videoDownloaded={ws.videoDownloaded} projectType={ws.projectType} />
                <FinalVideoSection projectId={ws.project.id} projectStatus={ws.project.status} language={language} script={ws.project.script || ""}
                  onGeneratePrompt={ws.handleGeneratePrompt} onGenerateThumbnailFromPrompt={ws.handleGenerateThumbnailFromPrompt}
                  onUploadThumbnail={ws.handleUploadThumbnail} onGenerateYoutubeInfo={() => ws.handleGenerateYoutubeInfo(language)} processing={ws.processing}
                  thumbnailPrompt={ws.thumbnailPrompt} setThumbnailPrompt={ws.setThumbnailPrompt}
                  thumbnailTitle={ws.thumbnailTitle} setThumbnailTitle={ws.setThumbnailTitle} thumbnailGenerated={ws.thumbnailGenerated}
                  thumbnailModel={ws.thumbnailModel} setThumbnailModel={ws.setThumbnailModel} youtubeInfo={ws.youtubeInfo}
                  setYoutubeInfo={ws.setYoutubeInfo} showFinalPreview={ws.showFinalPreview} setShowFinalPreview={ws.setShowFinalPreview}
                  finalVideoTimestamp={ws.finalVideoTimestamp} mediaAssets={ws.mediaAssets} onSelectMediaAsThumbnail={ws.handleSelectMediaAsThumbnail} />
              </>
            )}

            <div className="flex gap-2">
              {ws.step !== "script" && <button onClick={() => handleStepChange("script")} className="btn-secondary flex-1 text-xs">← Script</button>}
              {ws.step === "script" && ws.segments.length > 0 && <button onClick={() => handleStepChange("segments")} className="btn-secondary flex-1 text-xs">Segments →</button>}
              {ws.step === "segments" && ws.allAudioGenerated && <button onClick={() => handleStepChange("options")} className="btn-secondary flex-1 text-xs">Options →</button>}
            </div>
          </div>
        </div>
      </div>

      <audio ref={audioRef} onEnded={() => setPlayingPreset(null)} />
      <MusicSheet isOpen={ws.showMusicSheet} onClose={() => { audioRef.current?.pause(); setPlayingPreset(null); ws.setShowMusicSheet(false); }}
        musicPresets={ws.musicPresets} selectedMusic={ws.mergeOptions.bgMusic} onSelect={(id) => ws.setMergeOptions(p => ({ ...p, bgMusic: id }))}
        playingPreset={playingPreset} loadingPreview={loadingPreview} onPreview={handlePreviewMusic} projectId={ws.project.id} />
    </div>
  );
}
