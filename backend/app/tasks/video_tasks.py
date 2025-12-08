from app.tasks.celery_app import celery_app
from app.services.video import VideoService
from app.services.tts import TTSService

@celery_app.task
def process_video_task(project_id: str, clips_data: list, script: str, voice: str):
    video_service = VideoService()
    tts_service = TTSService()
    
    audio_path = tts_service.generate_sync(script, voice, project_id)
    output_path = video_service.merge_clips_sync(project_id, clips_data, audio_path)
    
    return {"audio_path": audio_path, "output_path": output_path}

