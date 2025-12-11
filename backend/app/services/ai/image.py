import json
import re
from pathlib import Path
from PIL import Image
import io
from .thumbnail import ThumbnailService


VIDEO_STYLE_CONFIGS = {
    "dialogue": {"scene": "conversation", "mood": "educational, friendly", "style": "two characters talking"},
    "storytelling": {"scene": "narrative", "mood": "dramatic, cinematic", "style": "story scenes with emotion"},
    "tutorial": {"scene": "demonstration", "mood": "clear, instructional", "style": "step-by-step visuals"},
    "documentary": {"scene": "informative", "mood": "professional, factual", "style": "documentary visuals"},
    "podcast": {"scene": "casual talk", "mood": "relaxed, friendly", "style": "hosts chatting casually"},
    "product_demo": {"scene": "showcase", "mood": "sleek, modern", "style": "product in action, features highlighted"},
    "testimonial": {"scene": "review", "mood": "authentic, relatable", "style": "happy customer sharing experience"},
    "social_ad": {"scene": "attention-grab", "mood": "bold, energetic", "style": "punchy visuals, high contrast"},
    "promo": {"scene": "announcement", "mood": "exciting, dramatic", "style": "cinematic reveal, build-up"},
}

IMAGE_STYLE_CONFIGS = {
    "cartoon": {
        "name": "Cartoon / Animation",
        "prompt": "CARTOON/ANIMATED illustration style, stylized like Pixar or Disney animation, vibrant colors, clean lines, expressive characters",
        "rules": "- CARTOON/ANIMATED style ONLY\n- NO real people, NO photorealistic humans\n- Characters must be stylized cartoon illustrations\n- Vibrant colors, warm lighting",
        "character_type": "cartoon character"
    },
    "anime": {
        "name": "Anime / Manga",
        "prompt": "ANIME style illustration, Japanese animation aesthetic, expressive eyes, detailed hair, dynamic poses",
        "rules": "- ANIME/MANGA art style\n- Japanese animation aesthetic\n- Expressive large eyes, detailed hair\n- Cel-shaded coloring, clean lines",
        "character_type": "anime character"
    },
    "realistic": {
        "name": "Realistic / Photorealistic",
        "prompt": "PHOTOREALISTIC image, high-quality photography style, natural lighting, realistic details, cinematic composition",
        "rules": "- PHOTOREALISTIC quality\n- Natural human appearance\n- Professional photography lighting\n- High detail and clarity",
        "character_type": "realistic person"
    },
    "3d_render": {
        "name": "3D Render",
        "prompt": "HIGH-QUALITY 3D RENDER, modern CGI style, smooth surfaces, professional lighting, Unreal Engine quality",
        "rules": "- 3D RENDERED style\n- CGI quality like modern video games or Pixar\n- Smooth surfaces, realistic lighting\n- Professional 3D modeling aesthetic",
        "character_type": "3D rendered character"
    },
    "watercolor": {
        "name": "Watercolor / Artistic",
        "prompt": "WATERCOLOR painting style, soft artistic strokes, gentle color blending, dreamy artistic atmosphere",
        "rules": "- WATERCOLOR/ARTISTIC painting style\n- Soft brush strokes, color blending\n- Artistic, dreamy quality\n- Hand-painted aesthetic",
        "character_type": "painted figure"
    },
    "flat_vector": {
        "name": "Flat / Vector",
        "prompt": "FLAT VECTOR illustration style, minimal design, bold solid colors, clean geometric shapes, modern graphic design",
        "rules": "- FLAT VECTOR style\n- Minimal, clean design\n- Bold solid colors, no gradients\n- Modern graphic illustration",
        "character_type": "vector character"
    },
    "cinematic": {
        "name": "Cinematic / Film",
        "prompt": "CINEMATIC film still, movie-quality composition, dramatic lighting, film grain, professional cinematography",
        "rules": "- CINEMATIC movie quality\n- Dramatic lighting and composition\n- Film-like color grading\n- Professional cinematography",
        "character_type": "film actor"
    },
}

