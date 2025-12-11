from elevenlabs import ElevenLabs
from elevenlabs.types import VoiceSettings
from pathlib import Path
from app.config import get_settings

# All voices support 29+ languages with eleven_multilingual_v2
# Languages: English, Spanish, French, German, Italian, Portuguese, Polish, Hindi, Arabic, 
# Chinese, Japanese, Korean, Indonesian, Dutch, Turkish, Filipino, Malay, Tamil, Russian, etc.

VOICES = {
    # === MULTILINGUAL VOICES (Best for non-English) ===
    "aria": {"id": "9BWtsMINqrJLrRacOk9x", "name": "Aria", "gender": "Female", "style": "Expressive, Natural", "accent": "Multilingual", "langs": "All 29"},
    "river": {"id": "SAz9YHcvj6GT2YYXdXww", "name": "River", "gender": "Non-binary", "style": "Calm, Soothing", "accent": "Multilingual", "langs": "All 29"},
    "bill": {"id": "pqHfZKP75CvOlQylNhV4", "name": "Bill", "gender": "Male", "style": "Documentary, Narrator", "accent": "Multilingual", "langs": "All 29"},
    
    # === ENGLISH VOICES ===
    "sarah": {"id": "EXAVITQu4vr4xnSDxMaL", "name": "Sarah", "gender": "Female", "style": "Soft, Warm", "accent": "American", "langs": "English+"},
    "alice": {"id": "Xb7hH8MSUJpSbSDYk0k2", "name": "Alice", "gender": "Female", "style": "Confident, Clear", "accent": "British", "langs": "English+"},
    "rachel": {"id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel", "gender": "Female", "style": "Deep, Narrator", "accent": "American", "langs": "English+"},
    "laura": {"id": "FGY2WhTYpPnrIDTdsKH5", "name": "Laura", "gender": "Female", "style": "Calm, Professional", "accent": "American", "langs": "English+"},
    "roger": {"id": "CwhRBWXzGAHq8TQ4Fs17", "name": "Roger", "gender": "Male", "style": "Authoritative, Deep", "accent": "American", "langs": "English+"},
    "charlie": {"id": "IKne3meq5aSn9XLyUdCD", "name": "Charlie", "gender": "Male", "style": "Casual, Friendly", "accent": "Australian", "langs": "English+"},
    "george": {"id": "JBFqnCBsd6RMkjVDRZzb", "name": "George", "gender": "Male", "style": "Warm, Storyteller", "accent": "British", "langs": "English+"},
    "adam": {"id": "pNInz6obpgDQGcFmaJgB", "name": "Adam", "gender": "Male", "style": "Deep, Cinematic", "accent": "American", "langs": "English+"},
    
    # === SPANISH VOICES ===
    "mateo": {"id": "wJqPDuzCCHV3BepBXVT8", "name": "Mateo", "gender": "Male", "style": "Warm, Narrator", "accent": "Spanish", "langs": "Spanish+"},
    "valentina": {"id": "ODq5zmih8GrVes37Dizd", "name": "Valentina", "gender": "Female", "style": "Expressive, Clear", "accent": "Spanish", "langs": "Spanish+"},
    
    # === GERMAN VOICES ===
    "freya": {"id": "jsCqWAovK2LkecY7zXl4", "name": "Freya", "gender": "Female", "style": "Professional, Clear", "accent": "German", "langs": "German+"},
    
    # === FRENCH VOICES ===
    "charlotte": {"id": "XB0fDUnXU5powFXDhCwa", "name": "Charlotte", "gender": "Female", "style": "Elegant, Warm", "accent": "French", "langs": "French+"},
    
    # === HINDI VOICES ===
    "devi": {"id": "vSp2KPOq9TIitCJa7vZ2", "name": "Devi", "gender": "Female", "style": "Expressive, Natural", "accent": "Hindi", "langs": "Hindi+"},
    
    # === ARABIC VOICES ===
    "nadia": {"id": "t0jbNlBVZ17f02VDIeMI", "name": "Nadia", "gender": "Female", "style": "Warm, Clear", "accent": "Arabic", "langs": "Arabic+"},
    
    # === JAPANESE VOICES ===
    "yuki": {"id": "XrExE9yKIg1WjnnlVkGX", "name": "Yuki", "gender": "Female", "style": "Soft, Professional", "accent": "Japanese", "langs": "Japanese+"},
    
    # === PORTUGUESE VOICES ===
    "lucas": {"id": "onwK4e9ZLuTAKqWW03F9", "name": "Lucas", "gender": "Male", "style": "Friendly, Natural", "accent": "Portuguese", "langs": "Portuguese+"},
}

