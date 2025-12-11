from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from app.database import get_db
from app.models.project import Project

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

