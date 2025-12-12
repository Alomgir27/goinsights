from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Body
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.video import VideoService
from app.services.youtube import YouTubeService
from app.models.project import Project
from typing import List
import os

router = APIRouter()

class SegmentData(BaseModel):
    start: int
    end: int
    text: str

class DownloadRequest(BaseModel):
    project_id: str

class MergeRequest(BaseModel):
    project_id: str
    segments: List[SegmentData]
    subtitles: bool = False
    animated_subtitles: bool = True
    subtitle_style: str = "karaoke"  # karaoke, neon, fire, minimal, bold, typewriter, glitch, bounce, wave, shadow, gradient, retro
    resize: str = "16:9"
    bg_music: str = ""
    bg_music_volume: float = 0.3

class ThumbnailRequest(BaseModel):
    project_id: str
    script: str = ""
    language: str = "English"
    model: str = "gemini-3-pro"  # gemini-3-pro, gemini-2.5-flash, dall-e-3

class ExtractClipRequest(BaseModel):
    project_id: str
    index: int
    start: int
    end: int

class BubblePosition(BaseModel):
    id: str
    segmentIndex: int
    mediaId: str = ""
    x: float
    y: float
    width: float
    tailDirection: str = "bottom"
    animation: str = "pop"
    colorIndex: int = 0
    shape: str = "rounded"
    transparent: bool = False

class MediaTimelineItem(BaseModel):
    id: str
    startTime: float = 0
    endTime: float = 5
    assignedSegments: List[int] = []

class CreateBubbleVideoRequest(BaseModel):
    project_id: str
    bubble_positions: List[BubblePosition] = []
    media_timeline: List[MediaTimelineItem] = []
    resize: str = "16:9"
    subtitles: bool = False
    animated_subtitles: bool = True
    subtitle_style: str = "karaoke"
    subtitle_size: int = 72
    subtitle_position: str = "bottom"
    dialogue_mode: bool = False
    speaker1_position: str = "top-left"
    speaker2_position: str = "top-right"
    dialogue_bg_style: str = "transparent"
    bg_music: bool = False
    bg_music_volume: float = 0.3

