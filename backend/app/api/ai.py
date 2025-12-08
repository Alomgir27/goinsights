from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
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
    duration_seconds: int = 120

class YoutubeInfoRequest(BaseModel):
    project_id: str
    script: str = ""

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
    
    # Build full transcript with timestamps
    transcript_parts = []
    for t in project.transcript:
        start = t.get('start', 0)
        text = t.get('text', '')
        if text.strip():
            transcript_parts.append(f"[{int(start)}s] {text}")
    
    transcript_with_time = "\n".join(transcript_parts)
    
    # Log for debugging
    print(f"Transcript length: {len(transcript_with_time)} chars, {len(project.transcript)} segments")
    
    result = await service.generate_script(transcript_with_time, request.duration_seconds)
    
    project.script = result["script"]
    project.segments_data = result.get("segments", [])  # Save segments to DB
    await db.commit()
    
    return result

@router.post("/youtube-info")
async def generate_youtube_info(request: YoutubeInfoRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    service = GeminiService()
    result = await service.generate_youtube_info(project.title, request.script or project.script or "")
    
    return result

