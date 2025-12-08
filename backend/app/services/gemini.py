from openai import OpenAI
import google.generativeai as genai
from pathlib import Path
import base64
from app.config import get_settings

class AIService:
    def __init__(self):
        settings = get_settings()
        if not settings.openai_api_key:
            raise Exception("OPENAI_API_KEY is required")
        self.openai = OpenAI(api_key=settings.openai_api_key)
        self.settings = settings
        
        # Initialize Gemini for image generation
        if settings.gemini_api_key:
            genai.configure(api_key=settings.gemini_api_key)
    
    async def _generate(self, prompt: str) -> str:
        response = self.openai.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000
        )
        return response.choices[0].message.content
    
    async def _extract_key_points(self, transcript_text: str) -> str:
        """Extract key points from long transcript in chunks"""
        # Split into chunks of ~4000 chars
        chunks = []
        words = transcript_text.split()
        chunk_size = 600  # words per chunk
        
        for i in range(0, len(words), chunk_size):
            chunk = " ".join(words[i:i + chunk_size])
            chunks.append(chunk)
        
        # Extract key points from each chunk
        all_points = []
        for i, chunk in enumerate(chunks):
            prompt = f"""Extract the 3-5 most important facts/points from this transcript section.
Include the approximate timestamp [Xs] for each point.

Format:
- [timestamp] Key point here
- [timestamp] Another point

Transcript section {i+1}/{len(chunks)}:
{chunk}

List ONLY the key points with timestamps:"""
            
            points = await self._generate(prompt)
            all_points.append(points)
        
        # Combine all key points
        combined = "\n\nKEY POINTS FROM FULL VIDEO:\n" + "\n".join(all_points)
        return combined
    
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
    
    async def generate_script(self, transcript_text: str, duration_seconds: int = 60) -> dict:
        num_segments = max(4, duration_seconds // 8)  # ~8 seconds per segment
        
        # Step 1: If transcript is long, extract key points in chunks first
        key_points = transcript_text
        if len(transcript_text) > 8000:
            key_points = await self._extract_key_points(transcript_text)
        
        prompt = f"""Create a {duration_seconds}-second voiceover script from this video transcript.

Extract exactly {num_segments} key moments with their source timestamps.

OUTPUT FORMAT (JSON array):
[
  {{"text": "Engaging narration sentence", "source_start": 45, "source_end": 52}},
  {{"text": "Another key point", "source_start": 120, "source_end": 128}},
  ...
]

RULES:
1. Exactly {num_segments} segments required
2. "text" = spoken narration (15-25 words, natural speech)
3. "source_start/source_end" = timestamps (seconds) from original video for B-roll clips
4. Each segment: 6-8 seconds when spoken
5. Cover the main topics from the transcript
6. Flow: hook → main points → conclusion
7. Plain text only, no markdown

Transcript content:
{key_points}

Return ONLY the JSON array."""
        
        result = await self._generate(prompt)
        
        # Parse JSON response
        import json
        import re
        try:
            json_match = re.search(r'\[[\s\S]*\]', result)
            if json_match:
                raw_segments = json.loads(json_match.group())
                
                # Limit segments to requested count (AI often returns more)
                raw_segments = raw_segments[:num_segments]
                
                # Calculate proper duration: aim for 6-8 seconds per segment
                seg_duration = max(6, duration_seconds // len(raw_segments))
                
                segments = []
                current_time = 0
                for s in raw_segments:
                    segments.append({
                        "text": s.get("text", ""),
                        "start": current_time,
                        "end": current_time + seg_duration,
                        "source_start": s.get("source_start", 0),
                        "source_end": s.get("source_end", seg_duration)
                    })
                    current_time += seg_duration
                
                script = " ".join([s["text"] for s in segments])
                return {"script": script, "segments": segments}
        except:
            pass
        
        return {"script": result, "segments": []}
    
    async def generate_youtube_info(self, title: str, script: str) -> dict:
        prompt = f"""Generate YouTube video metadata for this video.

Original Title: {title}
Script/Content: {script[:500]}

Generate:
1. TITLE: Catchy, SEO-friendly title (under 60 chars, include emoji if suitable)
2. DESCRIPTION: Engaging description with:
   - Hook in first line
   - Summary of content
   - Call to action
   - Hashtags at the end
3. TAGS: 10-15 relevant tags, comma separated

OUTPUT FORMAT (JSON):
{{
  "title": "Your title here",
  "description": "Full description here",
  "tags": "tag1, tag2, tag3, ..."
}}

Return ONLY the JSON."""
        
        result = await self._generate(prompt)
        
        import json
        import re
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
    
    async def generate_thumbnail_prompt(self, script: str, title: str) -> dict:
        """Generate thumbnail prompt and short title for overlay"""
        prompt = f"""Based on this video content, create:
1. A short catchy title (max 4 words, ALL CAPS) for thumbnail text overlay
2. An image description for the thumbnail background

Video Title: {title}
Script: {script[:300]}

OUTPUT FORMAT (JSON):
{{"title": "SHORT TITLE", "image": "detailed image description"}}

Rules for title: Max 4 words, impactful, creates curiosity
Rules for image: Dramatic, colorful, eye-catching background scene related to content

Return ONLY JSON."""
        
        result = await self._generate(prompt)
        
        import json
        import re
        try:
            json_match = re.search(r'\{[\s\S]*\}', result)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass
        
        # Fallback
        words = title.split()[:4]
        return {"title": " ".join(words).upper(), "image": f"dramatic scene about {title}"}
    
    async def generate_thumbnail_image(self, title: str, image_prompt: str, output_path: str) -> str:
        """Generate realistic YouTube thumbnail with DALL-E 3"""
        import httpx
        
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        full_prompt = f"""Photorealistic YouTube thumbnail, cinematic photography style:

SCENE: {image_prompt}

TEXT: Large bold "{title}" text in modern sans-serif font (like Impact or Bebas Neue), white letters with thick black outline and drop shadow, positioned in lower third or center.

CRITICAL REQUIREMENTS:
- Photorealistic, NOT cartoon, NOT illustration, NOT icon
- Real photography aesthetic with natural lighting
- Shallow depth of field, bokeh background
- High resolution, 8K quality
- Professional color grading
- The text "{title}" must be crisp, readable typography - NOT hand-drawn
- Dramatic composition like a movie poster
- 16:9 aspect ratio"""

        try:
            response = self.openai.images.generate(
                model="dall-e-3",
                prompt=full_prompt,
                size="1792x1024",
                quality="hd",
                n=1
            )
            
            image_url = response.data[0].url
            async with httpx.AsyncClient(timeout=60.0) as client:
                img_response = await client.get(image_url)
                if img_response.status_code == 200:
                    with open(output_path, "wb") as f:
                        f.write(img_response.content)
                    return output_path
                        
        except Exception as e:
            raise Exception(f"DALL-E image generation failed: {str(e)}")

# Backward compatibility alias
GeminiService = AIService
