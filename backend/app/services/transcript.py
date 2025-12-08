import re
import json
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
                "subtitleslangs": ["en"],
                "skip_download": True,
            }
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
                subs = info.get("automatic_captions", {}) or info.get("subtitles", {})
                if "en" in subs:
                    for fmt in subs["en"]:
                        if fmt.get("ext") == "json3":
                            return self._parse_json3(fmt.get("url", ""))
                return []
        except Exception as e:
            print(f"Transcript error: {e}")
            return []
    
    def _parse_json3(self, url: str) -> list[dict]:
        import httpx
        try:
            resp = httpx.get(url, timeout=30)
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
            return result
        except:
            return []
    
    def get_full_text(self, transcript: list[dict]) -> str:
        return " ".join([t["text"] for t in transcript])

