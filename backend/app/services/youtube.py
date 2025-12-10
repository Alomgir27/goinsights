import yt_dlp
import asyncio
from typing import Optional
from app.services.transcript import TranscriptService
from app.services.assemblyai import AssemblyAIService
from app.config import get_settings

class YouTubeService:
    def __init__(self):
        self.transcript_service = TranscriptService()
        self.assemblyai = AssemblyAIService()
        self.cookies_file = "./www.youtube.com_cookies.txt"
        self.ydl_opts = {"quiet": True, "no_warnings": True, "extract_flat": False, "cookiefile": self.cookies_file}
    
    def get_video_info(self, url: str) -> dict:
        """Get basic video info from YouTube"""
        video_id = self.transcript_service.extract_video_id(url)
        
        with yt_dlp.YoutubeDL(self.ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
        
        # Try to get basic transcript from YouTube first
        transcript = self.transcript_service.get_transcript(video_id)
        
        return {
            "video_id": video_id,
            "title": info.get("title", ""),
            "description": info.get("description", ""),
            "thumbnail": info.get("thumbnail", ""),
            "duration": info.get("duration", 0),
            "channel": info.get("channel", ""),
            "channel_id": info.get("channel_id", ""),
            "view_count": info.get("view_count", 0),
            "like_count": info.get("like_count", 0),
            "upload_date": info.get("upload_date", ""),
            "categories": info.get("categories", []),
            "tags": info.get("tags", []),
            "transcript": transcript,
            "full_text": self.transcript_service.get_full_text(transcript),
            "audio_url": self._get_audio_url(info)
        }
    
    def _get_audio_url(self, info: dict) -> Optional[str]:
        """Extract best audio URL from video info"""
        formats = info.get("formats", [])
        audio_formats = [f for f in formats if f.get("acodec") != "none" and f.get("vcodec") == "none"]
        if audio_formats:
            return audio_formats[-1].get("url")
        # Fallback to best format with audio
        for f in reversed(formats):
            if f.get("acodec") != "none":
                return f.get("url")
        return None
    
    async def get_detailed_transcription(self, url: str) -> dict:
        """Get detailed transcription using AssemblyAI with speaker diarization"""
        # First get basic video info
        video_info = self.get_video_info(url)
        audio_url = video_info.get("audio_url")
        
        if not audio_url:
            raise Exception("Could not extract audio URL from video")
        
        # Get detailed transcription from AssemblyAI
        transcription = await self.assemblyai.transcribe_from_url(
            audio_url=audio_url,
            speaker_labels=True
        )
        
        return {
            **video_info,
            "transcription": transcription
        }
    
    def download_video(self, url: str, output_path: str) -> str:
        opts = {
            "format": "best[height<=720]",
            "outtmpl": output_path,
            "quiet": True,
            "cookiefile": self.cookies_file,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
        return output_path
    
    def download_audio(self, url: str, output_path: str) -> str:
        opts = {
            "format": "bestaudio/best",
            "outtmpl": output_path,
            "quiet": True,
            "cookiefile": self.cookies_file,
            "postprocessors": [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }]
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
        return output_path.replace(".mp4", ".mp3")
