"use client";

import React from "react";
import { X, Loader2, Globe, Image, Film, Search } from "lucide-react";

interface StockItem {
  id: string;
  thumbnail: string;
  preview_url?: string;
  url: string;
  width: number;
  height: number;
  duration?: number;
  type: string;
  photographer?: string;
  user?: string;
  qualities?: { label?: string; url: string; width?: number; height?: number; quality?: string }[];
}

interface StockMediaModalProps {
  onClose: () => void;
  stockQuery: string;
  setStockQuery: (val: string) => void;
  stockMediaType: "photos" | "videos";
  setStockMediaType: (val: "photos" | "videos") => void;
  stockResults: StockItem[];
  stockSearching: boolean;
  stockHasMore: boolean;
  loadingMore: boolean;
  downloadingStock: string | null;
  previewItem: StockItem | null;
  selectedQuality: string;
  setSelectedQuality: (val: string) => void;
  onSearch: (loadMore?: boolean) => void;
  onPreview: (item: StockItem) => void;
  onClosePreview: () => void;
  onDownload: (item: StockItem, qualityUrl?: string) => void;
}

export default function StockMediaModal(props: StockMediaModalProps) {
  const {
    onClose, stockQuery, setStockQuery, stockMediaType, setStockMediaType,
    stockResults, stockSearching, stockHasMore, loadingMore, downloadingStock,
    previewItem, selectedQuality, setSelectedQuality, onSearch, onPreview, onClosePreview, onDownload
  } = props;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl w-full max-w-2xl p-5 shadow-2xl max-h-[85vh] flex flex-col">
          <button onClick={onClose} className="absolute top-3 right-3 p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
          
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5 text-teal-500" /> Free Stock Media
            <span className="text-xs font-normal text-slate-400 ml-auto">Powered by Pexels</span>
          </h3>
          
          <div className="flex gap-2 mb-3">
            <button onClick={() => setStockMediaType("photos")} className={`px-3 py-1.5 text-xs rounded-lg font-medium flex items-center gap-1.5 ${stockMediaType === "photos" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"}`}>
              <Image className="w-3.5 h-3.5" /> Photos
            </button>
            <button onClick={() => setStockMediaType("videos")} className={`px-3 py-1.5 text-xs rounded-lg font-medium flex items-center gap-1.5 ${stockMediaType === "videos" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-600"}`}>
              <Film className="w-3.5 h-3.5" /> Videos
            </button>
          </div>

          <div className="flex gap-2 mb-4">
            <input type="text" value={stockQuery} onChange={(e) => setStockQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onSearch(false)} placeholder="Search free images & videos..." className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-teal-400 focus:outline-none" />
            <button onClick={() => onSearch(false)} disabled={stockSearching || !stockQuery.trim()} className="px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
              {stockSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {stockResults.length > 0 ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {stockResults.map((item) => (
                    <div key={item.id} className="relative group aspect-video bg-slate-100 rounded-lg overflow-hidden cursor-pointer" onClick={() => onPreview(item)}>
                      <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                      {item.type === "video" && <span className="absolute top-1 left-1 text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded flex items-center gap-1"><Film className="w-2.5 h-2.5" /> {item.duration}s</span>}
                      <div className="absolute bottom-1 right-1 text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded">{item.width}×{item.height}</div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="text-white text-xs font-medium">Preview</span>
                      </div>
                    </div>
                  ))}
                </div>
                {stockHasMore && (
                  <button onClick={() => onSearch(true)} disabled={loadingMore} className="w-full py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg font-medium flex items-center justify-center gap-2">
                    {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                    {loadingMore ? "Loading..." : "Load More"}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Globe className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Search for free stock {stockMediaType}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {previewItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClosePreview} />
          <div className="relative bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden">
            <button onClick={onClosePreview} className="absolute top-3 right-3 z-10 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white"><X className="w-5 h-5" /></button>

            <div className="flex flex-col md:flex-row">
              <div className="flex-1 bg-black flex items-center justify-center min-h-[300px] max-h-[400px]">
                {previewItem.type === "video" ? (
                  <video src={previewItem.preview_url || previewItem.url} className="max-w-full max-h-full object-contain" controls autoPlay muted />
                ) : (
                  <img src={previewItem.preview_url || previewItem.thumbnail} alt="Preview" className="max-w-full max-h-full object-contain" />
                )}
              </div>

              <div className="w-full md:w-72 p-4 bg-slate-50 flex flex-col">
                <h4 className="font-semibold text-sm mb-1">Media Details</h4>
                <p className="text-xs text-slate-500 mb-3">by {previewItem.photographer || previewItem.user || "Unknown"}</p>

                <div className="space-y-2 text-xs mb-4">
                  <div className="flex justify-between py-1.5 border-b border-slate-200"><span className="text-slate-500">Type</span><span className="font-medium capitalize">{previewItem.type}</span></div>
                  <div className="flex justify-between py-1.5 border-b border-slate-200"><span className="text-slate-500">Resolution</span><span className="font-medium">{previewItem.width} × {previewItem.height}</span></div>
                  {previewItem.type === "video" && <div className="flex justify-between py-1.5 border-b border-slate-200"><span className="text-slate-500">Duration</span><span className="font-medium">{previewItem.duration}s</span></div>}
                </div>

                {previewItem.qualities && previewItem.qualities.length > 0 && (
                  <div className="mb-4">
                    <label className="text-[10px] text-slate-500 mb-1.5 block uppercase tracking-wide">Quality</label>
                    <div className="space-y-1">
                      {previewItem.qualities.map((q, i) => (
                        <button key={i} onClick={() => setSelectedQuality(q.url)}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex justify-between items-center transition-all ${selectedQuality === q.url ? "bg-teal-600 text-white" : "bg-white border border-slate-200 hover:border-teal-400"}`}>
                          <span>{q.label || q.quality || `${q.width}p`}</span>
                          <span className="text-[10px] opacity-75">{q.width}{q.height ? `×${q.height}` : ""}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-auto space-y-2">
                  <button onClick={() => onDownload(previewItem, selectedQuality)} disabled={downloadingStock === String(previewItem.id)}
                    className="w-full py-2.5 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2">
                    {downloadingStock === String(previewItem.id) ? <><Loader2 className="w-4 h-4 animate-spin" /> Downloading...</> : <>Add to Project</>}
                  </button>
                  <button onClick={onClosePreview} className="w-full py-2 text-slate-600 text-sm hover:bg-slate-100 rounded-lg">Cancel</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