@router.post("/download-source")
async def download_source(request: DownloadRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    youtube_service = YouTubeService()
    source_path = f"./storage/{project.id}/source.mp4"
    
    if not os.path.exists(source_path):
        youtube_service.download_video(project.youtube_url, source_path)
    
    return {"downloaded": True, "path": source_path}

@router.post("/extract-clip")
async def extract_clip(request: ExtractClipRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    source_path = f"./storage/{project.id}/source.mp4"
    if not os.path.exists(source_path):
        raise HTTPException(status_code=400, detail="Source video not downloaded")
    
    video_service = VideoService()
    clip_path = f"./storage/{project.id}/clip_{request.index}.mp4"
    video_service.extract_clip(source_path, request.start, request.end, clip_path)
    
    return {"clip_path": clip_path, "index": request.index}

@router.post("/merge")
async def merge_video(request: MergeRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    video_service = VideoService()
    
    # Get clip paths for each segment
    clip_paths = []
    for i, seg in enumerate(request.segments):
        clip_path = f"./storage/{project.id}/clip_{i}.mp4"
        if os.path.exists(clip_path):
            clip_paths.append(clip_path)
    
    if not clip_paths:
        raise HTTPException(status_code=400, detail="No clips extracted")
    
    audio_path = f"./storage/{project.id}/voice.mp3"
    subtitle_path = f"./storage/{project.id}/subtitles.srt" if request.subtitles else None
    
    if subtitle_path and not os.path.exists(subtitle_path):
        subtitle_path = None
    
    # Use pre-generated background music (from /generate-music endpoint)
    bg_music_path = None
    if request.bg_music:
        bg_music_path = f"./storage/{project.id}/bg_music.mp3"
        if not os.path.exists(bg_music_path):
            bg_music_path = None  # Skip if not generated
    
    output_path = video_service.merge_clips_final(
        project.id, clip_paths, audio_path, subtitle_path, request.resize,
        bg_music_path, request.bg_music_volume, request.animated_subtitles, request.subtitle_style
    )
    
    project.status = "completed"
    await db.commit()
    
    return {"output_path": output_path, "status": "completed"}

@router.post("/thumbnail")
async def generate_thumbnail(request: ThumbnailRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.services.ai import GeminiService
    ai_service = GeminiService()
    
    script_text = request.script or project.script or project.title
    
    # Step 1: Generate title and image prompt in specified language
    prompt_data = await ai_service.generate_thumbnail_prompt(script_text, project.title, request.language)
    title_text = prompt_data.get("title", "WATCH NOW")
    image_prompt = prompt_data.get("image", f"dramatic scene about {project.title}")
    
    # Save prompt for reference
    prompt_path = f"./storage/{project.id}/thumbnail_prompt.txt"
    os.makedirs(os.path.dirname(prompt_path), exist_ok=True)
    with open(prompt_path, "w", encoding="utf-8") as f:
        f.write(f"Title: {title_text}\nImage: {image_prompt}")
    
    # Step 2: Generate thumbnail with selected model
    thumbnail_path = f"./storage/{project.id}/thumbnail.png"
    try:
        await ai_service.generate_thumbnail_image(title_text, image_prompt, thumbnail_path, request.model)
        return {
            "thumbnail_prompt": f"{title_text} - {image_prompt}",
            "thumbnail_title": title_text,
            "thumbnail_path": thumbnail_path,
            "generated": True
        }
    except Exception as e:
        return {
            "thumbnail_prompt": f"{title_text} - {image_prompt}",
            "thumbnail_title": title_text,
            "error": str(e),
            "generated": False
        }

class ThumbnailPromptRequest(BaseModel):
    project_id: str
    script: str = ""
    language: str = "English"
    image_style: str = "cartoon"
    video_type: str = "tutorial"

@router.post("/thumbnail-prompt")
async def generate_thumbnail_prompt(request: ThumbnailPromptRequest, db: AsyncSession = Depends(get_db)):
    """Generate just the thumbnail prompt without creating the image"""
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.services.ai import GeminiService
    ai_service = GeminiService()
    
    script_text = request.script or project.script or project.title
    prompt_data = await ai_service.generate_thumbnail_prompt(
        script_text, project.title, request.language, request.image_style, request.video_type
    )
    image_prompt = prompt_data.get("image", f"dramatic scene about {project.title}")
    title_text = prompt_data.get("title", "")
    
    return {"prompt": image_prompt, "title": title_text}

class ThumbnailFromPromptRequest(BaseModel):
    project_id: str
    prompt: str
    model: str = "gemini-3-pro"
    image_style: str = "cartoon"
    video_type: str = "tutorial"
    title: str = ""
    title_position: str = ""

@router.post("/thumbnail-from-prompt")
async def generate_thumbnail_from_prompt(request: ThumbnailFromPromptRequest, db: AsyncSession = Depends(get_db)):
    """Generate thumbnail image from a custom prompt"""
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.services.ai import GeminiService
    ai_service = GeminiService()
    
    thumbnail_path = f"./storage/{project.id}/thumbnail.png"
    os.makedirs(os.path.dirname(thumbnail_path), exist_ok=True)
    
    title = request.title if request.title_position else ""
    
    try:
        await ai_service.generate_thumbnail_image(title, request.prompt, thumbnail_path, request.model, request.image_style, request.title_position)
        return {"generated": True, "path": thumbnail_path}
    except Exception as e:
        return {"generated": False, "error": str(e)}

@router.get("/preview-clip/{project_id}/{index}")
async def preview_clip(project_id: str, index: int):
    clip_path = f"./storage/{project_id}/clip_{index}.mp4"
    if not os.path.exists(clip_path):
        raise HTTPException(status_code=404, detail="Clip not found")
    return FileResponse(clip_path, media_type="video/mp4")

@router.post("/upload-thumbnail")
async def upload_thumbnail(project_id: str = Form(...), file: UploadFile = File(...)):
    """Upload a custom thumbnail image"""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
        raise HTTPException(status_code=400, detail="Invalid image format")
    
    project_dir = f"./storage/{project_id}"
    os.makedirs(project_dir, exist_ok=True)
    thumbnail_path = f"{project_dir}/thumbnail.png"
    
    content = await file.read()
    from PIL import Image
    import io
    img = Image.open(io.BytesIO(content))
    img.save(thumbnail_path, "PNG")
    
    return {"uploaded": True, "path": thumbnail_path}


class ThumbnailFromMediaRequest(BaseModel):
    project_id: str
    media_id: str
    title: str = ""
    font_size: str = "medium"
    font_style: str = "bold"
    position: str = "bottom"
    text_color: str = "#FFFFFF"
    stroke_color: str = "#000000"
    stroke_width: int = 3
    effect: str = "glow"


def get_unicode_font(size: int, bold: bool = True):
    """Get a font that supports multiple languages including Bengali, Hindi, Arabic, etc."""
    from PIL import ImageFont
    import subprocess
    import urllib.request
    
    fonts_dir = "./storage/fonts"
    os.makedirs(fonts_dir, exist_ok=True)
    noto_font_path = f"{fonts_dir}/NotoSans-Regular.ttf"
    
    if not os.path.exists(noto_font_path):
        try:
            url = "https://cdn.jsdelivr.net/gh/nicokempe/Noto-Sans-Font@main/fonts/NotoSans-Regular.ttf"
            urllib.request.urlretrieve(url, noto_font_path)
        except Exception as e:
            print(f"Failed to download Noto Sans: {e}")
    
    font_paths = [
        "/System/Library/Fonts/KohinoorBangla.ttc",
        "/System/Library/Fonts/Kohinoor.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        noto_font_path,
        "/usr/share/fonts/truetype/noto/NotoSansBengali-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf",
        "/usr/share/fonts/truetype/lohit-bengali/Lohit-Bengali.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ]
    
    for path in font_paths:
        if os.path.exists(path):
            try:
                if path.endswith(".ttc"):
                    font = ImageFont.truetype(path, size, index=0)
                else:
                    font = ImageFont.truetype(path, size)
                return font
            except Exception as e:
                print(f"Failed to load font {path}: {e}")
                continue
    
    try:
        result = subprocess.run(["fc-list", ":lang=bn", "-f", "%{file}\n"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            for font_file in result.stdout.strip().split("\n"):
                if font_file and os.path.exists(font_file):
                    try:
                        return ImageFont.truetype(font_file, size)
                    except:
                        continue
    except:
        pass
    
    print("WARNING: No Bengali font found, using default font")
    return ImageFont.load_default()


def add_animated_text(img, title: str, font, position: str, text_color: str, stroke_color: str, effect: str):
    """Add animated-style text with effects like glow, shadow, gradient"""
    from PIL import Image, ImageDraw, ImageFilter
    
    w, h = img.size
    bbox = font.getbbox(title)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (w - text_w) // 2
    
    if position == "top":
        y = int(h * 0.08)
    elif position == "center":
        y = (h - text_h) // 2
    else:
        y = int(h * 0.85) - text_h
    
    if effect == "glow":
        glow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow_layer)
        glow_color = text_color.replace("#", "")
        r, g, b = int(glow_color[0:2], 16), int(glow_color[2:4], 16), int(glow_color[4:6], 16)
        for i in range(15, 0, -3):
            alpha = int(80 - i * 4)
            glow_draw.text((x, y), title, font=font, fill=(r, g, b, alpha))
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=8))
        img = Image.alpha_composite(img, glow_layer)
    
    text_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    text_draw = ImageDraw.Draw(text_layer)
    
    if effect == "shadow" or effect == "glow":
        shadow_offset = max(4, int(text_h * 0.08))
        text_draw.text((x + shadow_offset, y + shadow_offset), title, font=font, fill=(0, 0, 0, 180))
    
    stroke_w = max(3, int(text_h * 0.06))
    for dx in range(-stroke_w, stroke_w + 1):
        for dy in range(-stroke_w, stroke_w + 1):
            if dx * dx + dy * dy <= stroke_w * stroke_w:
                text_draw.text((x + dx, y + dy), title, font=font, fill=stroke_color)
    
    text_draw.text((x, y), title, font=font, fill=text_color)
    
    return Image.alpha_composite(img, text_layer)


@router.post("/set-thumbnail-from-media")
async def set_thumbnail_from_media(req: ThumbnailFromMediaRequest):
    """Set a media file as the project thumbnail with animated title overlay"""
    from PIL import Image
    
    project_dir = f"./storage/{req.project_id}"
    media_dir = f"{project_dir}/media"
    
    media_path = None
    for ext in [".png", ".jpg", ".jpeg", ".webp"]:
        path = f"{media_dir}/{req.media_id}{ext}"
        if os.path.exists(path):
            media_path = path
            break
    
    if not media_path:
        raise HTTPException(status_code=404, detail="Media file not found")
    
    img = Image.open(media_path).convert("RGBA")
    
    if req.title:
        w, h = img.size
        size_map = {"small": int(h * 0.07), "medium": int(h * 0.10), "large": int(h * 0.14), "xlarge": int(h * 0.18)}
        font_size = size_map.get(req.font_size, int(h * 0.10))
        font = get_unicode_font(font_size, req.font_style == "bold")
        img = add_animated_text(img, req.title, font, req.position, req.text_color, req.stroke_color, req.effect)
    
    thumbnail_path = f"{project_dir}/thumbnail.png"
    img.convert("RGB").save(thumbnail_path, "PNG")
    
    return {"success": True}


@router.get("/thumbnail/{project_id}")
async def get_thumbnail(project_id: str):
    png_path = f"./storage/{project_id}/thumbnail.png"
    jpg_path = f"./storage/{project_id}/thumbnail.jpg"
    
    if os.path.exists(png_path):
        return FileResponse(png_path, media_type="image/png")
    elif os.path.exists(jpg_path):
        return FileResponse(jpg_path, media_type="image/jpeg")
    else:
        raise HTTPException(status_code=404, detail="Thumbnail not found")

@router.get("/preview/{project_id}")
async def preview_video(project_id: str):
    output_path = f"./storage/{project_id}/final.mp4"
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(output_path, media_type="video/mp4")

@router.get("/download/{project_id}")
async def download_video(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    output_path = f"./storage/{project_id}/final.mp4"
    if not os.path.exists(output_path):
        raise HTTPException(status_code=404, detail="Video not found")
    
    return FileResponse(output_path, media_type="video/mp4", filename=f"{project.title[:30]}.mp4")

# Music mood categories for YouTube search
MUSIC_MOODS = [
    {"id": "upbeat", "name": "⚡ Upbeat Energy", "query": "upbeat energetic background music no copyright"},
    {"id": "inspiring", "name": "✨ Inspiring", "query": "inspiring motivational background music no copyright"},
    {"id": "cinematic", "name": "🎬 Cinematic", "query": "cinematic epic background music no copyright"},
    {"id": "happy", "name": "😊 Happy Vibes", "query": "happy cheerful background music no copyright"},
    {"id": "lofi", "name": "🎧 Lo-Fi Chill", "query": "lofi chill beats background music no copyright"},
    {"id": "acoustic", "name": "🎸 Acoustic", "query": "acoustic guitar background music no copyright"},
    {"id": "ambient", "name": "🌊 Ambient Calm", "query": "ambient calm relaxing music no copyright"},
    {"id": "corporate", "name": "💼 Corporate", "query": "corporate business background music no copyright"},
    {"id": "piano", "name": "🎹 Soft Piano", "query": "soft piano background music no copyright"},
    {"id": "tech", "name": "🤖 Tech Modern", "query": "technology modern electronic music no copyright"},
    {"id": "documentary", "name": "📺 Documentary", "query": "documentary background music no copyright"},
    {"id": "jazz", "name": "🎷 Jazz Smooth", "query": "smooth jazz background music no copyright"},
    {"id": "suspense", "name": "🔍 Suspense", "query": "suspense mysterious background music no copyright"},
    {"id": "nature", "name": "🌿 Nature", "query": "nature peaceful background music no copyright"},
    {"id": "gaming", "name": "🎮 Gaming", "query": "gaming action background music no copyright"},
    {"id": "dark", "name": "🌑 Dark Cinematic", "query": "dark cinematic intense music no copyright"},
]

class GenerateMusicRequest(BaseModel):
    project_id: str
    preset_id: str

class DownloadMusicRequest(BaseModel):
    video_id: str
    project_id: str

def _search_youtube_music(query: str, limit: int = 5) -> list:
    import subprocess
    import json
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

def _download_youtube_audio(video_id: str, output_path: str) -> dict:
    import subprocess
    url = f"https://youtube.com/watch?v={video_id}"
    cmd = ["yt-dlp", "-x", "--audio-format", "mp3", "-o", output_path, url]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return {"success": result.returncode == 0}

def _search_and_download_youtube(query: str, output_path: str) -> dict:
    """Search YouTube and download first result audio"""
    import subprocess
    import json
    
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

@router.get("/music-library")
async def get_music_library():
    """Get list of music moods with cache status"""
    preview_dir = "./storage/music_previews"
    tracks = []
    for mood in MUSIC_MOODS:
        preview_path = f"{preview_dir}/{mood['id']}.mp3"
        cached = os.path.exists(preview_path)
        artist = ""
        if cached:
            meta_path = f"{preview_dir}/{mood['id']}.json"
            if os.path.exists(meta_path):
                import json
                with open(meta_path) as f:
                    artist = json.load(f).get("artist", "")
        tracks.append({"id": mood["id"], "name": mood["name"], "artist": artist, "cached": cached})
    return {"tracks": tracks}

@router.get("/music-preview/{preset_id}")
async def get_music_preview(preset_id: str):
    """Search YouTube and download audio for mood"""
    import json
    
    mood = next((m for m in MUSIC_MOODS if m["id"] == preset_id), None)
    if not mood:
        raise HTTPException(status_code=400, detail="Invalid mood")
    
    preview_dir = "./storage/music_previews"
    preview_path = f"{preview_dir}/{preset_id}.mp3"
    meta_path = f"{preview_dir}/{preset_id}.json"
    
    if os.path.exists(preview_path):
        return FileResponse(preview_path, media_type="audio/mpeg")
    
    os.makedirs(preview_dir, exist_ok=True)
    result = _search_and_download_youtube(mood["query"], preview_path)
    
    if result["success"]:
        with open(meta_path, "w") as f:
            json.dump({"title": result["title"], "artist": result["artist"]}, f)
        return FileResponse(preview_path, media_type="audio/mpeg")
    
    raise HTTPException(status_code=500, detail="Failed to download audio")

@router.get("/search-music")
async def search_music(q: str):
    """Search YouTube for background music"""
    if not q or len(q) < 2:
        return {"results": []}
    results = _search_youtube_music(q, limit=8)
    return {"results": results}

@router.get("/preview-search-music/{video_id}")
async def preview_search_music(video_id: str):
    """Preview a YouTube video as audio (cached)"""
    preview_dir = "./storage/music_previews/search"
    os.makedirs(preview_dir, exist_ok=True)
    preview_path = f"{preview_dir}/{video_id}.mp3"
    
    if os.path.exists(preview_path):
        return FileResponse(preview_path, media_type="audio/mpeg")
    
    result = _download_youtube_audio(video_id, preview_path)
    if result["success"] and os.path.exists(preview_path):
        return FileResponse(preview_path, media_type="audio/mpeg")
    
    raise HTTPException(status_code=500, detail="Failed to load preview")

@router.post("/download-music")
async def download_music(request: DownloadMusicRequest, db: AsyncSession = Depends(get_db)):
    """Download selected YouTube audio as background music"""
    output_path = f"./storage/{request.project_id}/bg_music.mp3"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    result = _download_youtube_audio(request.video_id, output_path)
    if not result["success"]:
        raise HTTPException(status_code=500, detail="Failed to download")
    return {"path": output_path, "generated": True}

@router.post("/generate-music")
async def generate_background_music(request: GenerateMusicRequest, db: AsyncSession = Depends(get_db)):
    """Copy cached music to project or download fresh"""
    import shutil
    import json
    
    mood = next((m for m in MUSIC_MOODS if m["id"] == request.preset_id), None)
    if not mood:
        raise HTTPException(status_code=400, detail="Invalid mood")
    
    preview_dir = "./storage/music_previews"
    preview_path = f"{preview_dir}/{request.preset_id}.mp3"
    output_path = f"./storage/{request.project_id}/bg_music.mp3"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    if not os.path.exists(preview_path):
        os.makedirs(preview_dir, exist_ok=True)
        result = _search_and_download_youtube(mood["query"], preview_path)
        if not result["success"]:
            raise HTTPException(status_code=500, detail="Failed to download audio")
        meta_path = f"{preview_dir}/{request.preset_id}.json"
        with open(meta_path, "w") as f:
            json.dump({"title": result["title"], "artist": result["artist"]}, f)
    
    shutil.copy2(preview_path, output_path)
    return {"path": output_path, "generated": True}


@router.post("/create-with-bubbles")
async def create_video_from_media(request: CreateBubbleVideoRequest, db: AsyncSession = Depends(get_db)):
    """Create video from media assets assigned per segment"""
    from app.models.project import MediaAsset
    from sqlalchemy import select
    
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = f"./storage/{request.project_id}"
    audio_path = f"{project_dir}/voice.mp3"
    
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=400, detail="Audio not generated yet")
    
    # Get media assets from DB
    result = await db.execute(
        select(MediaAsset).where(MediaAsset.project_id == request.project_id).order_by(MediaAsset.order)
    )
    assets = result.scalars().all()
    
    media_assets = [{"id": a.id, "path": a.file_path, "type": a.media_type} for a in assets]
    
    if not media_assets:
        raise HTTPException(status_code=400, detail="No media assets found")
    
    segments = project.segments_data or []
    if not segments:
        raise HTTPException(status_code=400, detail="No segments found")
    
    # Debug: Print segment media assignments
    print(f"[CREATE VIDEO] {len(segments)} segments, media_ids: {[s.get('media_id') for s in segments[:10]]}...")
    
    # Use existing SRT if available (has correct timing from audio merge)
    # Otherwise generate from segments
    subtitle_path = None
    if request.subtitles:
        existing_srt = f"{project_dir}/subtitles.srt"
        if os.path.exists(existing_srt):
            subtitle_path = existing_srt
        else:
            subtitle_path = f"{project_dir}/subtitles.srt"
            _generate_srt_from_segments(segments, subtitle_path)
    
    bg_music_path = None
    if request.bg_music:
        bg_music_path = f"{project_dir}/bg_music.mp3"
        if not os.path.exists(bg_music_path):
            bg_music_path = None
    
    service = VideoService()
    try:
        output = service.create_video_from_segments(
            request.project_id,
            segments,
            media_assets,
            audio_path,
            request.resize,
            subtitle_path,
            request.animated_subtitles,
            request.subtitle_style,
            request.subtitle_size,
            request.subtitle_position,
            request.dialogue_mode,
            request.speaker1_position,
            request.speaker2_position,
            request.dialogue_bg_style,
            bg_music_path,
            request.bg_music_volume
        )
        
        project.status = "completed"
        await db.commit()
        
        return {"status": "completed", "path": output}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _generate_srt_from_segments(segments: list, output_path: str):
    """Generate SRT subtitle file from segments"""
    def fmt_time(s: float) -> str:
        h, m = int(s // 3600), int((s % 3600) // 60)
        sec, ms = int(s % 60), int((s % 1) * 1000)
        return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"
    
    with open(output_path, "w", encoding="utf-8") as f:
        for i, seg in enumerate(segments, 1):
            start = seg.get("start", 0)
            end = seg.get("end", start + 5)
            text = seg.get("text", "")
            if text:
                f.write(f"{i}\n{fmt_time(start)} --> {fmt_time(end)}\n{text}\n\n")
