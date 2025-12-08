import os
import subprocess
from pathlib import Path
from app.config import get_settings

class VideoService:
    def __init__(self):
        self.settings = get_settings()
        self.storage = Path(self.settings.storage_path)
        self.storage.mkdir(parents=True, exist_ok=True)
    
    def extract_clip(self, video_path: str, start: float, end: float, output_path: str) -> str:
        duration = end - start
        cmd = [
            "ffmpeg", "-y", "-i", video_path,
            "-ss", str(start), "-t", str(duration),
            "-c:v", "libx264", "-c:a", "aac",
            output_path
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        return output_path
    
    def extract_clips(self, project_id: str, video_path: str, clips: list[dict]) -> list[str]:
        project_dir = self.storage / project_id / "clips"
        project_dir.mkdir(parents=True, exist_ok=True)
        
        clip_paths = []
        for i, clip in enumerate(clips):
            output = str(project_dir / f"clip_{i:03d}.mp4")
            self.extract_clip(video_path, clip["start"], clip["end"], output)
            clip_paths.append(output)
        return clip_paths
    
    def merge_clips_with_audio(self, project_id: str, clip_paths: list[str], audio_path: str, subtitle_path: str = None) -> str:
        project_dir = self.storage / project_id
        concat_file = project_dir / "concat.txt"
        output = str(project_dir / "final.mp4")
        
        with open(concat_file, "w") as f:
            for path in clip_paths:
                f.write(f"file '{path}'\n")
        
        cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file)]
        
        if audio_path and os.path.exists(audio_path):
            cmd.extend(["-i", audio_path, "-map", "0:v", "-map", "1:a", "-shortest"])
        
        if subtitle_path and os.path.exists(subtitle_path):
            cmd.extend(["-vf", f"subtitles={subtitle_path}"])
        
        cmd.extend(["-c:v", "libx264", "-c:a", "aac", output])
        subprocess.run(cmd, check=True, capture_output=True)
        
        return output
    
    def merge_clips_sync(self, project_id: str, clips_data: list, audio_path: str) -> str:
        project_dir = self.storage / project_id
        clip_paths = [c["path"] for c in clips_data]
        return self.merge_clips_with_audio(project_id, clip_paths, audio_path)
    
    def merge_segments(self, project_id: str, source: str, segments: list, audio_path: str, subtitle_path: str, resize: str) -> str:
        project_dir = self.storage / project_id
        output = str(project_dir / "final.mp4")
        
        scale_map = {"16:9": "1920:1080", "9:16": "1080:1920", "1:1": "1080:1080"}
        scale = scale_map.get(resize, "1920:1080")
        
        vf_filters = [f"scale={scale}:force_original_aspect_ratio=decrease,pad={scale}:(ow-iw)/2:(oh-ih)/2"]
        
        if subtitle_path and os.path.exists(subtitle_path):
            sub_path = subtitle_path.replace("\\", "/").replace(":", "\\:")
            vf_filters.append(f"subtitles='{sub_path}'")
        
        cmd = ["ffmpeg", "-y", "-i", source]
        
        if audio_path and os.path.exists(audio_path):
            cmd.extend(["-i", audio_path, "-map", "0:v", "-map", "1:a", "-shortest"])
        
        cmd.extend(["-vf", ",".join(vf_filters), "-c:v", "libx264", "-c:a", "aac", output])
        subprocess.run(cmd, check=True, capture_output=True)
        
        return output
    
    def generate_thumbnail(self, project_id: str, video_path: str) -> str:
        project_dir = self.storage / project_id
        output = str(project_dir / "thumbnail.jpg")
        
        cmd = ["ffmpeg", "-y", "-i", video_path, "-ss", "00:00:01", "-vframes", "1", "-q:v", "2", output]
        subprocess.run(cmd, check=True, capture_output=True)
        
        return output
    
    def merge_clips_final(self, project_id: str, clip_paths: list, audio_path: str, subtitle_path: str, resize: str, bg_music_path: str = None, bg_music_volume: float = 0.3) -> str:
        project_dir = self.storage / project_id
        concat_file = project_dir / "concat.txt"
        output = str(project_dir / "final.mp4")
        
        # Create concat file
        with open(concat_file, "w") as f:
            for path in clip_paths:
                abs_path = os.path.abspath(path).replace("\\", "/")
                f.write(f"file '{abs_path}'\n")
        
        scale_map = {"16:9": "1920:1080", "9:16": "1080:1920", "1:1": "1080:1080"}
        scale = scale_map.get(resize, "1920:1080")
        
        vf_filters = [f"scale={scale}:force_original_aspect_ratio=decrease,pad={scale}:(ow-iw)/2:(oh-ih)/2"]
        
        if subtitle_path and os.path.exists(subtitle_path):
            sub_path = subtitle_path.replace("\\", "/").replace(":", "\\:")
            vf_filters.append(f"subtitles='{sub_path}'")
        
        cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file)]
        
        # Mix voiceover with background music if provided
        if audio_path and os.path.exists(audio_path):
            if bg_music_path and os.path.exists(bg_music_path):
                # Mix voice (full volume) + background music (reduced volume)
                cmd.extend(["-i", audio_path, "-i", bg_music_path])
                cmd.extend(["-filter_complex", f"[1:a]volume=1.0[voice];[2:a]volume={bg_music_volume},aloop=loop=-1:size=2e+09[bg];[voice][bg]amix=inputs=2:duration=first[aout]"])
                cmd.extend(["-map", "0:v", "-map", "[aout]", "-shortest"])
            else:
                cmd.extend(["-i", audio_path, "-map", "0:v", "-map", "1:a", "-shortest"])
        
        cmd.extend(["-vf", ",".join(vf_filters), "-c:v", "libx264", "-c:a", "aac", output])
        subprocess.run(cmd, check=True, capture_output=True)
        
        return output

