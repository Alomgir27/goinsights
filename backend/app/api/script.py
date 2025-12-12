from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select
from app.database import get_db
from app.models.project import Project, MediaAsset
from typing import List

router = APIRouter()

class GenerateScriptRequest(BaseModel):
    project_id: str
    prompt: str
    duration_seconds: int = 60
    language: str = "English"
    num_segments: int = 0
    video_style: str = "dialogue"

@router.post("/generate")
async def generate_script_from_prompt(request: GenerateScriptRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.services.ai import GeminiService
    service = GeminiService()
    
    num_segments = request.num_segments or max(3, request.duration_seconds // 10)
    
    result = await service.generate_script_from_prompt(
        request.prompt, 
        request.duration_seconds, 
        request.language,
        num_segments,
        request.video_style
    )
    
    project.script = result["script"]
    project.segments_data = result.get("segments", [])
    project.prompt = request.prompt
    project.duration = request.duration_seconds
    flag_modified(project, "segments_data")
    await db.commit()
    await db.refresh(project)
    
    print(f"Generated {len(result.get('segments', []))} segments for project {request.project_id}")
    return result

class GenerateWikiScriptRequest(BaseModel):
    project_id: str
    duration_seconds: int = 60
    language: str = "English"

@router.post("/generate-wiki")
async def generate_wikipedia_script(request: GenerateWikiScriptRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if project.project_type != "wikipedia":
        raise HTTPException(status_code=400, detail="Not a Wikipedia project")
    
    wiki_data = project.wiki_data or {}
    article_content = wiki_data.get("extract", "") or project.prompt or ""
    
    result = await db.execute(
        select(MediaAsset).where(MediaAsset.project_id == project.id).order_by(MediaAsset.order)
    )
    assets = result.scalars().all()
    images = [{"id": a.id, "title": a.original_filename or a.prompt or "", "description": a.prompt or "", "type": a.media_type or "image"} for a in assets]
    
    from app.services.ai import GeminiService
    service = GeminiService()
    
    result = await service.generate_wikipedia_script(
        article_content,
        images,
        request.duration_seconds,
        request.language
    )
    
    project.script = result["script"]
    project.segments_data = result.get("segments", [])
    project.duration = request.duration_seconds
    flag_modified(project, "segments_data")
    await db.commit()
    
    return result


class ReassignMediaRequest(BaseModel):
    project_id: str


@router.post("/reassign-media")
async def reassign_media_to_segments(request: ReassignMediaRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    segments = project.segments_data or []
    if not segments:
        raise HTTPException(status_code=400, detail="No segments found")
    
    result = await db.execute(
        select(MediaAsset).where(MediaAsset.project_id == project.id).order_by(MediaAsset.order)
    )
    assets = result.scalars().all()
    if not assets:
        raise HTTPException(status_code=400, detail="No media found")
    
    media_list = [{"id": a.id, "title": a.original_filename or "", "description": a.prompt or "", "type": a.media_type or "image"} for a in assets]
    
    from app.services.ai import GeminiService
    service = GeminiService()
    
    updated = await service.reassign_media_to_segments(segments, media_list)
    
    project.segments_data = updated
    flag_modified(project, "segments_data")
    await db.commit()
    
    return {"status": "updated", "segments": len(updated)}

