from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.services.video import VideoService
from app.services.youtube import YouTubeService
from app.services.music import MusicService, search_youtube_music, download_youtube_audio
from app.services.thumbnail import ThumbnailService
from app.services.subtitle import generate_srt_from_segments
from app.models.project import Project, MediaAsset
from app.constants.media import MUSIC_MOODS
from app.schemas.video import (
    DownloadRequest, MergeRequest, ThumbnailRequest, ThumbnailPromptRequest,
    ThumbnailFromPromptRequest, ThumbnailFromMediaRequest, ExtractClipRequest,
    CreateBubbleVideoRequest, GenerateMusicRequest, DownloadMusicRequest
)
import os
import io
from PIL import Image

router = APIRouter()


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
    clip_paths = [f"./storage/{project.id}/clip_{i}.mp4" for i, _ in enumerate(request.segments) 
                  if os.path.exists(f"./storage/{project.id}/clip_{i}.mp4")]
    
    if not clip_paths:
        raise HTTPException(status_code=400, detail="No clips extracted")
    
    audio_path = f"./storage/{project.id}/voice.mp3"
    subtitle_path = f"./storage/{project.id}/subtitles.srt" if request.subtitles and os.path.exists(f"./storage/{project.id}/subtitles.srt") else None
    bg_music_path = f"./storage/{project.id}/bg_music.mp3" if request.bg_music and os.path.exists(f"./storage/{project.id}/bg_music.mp3") else None
    
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
    prompt_data = await ai_service.generate_thumbnail_prompt(script_text, project.title, request.language)
    title_text = prompt_data.get("title", "WATCH NOW")
    image_prompt = prompt_data.get("image", f"dramatic scene about {project.title}")
    
    prompt_path = f"./storage/{project.id}/thumbnail_prompt.txt"
    os.makedirs(os.path.dirname(prompt_path), exist_ok=True)
    with open(prompt_path, "w", encoding="utf-8") as f:
        f.write(f"Title: {title_text}\nImage: {image_prompt}")
    
    thumbnail_path = f"./storage/{project.id}/thumbnail.png"
    try:
        await ai_service.generate_thumbnail_image(title_text, image_prompt, thumbnail_path, request.model)
        return {"thumbnail_prompt": f"{title_text} - {image_prompt}", "thumbnail_title": title_text, "thumbnail_path": thumbnail_path, "generated": True}
    except Exception as e:
        return {"thumbnail_prompt": f"{title_text} - {image_prompt}", "thumbnail_title": title_text, "error": str(e), "generated": False}


