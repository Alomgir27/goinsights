from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
import os
from app.database import get_db
from app.models.project import Project
from app.services.youtube import YouTubeService

router = APIRouter()


class CreateRequest(BaseModel):
    url: str


class SearchRequest(BaseModel):
    query: str
    max_results: int = 15


class AnalyzeRequest(BaseModel):
    min_duration: int = 15
    max_duration: int = 90


class EffectsConfig(BaseModel):
    blur: bool = True
    zoom: str = "none"
    animation: str = "none"
    vignette: bool = False
    speed: float = 1.0
    colorGrade: str = "none"
    overlay: str = "none"


class OptionsConfig(BaseModel):
    subtitles: bool = True
    keepAudio: bool = True
    aspectRatio: str = "9:16"
    antiCopyright: bool = True  # Pitch shift audio to avoid detection


class GenerateRequest(BaseModel):
    segment_start: float
    segment_end: float
    effects: EffectsConfig
    options: OptionsConfig


@router.post("/create")
async def create_inshorts(request: CreateRequest, db: AsyncSession = Depends(get_db)):
    try:
        service = YouTubeService()
        info = service.get_video_info(request.url)
        
        project = Project(
            project_type="inshorts",
            youtube_url=request.url,
            video_id=info["video_id"],
            title=info["title"],
            description=info["description"],
            thumbnail_url=info["thumbnail"],
            duration=info["duration"],
            transcript=info["transcript"],
            channel=info.get("channel"),
            tags=info.get("tags", []),
            inshorts_options={"subtitles": True, "keepAudio": True, "aspectRatio": "9:16"},
            inshorts_effects={"blur": True, "zoom": "none", "shake": False, "vignette": False, "speed": 1, "colorGrade": "none"},
            status="extracted"
        )
        db.add(project)
        await db.commit()
        await db.refresh(project)
        
        os.makedirs(f"./storage/{project.id}", exist_ok=True)
        
        return {
            "id": project.id,
            "video_id": info["video_id"],
            "title": info["title"],
            "thumbnail": info["thumbnail"],
            "duration": info["duration"],
            "transcript": info["transcript"],
            "channel": info.get("channel")
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create inshorts: {str(e)}")


@router.post("/search")
async def search_videos(request: SearchRequest):
    import subprocess
    import json
    
    try:
        result = subprocess.run(
            ["yt-dlp", "--cookies", "www.youtube.com_cookies.txt", "-j", "--flat-playlist",
             "--playlist-end", str(request.max_results), f"ytsearch{request.max_results}:{request.query}"],
            capture_output=True, text=True, timeout=30,
            cwd="/Users/alomgir/workspace/goinsights/backend"
        )
        
        videos = []
        for line in result.stdout.strip().split('\n'):
            if not line:
                continue
            try:
                item = json.loads(line)
                video_id = item.get("id", "")
                if not video_id:
                    continue
                    
                duration_secs = item.get("duration", 0) or 0
                videos.append({
                    "id": video_id,
                    "title": item.get("title", ""),
                    "thumbnail": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                    "duration": duration_secs,
                    "duration_formatted": f"{int(duration_secs // 60)}:{int(duration_secs % 60):02d}",
                    "channel": item.get("channel", "") or item.get("uploader", ""),
                    "views": item.get("view_count", 0)
                })
            except json.JSONDecodeError:
                continue
        
        return {"videos": videos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/{project_id}/analyze")
async def analyze_video(project_id: str, request: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    from app.services.inshorts.analyzer import analyze_for_shorts
    
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    segments = await analyze_for_shorts(
        transcript=project.transcript or [],
        duration=project.duration,
        min_duration=request.min_duration,
        max_duration=request.max_duration
    )
    
    project.inshorts_segments = segments
    flag_modified(project, "inshorts_segments")
    await db.commit()
    
    return {"segments": segments}


@router.get("/{project_id}")
async def get_inshorts(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "id": project.id,
        "project_type": project.project_type,
        "video_id": project.video_id,
        "youtube_url": project.youtube_url,
        "title": project.title,
        "thumbnail_url": project.thumbnail_url,
        "duration": project.duration,
        "transcript": project.transcript,
        "channel": project.channel,
        "inshorts_segments": project.inshorts_segments,
        "inshorts_selected": project.inshorts_selected,
        "inshorts_effects": project.inshorts_effects,
        "inshorts_options": project.inshorts_options,
        "status": project.status
    }


@router.post("/{project_id}/select")
async def select_segment(project_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.inshorts_selected = {"start": data.get("start", 0), "end": data.get("end", 60)}
    flag_modified(project, "inshorts_selected")
    await db.commit()
    
    return {"status": "selected", "segment": project.inshorts_selected}


@router.post("/{project_id}/effects")
async def update_effects(project_id: str, effects: EffectsConfig, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.inshorts_effects = effects.model_dump()
    flag_modified(project, "inshorts_effects")
    await db.commit()
    
    return {"status": "updated", "effects": project.inshorts_effects}


@router.post("/{project_id}/generate")
async def generate_short(project_id: str, request: GenerateRequest, db: AsyncSession = Depends(get_db)):
    import threading
    from app.services.inshorts.composer import generate_inshort
    
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.inshorts_selected = {"start": request.segment_start, "end": request.segment_end}
    project.inshorts_effects = request.effects.model_dump()
    project.inshorts_options = request.options.model_dump()
    project.status = "generating"
    flag_modified(project, "inshorts_selected")
    flag_modified(project, "inshorts_effects")
    flag_modified(project, "inshorts_options")
    await db.commit()
    
    thread = threading.Thread(
        target=generate_inshort,
        kwargs={
            "project_id": project_id,
            "youtube_url": project.youtube_url,
            "start": request.segment_start,
            "end": request.segment_end,
            "effects": request.effects.model_dump(),
            "options": request.options.model_dump(),
            "transcript": project.transcript
        }
    )
    thread.start()
    
    return {"status": "generating", "message": "Short video generation started"}


@router.get("/{project_id}/status")
async def get_status(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    has_video = os.path.exists(f"./storage/{project_id}/short.mp4")
    # Respect actual project status - only show completed if status is completed AND video exists
    status = project.status
    video_ready = has_video and status == "completed"
    
    return {
        "status": status,
        "has_video": video_ready,
        "video_url": f"/api/inshorts/{project_id}/video" if video_ready else None
    }


@router.get("/{project_id}/video")
async def get_video(project_id: str, download: bool = False):
    from fastapi.responses import FileResponse
    
    video_path = f"./storage/{project_id}/short.mp4"
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video not found")
    
    if download:
        return FileResponse(video_path, media_type="video/mp4", filename="short.mp4")
    
    return FileResponse(video_path, media_type="video/mp4")


# ==================== BATCH SHORTS ====================

class BatchSuggestRequest(BaseModel):
    count: int = 5
    min_duration: int = 15
    max_duration: int = 60


class ShortItem(BaseModel):
    id: str
    start: float
    end: float
    title: str
    description: str
    tags: str
    effects: EffectsConfig
    status: str = "pending"


class BatchUpdateRequest(BaseModel):
    shorts: list[ShortItem]


class BatchGenerateRequest(BaseModel):
    short_ids: list[str]
    default_effects: EffectsConfig
    options: OptionsConfig


@router.post("/{project_id}/batch/suggest")
async def suggest_batch_shorts(project_id: str, request: BatchSuggestRequest, db: AsyncSession = Depends(get_db)):
    """AI suggests multiple segments with titles and descriptions"""
    import google.generativeai as genai
    import json
    import uuid
    from app.config import get_settings
    
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    settings = get_settings()
    genai.configure(api_key=settings.gemini_api_key)
    
    transcript = project.transcript or []
    duration = project.duration or 300
    title = project.title or "Video"
    
    transcript_text = " ".join([t.get("text", "") for t in transcript[:100]])
    
    prompt = f"""Analyze this video and suggest {request.count} short clips for social media.

Video Title: {title}
Duration: {duration} seconds
Transcript: {transcript_text[:2000]}

For each clip suggest:
- start/end times (between {request.min_duration}-{request.max_duration} seconds each)
- catchy title (max 60 chars)
- engaging description (max 150 chars)
- relevant hashtags (5-7 tags)

Return ONLY valid JSON array:
[{{"start": 0, "end": 30, "title": "...", "description": "...", "tags": "#tag1 #tag2"}}]

Make clips interesting, avoid overlapping times, spread across the video."""

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        elif "```" in text:
            text = text.split("```")[1].split("```")[0]
        
        suggestions = json.loads(text)
        
        shorts = []
        for s in suggestions[:request.count]:
            shorts.append({
                "id": str(uuid.uuid4())[:8],
                "start": max(0, s.get("start", 0)),
                "end": min(duration, s.get("end", 30)),
                "title": s.get("title", "Short clip")[:60],
                "description": s.get("description", "")[:150],
                "tags": s.get("tags", ""),
                "effects": {"blur": True, "zoom": "none", "animation": "none", "vignette": False, "speed": 1.0, "colorGrade": "none", "overlay": "none"},
                "status": "pending"
            })
        
        project.inshorts_batch = shorts
        flag_modified(project, "inshorts_batch")
        await db.commit()
        
        return {"shorts": shorts}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{project_id}/batch")
async def update_batch_shorts(project_id: str, request: BatchUpdateRequest, db: AsyncSession = Depends(get_db)):
    """Update batch shorts (titles, times, effects)"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project.inshorts_batch = [s.model_dump() for s in request.shorts]
    flag_modified(project, "inshorts_batch")
    await db.commit()
    
    return {"shorts": project.inshorts_batch}


@router.get("/{project_id}/batch")
async def get_batch_shorts(project_id: str, db: AsyncSession = Depends(get_db)):
    """Get batch shorts"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"shorts": project.inshorts_batch or []}


@router.post("/{project_id}/batch/generate")
async def generate_batch_shorts(project_id: str, request: BatchGenerateRequest, db: AsyncSession = Depends(get_db)):
    """Generate all selected shorts"""
    import threading
    from app.services.inshorts.composer import generate_batch
    
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    shorts = project.inshorts_batch or []
    to_generate = [s for s in shorts if s["id"] in request.short_ids]
    
    if not to_generate:
        raise HTTPException(status_code=400, detail="No shorts to generate")
    
    project.status = "generating"
    await db.commit()
    
    thread = threading.Thread(
        target=generate_batch,
        args=(project_id, project.youtube_url, to_generate, request.default_effects.model_dump(), request.options.model_dump())
    )
    thread.start()
    
    return {"message": f"Generating {len(to_generate)} shorts", "count": len(to_generate)}


@router.get("/{project_id}/batch/{short_id}/video")
async def get_batch_video(project_id: str, short_id: str, download: bool = False):
    """Get generated short video"""
    from fastapi.responses import FileResponse
    
    video_path = f"./storage/{project_id}/short_{short_id}.mp4"
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video not found")
    
    if download:
        return FileResponse(video_path, media_type="video/mp4", filename=f"short_{short_id}.mp4")
    return FileResponse(video_path, media_type="video/mp4")


class UploadShortRequest(BaseModel):
    short_id: str
    title: str
    description: str
    tags: str
    access_token: str
    privacy: str = "public"
    category_id: str = "22"


@router.post("/{project_id}/batch/upload")
async def upload_short_to_youtube(project_id: str, request: UploadShortRequest, db: AsyncSession = Depends(get_db)):
    """Upload a single short to YouTube"""
    import httpx
    
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Handle both single and batch shorts
    if request.short_id == "single":
        video_path = f"./storage/{project_id}/short.mp4"
    else:
        video_path = f"./storage/{project_id}/short_{request.short_id}.mp4"
    
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Short video not found")
    
    video_size = os.path.getsize(video_path)
    tags_list = [t.strip() for t in request.tags.replace("#", "").split() if t.strip()][:20]
    
    metadata = {
        "snippet": {
            "title": request.title[:100],
            "description": request.description + "\n\n#Shorts",
            "tags": tags_list,
            "categoryId": request.category_id
        },
        "status": {"privacyStatus": request.privacy, "selfDeclaredMadeForKids": False}
    }
    
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            init_resp = await client.post(
                "https://www.googleapis.com/upload/youtube/v3/videos",
                params={"uploadType": "resumable", "part": "snippet,status"},
                headers={
                    "Authorization": f"Bearer {request.access_token}",
                    "Content-Type": "application/json",
                    "X-Upload-Content-Type": "video/mp4",
                    "X-Upload-Content-Length": str(video_size)
                },
                json=metadata
            )
            
            if init_resp.status_code != 200:
                raise HTTPException(status_code=init_resp.status_code, detail=f"Upload init failed: {init_resp.text}")
            
            upload_url = init_resp.headers.get("Location")
            if not upload_url:
                raise HTTPException(status_code=500, detail="No upload URL")
            
            with open(video_path, "rb") as f:
                video_data = f.read()
            
            upload_resp = await client.put(
                upload_url,
                content=video_data,
                headers={"Content-Type": "video/mp4", "Content-Length": str(video_size)}
            )
            
            if upload_resp.status_code not in (200, 201):
                raise HTTPException(status_code=upload_resp.status_code, detail=f"Upload failed: {upload_resp.text}")
            
            result = upload_resp.json()
            video_id = result.get("id")
            
            batch = project.inshorts_batch or []
            for s in batch:
                if s["id"] == request.short_id:
                    s["youtube_id"] = video_id
                    s["status"] = "uploaded"
            project.inshorts_batch = batch
            from sqlalchemy.orm.attributes import flag_modified
            flag_modified(project, "inshorts_batch")
            await db.commit()
            
            return {"video_id": video_id, "url": f"https://youtube.com/shorts/{video_id}"}
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Upload timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

