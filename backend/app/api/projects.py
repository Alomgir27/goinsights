from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.project import Project

router = APIRouter()

@router.get("")
async def list_projects(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Project).order_by(Project.created_at.desc()))
    projects = result.scalars().all()
    return [
        {
            "id": p.id,
            "title": p.title,
            "thumbnail": p.thumbnail_url,
            "status": p.status,
            "created_at": p.created_at.isoformat()
        }
        for p in projects
    ]

@router.get("/{project_id}")
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "id": project.id,
        "youtube_url": project.youtube_url,
        "video_id": project.video_id,
        "title": project.title,
        "description": project.description,
        "thumbnail": project.thumbnail_url,
        "duration": project.duration,
        "transcript": project.transcript,
        "summary": project.summary,
        "script": project.script,
        "status": project.status,
        "created_at": project.created_at.isoformat()
    }

@router.delete("/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    await db.delete(project)
    await db.commit()
    return {"status": "deleted"}

