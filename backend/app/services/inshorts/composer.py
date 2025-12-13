import subprocess
import os
from pathlib import Path
from .processor import extract_segment, apply_effects, ASPECT_RATIOS

STORAGE_PATH = Path("./storage")


def generate_inshort(project_id: str, youtube_url: str, start: float, end: float, 
                     effects: dict, options: dict, transcript: list = None):
    project_dir = STORAGE_PATH / project_id
    project_dir.mkdir(parents=True, exist_ok=True)
    
    source_video = project_dir / "source.mp4"
    segment_video = project_dir / "segment.mp4"
    effects_video = project_dir / "effects.mp4"
    final_video = project_dir / "short.mp4"
    
    try:
        print(f"[INSHORTS] Starting generation for {project_id}")
        if not source_video.exists():
            print(f"[INSHORTS] Downloading video from {youtube_url}")
            download_video(youtube_url, str(source_video))
        else:
            print(f"[INSHORTS] Using existing source video")
        
        print(f"[INSHORTS] Extracting segment {start}-{end}s")
        extract_segment(str(source_video), str(segment_video), start, end, options.get("keepAudio", True))
        
        print(f"[INSHORTS] Applying effects: {effects}")
        apply_effects(str(segment_video), str(effects_video), effects, options.get("aspectRatio", "9:16"), options.get("antiCopyright", True))
        
        print(f"[INSHORTS] Effects applied, checking subtitles (transcript: {len(transcript) if transcript else 0} items)")
        
        if options.get("subtitles") and transcript and len(transcript) > 0:
            print(f"[INSHORTS] Generating subtitles")
            subtitle_path = generate_subtitles(project_dir, transcript, start, end, options.get("aspectRatio", "9:16"))
            burn_subtitles(str(effects_video), str(final_video), subtitle_path)
        else:
            print(f"[INSHORTS] No subtitles, copying effects to final")
            import shutil
            shutil.copy2(str(effects_video), str(final_video))
        
        print(f"[INSHORTS] Final video created, cleaning up")
        cleanup_temp_files(project_dir, ["segment.mp4", "effects.mp4"])  # Keep source.mp4 for regeneration
        update_project_status_sync(project_id, "completed")
        print(f"[INSHORTS] Generation completed for {project_id}")
        
    except Exception as e:
        print(f"[INSHORTS] Generation failed: {e}")
        import traceback
        traceback.print_exc()
        update_project_status_sync(project_id, "failed")


def download_video(url: str, output_path: str):
    cmd = [
        "yt-dlp",
        "--cookies", "www.youtube.com_cookies.txt",
        "-f", "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best",
        "--merge-output-format", "mp4",
        "-o", output_path,
        url
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd="/Users/alomgir/workspace/goinsights/backend")
    if result.returncode != 0:
        raise Exception(f"Download failed: {result.stderr[:500]}")


def generate_subtitles(project_dir: Path, transcript: list, start: float, end: float, aspect_ratio: str) -> str:
    srt_path = project_dir / "subtitles.srt"
    ass_path = project_dir / "subtitles.ass"
    
    filtered = [t for t in transcript if t.get("start", 0) >= start and t.get("start", 0) < end]
    
    with open(srt_path, "w", encoding="utf-8") as f:
        for i, item in enumerate(filtered, 1):
            item_start = item.get("start", 0) - start
            item_end = item_start + item.get("duration", 2)
            text = item.get("text", "").strip()
            
            f.write(f"{i}\n")
            f.write(f"{format_srt_time(item_start)} --> {format_srt_time(item_end)}\n")
            f.write(f"{text}\n\n")
    
    width, height = ASPECT_RATIOS.get(aspect_ratio, (1080, 1920))
    create_ass_subtitles(str(srt_path), str(ass_path), width, height)
    
    return str(ass_path)


