import json
import re
from .base import BaseAIService


class YouTubeService(BaseAIService):
    async def generate_youtube_info(self, title: str, script: str, language: str = "English") -> dict:
        prompt = f"""Generate YouTube video metadata for this video.

IMPORTANT: ALL OUTPUT MUST BE IN {language.upper()} LANGUAGE.

Original Title: {title}
Script/Content: {script[:500]}

Generate IN {language.upper()}:
1. TITLE: Catchy, SEO-friendly {language} title (under 60 chars, include emoji if suitable)
2. DESCRIPTION: Engaging {language} description with:
   - Hook in first line
   - Summary of content
   - Call to action
   - Hashtags at the end
3. TAGS: 10-15 relevant {language} tags, comma separated

OUTPUT FORMAT (JSON):
{{
  "title": "Your {language} title here",
  "description": "Full {language} description here",
  "tags": "{language.lower()}, tags, ..."
}}

Return ONLY the JSON. Everything MUST be in {language}."""
        
        result = await self._generate(prompt)
        
        try:
            json_match = re.search(r'\{[\s\S]*\}', result)
            if json_match:
                data = json.loads(json_match.group())
                return data
        except:
            pass
        
        return {
            "title": title,
            "description": script[:200] + "..." if script else "",
            "tags": "shorts, viral, trending"
        }

    async def summarize(self, transcript_text: str, style: str = "detailed") -> dict:
        prompts = {
            "short": f"Create a 30-second summary script. Be concise:\n\n{transcript_text}",
            "detailed": f"Create a 2-3 minute educational summary script with key points:\n\n{transcript_text}",
            "bullets": f"Summarize in bullet points:\n\n{transcript_text}"
        }
        result = await self._generate(prompts.get(style, prompts["detailed"]))
        return {"summary": result, "style": style}
    
    async def ask(self, transcript_text: str, question: str) -> str:
        prompt = f"Based on this transcript, answer: {question}\n\nTranscript:\n{transcript_text}"
        return await self._generate(prompt)