ASPECT_RATIO_CONFIGS = {
    "16:9": {"name": "Landscape (16:9)", "prompt": "16:9 LANDSCAPE aspect ratio, wide horizontal image", "size": "1792x1024"},
    "9:16": {"name": "Portrait (9:16)", "prompt": "9:16 PORTRAIT aspect ratio, tall vertical image for mobile/shorts", "size": "1024x1792"},
    "1:1": {"name": "Square (1:1)", "prompt": "1:1 SQUARE aspect ratio, perfect square image", "size": "1024x1024"},
    "4:3": {"name": "Standard (4:3)", "prompt": "4:3 aspect ratio, classic standard format", "size": "1365x1024"},
    "3:4": {"name": "Portrait (3:4)", "prompt": "3:4 PORTRAIT aspect ratio, vertical format", "size": "1024x1365"},
    "21:9": {"name": "Ultrawide (21:9)", "prompt": "21:9 ULTRAWIDE cinematic aspect ratio, very wide horizontal", "size": "1792x768"},
}

PROMPT_LANGUAGES = {
    "en": "English",
    "es": "Spanish", 
    "fr": "French",
    "de": "German",
    "pt": "Portuguese",
    "bn": "Bengali",
    "hi": "Hindi",
    "zh": "Chinese",
    "ja": "Japanese",
    "ko": "Korean",
    "ar": "Arabic",
    "ru": "Russian",
}