def format_srt_time(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def create_ass_subtitles(srt_path: str, ass_path: str, width: int, height: int):
    margin_v = height // 8
    font_size = 48 if width < 1200 else 56
    
    header = f"""[Script Info]
Title: Inshorts Subtitles
ScriptType: v4.00+
PlayResX: {width}
PlayResY: {height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,{font_size},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,3,1,2,20,20,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    events = []
    try:
        with open(srt_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        blocks = content.strip().split("\n\n")
        for block in blocks:
            lines = block.strip().split("\n")
            if len(lines) >= 3:
                times = lines[1].split(" --> ")
                start_time = convert_srt_to_ass_time(times[0])
                end_time = convert_srt_to_ass_time(times[1])
                text = " ".join(lines[2:]).replace("\n", "\\N")
                events.append(f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,,{text}")
    except Exception as e:
        print(f"ASS conversion error: {e}")
    
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(header)
        f.write("\n".join(events))


def convert_srt_to_ass_time(srt_time: str) -> str:
    parts = srt_time.replace(",", ".").split(":")
    hours = int(parts[0])
    minutes = int(parts[1])
    seconds = float(parts[2])
    return f"{hours}:{minutes:02d}:{seconds:05.2f}"


def burn_subtitles(input_path: str, output_path: str, subtitle_path: str):
    sub_path_escaped = subtitle_path.replace("\\", "/").replace(":", "\\:")
    
    cmd = [
        "ffmpeg", "-y", "-i", input_path,
        "-vf", f"ass='{sub_path_escaped}'",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "copy",
        output_path
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[INSHORTS] Subtitle burn failed, using video without subtitles")
        os.rename(input_path, output_path)


def cleanup_temp_files(project_dir: Path, files: list):
    for f in files:
        path = project_dir / f
        if path.exists():
            try:
                os.remove(path)
            except:
                pass


def update_project_status_sync(project_id: str, status: str):
    try:
        import psycopg2
        from app.config import get_settings
        
        settings = get_settings()
        url = settings.database_url.replace("postgresql+asyncpg://", "")
        parts = url.split("@")
        user_pass = parts[0].split(":")
        host_db = parts[1].split("/")
        host_port = host_db[0].split(":")
        
        conn = psycopg2.connect(
            host=host_port[0],
            port=int(host_port[1]) if len(host_port) > 1 else 5432,
            user=user_pass[0],
            password=user_pass[1],
            dbname=host_db[1]
        )
        cur = conn.cursor()
        cur.execute("UPDATE projects SET status = %s WHERE id = %s", (status, project_id))
        conn.commit()
        cur.close()
        conn.close()
        print(f"[INSHORTS] Status updated: {status}")
    except ImportError:
        print(f"[INSHORTS] psycopg2 not installed, status: {status}")
    except Exception as e:
        print(f"[INSHORTS] Status update failed: {e}, status: {status}")


def update_batch_status(project_id: str, short_id: str, status: str):
    try:
        import psycopg2
        import json
        from app.config import get_settings
        
        settings = get_settings()
        url = settings.database_url.replace("postgresql+asyncpg://", "")
        parts = url.split("@")
        user_pass = parts[0].split(":")
        host_db = parts[1].split("/")
        host_port = host_db[0].split(":")
        
        conn = psycopg2.connect(
            host=host_port[0],
            port=int(host_port[1]) if len(host_port) > 1 else 5432,
            user=user_pass[0],
            password=user_pass[1],
            dbname=host_db[1]
        )
        cur = conn.cursor()
        cur.execute("SELECT inshorts_batch FROM projects WHERE id = %s", (project_id,))
        row = cur.fetchone()
        if row and row[0]:
            batch = row[0] if isinstance(row[0], list) else json.loads(row[0])
            for s in batch:
                if s["id"] == short_id:
                    s["status"] = status
            cur.execute("UPDATE projects SET inshorts_batch = %s WHERE id = %s", (json.dumps(batch), project_id))
            conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[BATCH] Status update failed: {e}")


def generate_batch(project_id: str, youtube_url: str, shorts: list, default_effects: dict, options: dict):
    """Generate multiple shorts from a video"""
    from .processor import apply_effects, extract_segment
    
    print(f"[BATCH] Starting batch generation for {project_id}, {len(shorts)} shorts")
    project_dir = Path(f"./storage/{project_id}")
    project_dir.mkdir(parents=True, exist_ok=True)
    
    source_path = project_dir / "source.mp4"
    
    try:
        if not source_path.exists():
            download_video(youtube_url, str(source_path))
        
        for short in shorts:
            short_id = short["id"]
            print(f"[BATCH] Processing short {short_id}")
            update_batch_status(project_id, short_id, "processing")
            
            try:
                segment_path = project_dir / f"segment_{short_id}.mp4"
                effects_path = project_dir / f"effects_{short_id}.mp4"
                final_path = project_dir / f"short_{short_id}.mp4"
                
                extract_segment(str(source_path), str(segment_path), short["start"], short["end"], options.get("keepAudio", True))
                
                effects = {**default_effects, **short.get("effects", {})}
                apply_effects(str(segment_path), str(effects_path), effects, options.get("aspectRatio", "9:16"), options.get("antiCopyright", True))
                
                os.rename(str(effects_path), str(final_path))
                
                if segment_path.exists():
                    os.remove(segment_path)
                
                update_batch_status(project_id, short_id, "completed")
                print(f"[BATCH] Short {short_id} completed")
                
            except Exception as e:
                print(f"[BATCH] Short {short_id} failed: {e}")
                update_batch_status(project_id, short_id, "failed")
        
        update_project_status_sync(project_id, "completed")
        print(f"[BATCH] Batch generation completed for {project_id}")
        
    except Exception as e:
        print(f"[BATCH] Batch generation failed: {e}")
        update_project_status_sync(project_id, "failed")
