import os
import subprocess
from .base import BaseVideoService
from .clips import ClipService
from .effects import image_to_video, image_to_video_with_effect, video_to_clip
from .merge import merge_clips_final
from .dialogue import create_dialogue_video


class VideoService(ClipService):
    def image_to_video(self, image_path: str, output_path: str, duration: float = 5.0, effect: str = "zoom_in", resize: str = "16:9") -> str:
        return image_to_video(image_path, output_path, duration, effect, resize)

    def image_to_video_with_effect(self, image_path: str, output_path: str, duration: float, effect: str = "none", resize: str = "16:9") -> str:
        return image_to_video_with_effect(image_path, output_path, duration, effect, resize)
    
    def merge_clips_final(self, project_id: str, clip_paths: list, audio_path: str, subtitle_path: str, resize: str, bg_music_path: str = None, bg_music_volume: float = 0.3, animated_subtitles: bool = True, subtitle_style: str = "karaoke", subtitle_size: int = 72, subtitle_position: str = "bottom") -> str:
        return merge_clips_final(
            self.storage, project_id, clip_paths, audio_path, subtitle_path, resize,
            bg_music_path, bg_music_volume, animated_subtitles, subtitle_style, subtitle_size, subtitle_position
        )
    
    def create_video_from_media(self, project_id: str, segments: list, audio_path: str, resize: str = "16:9") -> str:
        project_dir = self.storage / project_id
        temp_clips = []
        
        for i, seg in enumerate(segments):
            media_path = seg.get("media_path")
            media_type = seg.get("media_type", "image")
            duration = seg.get("duration", 5)
            temp_clip = str(project_dir / f"temp_clip_{i}.mp4")
            
            if media_type == "image":
                self.image_to_video(media_path, temp_clip, duration, "zoom_in", resize)
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
        subtitle_position: str = "bottom",
        dialogue_mode: bool = False,
        speaker1_position: str = "top-left",
        speaker2_position: str = "top-right",
        dialogue_bg_style: str = "transparent"
    ) -> str:
        project_dir = self.storage / project_id
        
        # Get actual audio duration for sync
        audio_duration = 0
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audio_path],
                capture_output=True, text=True
            )
            audio_duration = float(result.stdout.strip()) if result.returncode == 0 else 0
        except:
            pass
        
        media_by_id = {m.get("id"): m for m in media_assets}
        default_media = media_assets[0] if media_assets else None
        
        # Calculate total segment duration
        total_seg_duration = sum(
            max((seg.get("end", 0) - seg.get("start", 0)), seg.get("duration", 5))
            for seg in segments
        ) if segments else 0
        
        # Use audio duration if available, otherwise segment total
        target_duration = audio_duration if audio_duration > 0 else total_seg_duration
        
        # Group consecutive segments with same media
        groups = []
        accumulated_time = 0
        
        print(f"[VIDEO] Processing {len(segments)} segments with {len(media_assets)} media assets")
        print(f"[VIDEO] Media IDs available: {list(media_by_id.keys())}")
        print(f"[VIDEO] Default media: {default_media.get('id') if default_media else 'None'}")
        
        for idx, seg in enumerate(segments):
            media_id = seg.get("media_id") or seg.get("mediaId")
            media = media_by_id.get(media_id) if media_id else default_media
            
            # Calculate segment duration from start/end or duration field
            seg_start = seg.get("start", accumulated_time)
            seg_end = seg.get("end", seg_start + 5)
            seg_duration = max(seg_end - seg_start, seg.get("duration", 5), 0.5)
            
            effect = seg.get("effect") or seg.get("Effect") or "none"
            current_media_id = media.get("id") if media else None
            media_type = media.get("type") or media.get("media_type", "image") if media else "unknown"
            
            print(f"[Seg {idx}] saved_media_id={media_id}, using={current_media_id}, type={media_type}, dur={seg_duration:.1f}s")
            
            # Check if we should extend previous group (same media)
            if groups and groups[-1]["media_id"] == current_media_id:
                groups[-1]["duration"] += seg_duration
                groups[-1]["seg_indices"].append(idx)
            else:
                groups.append({
                    "media_id": current_media_id,
                    "media": media,
                    "duration": seg_duration,
                    "effect": effect,
                    "seg_indices": [idx]
                })
            
            accumulated_time += seg_duration
        
        # Scale group durations to match audio if needed
        if target_duration > 0 and accumulated_time > 0:
            scale_factor = target_duration / accumulated_time
            if abs(scale_factor - 1.0) > 0.1:
                print(f"[SYNC] Scaling video {accumulated_time:.1f}s -> {target_duration:.1f}s (factor={scale_factor:.2f})")
                for grp in groups:
                    grp["duration"] *= scale_factor
        
        temp_clips = []
        for i, grp in enumerate(groups):
            media = grp["media"]
            if not media:
                print(f"[Group {i}] SKIP - no media")
                continue
            
            media_path = media.get("path") or media.get("file_path")
            media_type = media.get("type") or media.get("media_type", "image")
            
            if not media_path or not os.path.exists(media_path):
                print(f"[Group {i}] SKIP - file not found: {media_path}")
                continue
            
            clip_path = str(project_dir / f"seg_clip_{i}.mp4")
            duration = max(grp["duration"], 0.5)
            
            print(f"[Group {i}] type={media_type}, duration={duration:.2f}s, segs={grp['seg_indices']}")
            
            if media_type == "video":
                video_to_clip(media_path, clip_path, duration, resize)
            else:
                self.image_to_video_with_effect(media_path, clip_path, duration, grp["effect"], resize)
            
            if os.path.exists(clip_path):
                temp_clips.append(clip_path)
            else:
                print(f"[Group {i}] ERROR - clip not created")
        
        if not temp_clips:
            raise Exception("No clips to merge")
        
        if dialogue_mode:
            print(f"[DIALOGUE MODE] Active! speaker1={speaker1_position}, speaker2={speaker2_position}, bg={dialogue_bg_style}")
            base_video = self.merge_clips_final(
                project_id, temp_clips, audio_path, None, resize, None, 0.3, False, "", 72
            )
            return create_dialogue_video(
                project_dir, base_video, segments, resize,
                subtitle_size, speaker1_position, speaker2_position, subtitle_style, dialogue_bg_style
            )
        
        return self.merge_clips_final(
            project_id, temp_clips, audio_path, subtitle_path, resize,
            None, 0.3, animated_subtitles, subtitle_style, subtitle_size, subtitle_position
        )


__all__ = ["VideoService"]