class ImageService(ThumbnailService):
    
    def _get_style_instruction(self, video_style: str, config: dict) -> str:
        instructions = {
            "dialogue": "Show characters in natural conversation poses, facing each other, engaged in discussion.",
            "storytelling": "Create cinematic narrative scenes with emotional depth, dramatic lighting, story progression.",
            "tutorial": "Show clear demonstration visuals, step-by-step actions, instructional clarity.",
            "documentary": "Professional, informative visuals with factual presentation, clean composition.",
            "podcast": "Relaxed casual setting, hosts in comfortable positions, friendly atmosphere.",
            "product_demo": "Showcase product prominently, highlight features, sleek modern aesthetics, product in use.",
            "testimonial": "Authentic customer scenes, relatable settings, genuine expressions, before/after moments.",
            "social_ad": "Bold eye-catching visuals, high contrast colors, punchy dynamic compositions, scroll-stopping.",
            "promo": "Dramatic cinematic shots, build anticipation, exciting reveal moments, premium feel.",
        }
        return f"STYLE-SPECIFIC INSTRUCTION: {instructions.get(video_style, instructions['dialogue'])}"
    
    async def generate_character_sheet(self, segments: list, script: str = "", video_style: str = "dialogue", image_style: str = "cartoon") -> dict:
        """Generate consistent character/element descriptions for the project"""
        style_config = VIDEO_STYLE_CONFIGS.get(video_style, VIDEO_STYLE_CONFIGS["dialogue"])
        img_style = IMAGE_STYLE_CONFIGS.get(image_style, IMAGE_STYLE_CONFIGS["cartoon"])
        
        # Extract speakers from segments
        speakers = set()
        for s in segments:
            speaker = s.get('speaker', '')
            if speaker and speaker.lower() not in ['narrator', '']:
                speakers.add(speaker)
        
        # Analyze script for key elements (animals, objects, etc.)
        context = script[:1500] if script else "\n".join([s.get('text', '') for s in segments[:10]])
        
        prompt = f"""Analyze this script and create consistent visual descriptions for ALL recurring characters/elements.

VIDEO STYLE: {video_style.upper()} - {style_config['style']}
IMAGE STYLE: {img_style['name']} - {img_style['prompt']}
MOOD: {style_config['mood']}

SCRIPT:
{context}

SPEAKERS: {', '.join(speakers) if speakers else 'None specified'}

YOUR TASK:
1. Identify ALL recurring characters (people, animals, creatures)
2. Identify key recurring objects/locations
3. Create SPECIFIC visual descriptions for each in {img_style['name']} style

OUTPUT FORMAT (JSON):
{{
  "characters": {{
    "CharacterName": {{
      "type": "human/animal/creature",
      "appearance": "detailed physical description - colors, features, size",
      "clothing": "outfit details with specific colors (if applicable)",
      "style": "{img_style['character_type']} style notes"
    }}
  }},
  "setting": {{
    "location": "main location description",
    "colors": "color palette",
    "mood": "lighting and atmosphere"
  }},
  "image_style": "{image_style}"
}}

RULES:
- Be VERY specific with colors (not "colorful" but "bright orange with yellow stripes")
- Include distinguishing features
- Keep consistent {img_style['name']} style throughout
- If it's a story about animals, describe the animals in detail

Return ONLY valid JSON:"""

        result = await self._generate(prompt, max_tokens=2048)
        
        try:
            json_match = re.search(r'\{[\s\S]*\}', result)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass
        
        # Fallback
        return {
            "characters": {name: {"type": "human", "appearance": "friendly cartoon character", "clothing": "casual colorful outfit", "style": "pixar-like"} for name in (speakers or ["Character1", "Character2"])},
            "setting": {"location": "cozy indoor setting", "colors": "warm tones", "mood": "friendly and inviting"}
        }

    async def generate_segment_image(self, prompt: str, output_path: str, model: str = "gemini-2.5-flash", character_sheet: dict = None, image_style: str = "cartoon", aspect_ratio: str = "16:9") -> str:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        img_style = IMAGE_STYLE_CONFIGS.get(image_style, IMAGE_STYLE_CONFIGS["cartoon"])
        ratio_config = ASPECT_RATIO_CONFIGS.get(aspect_ratio, ASPECT_RATIO_CONFIGS["16:9"])
        
        char_instructions = ""
        if character_sheet:
            chars = character_sheet.get("characters", {})
            setting = character_sheet.get("setting", {})
            
            if chars:
                char_instructions = "\n\nCHARACTER DESCRIPTIONS (USE EXACTLY):\n"
                for name, desc in chars.items():
                    char_instructions += f"- {name}: {desc.get('type', 'character')}, {desc.get('appearance', '')}, {desc.get('clothing', '')}\n"
            
            if setting:
                char_instructions += f"\nSETTING: {setting.get('location', '')}, {setting.get('colors', '')}, {setting.get('mood', '')}\n"
        
        full_prompt = f"""{img_style['prompt']} illustration:
{prompt}
{char_instructions}
STYLE RULES:
- {ratio_config['prompt']}
{img_style['rules']}
- MAINTAIN EXACT appearance for all characters as described above
- Clean composition with GENEROUS SPACING between characters
- Professional quality"""
        
        if model == "dall-e-3":
            img_bytes = await self._generate_dalle(full_prompt, ratio_config['size'])
        else:
            img_bytes = await self._generate_gemini(full_prompt, model)
        
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img.save(output_path, "PNG", quality=95)
        return output_path

    async def generate_image_prompt(self, segments: list, script: str, character_sheet: dict = None, video_style: str = "dialogue", image_style: str = "cartoon", aspect_ratio: str = "16:9", prompt_language: str = "en") -> str:
        style_config = VIDEO_STYLE_CONFIGS.get(video_style, VIDEO_STYLE_CONFIGS["dialogue"])
        img_style = IMAGE_STYLE_CONFIGS.get(image_style, IMAGE_STYLE_CONFIGS["cartoon"])
        ratio_config = ASPECT_RATIO_CONFIGS.get(aspect_ratio, ASPECT_RATIO_CONFIGS["16:9"])
        lang_name = PROMPT_LANGUAGES.get(prompt_language, "English")
        
        context = ""
        speakers = set()
        if segments:
            for s in segments[:5]:
                speaker = s.get('speaker', 'Person')
                if speaker:
                    speakers.add(speaker)
            context = "\n".join([f"{s.get('speaker', 'Narrator')}: {s.get('text', '')}" for s in segments[:5]])
        elif script:
            context = script[:500]
        
        if not context:
            return f"{ratio_config['prompt']}, {img_style['prompt']}, {style_config['mood']}, characters in a cozy setting"
        
        char_instructions = ""
        if character_sheet:
            chars = character_sheet.get("characters", {})
            setting = character_sheet.get("setting", {})
            if chars:
                char_instructions = "USE THESE EXACT CHARACTER DESCRIPTIONS:\n"
                for name, desc in chars.items():
                    char_instructions += f"- {name}: {desc.get('appearance', '')}, {desc.get('clothing', '')}\n"
            if setting:
                char_instructions += f"SETTING: {setting.get('location', '')}, {setting.get('mood', '')}\n"
        
        lang_instruction = f"\nGenerate the prompt in {lang_name} language." if prompt_language != "en" else ""
        
        prompt = f"""Create ONE image prompt for a {video_style.upper()} scene in {img_style['name']} style.

SCRIPT CONTEXT:
{context}

{char_instructions}
VIDEO STYLE: {style_config['style']}, {style_config['mood']}
IMAGE STYLE: {img_style['name']}
ASPECT RATIO: {ratio_config['name']}

REQUIREMENTS:
- {ratio_config['prompt']}
- {img_style['name']} style
- {style_config['scene']} scene with appropriate poses
- GENEROUS SPACING between characters
- NO text, speech bubbles, or logos
{lang_instruction}
Return ONLY the image prompt (2-3 sentences):"""

        result = await self._generate(prompt)
        return f"{ratio_config['prompt']}, {img_style['prompt']}, {result.strip()}"

    async def generate_batch_prompts(self, segments: list, count: int = 0, character_sheet: dict = None, script: str = "", language: str = "English", existing_prompts: list = None, video_style: str = "dialogue", image_style: str = "cartoon", aspect_ratio: str = "16:9", prompt_language: str = "en") -> list:
        if not segments:
            return []
        
        style_config = VIDEO_STYLE_CONFIGS.get(video_style, VIDEO_STYLE_CONFIGS["dialogue"])
        img_style = IMAGE_STYLE_CONFIGS.get(image_style, IMAGE_STYLE_CONFIGS["cartoon"])
        ratio_config = ASPECT_RATIO_CONFIGS.get(aspect_ratio, ASPECT_RATIO_CONFIGS["16:9"])
        lang_name = PROMPT_LANGUAGES.get(prompt_language, "English")
        
        # Generate character sheet if not provided
        if not character_sheet:
            character_sheet = await self.generate_character_sheet(segments, script, video_style, image_style)
        
        total_duration = max(s.get("end", 0) for s in segments)
        num_images = count if count > 0 else max(2, min(len(segments), 6))
        
        # Build character description from sheet
        char_desc = ""
        chars = character_sheet.get("characters", {})
        for name, desc in chars.items():
            char_desc += f"- {name}: {desc.get('type', '')}, {desc.get('appearance', '')}, {desc.get('clothing', '')}\n"
        
        setting = character_sheet.get("setting", {})
        setting_desc = f"Location: {setting.get('location', 'indoor')}, Colors: {setting.get('colors', 'warm')}, Mood: {setting.get('mood', 'friendly')}"
        
        script_text = "\n".join([
            f"[{s.get('start', 0)}s] {s.get('speaker', '')}: {s.get('text', '')}"
            for s in segments
        ])
        
        lang_note = f"(Script language: {language} - character names may be in {language})" if language != "English" else ""
        
        # Build context from existing prompts for style consistency
        existing_context = ""
        if existing_prompts and len(existing_prompts) > 0:
            # Take last 5-8 prompts for better context
            sample_prompts = existing_prompts[-8:] if len(existing_prompts) > 8 else existing_prompts
            existing_context = f"""
=== CRITICAL: EXISTING IMAGE STYLE REFERENCE ===
You have {len(existing_prompts)} existing images. Here are the prompts used:

{chr(10).join([f"Image {i+1}: {p[:300]}" for i, p in enumerate(sample_prompts)])}

MANDATORY REQUIREMENTS:
- Use EXACT SAME visual style as above
- Use EXACT SAME character designs (appearance, colors, clothing)
- Use EXACT SAME art style (cartoon type, line style, color palette)
- Use EXACT SAME setting/background style
- New images must look like they belong to the SAME video
==============================================
"""
        
        style_instruction = self._get_style_instruction(video_style, style_config)
        
        lang_output = f"\nGenerate prompts in {lang_name} language." if prompt_language != "en" else ""
        
        prompt = f"""Create {num_images} {img_style['name'].upper()} scene image prompts for a {video_style.upper()} video.
{lang_note}

VIDEO STYLE: {video_style.upper()}
- Scene type: {style_config['scene']}
- Mood: {style_config['mood']}
- Visual style: {style_config['style']}

IMAGE STYLE: {img_style['name']}
- {img_style['prompt']}

ASPECT RATIO: {ratio_config['name']}

CHARACTER DESCRIPTIONS (USE EXACTLY IN ALL PROMPTS):
{char_desc}

SETTING: {setting_desc}
{existing_context}
SCRIPT ({total_duration}s total):
{script_text[:2000]}

{style_instruction}
{lang_output}
CRITICAL RULES:
1. {ratio_config['prompt']}
2. {img_style['name'].upper()} style - {img_style['rules'].split(chr(10))[0]}
3. Use EXACT character descriptions above in EVERY prompt
4. SAME appearance for each character across ALL images
5. SAME setting/location in all images
6. GENEROUS SPACING between characters
7. Character names from script (may be in {language}) should be used as-is
{"8. MATCH the style of existing prompts exactly" if existing_prompts else ""}

Create {num_images} prompts showing these EXACT characters in different {style_config['scene']} scenes.

OUTPUT FORMAT (JSON):
[
  {{"timestamp": 0, "prompt": "{ratio_config['name']}, {img_style['name']}, {style_config['mood']}, [EXACT CHARACTER DESCRIPTIONS], [SETTING], characters well-spaced"}},
  ...
]

Return ONLY valid JSON array:"""

        result = await self._generate(prompt, max_tokens=8192)
        
        try:
            json_match = re.search(r'\[[\s\S]*\]', result)
            if json_match:
                prompts = json.loads(json_match.group())[:num_images]
                for p in prompts:
                    if "prompt" in p:
                        p["prompt"] = f"{ratio_config['prompt']}, {img_style['prompt']}, {p['prompt']}"
                        p["character_sheet"] = character_sheet
                        p["image_style"] = image_style
                        p["aspect_ratio"] = aspect_ratio
                return prompts
        except Exception:
            pass
        
        # Fallback: generate basic prompts from segments
        fallback_prompts = []
        interval = max(1, len(segments) // num_images) if num_images > 0 else 1
        for i in range(num_images):
            idx = min(i * interval, len(segments) - 1) if segments else 0
            seg = segments[idx] if segments else {}
            speaker = seg.get('speaker', 'Character')
            timestamp = seg.get('start', i * 10)
            
            base_prompt = f"{ratio_config['prompt']}, {img_style['prompt']}, {style_config['mood']}, {speaker} in a {style_config['scene']} scene"
            if char_desc:
                first_char = char_desc.split('\n')[0] if '\n' in char_desc else char_desc
                base_prompt += f", {first_char}"
            
            fallback_prompts.append({
                "timestamp": timestamp,
                "prompt": base_prompt,
                "character_sheet": character_sheet,
                "image_style": image_style,
                "aspect_ratio": aspect_ratio
            })
        
        return fallback_prompts

