import re
import time
import yt_dlp

class TranscriptService:
    def extract_video_id(self, url: str) -> str:
        patterns = [
            r'(?:v=|\/)([0-9A-Za-z_-]{11}).*',
            r'(?:youtu\.be\/)([0-9A-Za-z_-]{11})',
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)
        raise ValueError("Invalid YouTube URL")
    
    def get_transcript(self, video_id: str) -> list[dict]:
        try:
            url = f"https://youtube.com/watch?v={video_id}"
            opts = {
                "quiet": True,
                "no_warnings": True,
                "writesubtitles": True,
                "writeautomaticsub": True,
                "subtitleslangs": ["en", "en-US", "en-GB"],
                "skip_download": True,
                "cookiefile": "./www.youtube.com_cookies.txt",
            }
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
                
                # Priority: manual English subs > auto English > any translated to English
                subs = info.get("subtitles", {})
                auto_subs = info.get("automatic_captions", {})
                
                # Try manual English first
                for lang in ["en", "en-US", "en-GB"]:
                    if lang in subs:
                        result = self._try_parse_subs(subs[lang])
                        if result:
                            print(f"Found manual {lang} subtitles")
                            return result
                
                # Try auto English
                for lang in ["en", "en-US", "en-GB"]:
                    if lang in auto_subs:
                        result = self._try_parse_subs(auto_subs[lang])
                        if result:
                            print(f"Found auto {lang} subtitles")
                            return result
                
                print(f"No English subtitles found. Available: manual={list(subs.keys())}, auto={list(auto_subs.keys())}")
                return []
                
        except Exception as e:
            print(f"Transcript error: {e}")
            return []
    
    def _try_parse_subs(self, sub_formats: list) -> list[dict]:
        import httpx
        
        for fmt in sub_formats:
            if fmt.get("ext") == "json3":
                url = fmt.get("url", "")
                if not url:
                    continue
                try:
                    time.sleep(0.5)  # Rate limit protection
                    resp = httpx.get(url, timeout=30)
                    if resp.status_code == 429:
                        print("Rate limited, waiting...")
                        time.sleep(2)
                        resp = httpx.get(url, timeout=30)
                    
                    if resp.status_code != 200:
                        continue
                        
                    data = resp.json()
                    result = []
                    for event in data.get("events", []):
                        if "segs" in event:
                            text = "".join(s.get("utf8", "") for s in event["segs"]).strip()
                            if text:
                                result.append({
                                    "start": event.get("tStartMs", 0) / 1000,
                                    "duration": event.get("dDurationMs", 2000) / 1000,
                                    "text": text
                                })
                    if result:
                        return result
                except Exception as e:
                    print(f"Parse error: {e}")
                    continue
        return []
    
    def get_full_text(self, transcript: list[dict]) -> str:
        return " ".join([t["text"] for t in transcript])