@router.post("/thumbnail-prompt")
async def generate_thumbnail_prompt(request: ThumbnailPromptRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.services.ai import GeminiService
    ai_service = GeminiService()
    
    script_text = request.script or project.script or project.title
    prompt_data = await ai_service.generate_thumbnail_prompt(script_text, project.title, request.language, request.image_style, request.video_type)
    return {"prompt": prompt_data.get("image", f"dramatic scene about {project.title}"), "title": prompt_data.get("title", "")}


@router.post("/thumbnail-from-prompt")
async def generate_thumbnail_from_prompt(request: ThumbnailFromPromptRequest, db: AsyncSession = Depends(get_db)):
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
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
        raise HTTPException(status_code=400, detail="Invalid image format")
    
    project_dir = f"./storage/{project_id}"
    os.makedirs(project_dir, exist_ok=True)
    thumbnail_path = f"{project_dir}/thumbnail.png"
    
    content = await file.read()
    img = Image.open(io.BytesIO(content))
    img.save(thumbnail_path, "PNG")
    return {"uploaded": True, "path": thumbnail_path}


@router.post("/set-thumbnail-from-media")
async def set_thumbnail_from_media(req: ThumbnailFromMediaRequest):
    project_dir = f"./storage/{req.project_id}"
    media_dir = f"{project_dir}/media"
    
    media_path = next((f"{media_dir}/{req.media_id}{ext}" for ext in [".png", ".jpg", ".jpeg", ".webp"] if os.path.exists(f"{media_dir}/{req.media_id}{ext}")), None)
    if not media_path:
        raise HTTPException(status_code=404, detail="Media file not found")
    
    thumbnail_service = ThumbnailService()
    success = thumbnail_service.create_from_media(
        media_path, f"{project_dir}/thumbnail.png", req.title, req.font_size, req.font_style,
        req.position, req.text_color, req.stroke_color, req.effect
    )
    return {"success": success}


@router.get("/thumbnail/{project_id}")
async def get_thumbnail(project_id: str):
    png_path = f"./storage/{project_id}/thumbnail.png"
    jpg_path = f"./storage/{project_id}/thumbnail.jpg"
    if os.path.exists(png_path):
        return FileResponse(png_path, media_type="image/png")
    elif os.path.exists(jpg_path):
        return FileResponse(jpg_path, media_type="image/jpeg")
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


@router.get("/music-library")
async def get_music_library():
    music_service = MusicService()
    tracks = music_service.get_music_library(MUSIC_MOODS)
    return {"tracks": tracks}


@router.get("/music-preview/{preset_id}")
async def get_music_preview(preset_id: str):
    mood = next((m for m in MUSIC_MOODS if m["id"] == preset_id), None)
    if not mood:
        raise HTTPException(status_code=400, detail="Invalid mood")
    
    music_service = MusicService()
    preview_path = music_service.get_preview_path(preset_id)
    if preview_path:
        return FileResponse(preview_path, media_type="audio/mpeg")
    
    success, path = music_service.download_preview(preset_id, mood["query"])
    if success:
        return FileResponse(path, media_type="audio/mpeg")
    raise HTTPException(status_code=500, detail="Failed to download audio")


@router.get("/search-music")
async def search_music(q: str):
    if not q or len(q) < 2:
        return {"results": []}
    return {"results": search_youtube_music(q, limit=8)}


@router.get("/preview-search-music/{video_id}")
async def preview_search_music(video_id: str):
    preview_dir = "./storage/music_previews/search"
    os.makedirs(preview_dir, exist_ok=True)
    preview_path = f"{preview_dir}/{video_id}.mp3"
    
    if os.path.exists(preview_path):
        return FileResponse(preview_path, media_type="audio/mpeg")
    
    result = download_youtube_audio(video_id, preview_path)
    if result["success"] and os.path.exists(preview_path):
        return FileResponse(preview_path, media_type="audio/mpeg")
    raise HTTPException(status_code=500, detail="Failed to load preview")


@router.post("/download-music")
async def download_music(request: DownloadMusicRequest, db: AsyncSession = Depends(get_db)):
    music_service = MusicService()
    success, path = music_service.download_to_project(request.video_id, request.project_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to download")
    return {"path": path, "generated": True}


@router.post("/generate-music")
async def generate_background_music(request: GenerateMusicRequest, db: AsyncSession = Depends(get_db)):
    music_service = MusicService()
    success, result = music_service.copy_to_project(request.preset_id, request.project_id, MUSIC_MOODS)
    if not success:
        raise HTTPException(status_code=500 if "Failed" in result else 400, detail=result)
    return {"path": result, "generated": True}


@router.post("/create-with-bubbles")
async def create_video_from_media(request: CreateBubbleVideoRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = f"./storage/{request.project_id}"
    audio_path = f"{project_dir}/voice.mp3"
    
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=400, detail="Audio not generated yet")
    
    result = await db.execute(select(MediaAsset).where(MediaAsset.project_id == request.project_id).order_by(MediaAsset.order))
    assets = result.scalars().all()
    media_assets = [{"id": a.id, "path": a.file_path, "type": a.media_type} for a in assets]
    
    if not media_assets:
        raise HTTPException(status_code=400, detail="No media assets found")
    
    segments = project.segments_data or []
    if not segments:
        raise HTTPException(status_code=400, detail="No segments found")
    
    subtitle_path = None
    if request.subtitles:
        existing_srt = f"{project_dir}/subtitles.srt"
        if os.path.exists(existing_srt):
            subtitle_path = existing_srt
        else:
            subtitle_path = f"{project_dir}/subtitles.srt"
            generate_srt_from_segments(segments, subtitle_path)
    
    bg_music_path = f"{project_dir}/bg_music.mp3" if request.bg_music and os.path.exists(f"{project_dir}/bg_music.mp3") else None
    
    service = VideoService()
    wm = request.watermark
    try:
        output = service.create_video_from_segments(
            request.project_id, segments, media_assets, audio_path, request.resize,
            subtitle_path, request.animated_subtitles, request.subtitle_style, request.subtitle_size,
            request.subtitle_position, request.dialogue_mode, request.speaker1_position, request.speaker2_position,
            request.dialogue_bg_style, bg_music_path, request.bg_music_volume,
            wm.text if wm.enabled else "", wm.position, wm.font_size, wm.opacity
        )
        project.status = "completed"
        await db.commit()
        return {"status": "completed", "path": output}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
