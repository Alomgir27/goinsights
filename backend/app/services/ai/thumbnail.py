import json
import re
from pathlib import Path
from PIL import Image
import io
import httpx
from .base import BaseAIService


class ThumbnailService(BaseAIService):
    STYLE_MAP = {
        "cartoon": "CARTOON/ANIMATED style like Pixar or Disney, colorful and playful",
        "anime": "ANIME style with expressive characters, Japanese animation aesthetic",
        "realistic": "PHOTOREALISTIC style with realistic lighting and textures",
        "3d_render": "3D RENDERED style with polished CGI look, like modern game graphics",
        "cinematic": "CINEMATIC movie poster style with dramatic lighting and composition",
    }
    
    VIDEO_TYPE_MAP = {
        "tutorial": "educational, step-by-step demonstration scene",
        "podcast": "conversation or interview setting with speaking characters",
        "story": "narrative storytelling scene with emotional characters",
        "motivation": "inspiring, powerful scene with heroic pose or achievement",
        "news": "professional news-style with informative elements",
        "review": "product showcase or comparison scene",
        "vlog": "casual, personal lifestyle scene",
        "educational": "learning environment with visual explanations",
        "gaming": "exciting game scene with action elements",
        "music": "musical performance or artistic music-themed scene",
    }

    async def generate_thumbnail_prompt(self, script: str, title: str, language: str = "English", 
                                        image_style: str = "cartoon", video_type: str = "tutorial") -> dict:
        lang_note = f"Script is in {language}. Character names may be in {language}." if language != "English" else ""
        style_desc = self.STYLE_MAP.get(image_style, self.STYLE_MAP["cartoon"])
        type_desc = self.VIDEO_TYPE_MAP.get(video_type, self.VIDEO_TYPE_MAP["tutorial"])
        
        title_tone_map = {
            "tutorial": "educational, instructional (e.g., 'শিখুন কীভাবে', 'EASY RECIPE', 'HOW TO MAKE')",
            "podcast": "conversational, thought-provoking (e.g., 'আজকের আলোচনা', 'LET'S TALK')",
            "story": "dramatic, emotional (e.g., 'অবিশ্বাস্য গল্প', 'THE UNTOLD STORY')",
            "motivation": "inspiring, powerful (e.g., 'তুমি পারবে', 'NEVER GIVE UP')",
            "news": "urgent, informative (e.g., 'ব্রেকিং নিউজ', 'BREAKING NEWS')",
            "review": "honest, direct (e.g., 'সত্যি কি ভালো?', 'HONEST REVIEW')",
            "vlog": "personal, casual (e.g., 'আমার দিন', 'MY DAY')",
            "educational": "informative, clear (e.g., 'জানুন বিস্তারিত', 'EXPLAINED')",
            "gaming": "exciting, action (e.g., 'এপিক গেমপ্লে', 'INSANE GAMEPLAY')",
            "music": "artistic, expressive (e.g., 'নতুন গান', 'NEW RELEASE')",
        }
        title_tone = title_tone_map.get(video_type, "catchy and relevant")
        
        prompt = f"""Generate YouTube THUMBNAIL content:

Title: {title}
Type: {video_type}
{lang_note}

Create JSON with:

1. "title": 2-4 word text in {language.upper()}, ALL CAPS, no emojis

2. "image": MINIMALIST thumbnail prompt (1-2 sentences max)
   - Style: {style_desc}
   - THUMBNAIL RULES:
     * ONE main subject only (person/object/icon)
     * SOLID or simple gradient background
     * HIGH CONTRAST colors
     * Clean, uncluttered composition
     * Works at small size (like mobile view)
   - NO complex scenes, NO multiple elements, NO detailed backgrounds

GOOD examples:
- "Person with shocked expression, solid yellow background"
- "Hand holding phone showing app, clean blue gradient"
- "Single gold trophy, minimalist white background"

BAD examples (too complex):
- "Person at desk with holographic display showing interface with progress bars and badges in modern classroom"

OUTPUT JSON only:
{{"title": "SHORT TITLE", "image": "simple, minimal thumbnail description"}}"""
        
        result = await self._generate(prompt)
        
        parsed_title = ""
        parsed_image = ""
        
        try:
            json_match = re.search(r'\{[\s\S]*\}', result)
            if json_match:
                parsed = json.loads(json_match.group())
                parsed_title = parsed.get("title", "")
                parsed_image = parsed.get("image", "")
        except:
            pass
        
        # If no title, generate from video title
        if not parsed_title:
            clean_title = re.sub(r'[^\w\s]', '', title)
            words = clean_title.split()[:4]
            parsed_title = " ".join(words).upper()
        
        # If no image, use the raw result or fallback
        if not parsed_image:
            parsed_image = result if len(result) > 50 else f"dramatic scene about {title}"
        
        return {"title": parsed_title, "image": parsed_image}
    
    async def generate_thumbnail_image(self, title: str, image_prompt: str, output_path: str, 
                                       model: str = "gemini-2.5-flash", image_style: str = "cartoon",
                                       title_position: str = "") -> str:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        style_desc = self.STYLE_MAP.get(image_style, self.STYLE_MAP["cartoon"])
        
        style_instruction = "CARTOON/ANIMATED style - stylized illustrations" if image_style in ["cartoon", "anime"] else f"{style_desc}"
        
        full_prompt = f"""YouTube THUMBNAIL image:

{image_prompt}

MUST FOLLOW:
1. 16:9 LANDSCAPE (wide horizontal)
2. MINIMALIST - ONE main subject, clean background
3. HIGH CONTRAST colors, bold and vibrant
4. Simple composition - works at small mobile size
5. Style: {style_instruction}

DO NOT add extra elements, complex backgrounds, or clutter."""
        
        if title and title_position:
            position_map = {"top": "at the TOP", "center": "in the CENTER", "bottom": "at the BOTTOM"}
            pos_text = position_map.get(title_position, "in the CENTER")
            full_prompt += f"""
6. MUST include the exact text "{title.upper()}" prominently {pos_text} of the image
7. Text should be LARGE, BOLD, easy to read - white or bright color with dark outline/shadow"""

        if model == "dall-e-3":
            img_bytes = await self._generate_dalle(full_prompt)
        else:
            img_bytes = await self._generate_gemini(full_prompt, model)
        
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img.save(output_path, "PNG", quality=95)
        return output_path

    async def _generate_gemini(self, prompt: str, model: str) -> bytes:
        from google import genai as google_genai
        from google.genai import types
        
        if not self.settings.gemini_api_key:
            raise Exception("GEMINI_API_KEY is required")
        
        model_map = {
            "gemini-2.5-flash": "gemini-2.5-flash-image",
            "gemini-2.0-flash": "gemini-2.0-flash-exp-image-generation",
            "gemini-3-pro": "gemini-3-pro-image-preview",
        }
        model_name = model_map.get(model, "gemini-2.5-flash-image")
        
        client = google_genai.Client(api_key=self.settings.gemini_api_key)
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(response_modalities=["IMAGE"])
        )
        
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                return part.inline_data.data
        raise Exception("No image generated from Gemini")

    async def _generate_dalle(self, prompt: str, size: str = "1792x1024") -> bytes:
        if not self.settings.openai_api_key:
            raise Exception("OPENAI_API_KEY is required for DALL-E")
        
        # DALL-E 3 supported sizes: 1024x1024, 1792x1024, 1024x1792
        dalle_sizes = {"1792x1024": "1792x1024", "1024x1792": "1024x1792", "1024x1024": "1024x1024"}
        dalle_size = dalle_sizes.get(size, "1792x1024")
        
        response = self.openai.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size=dalle_size,
            quality="standard",
            n=1
        )
        
        image_url = response.data[0].url
        async with httpx.AsyncClient() as client:
            img_response = await client.get(image_url)
            return img_response.content

