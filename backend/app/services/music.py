"""Music service for YouTube background music search and download."""

import os
import json
import shutil
import subprocess
from typing import Optional


def search_youtube_music(query: str, limit: int = 5) -> list:
    """Search YouTube for music tracks."""
    search_cmd = ["yt-dlp", "--dump-json", "--flat-playlist", f"ytsearch{limit}:{query} no copyright background music"]
    result = subprocess.run(search_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return []
    
    results = []
    for line in result.stdout.strip().split('\n'):
        if line:
            info = json.loads(line)
            results.append({
                "id": info.get("id", ""),
                "title": info.get("title", ""),
                "artist": info.get("uploader", info.get("channel", "Unknown")),
                "duration": info.get("duration", 0),
                "url": info.get("url") or f"https://youtube.com/watch?v={info.get('id', '')}"
            })
    return results


def download_youtube_audio(video_id: str, output_path: str) -> dict:
    """Download audio from YouTube video."""
    url = f"https://youtube.com/watch?v={video_id}"
    cmd = ["yt-dlp", "-x", "--audio-format", "mp3", "-o", output_path, url]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return {"success": result.returncode == 0}


def search_and_download_youtube(query: str, output_path: str) -> dict:
    """Search YouTube and download first result audio."""
    search_cmd = ["yt-dlp", "--dump-json", "-x", f"ytsearch1:{query}"]
    result = subprocess.run(search_cmd, capture_output=True, text=True)
    if result.returncode != 0:
        return {"success": False}
    
    info = json.loads(result.stdout)
    video_url = info.get("webpage_url") or info.get("url")
    
    dl_cmd = ["yt-dlp", "-x", "--audio-format", "mp3", "-o", output_path, video_url]
    dl_result = subprocess.run(dl_cmd, capture_output=True, text=True)
    
    return {
        "success": dl_result.returncode == 0,
        "title": info.get("title", ""),
        "artist": info.get("uploader", "YouTube")
    }


class MusicService:
    """Service for managing background music."""
    
    def __init__(self, storage_path: str = "./storage"):
        self.storage_path = storage_path
        self.preview_dir = f"{storage_path}/music_previews"
    
    def get_music_library(self, moods: list) -> list:
        """Get list of music moods with cache status."""
        tracks = []
        for mood in moods:
            preview_path = f"{self.preview_dir}/{mood['id']}.mp3"
            cached = os.path.exists(preview_path)
            artist = ""
            if cached:
                meta_path = f"{self.preview_dir}/{mood['id']}.json"
                if os.path.exists(meta_path):
                    with open(meta_path) as f:
                        artist = json.load(f).get("artist", "")
            tracks.append({"id": mood["id"], "name": mood["name"], "artist": artist, "cached": cached})
        return tracks
    
    def get_preview_path(self, preset_id: str) -> Optional[str]:
        """Get cached preview path if exists."""
        preview_path = f"{self.preview_dir}/{preset_id}.mp3"
        return preview_path if os.path.exists(preview_path) else None
    
    def download_preview(self, preset_id: str, query: str) -> tuple[bool, str]:
        """Download and cache music preview."""
        os.makedirs(self.preview_dir, exist_ok=True)
        preview_path = f"{self.preview_dir}/{preset_id}.mp3"
        meta_path = f"{self.preview_dir}/{preset_id}.json"
        
        result = search_and_download_youtube(query, preview_path)
        
        if result["success"]:
            with open(meta_path, "w") as f:
                json.dump({"title": result["title"], "artist": result["artist"]}, f)
            return True, preview_path
        return False, ""
    
    def copy_to_project(self, preset_id: str, project_id: str, moods: list) -> tuple[bool, str]:
        """Copy cached music to project or download fresh."""
        mood = next((m for m in moods if m["id"] == preset_id), None)
        if not mood:
            return False, "Invalid mood"
        
        preview_path = f"{self.preview_dir}/{preset_id}.mp3"
        output_path = f"{self.storage_path}/{project_id}/bg_music.mp3"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        if not os.path.exists(preview_path):
            success, _ = self.download_preview(preset_id, mood["query"])
            if not success:
                return False, "Failed to download audio"
        
        shutil.copy2(preview_path, output_path)
        return True, output_path
    
    def download_to_project(self, video_id: str, project_id: str) -> tuple[bool, str]:
        """Download YouTube audio directly to project."""
        output_path = f"{self.storage_path}/{project_id}/bg_music.mp3"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        result = download_youtube_audio(video_id, output_path)
        return result["success"], output_path

