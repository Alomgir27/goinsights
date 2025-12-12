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
import httpx
from PIL import Image

router = APIRouter()

IMAGE_STYLES = ["cartoon", "anime", "realistic", "3d_render", "watercolor", "flat_vector", "cinematic"]
ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"]
PROMPT_LANGUAGES = ["en", "es", "fr", "de", "pt", "bn", "hi", "zh", "ja", "ko", "ar", "ru"]

class GenerateImageRequest(BaseModel):
    project_id: str
    prompt: str
    segment_index: int = 0
    model: str = "gemini-2.5-flash"
    image_style: str = "cartoon"
    aspect_ratio: str = "16:9"

class SuggestPromptRequest(BaseModel):
    project_id: str
    segments: list = []
    script: str = ""
    image_style: str = "cartoon"
    aspect_ratio: str = "16:9"
    prompt_language: str = "en"

class BatchGenerateRequest(BaseModel):
    project_id: str
    segments: list
    model: str = "gemini-2.5-flash"
    count: int = 0
    regenerate_characters: bool = False
    language: str = "English"
    image_style: str = "cartoon"
    aspect_ratio: str = "16:9"
    prompt_language: str = "en"

class ImageToVideoRequest(BaseModel):
    project_id: str
    media_id: str
    duration: float = 5.0
    effect: str = "zoom_in"

class RegenerateImageRequest(BaseModel):
    media_id: str
    prompt: str = ""  # Optional new prompt, uses existing if empty
    model: str = "gemini-2.5-flash"
    image_style: str = ""  # Optional, uses project default if empty
    aspect_ratio: str = ""  # Optional, uses existing if empty

class UpdatePromptRequest(BaseModel):
    media_id: str
    prompt: str

class UpdateMediaOrderRequest(BaseModel):
    project_id: str
    media_order: list  # List of media IDs in new order


@router.post("/update-order")
async def update_media_order(request: UpdateMediaOrderRequest, db: AsyncSession = Depends(get_db)):
    """Update the order of media assets"""
    for idx, media_id in enumerate(request.media_order):
        asset = await db.get(MediaAsset, media_id)
        if asset and asset.project_id == request.project_id:
            asset.order = idx
    await db.commit()
    return {"status": "updated", "count": len(request.media_order)}

class StockSearchRequest(BaseModel):
    query: str
    media_type: str = "photos"  # photos or videos
    per_page: int = 15
    orientation: str = ""  # landscape, portrait, square

class StockDownloadRequest(BaseModel):
    project_id: str
    url: str
    source: str = "pexels"
    media_type: str = "image"


def get_best_video_quality(video_files: list) -> dict:
    """Get best quality video file sorted by resolution"""
    sorted_files = sorted(video_files, key=lambda f: (f.get("width", 0) * f.get("height", 0)), reverse=True)
    best = sorted_files[0] if sorted_files else {}
    return {
        "url": best.get("link"),
        "width": best.get("width"),
        "height": best.get("height"),
        "quality": best.get("quality"),
        "file_type": best.get("file_type")
    }

def get_video_qualities(video_files: list) -> list:
    """Return all available quality options"""
    qualities = []
    for f in sorted(video_files, key=lambda x: x.get("width", 0) * x.get("height", 0), reverse=True):
        qualities.append({
            "url": f.get("link"),
            "width": f.get("width"),
            "height": f.get("height"),
            "quality": f.get("quality"),
            "file_type": f.get("file_type")
        })
    return qualities

