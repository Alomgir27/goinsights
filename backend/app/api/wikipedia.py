from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
from app.database import get_db
from app.models.project import Project, MediaAsset
from app.services.wikipedia import WikipediaService
from typing import List
import httpx
import os
import uuid

router = APIRouter()
wiki_service = WikipediaService()

@router.get("/on-this-day")
async def get_on_this_day(lang: str = "en"):
    events = await wiki_service.get_on_this_day(lang=lang)
    return {"events": events}

@router.get("/search")
async def search_wikipedia(q: str, lang: str = "en"):
    if not q or len(q) < 2:
        return {"results": []}
    results = await wiki_service.search(q, lang=lang)
    return {"results": results}

@router.get("/categories")
async def get_categories():
    categories = await wiki_service.get_categories()
    return {"categories": categories}

@router.get("/article/{title:path}")
async def get_article(title: str, lang: str = "en", timeout: float = 60.0):
    service = WikipediaService(timeout=timeout) if timeout != 60.0 else wiki_service
    article = await service.get_article(title, lang=lang)
    if "error" in article:
        raise HTTPException(status_code=404, detail=article["error"])
    return article

class CreateWikiProjectRequest(BaseModel):
    title: str
    article_title: str
    extract: str
    sections: List[dict] = []
    duration: int = 60
    language: str = "English"

@router.post("/create-project")
async def create_wiki_project(request: CreateWikiProjectRequest, db: AsyncSession = Depends(get_db)):
    project = Project(
        id=str(uuid.uuid4()),
        title=request.title,
        project_type="wikipedia",
        language=request.language,
        duration=request.duration,
        prompt=request.extract[:1000],
        status="draft"
    )
    project.segments_data = []
    project.wiki_data = {
        "article_title": request.article_title,
        "extract": request.extract,
        "sections": request.sections
    }
    
    db.add(project)
    await db.commit()
    await db.refresh(project)
    
    return {"project_id": project.id, "title": project.title}

class CollectMediaRequest(BaseModel):
    project_id: str
    media: List[dict] = []
    images: List[dict] = []

@router.post("/collect-media")
async def collect_media(request: CollectMediaRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_dir = f"./storage/{project.id}/media"
    os.makedirs(project_dir, exist_ok=True)
    
    items = request.media if request.media else request.images
    
    collected = []
    headers = {
        "User-Agent": "GoInsights/1.0 (https://goinsights.app; video generation tool) Python/httpx",
        "Referer": "https://commons.wikimedia.org/",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8"
    }
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        for i, item in enumerate(items):
            try:
                response = await client.get(item["url"], timeout=60.0)
                if response.status_code != 200:
                    print(f"[WIKI] Failed to download {item['url']}: {response.status_code}")
                    continue
                
                media_type = item.get("type", "image")
                url = item["url"]
                ext = url.split(".")[-1].split("?")[0][:5].lower()
                
                if media_type == "video":
                    if ext not in ["ogv", "webm", "mp4"]:
                        ext = "mp4"
                else:
                    if ext not in ["jpg", "jpeg", "png", "gif", "webp"]:
                        ext = "jpg"
                
                media_id = str(uuid.uuid4())
                file_path = f"{project_dir}/{media_id}.{ext}"
                
                with open(file_path, "wb") as f:
                    f.write(response.content)
                
                asset = MediaAsset(
                    id=media_id,
                    project_id=project.id,
                    file_path=file_path,
                    media_type=media_type,
                    source="wikipedia",
                    prompt=item.get("description", item.get("title", "")),
                    order=i
                )
                db.add(asset)
                collected.append({
                    "id": media_id,
                    "title": item.get("title"),
                    "type": media_type,
                    "path": file_path
                })
            except Exception:
                continue
    
    await db.commit()
    return {"collected": len(collected), "media": collected}

