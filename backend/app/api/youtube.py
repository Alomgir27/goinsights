from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.youtube import YouTubeService
from app.models.project import Project

router = APIRouter()

class ExtractRequest(BaseModel):
    url: str

class ExtractResponse(BaseModel):
    project_id: str
    video_id: str
    title: str
    description: str
    thumbnail: str
    duration: int
    transcript: list[dict]
    channel: Optional[str] = None
    view_count: Optional[int] = None
    tags: Optional[list[str]] = None

class TranscriptionResponse(BaseModel):
    project_id: str
    status: str
    transcription: Optional[dict] = None

@router.post("/extract", response_model=ExtractResponse)
async def extract_video(request: ExtractRequest, db: AsyncSession = Depends(get_db)):
    """Extract basic video info and quick transcript"""
    try:
        service = YouTubeService()
        info = service.get_video_info(request.url)
        
        project = Project(
            youtube_url=request.url,
            video_id=info["video_id"],
            title=info["title"],
            description=info["description"],
            thumbnail_url=info["thumbnail"],
            duration=info["duration"],
            transcript=info["transcript"],
            channel=info.get("channel"),
            tags=info.get("tags", []),
            status="extracted"
        )
        db.add(project)
        await db.commit()
        await db.refresh(project)
        
        return ExtractResponse(
            project_id=project.id,
            video_id=info["video_id"],
            title=info["title"],
            description=info["description"],
            thumbnail=info["thumbnail"],
            duration=info["duration"],
            transcript=info["transcript"],
            channel=info.get("channel"),
            view_count=info.get("view_count"),
            tags=info.get("tags", [])
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract video: {str(e)}")

@router.post("/transcribe/{project_id}", response_model=TranscriptionResponse)
async def transcribe_video(project_id: str, db: AsyncSession = Depends(get_db)):
    """Get detailed transcription with AssemblyAI (speaker diarization, chapters, etc.)"""
    try:
        # Get project
        project = await db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if already transcribed
        if project.detailed_transcription:
            return TranscriptionResponse(
                project_id=project_id,
                status="completed",
                transcription=project.detailed_transcription
            )
        
        # Update status
        project.status = "transcribing"
        await db.commit()
        
        # Get detailed transcription
        service = YouTubeService()
        result = await service.get_detailed_transcription(project.youtube_url)
        
        # Update project with transcription
        project.detailed_transcription = result.get("transcription")
        project.status = "transcribed"
        await db.commit()
        
        return TranscriptionResponse(
            project_id=project_id,
            status="completed",
            transcription=project.detailed_transcription
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@router.get("/transcription-status/{project_id}")
async def get_transcription_status(project_id: str, db: AsyncSession = Depends(get_db)):
    """Check transcription status"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "project_id": project_id,
        "status": project.status,
        "has_transcription": project.detailed_transcription is not None
    }
