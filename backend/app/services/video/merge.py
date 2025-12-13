import os
import subprocess
from pathlib import Path
from .subtitles import create_animated_subtitles


def get_watermark_position(position: str, resize: str) -> str:
    """Return FFmpeg drawtext x:y position based on position name."""
    scale_map = {"16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1080, 1080)}
    w, h = scale_map.get(resize, (1920, 1080))
    margin = 30
    positions = {
        "top-left": f"x={margin}:y={margin}",
        "top-center": f"x=(w-text_w)/2:y={margin}",
        "top-right": f"x=w-text_w-{margin}:y={margin}",
        "bottom-left": f"x={margin}:y=h-text_h-{margin}",
        "bottom-center": f"x=(w-text_w)/2:y=h-text_h-{margin}",
        "bottom-right": f"x=w-text_w-{margin}:y=h-text_h-{margin}",
    }
    return positions.get(position, positions["bottom-right"])


def merge_clips_final(
    storage: Path,
    project_id: str,
    clip_paths: list,
    audio_path: str,
    subtitle_path: str,
    resize: str,
    bg_music_path: str = None,
    bg_music_volume: float = 0.3,
    animated_subtitles: bool = True,
    subtitle_style: str = "karaoke",
    subtitle_size: int = 72,
    subtitle_position: str = "bottom",
    watermark_text: str = "",
    watermark_position: str = "bottom-right",
    watermark_font_size: int = 28,
    watermark_opacity: float = 0.7
) -> str:
    project_dir = storage / project_id
    concat_file = project_dir / "concat.txt"
    output = str(project_dir / "final.mp4")
    
    # Filter out non-existent clips
    valid_clips = [p for p in clip_paths if os.path.exists(p)]
    if not valid_clips:
        raise Exception("No valid clips to merge")
    
    print(f"[MERGE] {len(valid_clips)} clips, audio={os.path.exists(audio_path) if audio_path else False}, bgMusic={bg_music_path is not None}, vol={bg_music_volume}")
    
    with open(concat_file, "w") as f:
        for path in valid_clips:
            abs_path = os.path.abspath(path).replace("\\", "/")
            f.write(f"file '{abs_path}'\n")
    
    scale_map = {"16:9": "1920:1080", "9:16": "1080:1920", "1:1": "1080:1080"}
    scale = scale_map.get(resize, "1920:1080")
    
    # Ensure consistent framerate and pixel format
    vf_filters = [f"scale={scale}:force_original_aspect_ratio=decrease,pad={scale}:(ow-iw)/2:(oh-ih)/2,fps=25,format=yuv420p"]
    
    if subtitle_path and os.path.exists(subtitle_path):
        sub_path = subtitle_path.replace("\\", "/").replace(":", "\\:")
        if animated_subtitles:
            ass_path = create_animated_subtitles(subtitle_path, project_dir, resize, subtitle_style, subtitle_size, subtitle_position)
            if ass_path:
                ass_escaped = ass_path.replace("\\", "/").replace(":", "\\:")
                vf_filters.append(f"ass='{ass_escaped}'")
            else:
                vf_filters.append(f"subtitles='{sub_path}'")
        else:
            vf_filters.append(f"subtitles='{sub_path}'")
    
    if watermark_text:
        escaped_text = watermark_text.replace("'", "\\'").replace(":", "\\:")
        pos_coords = get_watermark_position(watermark_position, resize)
        alpha = min(max(watermark_opacity, 0.3), 1.0)
        vf_filters.append(f"drawtext=text='{escaped_text}':{pos_coords}:fontsize={watermark_font_size}:fontcolor=white@{alpha}:shadowcolor=black@0.5:shadowx=2:shadowy=2")
    
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file)]
    
    if audio_path and os.path.exists(audio_path):
        if bg_music_path and os.path.exists(bg_music_path):
            cmd.extend(["-i", audio_path, "-i", bg_music_path])
            filter_complex = (
                f"[2:a]aloop=loop=-1:size=2e+09,volume={bg_music_volume}[bg];"
                f"[1:a]volume=1.0[voice];"
                f"[voice][bg]amix=inputs=2:duration=first:normalize=0[aout]"
            )
            cmd.extend(["-filter_complex", filter_complex])
            cmd.extend(["-map", "0:v", "-map", "[aout]"])
        else:
            cmd.extend(["-i", audio_path, "-map", "0:v", "-map", "1:a"])
    
    cmd.extend([
        "-vf", ",".join(vf_filters),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-r", "25",
        "-vsync", "cfr",
        "-threads", "0",
        output
    ])
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[MERGE] Error: {result.stderr[:300] if result.stderr else 'unknown'}")
        raise Exception(f"Merge failed: {result.stderr[:100] if result.stderr else 'unknown error'}")
    
    print(f"[MERGE] Done: {output}")
    return output

