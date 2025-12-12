from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified
import os
import re
from pydub import AudioSegment
from app.database import get_db
from app.services.tts import TTSService
from app.models.project import Project, GeneratedAudio
from app.config import get_settings

router = APIRouter()

def clean_text(text: str) -> str:
    text = re.sub(r'\[.*?\]', '', text)  # [CLIP: ...], [Hook - ...]
    text = re.sub(r'\*\*.*?:\*\*', '', text)  # **Narrator:**
    text = re.sub(r'\*\*[^*]+\*\*', '', text)  # **headers**
    text = re.sub(r'---+', '', text)  # dashed lines
    text = re.sub(r'\d{1,2}:\d{2}(:\d{2})?', '', text)  # timestamps
    text = re.sub(r'#{1,6}\s*.*?\n', '', text)  # # headers
    text = re.sub(r'[*_~`#]', '', text)  # remaining markdown
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

class SegmentRequest(BaseModel):
    project_id: str
    segment_index: int
    text: str
    voice: str = "aria"
    speed: float = 1.0
    stability: float = 0.5
    model: str = "v2"  # v2, v3, flash

class MergeSegmentsRequest(BaseModel):
    project_id: str
    segment_count: int
    silences: list[float] = []

@router.post("/generate-segment")
async def generate_segment(request: SegmentRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    service = TTSService()
    cleaned_text = clean_text(request.text)
    audio_path = await service.generate_segment(
        cleaned_text, request.voice, request.project_id, request.segment_index,
        speed=request.speed, stability=request.stability, model=request.model
    )
    
    # Get audio duration
    duration = 5.0
    if os.path.exists(audio_path):
        try:
            audio = AudioSegment.from_mp3(audio_path)
            duration = len(audio) / 1000.0
        except:
            pass
    
    return {"segment_index": request.segment_index, "audio_path": audio_path, "duration": duration}

@router.post("/merge-segments")
async def merge_segments(request: MergeSegmentsRequest, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    settings = get_settings()
    project_dir = f"{settings.storage_path}/{request.project_id}"
    
    combined = AudioSegment.empty()
    all_subs = []
    current_time = 0.0
    
    for i in range(request.segment_count):
        seg_path = f"{project_dir}/segment_{i}.mp3"
        if not os.path.exists(seg_path):
            raise HTTPException(status_code=400, detail=f"Segment {i} not generated")
        
        audio = AudioSegment.from_mp3(seg_path)
        audio_duration = len(audio) / 1000.0
        combined += audio
        
        seg_text = ""
        if project.segments_data and i < len(project.segments_data):
            seg_text = project.segments_data[i].get("text", "")
        
        if not seg_text:
            srt_path = f"{project_dir}/segment_{i}.srt"
            if os.path.exists(srt_path):
                with open(srt_path, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    seg_text = content.split("\n")[-1] if content else ""
        
        if seg_text:
            all_subs.append({
                "start": current_time, 
                "duration": audio_duration,
                "text": seg_text
            })
        
        current_time += audio_duration
        
        silence_ms = int((request.silences[i] if i < len(request.silences) else 0) * 1000)
        if silence_ms > 0:
            combined += AudioSegment.silent(duration=silence_ms)
            current_time += silence_ms / 1000.0
    
    output_path = f"{project_dir}/voice.mp3"
    combined.export(output_path, format="mp3")
    
    # Write combined SRT with correct timing
    srt_path = f"{project_dir}/subtitles.srt"
    with open(srt_path, "w", encoding="utf-8") as f:
        for i, sub in enumerate(all_subs, 1):
            start = sub["start"]
            end = start + sub["duration"]
            f.write(f"{i}\n{_fmt_time(start)} --> {_fmt_time(end)}\n{sub['text']}\n\n")
    
    # Update segments_data with actual timing from audio
    if project.segments_data:
        updated_segments = []
        for i, seg in enumerate(project.segments_data):
            if i < len(all_subs):
                seg["start"] = all_subs[i]["start"]
                seg["end"] = all_subs[i]["start"] + all_subs[i]["duration"]
                seg["duration"] = all_subs[i]["duration"]
            updated_segments.append(seg)
        project.segments_data = updated_segments
        flag_modified(project, "segments_data")
    
    db_audio = GeneratedAudio(project_id=project.id, text="merged", voice="merged", file_path=output_path)
    db.add(db_audio)
    await db.commit()
    await db.refresh(project)
    
    # Return updated timing for frontend
    timing = [{"start": s["start"], "end": s["start"] + s["duration"]} for s in all_subs]
    return {"audio_path": output_path, "subtitle_path": srt_path, "timing": timing}

def _fmt_time(s: float) -> str:
    h, m = int(s // 3600), int((s % 3600) // 60)
    sec, ms = int(s % 60), int((s % 1) * 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"

@router.get("/check-segments/{project_id}")
async def check_existing_segments(project_id: str):
    settings = get_settings()
    project_dir = f"{settings.storage_path}/{project_id}"
    
    existing_audio = []
    existing_clips = []
    i = 0
    while True:
        seg_path = f"{project_dir}/segment_{i}.mp3"
        clip_path = f"{project_dir}/clip_{i}.mp4"
        if os.path.exists(seg_path):
            existing_audio.append(i)
        if os.path.exists(clip_path):
            existing_clips.append(i)
        if not os.path.exists(seg_path) and not os.path.exists(clip_path):
            if i > 150:  # Safety limit for long videos (up to 15 mins)
                break
            i += 1
            continue
        i += 1
    
    voice_exists = os.path.exists(f"{project_dir}/voice.mp3")
    video_exists = os.path.exists(f"{project_dir}/source.mp4")
    
    return {"existing_segments": existing_audio, "existing_clips": existing_clips, "voice_merged": voice_exists, "video_downloaded": video_exists}

@router.get("/preview/{project_id}")
async def preview_audio(project_id: str):
    audio_path = f"./storage/{project_id}/voice.mp3"
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Audio not found")
    return FileResponse(audio_path, media_type="audio/mpeg")

@router.get("/preview-segment/{project_id}/{segment_index}")
async def preview_segment(project_id: str, segment_index: int):
    audio_path = f"./storage/{project_id}/segment_{segment_index}.mp3"
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=404, detail="Segment not found")
    return FileResponse(audio_path, media_type="audio/mpeg")

@router.get("/voices")
async def list_voices():
    from app.services.tts import VOICES
    voices = []
    for key, data in VOICES.items():
        voices.append({
            "id": key,
            "name": data["name"],
            "gender": data["gender"],
            "style": data["style"],
            "accent": data["accent"],
            "langs": data.get("langs", "All"),
        })
    # Sort: Multilingual first, then by accent/name
    def sort_key(v):
        if v["accent"] == "Multilingual":
            return (0, v["name"])
        return (1, v["accent"], v["name"])
    voices.sort(key=sort_key)
    return {"voices": voices}

@router.get("/models")
async def list_models():
    from app.services.tts import MODELS
    models = []
    for key, data in MODELS.items():
        models.append({
            "id": key,
            "name": data["name"],
            "langs": data["langs"],
            "desc": data["desc"],
        })
    return {"models": models}

@router.get("/voice-demo/{voice_id}")
async def get_voice_demo(voice_id: str):
    from app.services.tts import VOICES
    if voice_id not in VOICES:
        raise HTTPException(status_code=404, detail="Voice not found")
    
    demo_path = f"./storage/voice_demos/{voice_id}.mp3"
    if os.path.exists(demo_path):
        return FileResponse(demo_path, media_type="audio/mpeg")
    
    service = TTSService()
    path = await service.generate_demo(voice_id)
    return FileResponse(path, media_type="audio/mpeg")
