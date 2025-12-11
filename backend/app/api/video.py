from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.video import VideoService
from app.services.youtube import YouTubeService
from app.models.project import Project
from typing import List
import os
import httpx

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
    
    try:
        await ai_service.generate_thumbnail_image(request.title, request.prompt, thumbnail_path, request.model, request.image_style)
        return {"generated": True, "path": thumbnail_path}
    except Exception as e:
        return {"generated": False, "error": str(e)}

@router.get("/preview-clip/{project_id}/{index}")
async def preview_clip(project_id: str, index: int):
    clip_path = f"./storage/{project_id}/clip_{index}.mp4"
    if not os.path.exists(clip_path):
        raise HTTPException(status_code=404, detail="Clip not found")
    return FileResponse(clip_path, media_type="video/mp4")

@router.get("/thumbnail/{project_id}")
async def get_thumbnail(project_id: str):
    # Check for PNG first, then JPG
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

# ElevenLabs Sound Effects presets
ELEVENLABS_SOUND_PRESETS = [
    {"id": "cinematic", "name": "🎬 Cinematic Epic", "prompt": "epic cinematic orchestral background music, dramatic and inspiring"},
    {"id": "upbeat", "name": "⚡ Upbeat Energy", "prompt": "upbeat energetic electronic background music, positive and dynamic"},
    {"id": "ambient", "name": "🌊 Calm Ambient", "prompt": "calm ambient background music, peaceful and relaxing atmosphere"},
    {"id": "tech", "name": "🤖 Tech Modern", "prompt": "modern technology background music, futuristic electronic beats"},
    {"id": "piano", "name": "🎹 Soft Piano", "prompt": "soft piano background music, gentle and emotional melody"},
    {"id": "inspiring", "name": "✨ Inspiring", "prompt": "inspiring motivational background music, uplifting and hopeful"},
    {"id": "documentary", "name": "📺 Documentary", "prompt": "documentary style background music, informative and engaging"},
    {"id": "lofi", "name": "🎧 Lo-Fi Chill", "prompt": "lo-fi chill hop background music, relaxed beats for studying"},
    {"id": "corporate", "name": "💼 Corporate", "prompt": "professional corporate background music, clean and business-like"},
    {"id": "acoustic", "name": "🎸 Acoustic", "prompt": "acoustic guitar background music, warm and organic folk melody"},
    {"id": "synthwave", "name": "🌆 Synthwave", "prompt": "synthwave retro 80s background music, neon electronic vibes"},
    {"id": "jazz", "name": "🎷 Jazz Smooth", "prompt": "smooth jazz background music, sophisticated and classy"},
    {"id": "suspense", "name": "🔍 Suspense", "prompt": "suspenseful mysterious background music, tension and intrigue"},
    {"id": "happy", "name": "😊 Happy", "prompt": "happy cheerful background music, bright and joyful melody"},
    {"id": "dark", "name": "🌑 Dark Intense", "prompt": "dark intense background music, powerful and dramatic"},
    {"id": "nature", "name": "🌿 Nature", "prompt": "nature organic background music, birds and forest ambience"},
    {"id": "gaming", "name": "🎮 Gaming", "prompt": "gaming action background music, intense and exciting"},
    {"id": "meditation", "name": "🧘 Meditation", "prompt": "meditation zen background music, peaceful tibetan bowls"},
    {"id": "news", "name": "📰 News", "prompt": "news broadcast background music, urgent and informative"},
    {"id": "comedy", "name": "😄 Comedy", "prompt": "funny comedy background music, playful and quirky"},
]

class GenerateMusicRequest(BaseModel):
    project_id: str
    preset_id: str

@router.get("/music-library")
async def get_music_library():
    """Get list of ElevenLabs sound presets with cache status"""
    preview_dir = "./storage/music_previews"
    tracks = []
    for preset in ELEVENLABS_SOUND_PRESETS:
        preview_path = f"{preview_dir}/{preset['id']}.mp3"
        tracks.append({**preset, "cached": os.path.exists(preview_path)})
    return {"tracks": tracks}

@router.get("/music-preview/{preset_id}")
async def get_music_preview(preset_id: str):
    """Serve cached music preview or generate new one"""
    from app.config import get_settings
    
    preset = next((p for p in ELEVENLABS_SOUND_PRESETS if p["id"] == preset_id), None)
    if not preset:
        raise HTTPException(status_code=400, detail="Invalid preset")
    
    preview_dir = "./storage/music_previews"
    preview_path = f"{preview_dir}/{preset_id}.mp3"
    
    if os.path.exists(preview_path):
        return FileResponse(preview_path, media_type="audio/mpeg")
    
    # Generate preview if not cached
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
    
    os.makedirs(preview_dir, exist_ok=True)
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.elevenlabs.io/v1/sound-generation",
            headers={"xi-api-key": settings.elevenlabs_api_key, "Content-Type": "application/json"},
            json={"text": preset["prompt"], "duration_seconds": 15, "prompt_influence": 0.3},
            timeout=60.0
        )
        
        if response.status_code == 200:
            with open(preview_path, "wb") as f:
                f.write(response.content)
            return FileResponse(preview_path, media_type="audio/mpeg")
        else:
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs error: {response.text}")

@router.post("/generate-music")
async def generate_background_music(request: GenerateMusicRequest, db: AsyncSession = Depends(get_db)):
    """Generate background music using ElevenLabs Sound Effects API"""
    from app.config import get_settings
    
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
    
    preset = next((p for p in ELEVENLABS_SOUND_PRESETS if p["id"] == request.preset_id), None)
    if not preset:
        raise HTTPException(status_code=400, detail="Invalid preset")
    
    output_path = f"./storage/{request.project_id}/bg_music.mp3"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.elevenlabs.io/v1/sound-generation",
            headers={"xi-api-key": settings.elevenlabs_api_key, "Content-Type": "application/json"},
            json={"text": preset["prompt"], "duration_seconds": 30, "prompt_influence": 0.3},
            timeout=60.0
        )
        
        if response.status_code == 200:
            with open(output_path, "wb") as f:
                f.write(response.content)
            return {"path": output_path, "generated": True}
        else:
            raise HTTPException(status_code=response.status_code, detail=f"ElevenLabs error: {response.text}")


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
            request.dialogue_bg_style
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
