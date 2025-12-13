from openai import OpenAI
import google.generativeai as genai
from app.config import get_settings


class BaseAIService:
    def __init__(self):
        settings = get_settings()
        self.settings = settings
        
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
        
        if settings.openai_api_key:
            self.openai = OpenAI(api_key=settings.openai_api_key)
        else:
            self.openai = None
    
    async def _generate(self, prompt: str, max_tokens: int = 8192) -> str:
        model = genai.GenerativeModel("gemini-3-pro-preview")
        response = model.generate_content(prompt)
        return response.text

