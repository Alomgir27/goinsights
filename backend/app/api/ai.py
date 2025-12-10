from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import select
from app.database import get_db
from app.services.gemini import GeminiService
from app.models.project import Project

router = APIRouter()

class SummarizeRequest(BaseModel):
    project_id: str
    style: str = "detailed"

class AskRequest(BaseModel):
    project_id: str
    question: str

class ScriptRequest(BaseModel):
    project_id: str
    duration_seconds: int = 300
    language: str = "English"

class YoutubeInfoRequest(BaseModel):
    project_id: str
    script: str = ""
    language: str = "English"

@router.post("/summarize")
async def summarize(request: SummarizeRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    service = GeminiService()
    transcript_text = " ".join([t["text"] for t in project.transcript])
    result = await service.summarize(transcript_text, request.style)
    
    project.summary = result["summary"]
    await db.commit()
    
    return result

@router.post("/ask")
async def ask(request: AskRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    service = GeminiService()
    transcript_text = " ".join([t["text"] for t in project.transcript])
    answer = await service.ask(transcript_text, request.question)
    
    return {"question": request.question, "answer": answer}

@router.post("/script")
async def generate_script(request: ScriptRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    service = GeminiService()
    video_duration = project.duration or 300
    
    # Build transcript with timestamps
    transcript_parts = []
    for t in project.transcript:
        start = t.get('start', 0)
        text = t.get('text', '')
        if text.strip():
            transcript_parts.append(f"[{int(start)}s] {text}")
    
    transcript_with_time = "\n".join(transcript_parts)
    
    # Add video duration context
    transcript_with_time = f"VIDEO DURATION: {video_duration} seconds\n\n{transcript_with_time}"
    
    print(f"Transcript: {len(transcript_with_time)} chars, {len(project.transcript)} segments, video: {video_duration}s, lang: {request.language}")
    
    result = await service.generate_script(transcript_with_time, request.duration_seconds, request.language)
    
    # Validate and fix source timestamps to be within video duration
    if result.get("segments"):
        for seg in result["segments"]:
            seg["source_start"] = max(0, min(seg.get("source_start", 0), video_duration - 10))
            seg["source_end"] = max(seg["source_start"] + 5, min(seg.get("source_end", seg["source_start"] + 8), video_duration))
    
    project.script = result["script"]
    project.segments_data = result.get("segments", [])
    flag_modified(project, "segments_data")
    await db.commit()
    await db.refresh(project)
    
    print(f"Generated {len(result.get('segments', []))} segments from transcript")
    return result

@router.post("/youtube-info")
async def generate_youtube_info(request: YoutubeInfoRequest, db: AsyncSession = Depends(get_db)):
    import json
    import os
    
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    service = GeminiService()
    result = await service.generate_youtube_info(project.title, request.script or project.script or "", request.language)
    
    # Save to file for persistence
    project_dir = f"./storage/{request.project_id}"
    os.makedirs(project_dir, exist_ok=True)
    with open(f"{project_dir}/youtube_info.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False)
    
    return result