@router.get("/stock/search")
async def search_stock_media(query: str, media_type: str = "photos", per_page: int = 15, orientation: str = "", page: int = 1):
    settings = get_settings()
    if not settings.pexels_api_key:
        raise HTTPException(status_code=500, detail="Pexels API key not configured")
    
    headers = {"Authorization": settings.pexels_api_key}
    base_url = "https://api.pexels.com"
    
    params = {"query": query, "per_page": per_page, "page": page}
    if orientation:
        params["orientation"] = orientation
    
    async with httpx.AsyncClient() as client:
        if media_type == "videos":
            response = await client.get(f"{base_url}/videos/search", headers=headers, params=params)
        else:
            response = await client.get(f"{base_url}/v1/search", headers=headers, params=params)
        
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail="Pexels API error")
        
        data = response.json()
        
        if media_type == "videos":
            results = []
            for v in data.get("videos", []):
                best = get_best_video_quality(v.get("video_files", []))
                results.append({
                    "id": v["id"],
                    "thumbnail": v["image"],
                    "preview_url": v.get("video_files", [{}])[0].get("link"),
                    "url": best.get("url"),
                    "width": best.get("width") or v["width"],
                    "height": best.get("height") or v["height"],
                    "duration": v["duration"],
                    "source": "pexels",
                    "type": "video",
                    "user": v.get("user", {}).get("name", "Unknown"),
                    "qualities": get_video_qualities(v.get("video_files", []))
                })
            return {"results": results, "total": data.get("total_results", 0)}
        else:
            results = []
            for p in data.get("photos", []):
                src = p.get("src", {})
                results.append({
                    "id": p["id"],
                    "thumbnail": src.get("medium"),
                    "preview_url": src.get("large"),
                    "url": src.get("original"),
                    "width": p["width"],
                    "height": p["height"],
                    "photographer": p.get("photographer", "Unknown"),
                    "source": "pexels",
                    "type": "image",
                    "qualities": [
                        {"label": "Original", "url": src.get("original"), "width": p["width"], "height": p["height"]},
                        {"label": "Large 2x", "url": src.get("large2x"), "width": min(p["width"], 1880)},
                        {"label": "Large", "url": src.get("large"), "width": min(p["width"], 940)},
                        {"label": "Medium", "url": src.get("medium"), "width": min(p["width"], 350)}
                    ]
                })
            return {"results": results, "total": data.get("total_results", 0)}


@router.post("/stock/download")
async def download_stock_media(request: StockDownloadRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    settings = get_settings()
    project_dir = f"{settings.storage_path}/{request.project_id}/media"
    os.makedirs(project_dir, exist_ok=True)
    
    media_id = str(uuid.uuid4())
    ext = ".mp4" if request.media_type == "video" else ".jpg"
    file_path = f"{project_dir}/{media_id}{ext}"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(request.url)
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail="Failed to download media")
        
        with open(file_path, "wb") as f:
            f.write(response.content)
    
    width, height, duration = None, None, None
    if request.media_type == "image":
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
            if len(parts) >= 2:
                width, height = int(parts[0]), int(parts[1])
                duration = float(parts[2]) if len(parts) > 2 and parts[2] else None
    
    db_result = await db.execute(select(MediaAsset).where(MediaAsset.project_id == request.project_id))
    order = len(db_result.scalars().all())
    
    asset = MediaAsset(
        id=media_id,
        project_id=request.project_id,
        media_type=request.media_type,
        source=f"stock_{request.source}",
        file_path=file_path,
        duration=duration,
        width=width,
        height=height,
        order=order
    )
    db.add(asset)
    await db.commit()
    
    return {
        "id": media_id, "type": request.media_type, "source": f"stock_{request.source}",
        "path": file_path, "duration": duration, "width": width, "height": height, "order": order
    }


