from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select
from app.database import get_db
from app.models.project import Project, MediaAsset
import os

router = APIRouter()

class CustomProjectRequest(BaseModel):
    title: str
    prompt: str = ""
    duration: int = 60
    video_style: str = "dialogue"
    language: str = "English"

def get_project_thumbnail(project_id: str, thumbnail_url: str) -> str | None:
    if thumbnail_url:
        return thumbnail_url
    if os.path.exists(f"./storage/{project_id}/thumbnail.png"):
        return f"/api/video/thumbnail/{project_id}"
    return None


@router.get("")
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "thumbnail": get_project_thumbnail(p.id, p.thumbnail_url),
            "status": p.status,
            "project_type": p.project_type or "youtube",
            "created_at": p.created_at.isoformat()
        }
        for p in projects
    ]

@router.post("/custom")
async def create_custom_project(request: CustomProjectRequest, db: AsyncSession = Depends(get_db)):
    project = Project(
        project_type="custom",
        title=request.title,
        prompt=request.prompt,
        duration=request.duration,
        video_style=request.video_style,
        language=request.language,
        status="pending"
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    
    os.makedirs(f"./storage/{project.id}", exist_ok=True)
    
    return {"id": project.id, "title": project.title, "project_type": "custom", "video_style": project.video_style}

@router.get("/{project_id}")
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    import json
    
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = f"./storage/{project_id}"
    thumbnail_generated = os.path.exists(f"{project_dir}/thumbnail.png")
    
    thumbnail_prompt = None
    if os.path.exists(f"{project_dir}/thumbnail_prompt.txt"):
        try:
            with open(f"{project_dir}/thumbnail_prompt.txt", "r", encoding="utf-8") as f:
                thumbnail_prompt = f.read()
        except:
            pass
    
    youtube_info = None
    if os.path.exists(f"{project_dir}/youtube_info.json"):
        try:
            with open(f"{project_dir}/youtube_info.json", "r", encoding="utf-8") as f:
                youtube_info = json.load(f)
        except:
            pass
    
    # Load media assets
    media_assets = []
    if project.project_type in ("custom", "ads", "wikipedia"):
        result = await db.execute(
            select(MediaAsset).where(MediaAsset.project_id == project_id).order_by(MediaAsset.order)
        )
        assets = result.scalars().all()
        media_assets = [
            {"id": a.id, "type": a.media_type, "source": a.source, "path": a.file_path, 
             "duration": a.duration, "order": a.order, "prompt": a.prompt}
            for a in assets
        ]
    
    return {
        "id": project.id,
        "project_type": project.project_type or "youtube",
        "video_style": project.video_style or "dialogue",
        "language": project.language or "English",
        "youtube_url": project.youtube_url,
        "video_id": project.video_id,
        "title": project.title,
        "description": project.description,
        "thumbnail_url": project.thumbnail_url,
        "duration": project.duration,
        "prompt": project.prompt,
        "transcript": project.transcript,
        "summary": project.summary,
        "script": project.script,
        "segments_data": project.segments_data,
        "wiki_data": project.wiki_data,
        "status": project.status,
        "created_at": project.created_at.isoformat(),
        "thumbnail_generated": thumbnail_generated,
        "thumbnail_prompt": thumbnail_prompt,
        "youtube_info": youtube_info,
        "media_assets": media_assets
    }

@router.post("/{project_id}/segments")
async def save_segments(project_id: str, data: dict, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    segments = data.get("segments", [])
    segments_data = [
        {
            "text": s.get("text", ""),
            "display_text": s.get("displayText", s.get("display_text", "")),
            "speaker": s.get("speaker", ""),
            "start": s.get("start", 0),
            "end": s.get("end", 0),
            "source_start": s.get("sourceStart", 0),
            "source_end": s.get("sourceEnd", 0),
            "voice_id": s.get("voiceId", s.get("voice_id", "aria")),
            "media_id": s.get("mediaId", s.get("media_id")),
            "media_type": s.get("mediaType", s.get("media_type")),
            "duration": s.get("duration", 8),
            "trim_start": s.get("trimStart", s.get("trim_start", 0)),
            "trim_end": s.get("trimEnd", s.get("trim_end")),
            "effect": s.get("effect", "none"),
            "audio_generated": s.get("audioGenerated", s.get("audio_generated", False)),
        }
        for s in segments
    ]
    
    project.segments_data = segments_data
    flag_modified(project, "segments_data")
    await db.commit()
    await db.refresh(project)
    
    print(f"Saved {len(segments_data)} segments for project {project_id}")
    return {"status": "saved", "count": len(segments_data)}


class UpdateProjectRequest(BaseModel):
    language: str = None
    video_style: str = None

@router.patch("/{project_id}")
async def update_project(project_id: str, data: UpdateProjectRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if data.language:
        project.language = data.language
    if data.video_style:
        project.video_style = data.video_style
    
    await db.commit()
    return {"status": "updated", "language": project.language, "video_style": project.video_style}

@router.delete("/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.delete(project)
    await db.commit()
    return {"status": "deleted"}

