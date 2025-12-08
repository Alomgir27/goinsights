from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.services.video import VideoService
from app.services.youtube import YouTubeService
from app.models.project import Project, VideoClip

router = APIRouter()

class ClipData(BaseModel):
    start: float
    end: float

class ExtractClipsRequest(BaseModel):
    project_id: str
    clips: list[ClipData]

@router.post("/extract")
async def extract_clips(request: ExtractClipsRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    youtube_service = YouTubeService()
    video_service = VideoService()
    
    video_path = f"./storage/{project.id}/source.mp4"
    youtube_service.download_video(project.youtube_url, video_path)
    
    clips_data = [{"start": c.start, "end": c.end} for c in request.clips]
    clip_paths = video_service.extract_clips(project.id, video_path, clips_data)
    
    for i, (clip, path) in enumerate(zip(request.clips, clip_paths)):
        db_clip = VideoClip(
            project_id=project.id,
            start_time=int(clip.start),
            end_time=int(clip.end),
            file_path=path,
            order=i
        )
        db.add(db_clip)
    
    project.status = "clips_extracted"
    await db.commit()
    
    return {"clips": [{"path": p, "order": i} for i, p in enumerate(clip_paths)]}