@router.get("/options")
async def get_image_options():
    """Get available options for image generation"""
    return {
        "image_styles": [
            {"id": "cartoon", "name": "Cartoon / Animation", "desc": "Pixar/Disney style"},
            {"id": "anime", "name": "Anime / Manga", "desc": "Japanese animation"},
            {"id": "realistic", "name": "Realistic", "desc": "Photorealistic"},
            {"id": "3d_render", "name": "3D Render", "desc": "CGI quality"},
            {"id": "watercolor", "name": "Watercolor", "desc": "Artistic painting"},
            {"id": "flat_vector", "name": "Flat Vector", "desc": "Modern minimal"},
            {"id": "cinematic", "name": "Cinematic", "desc": "Film quality"},
        ],
        "aspect_ratios": [
            {"id": "16:9", "name": "Landscape (16:9)", "desc": "YouTube, desktop"},
            {"id": "9:16", "name": "Portrait (9:16)", "desc": "Shorts, mobile"},
            {"id": "1:1", "name": "Square (1:1)", "desc": "Instagram"},
            {"id": "4:3", "name": "Standard (4:3)", "desc": "Classic format"},
            {"id": "3:4", "name": "Portrait (3:4)", "desc": "Vertical"},
            {"id": "21:9", "name": "Ultrawide (21:9)", "desc": "Cinematic"},
        ],
        "prompt_languages": [
            {"id": "en", "name": "English"},
            {"id": "es", "name": "Spanish"},
            {"id": "fr", "name": "French"},
            {"id": "de", "name": "German"},
            {"id": "pt", "name": "Portuguese"},
            {"id": "bn", "name": "Bengali"},
            {"id": "hi", "name": "Hindi"},
            {"id": "zh", "name": "Chinese"},
            {"id": "ja", "name": "Japanese"},
            {"id": "ko", "name": "Korean"},
            {"id": "ar", "name": "Arabic"},
            {"id": "ru", "name": "Russian"},
        ]
    }


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
    
    from app.services.ai import GeminiService
    service = GeminiService()
    
    settings = get_settings()
    project_dir = f"{settings.storage_path}/{request.project_id}/media"
    os.makedirs(project_dir, exist_ok=True)
    
    media_id = str(uuid.uuid4())
    file_path = f"{project_dir}/{media_id}.png"
    
    image_style = request.image_style or project.image_style or "cartoon"
    aspect_ratio = request.aspect_ratio or "16:9"
    
    # Use character sheet, image style and aspect ratio for consistency
    await service.generate_segment_image(request.prompt, file_path, request.model, project.character_sheet, image_style, aspect_ratio)
    
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


