from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.project import Project, MediaAsset
from app.config import get_settings
from pydantic import BaseModel
import os
import uuid
import subprocess
from PIL import Image

router = APIRouter()

class GenerateImageRequest(BaseModel):
    project_id: str
    prompt: str
    segment_index: int = 0
    model: str = "gemini-2.5-flash"

class SuggestPromptRequest(BaseModel):
    project_id: str
    segments: list = []
    script: str = ""

class BatchGenerateRequest(BaseModel):
    project_id: str
    segments: list
    model: str = "gemini-2.5-flash"
    count: int = 0

class ImageToVideoRequest(BaseModel):
    project_id: str
    media_id: str
    duration: float = 5.0
    effect: str = "zoom_in"

@router.post("/upload")
async def upload_media(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    settings = get_settings()
    project_dir = f"{settings.storage_path}/{project_id}/media"
    os.makedirs(project_dir, exist_ok=True)
    
    ext = os.path.splitext(file.filename)[1].lower()
    media_type = "video" if ext in [".mp4", ".mov", ".avi", ".webm"] else "image"
    
    media_id = str(uuid.uuid4())
    file_path = f"{project_dir}/{media_id}{ext}"
    
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    duration = None
    width, height = None, None
    
    if media_type == "image":
        with Image.open(file_path) as img:
            width, height = img.size
    else:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0", 
             "-show_entries", "stream=width,height,duration", "-of", "csv=p=0", file_path],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            parts = result.stdout.strip().split(",")
            if len(parts) >= 3:
                width, height = int(parts[0]), int(parts[1])
                duration = float(parts[2]) if parts[2] else None
    
    result = await db.execute(
        select(MediaAsset).where(MediaAsset.project_id == project_id)
    )
    order = len(result.scalars().all())
    
    asset = MediaAsset(
        id=media_id,
        project_id=project_id,
        media_type=media_type,
        source="upload",
        file_path=file_path,
        original_filename=file.filename,
        duration=duration,
        width=width,
        height=height,
        order=order
    )
    db.add(asset)
    await db.commit()
    
    return {
        "id": media_id, "type": media_type, "source": "upload", "path": file_path,
        "duration": duration, "width": width, "height": height, "order": order
    }

@router.post("/generate-image")
async def generate_image(request: GenerateImageRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.services.gemini import GeminiService
    service = GeminiService()
    
    settings = get_settings()
    project_dir = f"{settings.storage_path}/{request.project_id}/media"
    os.makedirs(project_dir, exist_ok=True)
    
    media_id = str(uuid.uuid4())
    file_path = f"{project_dir}/{media_id}.png"
    
    await service.generate_segment_image(request.prompt, file_path, request.model)
    
    width, height = None, None
    if os.path.exists(file_path):
        with Image.open(file_path) as img:
            width, height = img.size
    
    result = await db.execute(
        select(MediaAsset).where(MediaAsset.project_id == request.project_id)
    )
    order = len(result.scalars().all())
    
    asset = MediaAsset(
        id=media_id,
        project_id=request.project_id,
        media_type="image",
        source="ai_generated",
        file_path=file_path,
        prompt=request.prompt,
        width=width,
        height=height,
        order=order
    )
    db.add(asset)
    await db.commit()
    
    return {"id": media_id, "type": "image", "source": "ai_generated", "path": file_path, "prompt": request.prompt, "order": order}

@router.post("/suggest-prompt")
async def suggest_image_prompt(request: SuggestPromptRequest, db: AsyncSession = Depends(get_db)):
    """AI generates image prompt based on script/segments context"""
    from app.services.gemini import GeminiService
    service = GeminiService()
    
    prompt = await service.generate_image_prompt(request.segments, request.script)
    return {"prompt": prompt}


class GeneratePromptsRequest(BaseModel):
    project_id: str
    segments: list
    count: int = 3


@router.post("/generate-prompts")
async def generate_prompts_only(request: GeneratePromptsRequest, db: AsyncSession = Depends(get_db)):
    """Generate image prompts from segments (without generating images)"""
    from app.services.gemini import GeminiService
    service = GeminiService()
    
    prompts = await service.generate_batch_prompts(request.segments, request.count)
    return {"prompts": prompts}


@router.post("/generate-batch")
async def generate_batch_images(request: BatchGenerateRequest, db: AsyncSession = Depends(get_db)):
    """Generate multiple images based on script analysis"""
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.services.gemini import GeminiService
    service = GeminiService()
    
    prompts = await service.generate_batch_prompts(request.segments, request.count)
    
    settings = get_settings()
    project_dir = f"{settings.storage_path}/{request.project_id}/media"
    os.makedirs(project_dir, exist_ok=True)
    
    generated = []
    for p in prompts:
        media_id = str(uuid.uuid4())
        file_path = f"{project_dir}/{media_id}.png"
        
        await service.generate_segment_image(p["prompt"], file_path, request.model)
        
        width, height = None, None
        if os.path.exists(file_path):
            with Image.open(file_path) as img:
                width, height = img.size
        
        result = await db.execute(
            select(MediaAsset).where(MediaAsset.project_id == request.project_id)
        )
        order = len(result.scalars().all())
        
        asset = MediaAsset(
            id=media_id,
            project_id=request.project_id,
            media_type="image",
            source="ai_generated",
            file_path=file_path,
            prompt=p["prompt"],
            width=width,
            height=height,
            order=order
        )
        db.add(asset)
        await db.commit()
        
        generated.append({
            "id": media_id,
            "type": "image",
            "source": "ai_generated",
            "prompt": p["prompt"],
            "order": order,
            "timestamp": p.get("timestamp", 0)
        })
    
    return {"images": generated, "count": len(generated)}

@router.post("/image-to-video")
async def convert_image_to_video(request: ImageToVideoRequest, db: AsyncSession = Depends(get_db)):
    asset = await db.get(MediaAsset, request.media_id)
    if not asset or asset.media_type != "image":
        raise HTTPException(status_code=404, detail="Image not found")
    
    from app.services.video import VideoService
    video_service = VideoService()
    
    output_path = asset.file_path.replace(".png", ".mp4").replace(".jpg", ".mp4")
    video_service.image_to_video(asset.file_path, output_path, request.duration, request.effect)
    
    return {"video_path": output_path, "duration": request.duration}

@router.get("/{project_id}")
async def list_media(project_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MediaAsset).where(MediaAsset.project_id == project_id).order_by(MediaAsset.order)
    )
    assets = result.scalars().all()
    return [
        {"id": a.id, "type": a.media_type, "source": a.source, "path": a.file_path,
         "duration": a.duration, "width": a.width, "height": a.height, 
         "prompt": a.prompt, "order": a.order}
        for a in assets
    ]

@router.get("/file/{media_id}")
async def get_media_file(media_id: str, db: AsyncSession = Depends(get_db)):
    asset = await db.get(MediaAsset, media_id)
    if not asset or not os.path.exists(asset.file_path):
        raise HTTPException(status_code=404, detail="Media not found")
    
    media_type = "image/png" if asset.media_type == "image" else "video/mp4"
    return FileResponse(asset.file_path, media_type=media_type)

@router.delete("/{media_id}")
async def delete_media(media_id: str, db: AsyncSession = Depends(get_db)):
    asset = await db.get(MediaAsset, media_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Media not found")
    
    if os.path.exists(asset.file_path):
        os.remove(asset.file_path)
    
    await db.delete(asset)
    await db.commit()
    
    return {"status": "deleted"}

