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
            "ffmpeg", "-y",
            "-ss", str(start),           # Input seeking (fast)
            "-i", video_path,
            "-t", str(duration),
            "-c:v", "libx264",
            "-preset", "fast",            # Faster encoding
            "-crf", "23",                 # Quality control
            "-c:a", "aac",
            "-threads", "0",              # Use all cores
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
        
        cmd.extend(["-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac", "-threads", "0", output])
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
        
        cmd.extend([
            "-vf", ",".join(vf_filters),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-threads", "0",
            output
        ])
        subprocess.run(cmd, check=True, capture_output=True)
        
        return output
    
    def generate_thumbnail(self, project_id: str, video_path: str) -> str:
        project_dir = self.storage / project_id
        output = str(project_dir / "thumbnail.jpg")
        cmd = ["ffmpeg", "-y", "-ss", "00:00:01", "-i", video_path, "-vframes", "1", "-q:v", "2", output]
        subprocess.run(cmd, check=True, capture_output=True)
        return output
    
    def _create_animated_subtitles(self, srt_path: str, project_dir: Path, resize: str, style: str = "karaoke", font_size: int = 72) -> str:
        """Convert SRT to ASS with word-limited single-line animation"""
        import re
        
        ass_path = str(project_dir / "subtitles.ass")
        res_map = {"16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1080, 1080)}
        w, h = res_map.get(resize, (1920, 1080))
        # Use provided font_size, adjust for vertical if needed
        if resize == "9:16" and font_size > 64:
            font_size = int(font_size * 0.85)
        max_words = 4 if resize == "9:16" else 5
        
        style_configs = {
            "karaoke": {"hl": "&H00FFFF&", "base": "&HFFFFFF&", "font": "Arial Black", "effect": "color"},
            "neon": {"hl": "&H00FF00&", "base": "&HFF00FF&", "font": "Impact", "effect": "glow"},
            "fire": {"hl": "&H0045FF&", "base": "&H00A5FF&", "font": "Arial Black", "effect": "color"},
            "minimal": {"hl": "&HFFFFFF&", "base": "&HCCCCCC&", "font": "Helvetica", "effect": "color"},
            "bold": {"hl": "&H00FFFF&", "base": "&HFFFFFF&", "font": "Impact", "effect": "scale"},
            "typewriter": {"hl": "&H00FF00&", "base": "&HFFFFFF&", "font": "Courier New", "effect": "color"},
            "glitch": {"hl": "&HFF00FF&", "base": "&H00FFFF&", "font": "Impact", "effect": "glitch"},
            "bounce": {"hl": "&H00FF88&", "base": "&HFFFFFF&", "font": "Arial Black", "effect": "bounce"},
            "wave": {"hl": "&HFFCC00&", "base": "&HFF8800&", "font": "Arial Black", "effect": "wave"},
            "shadow": {"hl": "&HFFFFFF&", "base": "&HDDDDDD&", "font": "Impact", "effect": "shadow"},
            "gradient": {"hl": "&HFF88FF&", "base": "&H88FFFF&", "font": "Arial Black", "effect": "gradient"},
            "retro": {"hl": "&H00CCFF&", "base": "&H66FFFF&", "font": "Courier New", "effect": "retro"},
        }
        cfg = style_configs.get(style, style_configs["karaoke"])
        
        ass_header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{cfg['font']},{font_size},{cfg['base']},&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,2,2,20,20,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        
        def ms_to_ass(ms):
            return f"{ms//3600000}:{(ms//60000)%60:02}:{(ms//1000)%60:02}.{(ms%1000)//10:02}"
        
        events = []
        try:
            with open(srt_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            blocks = re.split(r"\n\n+", content.strip())
            
            for block in blocks:
                lines = block.strip().split("\n")
                if len(lines) < 3:
                    continue
                    
                match = re.match(r"(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})", lines[1])
                if not match:
                    continue
                
                sh, sm, ss, sms, eh, em, es, ems = match.groups()
                start_ms = int(sh)*3600000 + int(sm)*60000 + int(ss)*1000 + int(sms)
                end_ms = int(eh)*3600000 + int(em)*60000 + int(es)*1000 + int(ems)
                
                text = " ".join(lines[2:]).replace("\n", " ").strip()
                words = text.split()
                if not words:
                    continue
                
                duration = end_ms - start_ms
                per_word = max(150, duration // len(words))
                
                for i in range(0, len(words), max_words):
                    chunk = words[i:i + max_words]
                    chunk_start = start_ms + i * per_word
                    chunk_end = min(start_ms + (i + len(chunk)) * per_word, end_ms)
                    chunk_dur = chunk_end - chunk_start
                    word_time = chunk_dur // len(chunk)
                    
                    for j, word in enumerate(chunk):
                        ws = ms_to_ass(chunk_start + j * word_time)
                        we = ms_to_ass(chunk_start + (j + 1) * word_time if j < len(chunk) - 1 else chunk_end)
                        
                        parts = []
                        for k, w in enumerate(chunk):
                            if k == j:
                                effect_type = cfg.get("effect", "color")
                                if effect_type == "scale":
                                    parts.append(f"{{\\c{cfg['hl']}\\fscx115\\fscy115}}{w}{{\\fscx100\\fscy100}}")
                                elif effect_type == "glow":
                                    parts.append(f"{{\\c{cfg['hl']}\\bord5\\blur3}}{w}{{\\bord4\\blur0}}")
                                elif effect_type == "glitch":
                                    parts.append(f"{{\\c{cfg['hl']}\\shad3\\be1\\fscx105}}{w}{{\\shad2\\be0\\fscx100}}")
                                elif effect_type == "bounce":
                                    parts.append(f"{{\\c{cfg['hl']}\\fscx120\\fscy120\\fsp2}}{w}{{\\fscx100\\fscy100\\fsp0}}")
                                elif effect_type == "wave":
                                    parts.append(f"{{\\c{cfg['hl']}\\bord3\\blur1\\fsp1}}{w}{{\\bord4\\blur0\\fsp0}}")
                                elif effect_type == "shadow":
                                    parts.append(f"{{\\c{cfg['hl']}\\shad5\\bord2}}{w}{{\\shad2\\bord4}}")
                                elif effect_type == "gradient":
                                    parts.append(f"{{\\c{cfg['hl']}\\bord4\\fscx110\\fscy110}}{w}{{\\bord4\\fscx100\\fscy100}}")
                                elif effect_type == "retro":
                                    parts.append(f"{{\\c{cfg['hl']}\\bord2\\shad3\\fsp3}}{w}{{\\bord4\\shad2\\fsp0}}")
                                else:
                                    parts.append(f"{{\\c{cfg['hl']}}}{w}")
                            else:
                                parts.append(f"{{\\c{cfg['base']}}}{w}")
                        
                        events.append(f"Dialogue: 0,{ws},{we},Default,,0,0,0,,{' '.join(parts)}")
            
            with open(ass_path, "w", encoding="utf-8") as f:
                f.write(ass_header + "\n".join(events))
            return ass_path
        except Exception as e:
            print(f"ASS creation error: {e}")
            return None
    
    def merge_clips_final(self, project_id: str, clip_paths: list, audio_path: str, subtitle_path: str, resize: str, bg_music_path: str = None, bg_music_volume: float = 0.3, animated_subtitles: bool = True, subtitle_style: str = "karaoke", subtitle_size: int = 72) -> str:
        project_dir = self.storage / project_id
        concat_file = project_dir / "concat.txt"
        output = str(project_dir / "final.mp4")
        
        with open(concat_file, "w") as f:
            for path in clip_paths:
                abs_path = os.path.abspath(path).replace("\\", "/")
                f.write(f"file '{abs_path}'\n")
        
        scale_map = {"16:9": "1920:1080", "9:16": "1080:1920", "1:1": "1080:1080"}
        scale = scale_map.get(resize, "1920:1080")
        
        vf_filters = [f"scale={scale}:force_original_aspect_ratio=decrease,pad={scale}:(ow-iw)/2:(oh-ih)/2"]
        
        if subtitle_path and os.path.exists(subtitle_path):
            sub_path = subtitle_path.replace("\\", "/").replace(":", "\\:")
            if animated_subtitles:
                ass_path = self._create_animated_subtitles(subtitle_path, project_dir, resize, subtitle_style, subtitle_size)
                if ass_path:
                    ass_escaped = ass_path.replace("\\", "/").replace(":", "\\:")
                    vf_filters.append(f"ass='{ass_escaped}'")
                else:
                    vf_filters.append(f"subtitles='{sub_path}'")
            else:
                vf_filters.append(f"subtitles='{sub_path}'")
        
        cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file)]
        
        # Mix voiceover with background music if provided
        if audio_path and os.path.exists(audio_path):
            if bg_music_path and os.path.exists(bg_music_path):
                # Mix voice (full volume) + background music (reduced volume)
                # Using amerge + volume control for better mixing
                # Voice at full volume, background music at user-specified volume (default 0.3 = 30%)
                cmd.extend(["-i", audio_path, "-i", bg_music_path])
                # aloop: loop background music to match voice duration
                # volume: control background music level
                # amix: mix both with normalize=0 to prevent auto-leveling
                filter_complex = (
                    f"[2:a]aloop=loop=-1:size=2e+09,volume={bg_music_volume}[bg];"
                    f"[1:a]volume=1.0[voice];"
                    f"[voice][bg]amix=inputs=2:duration=first:normalize=0[aout]"
                )
                cmd.extend(["-filter_complex", filter_complex])
                cmd.extend(["-map", "0:v", "-map", "[aout]", "-shortest"])
            else:
                cmd.extend(["-i", audio_path, "-map", "0:v", "-map", "1:a", "-shortest"])
        
        cmd.extend([
            "-vf", ",".join(vf_filters),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "aac",
            "-threads", "0",
            output
        ])
        subprocess.run(cmd, check=True, capture_output=True)
        return output
    
    def image_to_video(self, image_path: str, output_path: str, duration: float = 5.0, effect: str = "zoom_in") -> str:
        effects = {
            "zoom_in": "scale=8000:-1,zoompan=z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=1920x1080:fps=25",
            "zoom_out": "scale=8000:-1,zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=1920x1080:fps=25",
            "pan_left": "scale=3840:-1,zoompan=z='1.1':x='if(lte(on,1),0,min(x+2,iw-iw/zoom))':y='ih/2-(ih/zoom/2)':d=125:s=1920x1080:fps=25",
            "pan_right": "scale=3840:-1,zoompan=z='1.1':x='if(lte(on,1),iw,max(0,x-2))':y='ih/2-(ih/zoom/2)':d=125:s=1920x1080:fps=25",
            "static": "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"
        }
        
        vf = effects.get(effect, effects["zoom_in"])
        frames = int(duration * 25)
        vf = vf.replace("d=125", f"d={frames}")
        
        cmd = [
            "ffmpeg", "-y", "-loop", "1", "-i", image_path,
            "-vf", vf, "-c:v", "libx264", "-t", str(duration),
            "-pix_fmt", "yuv420p", "-preset", "fast", output_path
        ]
        subprocess.run(cmd, check=True, capture_output=True)
        return output_path

    def image_to_video_with_effect(self, image_path: str, output_path: str, duration: float, effect: str = "none") -> str:
        """Create video from image with animation effect: none, fade, pop, slide, zoom"""
        frames = int(duration * 25)
        fade_frames = min(15, frames // 4)  # Fade duration (0.6s max)
        
        # Base scale filter
        scale = "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"
        
        if effect == "none":
            vf = scale
        elif effect == "fade":
            vf = f"{scale},fade=t=in:st=0:d=0.5,fade=t=out:st={duration-0.5}:d=0.5"
        elif effect == "pop":
            # Scale up from 0.8 to 1.0 with bounce
            vf = f"scale=8000:-1,zoompan=z='if(lt(on,{fade_frames}),0.8+0.2*on/{fade_frames},1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps=25,fade=t=in:st=0:d=0.3"
        elif effect == "slide":
            # Slide in from left
            vf = f"{scale},fade=t=in:st=0:d=0.4"
        elif effect == "zoom":
            # Slow zoom in throughout
            vf = f"scale=8000:-1,zoompan=z='min(zoom+0.001,1.2)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1920x1080:fps=25"
        else:
            vf = f"{scale},fade=t=in:st=0:d=0.5"
        
        cmd = [
            "ffmpeg", "-y", "-loop", "1", "-i", image_path,
            "-vf", vf, "-c:v", "libx264", "-t", str(duration),
            "-pix_fmt", "yuv420p", "-preset", "fast", output_path
        ]
        
        try:
            subprocess.run(cmd, check=True, capture_output=True)
        except subprocess.CalledProcessError:
            # Fallback to simple scale
            cmd = [
                "ffmpeg", "-y", "-loop", "1", "-i", image_path,
                "-vf", scale, "-c:v", "libx264", "-t", str(duration),
                "-pix_fmt", "yuv420p", "-preset", "fast", output_path
            ]
            subprocess.run(cmd, check=True, capture_output=True)
        
        return output_path
    
    def create_video_from_media(self, project_id: str, segments: list, audio_path: str, resize: str = "16:9") -> str:
        project_dir = self.storage / project_id
        temp_clips = []
        
        for i, seg in enumerate(segments):
            media_path = seg.get("media_path")
            media_type = seg.get("media_type", "image")
            duration = seg.get("duration", 5)
            temp_clip = str(project_dir / f"temp_clip_{i}.mp4")
            
            if media_type == "image":
                self.image_to_video(media_path, temp_clip, duration)
            else:
                trim_start = seg.get("trim_start", 0)
                trim_end = seg.get("trim_end", trim_start + duration)
                self.extract_clip(media_path, trim_start, trim_end, temp_clip)
            
            temp_clips.append(temp_clip)
        
        return self.merge_clips_final(project_id, temp_clips, audio_path, None, resize)

    def create_video_from_segments(
        self,
        project_id: str,
        segments: list[dict],
        media_assets: list[dict],
        audio_path: str,
        resize: str = "16:9",
        subtitle_path: str = None,
        animated_subtitles: bool = True,
        subtitle_style: str = "karaoke",
        subtitle_size: int = 72,
        dialogue_mode: bool = False,
        speaker1_position: str = "top-left",
        speaker2_position: str = "top-right",
        dialogue_bg_style: str = "transparent"
    ) -> str:
        """
        Create video from media assets assigned per segment with effects and subtitles
        """
        project_dir = self.storage / project_id
        
        # Get audio duration
        audio_duration = 0
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audio_path],
                capture_output=True, text=True
            )
            audio_duration = float(result.stdout.strip()) if result.returncode == 0 else 0
        except:
            pass
        
        total_duration = max(audio_duration, max((s.get("end", 0) for s in segments), default=0)) or 20
        
        # Build media lookup by id
        media_by_id = {m.get("id"): m for m in media_assets}
        default_media = media_assets[0] if media_assets else None
        
        # Create clips per segment using assigned media with effects
        temp_clips = []
        for i, seg in enumerate(segments):
            seg_start = seg.get("start", 0)
            seg_end = seg.get("end", seg_start + 5)
            seg_duration = max(seg_end - seg_start, 1)
            effect = seg.get("effect", "none")
            
            # Get assigned media for this segment (or default)
            media_id = seg.get("media_id") or seg.get("mediaId")
            media = media_by_id.get(media_id) if media_id else default_media
            
            if not media:
                continue
                
            media_path = media.get("path") or media.get("file_path")
            if not media_path or not os.path.exists(media_path):
                continue
            
            # Create clip for this segment with effect
            clip_path = str(project_dir / f"seg_clip_{i}.mp4")
            self.image_to_video_with_effect(media_path, clip_path, seg_duration, effect)
            temp_clips.append(clip_path)
        
        if not temp_clips:
            raise Exception("No clips to merge")
        
        if dialogue_mode:
            print(f"[DIALOGUE MODE] Active! speaker1={speaker1_position}, speaker2={speaker2_position}, bg={dialogue_bg_style}")
            print(f"[DIALOGUE MODE] Segments count: {len(segments)}, style={subtitle_style}")
            for s in segments[:3]:
                print(f"  speaker={s.get('speaker', 'N/A')}, text={s.get('text', '')[:30]}")
            return self._create_dialogue_video(
                project_id, temp_clips, audio_path, segments, resize,
                subtitle_size, speaker1_position, speaker2_position, subtitle_style, dialogue_bg_style
            )
        
        return self.merge_clips_final(
            project_id, temp_clips, audio_path, subtitle_path, resize,
            None, 0.3, animated_subtitles, subtitle_style, subtitle_size
        )

    def _create_dialogue_video(
        self,
        project_id: str,
        temp_clips: list[str],
        audio_path: str,
        segments: list[dict],
        resize: str,
        font_size: int,
        speaker1_pos: str,
        speaker2_pos: str,
        subtitle_style: str = "karaoke",
        bg_style: str = "transparent"
    ) -> str:
        """Create video with dialogue-style subtitles at two speaker positions with animation"""
        project_dir = self.storage / project_id
        print(f"[_create_dialogue_video] Starting with {len(segments)} segments, font={font_size}")
        
        # First merge clips with audio (no subtitles) to temp file
        base_video = self.merge_clips_final(
            project_id, temp_clips, audio_path, None, resize, None, 0.3, False, "", 72
        )
        
        # Rename final.mp4 to base_video_temp.mp4
        base_temp = str(project_dir / "base_video_temp.mp4")
        if os.path.exists(base_video):
            os.rename(base_video, base_temp)
            base_video = base_temp
        print(f"[_create_dialogue_video] Base video: {base_video}")
        
        # Build unique speakers list
        speakers = []
        for seg in segments:
            sp = seg.get("speaker", "")
            if sp and sp not in speakers:
                speakers.append(sp)
        
        # Create ASS file with word-by-word animation at speaker positions
        ass_path = self._create_dialogue_ass(
            segments, speakers, project_dir, resize, font_size,
            speaker1_pos, speaker2_pos, subtitle_style, bg_style
        )
        
        output_path = str(project_dir / "final.mp4")
        ass_escaped = ass_path.replace("\\", "/").replace(":", "\\:")
        
        cmd = [
            "ffmpeg", "-y", "-i", base_video,
            "-vf", f"ass='{ass_escaped}'",
            "-c:a", "copy", output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            print(f"[_create_dialogue_video] FFmpeg error: {result.stderr[-500:]}")
            import shutil
            shutil.copy(base_video, output_path)
        else:
            print(f"[_create_dialogue_video] Success! Output: {output_path}")
        
        return output_path
    
    def _create_dialogue_ass(
        self, segments: list, speakers: list, project_dir: Path,
        resize: str, font_size: int, speaker1_pos: str, speaker2_pos: str, style: str, bg_style: str = "transparent"
    ) -> str:
        """Create ASS subtitle file with word-by-word animation at speaker positions"""
        ass_path = str(project_dir / "dialogue.ass")
        res_map = {"16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1080, 1080)}
        w, h = res_map.get(resize, (1920, 1080))
        
        style_configs = {
            "karaoke": {"hl": "&H00FFFF&", "base": "&HFFFFFF&", "font": "Arial Black"},
            "neon": {"hl": "&H00FF00&", "base": "&HFF88FF&", "font": "Impact"},
            "fire": {"hl": "&H0088FF&", "base": "&H00CCFF&", "font": "Arial Black"},
            "minimal": {"hl": "&HFFFFFF&", "base": "&HFFFFFF&", "font": "Arial"},
            "bold": {"hl": "&H00FFFF&", "base": "&HFFFFFF&", "font": "Impact"},
        }
        cfg = style_configs.get(style, style_configs["karaoke"])
        
        bg_map = {
            "none": "&H00000000", "transparent": "&HC0000000",
            "solid": "&H90000000", "blur": "&HA0000000", "gradient": "&HB0000000",
        }
        back_color = bg_map.get(bg_style, "&HC0000000")
        
        # Margins from screen edges - proper spacing
        margin = 100
        pos_config = {
            "top-left": (margin, margin + 50, 7),
            "top-right": (w - margin, margin + 50, 9),
            "bottom-left": (margin, h - margin - 80, 1),
            "bottom-right": (w - margin, h - margin - 80, 3),
        }
        
        ass_header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Speaker1,{cfg['font']},{font_size},{cfg['base']},{cfg['hl']},&H00000000,{back_color},1,0,0,0,100,100,2,0,3,0,12,7,{margin},{margin},{margin},1
Style: Speaker2,{cfg['font']},{font_size},{cfg['base']},{cfg['hl']},&H00000000,{back_color},1,0,0,0,100,100,2,0,3,0,12,3,{margin},{margin},{margin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
        
        def ms_to_ass(ms):
            return f"{ms//3600000}:{(ms//60000)%60:02}:{(ms//1000)%60:02}.{(ms%1000)//10:02}"
        
        events = []
        for seg in segments:
            text = seg.get("text", "")
            speaker = seg.get("speaker", "")
            start_sec = seg.get("start", 0)
            end_sec = seg.get("end", start_sec + 5)
            
            if speaker and speaker in speakers:
                is_speaker1 = speakers.index(speaker) % 2 == 0
                style_name = "Speaker1" if is_speaker1 else "Speaker2"
                pos = speaker1_pos if is_speaker1 else speaker2_pos
            else:
                style_name = "Speaker1"
                pos = speaker1_pos
            
            x, y, an = pos_config.get(pos, pos_config["bottom-left"])
            
            words = text.split()
            if not words:
                continue
            
            start_ms = int(start_sec * 1000)
            end_ms = int(end_sec * 1000)
            duration_ms = end_ms - start_ms
            word_duration_ms = duration_ms // len(words)
            
            max_words_per_line = 6 if resize != "9:16" else 4
            lines = []
            for i in range(0, len(words), max_words_per_line):
                lines.append(words[i:i + max_words_per_line])
            
            karaoke_text = f"{{\\an{an}\\pos({x},{y})}}"
            word_idx = 0
            for line_idx, line_words in enumerate(lines):
                for word in line_words:
                    word_time = word_duration_ms // 10
                    karaoke_text += f"{{\\k{word_time}}}{word} "
                    word_idx += 1
                if line_idx < len(lines) - 1:
                    karaoke_text = karaoke_text.rstrip() + "\\N"
            
            events.append(f"Dialogue: 0,{ms_to_ass(start_ms)},{ms_to_ass(end_ms)},{style_name},,0,0,0,,{karaoke_text.strip()}")
        
        with open(ass_path, "w", encoding="utf-8") as f:
            f.write(ass_header + "\n".join(events))
        
        return ass_path