DEMO_TEXT = "Welcome to ZapClip. Create stunning video content with AI-powered voice generation."

# Available TTS models
MODELS = {
    "v2": {"id": "eleven_multilingual_v2", "name": "Multilingual v2", "langs": 29, "desc": "Stable, 29 languages"},
    "v3": {"id": "eleven_v3", "name": "v3 (Latest)", "langs": 70, "desc": "Latest, 70+ languages"},
    "flash": {"id": "eleven_flash_v2_5", "name": "Flash v2.5", "langs": 32, "desc": "Fast, 32 languages"},
}

class TTSService:
    def __init__(self):
        self.settings = get_settings()
        self.storage = Path(self.settings.storage_path)
        self.client = ElevenLabs(api_key=self.settings.elevenlabs_api_key)
    
    def _get_voice_id(self, voice: str) -> str:
        voice_data = VOICES.get(voice, VOICES["aria"])
        return voice_data["id"]
    
    def _get_model_id(self, model: str) -> str:
        model_data = MODELS.get(model, MODELS["v2"])
        return model_data["id"]
    
    async def generate_segment(self, text: str, voice: str, project_id: str, index: int, speed: float = 1.0, stability: float = 0.5, model: str = "v2") -> str:
        import subprocess
        
        project_dir = self.storage / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        output_path = project_dir / f"segment_{index}.mp3"
        temp_path = project_dir / f"segment_{index}_temp.mp3"
        
        voice_id = self._get_voice_id(voice)
        model_id = self._get_model_id(model)
        voice_settings = VoiceSettings(stability=stability, similarity_boost=0.75)
        
        audio = self.client.text_to_speech.convert(
            voice_id=voice_id, 
            text=text, 
            model_id=model_id,
            voice_settings=voice_settings
        )
        
        # Write to temp file first
        write_path = temp_path if speed != 1.0 else output_path
        with open(write_path, "wb") as f:
            for chunk in audio:
                f.write(chunk)
        
        # Apply speed adjustment using FFmpeg if speed != 1.0
        if speed != 1.0:
            subprocess.run([
                "ffmpeg", "-y", "-i", str(temp_path),
                "-filter:a", f"atempo={speed}",
                "-vn", str(output_path)
            ], capture_output=True)
            temp_path.unlink(missing_ok=True)
        
        srt_path = project_dir / f"segment_{index}.srt"
        with open(srt_path, "w", encoding="utf-8") as f:
            f.write(f"1\n00:00:00,000 --> 00:00:03,000\n{text}\n")
        
        return str(output_path)
    
    async def generate(self, text: str, voice: str, project_id: str, speed: float = 1.0, stability: float = 0.5, model: str = "v2") -> str:
        import subprocess
        
        project_dir = self.storage / project_id
        project_dir.mkdir(parents=True, exist_ok=True)
        output_path = project_dir / "voice.mp3"
        temp_path = project_dir / "voice_temp.mp3"
        
        voice_id = self._get_voice_id(voice)
        model_id = self._get_model_id(model)
        voice_settings = VoiceSettings(stability=stability, similarity_boost=0.75)
        
        audio = self.client.text_to_speech.convert(
            voice_id=voice_id, 
            text=text, 
            model_id=model_id,
            voice_settings=voice_settings
        )
        
        write_path = temp_path if speed != 1.0 else output_path
        with open(write_path, "wb") as f:
            for chunk in audio:
                f.write(chunk)
        
        if speed != 1.0:
            subprocess.run([
                "ffmpeg", "-y", "-i", str(temp_path),
                "-filter:a", f"atempo={speed}",
                "-vn", str(output_path)
            ], capture_output=True)
            temp_path.unlink(missing_ok=True)
        
        return str(output_path)
    
    async def generate_demo(self, voice: str) -> str:
        demo_dir = self.storage / "voice_demos"
        demo_dir.mkdir(parents=True, exist_ok=True)
        output_path = demo_dir / f"{voice}.mp3"
        
        if output_path.exists():
            return str(output_path)
        
        voice_id = self._get_voice_id(voice)
        voice_settings = VoiceSettings(stability=0.5, similarity_boost=0.75, speed=1.0)
        
        audio = self.client.text_to_speech.convert(
            voice_id=voice_id, text=DEMO_TEXT, model_id="eleven_multilingual_v2",
            voice_settings=voice_settings
        )
        
        with open(output_path, "wb") as f:
            for chunk in audio:
                f.write(chunk)
        
        return str(output_path)