@router.post("/regenerate-image")
async def regenerate_image(request: RegenerateImageRequest, db: AsyncSession = Depends(get_db)):
    """Regenerate an existing image with optional new settings"""
    asset = await db.get(MediaAsset, request.media_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Image not found")
    
    project = await db.get(Project, asset.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.services.ai import GeminiService
    service = GeminiService()
    
    # Use new values or fall back to existing/project defaults
    prompt = request.prompt or asset.prompt
    if not prompt:
        raise HTTPException(status_code=400, detail="No prompt available for regeneration")
    
    image_style = request.image_style or project.image_style or "cartoon"
    aspect_ratio = request.aspect_ratio or "16:9"
    
    # Generate new image to same path (overwrite)
    await service.generate_segment_image(
        prompt, asset.file_path, request.model, 
        project.character_sheet, image_style, aspect_ratio
    )
    
    # Update dimensions
    width, height = None, None
    if os.path.exists(asset.file_path):
        with Image.open(asset.file_path) as img:
            width, height = img.size
    
    asset.width = width
    asset.height = height
    asset.prompt = prompt
    await db.commit()
    
    return {
        "id": asset.id, 
        "type": "image", 
        "source": "ai_generated", 
        "path": asset.file_path, 
        "prompt": prompt,
        "width": width,
        "height": height,
        "regenerated": True
    }


@router.patch("/update-prompt")
async def update_image_prompt(request: UpdatePromptRequest, db: AsyncSession = Depends(get_db)):
    """Update prompt for an existing image without regenerating"""
    asset = await db.get(MediaAsset, request.media_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Image not found")
    
    asset.prompt = request.prompt
    await db.commit()
    
    return {"id": asset.id, "prompt": request.prompt, "updated": True}


@router.post("/suggest-prompt")
async def suggest_image_prompt(request: SuggestPromptRequest, db: AsyncSession = Depends(get_db)):
    """AI generates image prompt based on script/segments context"""
    from app.services.ai import GeminiService
    service = GeminiService()
    
    project = await db.get(Project, request.project_id)
    character_sheet = project.character_sheet if project else None
    video_style = project.video_style if project else "dialogue"
    image_style = request.image_style or (project.image_style if project else "cartoon")
    
    prompt = await service.generate_image_prompt(
        request.segments, 
        request.script,
        character_sheet=character_sheet,
        video_style=video_style,
        image_style=image_style,
        aspect_ratio=request.aspect_ratio,
        prompt_language=request.prompt_language
    )
    return {"prompt": prompt}


class GeneratePromptsRequest(BaseModel):
    project_id: str
    segments: list
    count: int = 3
    language: str = "English"
    existing_prompts: list = []
    image_style: str = "cartoon"
    aspect_ratio: str = "16:9"
    prompt_language: str = "en"


@router.post("/generate-prompts")
async def generate_prompts_only(request: GeneratePromptsRequest, db: AsyncSession = Depends(get_db)):
    """Generate image prompts from segments (without generating images)"""
    from app.services.ai import GeminiService
    from sqlalchemy.orm.attributes import flag_modified
    
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    service = GeminiService()
    video_style = project.video_style or "dialogue"
    image_style = request.image_style or project.image_style or "cartoon"
    
    # Reuse character sheet for consistency
    character_sheet = project.character_sheet
    if not character_sheet:
        character_sheet = await service.generate_character_sheet(
            request.segments, 
            project.script or "", 
            video_style,
            image_style
        )
        project.character_sheet = character_sheet
        project.image_style = image_style
        flag_modified(project, "character_sheet")
        await db.commit()
    
    prompts = await service.generate_batch_prompts(
        request.segments, 
        request.count, 
        character_sheet=character_sheet,
        script=project.script or "",
        language=request.language,
        existing_prompts=request.existing_prompts,
        video_style=video_style,
        image_style=image_style,
        aspect_ratio=request.aspect_ratio,
        prompt_language=request.prompt_language
    )
    
    if not prompts:
        raise HTTPException(status_code=500, detail="Failed to generate prompts")
    
    return {"prompts": prompts, "character_sheet": character_sheet}


@router.post("/generate-batch")
async def generate_batch_images(request: BatchGenerateRequest, db: AsyncSession = Depends(get_db)):
    """Generate multiple images with consistent characters"""
    from sqlalchemy.orm.attributes import flag_modified
    
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    from app.services.ai import GeminiService
    service = GeminiService()
    
    video_style = project.video_style or "dialogue"
    image_style = request.image_style or project.image_style or "cartoon"
    
    # Generate or reuse character sheet for consistency
    character_sheet = project.character_sheet
    if not character_sheet or request.regenerate_characters:
        character_sheet = await service.generate_character_sheet(request.segments, project.script or "", video_style, image_style)
        project.character_sheet = character_sheet
        project.image_style = image_style
        flag_modified(project, "character_sheet")
        await db.commit()
    
    prompts = await service.generate_batch_prompts(
        request.segments, request.count, character_sheet, project.script or "", 
        request.language, video_style=video_style, image_style=image_style,
        aspect_ratio=request.aspect_ratio, prompt_language=request.prompt_language
    )
    
    settings = get_settings()
    project_dir = f"{settings.storage_path}/{request.project_id}/media"
    os.makedirs(project_dir, exist_ok=True)
    
    generated = []
    for p in prompts:
        media_id = str(uuid.uuid4())
        file_path = f"{project_dir}/{media_id}.png"
        
        await service.generate_segment_image(p["prompt"], file_path, request.model, character_sheet, image_style, request.aspect_ratio)
        
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
            "timestamp": p.get("timestamp", 0),
            "path": file_path
        })
    
    return {"images": generated, "count": len(generated), "character_sheet": character_sheet}

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

