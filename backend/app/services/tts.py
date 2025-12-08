from elevenlabs import ElevenLabs
from elevenlabs.types import VoiceSettings
from pathlib import Path
from app.config import get_settings

VOICES = {
    "sarah": "EXAVITQu4vr4xnSDxMaL",
    "roger": "CwhRBWXzGAHq8TQ4Fs17",
    "laura": "FGY2WhTYpPnrIDTdsKH5",
    "charlie": "IKne3meq5aSn9XLyUdCD",
    "george": "JBFqnCBsd6RMkjVDRZzb",
    "liam": "TX3LPaxmHKxFdv7VOQHJ",
    "alice": "Xb7hH8MSUJpSbSDYk0k2",
}

class TTSService:
    def __init__(self):
        self.settings = get_settings()
        self.storage = Path(self.settings.storage_path)
        self.client = ElevenLabs(api_key=self.settings.elevenlabs_api_key)
    
    async def generate_segment(self, text: str, voice: str, project_id: str, index: int, speed: float = 1.0, stability: float = 0.5) -> str:
        project_dir = self.storage / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        output_path = project_dir / f"segment_{index}.mp3"
        
        voice_id = VOICES.get(voice, VOICES["sarah"])
        voice_settings = VoiceSettings(stability=stability, similarity_boost=0.75, speed=speed)
        
        audio = self.client.text_to_speech.convert(
            voice_id=voice_id, text=text, model_id="eleven_multilingual_v2",
            voice_settings=voice_settings
        )
        
        with open(output_path, "wb") as f:
            for chunk in audio:
                f.write(chunk)
        
        srt_path = project_dir / f"segment_{index}.srt"
        with open(srt_path, "w", encoding="utf-8") as f:
            f.write(f"1\n00:00:00,000 --> 00:00:03,000\n{text}\n")
        
        return str(output_path)
    
    async def generate(self, text: str, voice: str, project_id: str, speed: float = 1.0, stability: float = 0.5) -> str:
        project_dir = self.storage / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        output_path = project_dir / "voice.mp3"
        
        voice_id = VOICES.get(voice, VOICES["sarah"])
        voice_settings = VoiceSettings(stability=stability, similarity_boost=0.75, speed=speed)
        
        audio = self.client.text_to_speech.convert(
            voice_id=voice_id, text=text, model_id="eleven_multilingual_v2",
            voice_settings=voice_settings
        )
        
        with open(output_path, "wb") as f:
            for chunk in audio:
                f.write(chunk)
        
        return str(output_path)
