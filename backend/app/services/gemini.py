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
    
    async def _generate(self, prompt: str, max_tokens: int = 4096) -> str:
        response = self.openai.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens
        )
        return response.choices[0].message.content
    
    async def _extract_key_points(self, transcript_text: str, target_segments: int = 20) -> str:
        """Extract key points preserving original timestamps from transcript"""
        import re
        
        # Split transcript while preserving timestamps
        lines = transcript_text.split('\n')
        chunk_size = 50  # lines per chunk
        chunks = []
        
        for i in range(0, len(lines), chunk_size):
            chunk = '\n'.join(lines[i:i + chunk_size])
            if chunk.strip():
                chunks.append(chunk)
        
        if not chunks:
            return transcript_text
        
        points_per_chunk = max(3, (target_segments // len(chunks)) + 1)
        
        all_points = []
        for i, chunk in enumerate(chunks):
            # Find timestamps in this chunk
            timestamps = re.findall(r'\[(\d+)s\]', chunk)
            time_range = f"{timestamps[0]}s-{timestamps[-1]}s" if timestamps else f"part {i+1}"
            
            prompt = f"""From this transcript section, identify {points_per_chunk} key moments.

IMPORTANT: Use the EXACT [Xs] timestamps shown in the transcript.

OUTPUT: List each moment with its timestamp:
[120s] Topic: What is discussed here
[145s] Topic: Next important point

Transcript section ({time_range}):
{chunk}

List the key moments with their [Xs] timestamps:"""
            
            points = await self._generate(prompt)
            all_points.append(points)
        
        return "\n\n".join(all_points)
    
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
    
    async def generate_script(self, transcript_text: str, duration_seconds: int = 300, language: str = "English") -> dict:
        """Generate script for videos up to 15 minutes (900 seconds)"""
        num_segments = max(5, min(120, duration_seconds // 7))
        
        key_points = transcript_text
        if len(transcript_text) > 6000:
            key_points = await self._extract_key_points(transcript_text, num_segments)
        
        if num_segments > 40:
            return await self._generate_long_script(key_points, duration_seconds, num_segments, language)
        
        prompt = f"""Analyze this timestamped transcript and create a {duration_seconds}-second voiceover script.

The transcript has timestamps like [45s], [120s] etc. showing WHEN each part is spoken in the original video.

YOUR TASK: Pick {num_segments} interesting moments from the transcript. For each:
1. Find what is being discussed at that timestamp
2. Write a {language} narration about that topic
3. Use the EXACT timestamp from transcript as source_start

OUTPUT FORMAT (JSON array):
[
  {{"text": "{language} narration about topic at 45s", "source_start": 45, "source_end": 53}},
  {{"text": "{language} narration about topic at 120s", "source_start": 120, "source_end": 128}},
  ...
]

MATCHING RULES (CRITICAL):
- source_start MUST be a timestamp [Xs] that appears in the transcript
- source_end = source_start + 8 seconds
- The "text" narration MUST describe what is discussed at that timestamp
- Example: If transcript shows "[45s] The speaker talks about climate change" 
  → source_start: 45, text: "Climate change is affecting our planet..."

ADDITIONAL RULES:
- Exactly {num_segments} segments
- Output language: {language.upper()}
- Spread timestamps across the full video chronologically
- Each narration: 15-25 words, natural speech

TRANSCRIPT WITH TIMESTAMPS:
{key_points[:12000]}

Return ONLY the JSON array:"""
        
        token_limit = 4096 if num_segments <= 20 else 8192
        result = await self._generate(prompt, max_tokens=token_limit)
        return self._parse_script_result(result, duration_seconds, num_segments)
    
    async def _generate_long_script(self, key_points: str, duration_seconds: int, total_segments: int, language: str = "English") -> dict:
        """Generate script in batches for very long videos (10+ minutes)"""
        import json
        import re
        
        all_segments = []
        batch_size = 30
        num_batches = (total_segments + batch_size - 1) // batch_size
        time_per_batch = duration_seconds // num_batches
        
        for batch in range(num_batches):
            start_time = batch * time_per_batch
            end_time = min((batch + 1) * time_per_batch, duration_seconds)
            segments_in_batch = batch_size if batch < num_batches - 1 else (total_segments - batch * batch_size)
            
            point_start = int(len(key_points) * batch / num_batches)
            point_end = int(len(key_points) * (batch + 1) / num_batches)
            batch_points = key_points[point_start:point_end]
            
            prompt = f"""Pick {segments_in_batch} moments from this transcript section ({start_time}s to {end_time}s).

Use timestamps like [Xs] from the transcript as source_start values.

OUTPUT FORMAT:
[{{"text": "{language} narration matching the topic", "source_start": (timestamp from transcript), "source_end": (source_start + 8)}}, ...]

RULES:
- source_start MUST be an actual timestamp [Xs] from the transcript
- Narration describes what's discussed at that timestamp
- Timestamps between {start_time}s and {end_time}s only
- {segments_in_batch} segments, 15-25 words each in {language.upper()}
- Batch {batch + 1}/{num_batches}

TRANSCRIPT SECTION:
{batch_points[:4000]}

Return ONLY JSON:"""
            
            result = await self._generate(prompt, max_tokens=8192)
            
            try:
                json_match = re.search(r'\[[\s\S]*\]', result)
                if json_match:
                    batch_segments = json.loads(json_match.group())
                    all_segments.extend(batch_segments[:segments_in_batch])
            except:
                pass
        
        # Recalculate timing
        seg_duration = duration_seconds // len(all_segments) if all_segments else 7
        current_time = 0
        segments = []
        for s in all_segments:
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
    
    def _parse_script_result(self, result: str, duration_seconds: int, num_segments: int) -> dict:
        """Parse AI response into segments with validated timing"""
        import json
        import re
        
        try:
            json_match = re.search(r'\[[\s\S]*\]', result)
            if json_match:
                raw_segments = json.loads(json_match.group())
                raw_segments = raw_segments[:num_segments]
                
                output_seg_duration = max(5, duration_seconds // len(raw_segments))
                
                segments = []
                current_output_time = 0
                
                for i, s in enumerate(raw_segments):
                    # Get source timestamps from AI (where content is in original video)
                    source_start = s.get("source_start", 0)
                    source_end = s.get("source_end", source_start + 8)
                    
                    # Ensure source clip is 6-10 seconds
                    clip_duration = source_end - source_start
                    if clip_duration < 6:
                        source_end = source_start + 8
                    elif clip_duration > 12:
                        source_end = source_start + 10
                    
                    segments.append({
                        "text": s.get("text", ""),
                        "start": current_output_time,  # Output timeline
                        "end": current_output_time + output_seg_duration,
                        "source_start": int(source_start),  # Original video timestamp
                        "source_end": int(source_end)
                    })
                    current_output_time += output_seg_duration
                
                script = " ".join([s["text"] for s in segments])
                return {"script": script, "segments": segments}
        except Exception as e:
            print(f"Parse error: {e}")
        
        return {"script": result, "segments": []}
    
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
    
    async def generate_thumbnail_prompt(self, script: str, title: str, language: str = "English") -> dict:
        """Generate thumbnail prompt matching video's cartoon/animated style"""
        prompt = f"""Based on this video content, create:
1. A short catchy title for thumbnail text overlay IN {language.upper()}
2. A CARTOON/ANIMATED image description for thumbnail

Video Title: {title}
Script: {script[:300]}

OUTPUT FORMAT (JSON):
{{"title": "SHORT TITLE IN {language.upper()}", "image": "cartoon scene description"}}

TITLE RULES:
- Maximum 3-4 words IN {language.upper()} LANGUAGE
- Plain text only, NO emojis, NO icons, NO special characters
- ALL CAPS, creates curiosity or impact

IMAGE RULES (IMPORTANT):
- CARTOON/ANIMATED style - NO real people, NO photorealistic
- Stylized cartoon characters like Pixar or anime style
- Vibrant colors, eye-catching, related to content
- Describe cartoon characters and scene

Return ONLY JSON. Title MUST be in {language}."""
        
        result = await self._generate(prompt)
        
        import json
        import re
        try:
            json_match = re.search(r'\{[\s\S]*\}', result)
            if json_match:
                return json.loads(json_match.group())
        except:
            pass
        
        # Fallback - clean title without special characters
        import re
        clean_title = re.sub(r'[^\w\s]', '', title)  # Remove special chars
        words = clean_title.split()[:3]
        return {"title": " ".join(words).upper(), "image": f"dramatic scene about {title}"}
    
    async def generate_thumbnail_image(self, title: str, image_prompt: str, output_path: str, model: str = "gemini-2.5-flash") -> str:
        """Generate YouTube thumbnail with AI-rendered title text"""
        from PIL import Image
        import io
        
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        full_prompt = f"""Create a YouTube thumbnail image with TEXT and ILLUSTRATION:

TEXT TO DISPLAY: "{title.upper()}"

SCENE/BACKGROUND: {image_prompt}

REQUIREMENTS:
1. MUST include the exact text "{title.upper()}" prominently in the CENTER of image
2. Text should be LARGE, BOLD, easy to read - white or bright color with dark outline/shadow
3. CARTOON/ANIMATED style - NO real people, NO photorealistic humans
4. Characters must be stylized cartoon/anime illustrations like Pixar or anime
5. Vibrant, eye-catching colors with dramatic lighting
6. 16:9 aspect ratio, professional quality
7. Text should be the main focus, clearly readable at small sizes"""

        if model == "dall-e-3":
            img_bytes = await self._generate_dalle(full_prompt)
        else:
            img_bytes = await self._generate_gemini(full_prompt, model)
        
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img.save(output_path, "PNG", quality=95)
        return output_path

    async def _generate_gemini(self, prompt: str, model: str) -> bytes:
        """Generate image using Gemini models"""
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

    async def _generate_dalle(self, prompt: str) -> bytes:
        """Generate image using DALL-E 3"""
        import httpx
        
        if not self.settings.openai_api_key:
            raise Exception("OPENAI_API_KEY is required for DALL-E")
        
        response = self.openai.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size="1792x1024",
            quality="standard",
            n=1
        )
        
        image_url = response.data[0].url
        async with httpx.AsyncClient() as client:
            img_response = await client.get(image_url)
            return img_response.content
    
    async def generate_script_from_prompt(self, prompt: str, duration_seconds: int, language: str, num_segments: int) -> dict:
        """Generate script from user prompt - uses batches for long scripts"""
        import json
        import re
        
        # For scripts > 3 minutes, generate in batches
        if num_segments > 30:
            return await self._generate_long_dialogue(prompt, duration_seconds, language, num_segments)
        
        ai_prompt = f"""Generate an EDUCATIONAL DIALOGUE script for a video:

TOPIC: {prompt}
DURATION: {duration_seconds} seconds
SEGMENTS: {num_segments}
LANGUAGE: {language}

DIALOGUE FORMAT:
- EXACTLY 2 speakers: A learner asking questions and an expert explaining
- Learner: Curious, asks smart questions, shares confusions viewers might have
- Expert: Gives clear, practical answers with examples viewers can use immediately

CONTENT RULES:
1. Make every exchange valuable - teach something useful in each response
2. Include real examples, practical tips, and common mistakes to avoid
3. Keep it conversational but educational - viewers should learn something new
4. End with actionable takeaway or memorable tip

TECHNICAL RULES:
1. Each segment = ONE speaker's complete turn (all sentences before other responds)
2. Alternate: Learner asks -> Expert explains -> Learner follows up -> Expert answers
3. Each segment 20-50 words, 5-10 seconds
4. START directly with dialogue - no intros or greetings
5. Use simple names like Alex and Sam but my recommendation is to use names that are easy to understand and remember. I prefer different names not always Alex and Sam.

OUTPUT FORMAT - Return ONLY this JSON array:
[
  {{"speaker": "Alex", "text": "I always get confused about when to use present tense. Can you explain it simply?", "duration": 6}},
  {{"speaker": "Sam", "text": "Sure! Present tense describes habits and facts. Like - I eat breakfast every morning. We add s for he or she.", "duration": 8}},
  {{"speaker": "Alex", "text": "Oh that makes sense! So she eats, he plays. What about questions?", "duration": 5}}
]

IMPORTANT: Return ONLY valid JSON array - start with [ end with ] - no markdown or text"""
        
        result = await self._generate(ai_prompt, max_tokens=8192)
        
        try:
            json_match = re.search(r'\[[\s\S]*\]', result)
            if json_match:
                json_str = json_match.group()
                json_str = re.sub(r',\s*]', ']', json_str)
                json_str = re.sub(r',\s*}', '}', json_str)
                json_str = json_str.replace('\n', ' ').replace('\r', '')
                raw_segments = json.loads(json_str)
                seg_duration = duration_seconds // len(raw_segments)
                
                # Map speakers to different voices for variety
                voice_map = {}
                available_voices = ["aria", "roger", "sarah", "george", "lily", "charlie"]
                voice_index = 0
                
                segments = []
                current_time = 0
                for s in raw_segments:
                    dur = s.get("duration", seg_duration)
                    speaker = s.get("speaker", "Narrator")
                    text = s.get("text", "")
                    
                    # Assign voice based on speaker
                    if speaker not in voice_map:
                        voice_map[speaker] = available_voices[voice_index % len(available_voices)]
                        voice_index += 1
                    
                    # Store clean text for TTS (no speaker prefix)
                    # Display text includes speaker name for UI
                    segments.append({
                        "text": text,  # Clean text for TTS
                        "display_text": f"{speaker}: {text}" if speaker else text,  # For UI display
                        "speaker": speaker,
                        "start": current_time,
                        "end": current_time + dur,
                        "duration": dur,
                        "voice_id": voice_map.get(speaker, "aria")
                    })
                    current_time += dur
                
                script = "\n".join([s["display_text"] for s in segments])
                return {"script": script, "segments": segments}
        except Exception as e:
            print(f"Script parse error: {e}")
            print(f"Raw result: {result[:500]}")
        
        # Fallback: try to parse text format "Speaker: text"
        try:
            lines = [l.strip() for l in result.split('\n') if ':' in l and l.strip()]
            if lines:
                segments = []
                seg_duration = duration_seconds // max(len(lines), 1)
                voice_map = {}
                available_voices = ["aria", "roger", "sarah", "george", "lily", "charlie"]
                voice_index = 0
                current_time = 0
                
                for line in lines:
                    parts = line.split(':', 1)
                    if len(parts) == 2:
                        speaker = parts[0].strip()
                        text = parts[1].strip()
                        if speaker not in voice_map:
                            voice_map[speaker] = available_voices[voice_index % len(available_voices)]
                            voice_index += 1
                        segments.append({
                            "text": text,
                            "display_text": f"{speaker}: {text}",
                            "speaker": speaker,
                            "start": current_time,
                            "end": current_time + seg_duration,
                            "duration": seg_duration,
                            "voice_id": voice_map.get(speaker, "aria")
                        })
                        current_time += seg_duration
                
                if segments:
                    script = "\n".join([s["display_text"] for s in segments])
                    return {"script": script, "segments": segments}
        except:
            pass
        
        return {"script": result, "segments": []}
    
    async def _generate_long_dialogue(self, prompt: str, duration_seconds: int, language: str, total_segments: int) -> dict:
        """Generate long dialogue scripts in batches"""
        import json
        import re
        
        all_segments = []
        batch_size = 25
        num_batches = (total_segments + batch_size - 1) // batch_size
        
        voice_map = {}
        available_voices = ["aria", "roger", "sarah", "george", "lily", "charlie"]
        voice_index = 0
        
        for batch in range(num_batches):
            segments_in_batch = batch_size if batch < num_batches - 1 else (total_segments - batch * batch_size)
            batch_num = batch + 1
            
            context = ""
            if all_segments:
                last_few = all_segments[-3:]
                context = "CONTINUE from:\n" + "\n".join([f"{s['speaker']}: {s['text']}" for s in last_few])
            
            ai_prompt = f"""Generate EDUCATIONAL DIALOGUE for a video (Part {batch_num}/{num_batches}):

TOPIC: {prompt}
LANGUAGE: {language}
SEGMENTS NEEDED: {segments_in_batch}

{context}

DIALOGUE FORMAT:
- 2 speakers: Learner (curious, asks questions) and Expert (explains clearly)
- Each segment 20-50 words, 5-10 seconds spoken
- Alternate speakers naturally
- Use names Nina and Leo consistently

OUTPUT: Return ONLY JSON array with {segments_in_batch} segments:
[{{"speaker": "Nina", "text": "question here", "duration": 6}}, {{"speaker": "Leo", "text": "answer here", "duration": 8}}]

Return ONLY valid JSON array:"""
            
            result = await self._generate(ai_prompt, max_tokens=8192)
            
            try:
                json_match = re.search(r'\[[\s\S]*\]', result)
                if json_match:
                    json_str = json_match.group()
                    json_str = re.sub(r',\s*]', ']', json_str)
                    json_str = re.sub(r',\s*}', '}', json_str)
                    batch_segments = json.loads(json_str)
                    
                    for s in batch_segments[:segments_in_batch]:
                        speaker = s.get("speaker", "Narrator")
                        text = s.get("text", "")
                        dur = s.get("duration", 7)
                        
                        if speaker not in voice_map:
                            voice_map[speaker] = available_voices[voice_index % len(available_voices)]
                            voice_index += 1
                        
                        all_segments.append({
                            "text": text,
                            "display_text": f"{speaker}: {text}",
                            "speaker": speaker,
                            "duration": dur,
                            "voice_id": voice_map.get(speaker, "aria")
                        })
            except Exception as e:
                print(f"Batch {batch_num} parse error: {e}")
        
        # Calculate timing
        current_time = 0
        for seg in all_segments:
            seg["start"] = current_time
            seg["end"] = current_time + seg["duration"]
            current_time += seg["duration"]
        
        script = "\n".join([s["display_text"] for s in all_segments])
        return {"script": script, "segments": all_segments}
    
    async def generate_segment_image(self, prompt: str, output_path: str, model: str = "gemini-2.5-flash") -> str:
        """Generate image for a script segment with model selection"""
        from PIL import Image
        import io
        
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        
        full_prompt = f"""CARTOON/ANIMATED illustration for educational video:
{prompt}

STYLE RULES:
- CARTOON/ANIMATED style ONLY - NO real people, NO photorealistic humans
- Characters must be stylized cartoon/anime illustrations
- Clean composition with GENEROUS SPACING between characters
- Characters should NOT overlap or be too close together
- Leave breathing room around each character (at least 15% margin)
- 16:9 aspect ratio, vibrant colors, warm lighting
- Professional animation quality like Pixar or anime studios"""
        
        if model == "dall-e-3":
            img_bytes = await self._generate_dalle(full_prompt)
        else:
            img_bytes = await self._generate_gemini(full_prompt, model)
        
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        img.save(output_path, "PNG", quality=95)
        return output_path

    async def generate_image_prompt(self, segments: list, script: str) -> str:
        """Generate a cinematic image prompt based on script context"""
        context = ""
        speakers = set()
        if segments:
            for s in segments[:5]:
                speaker = s.get('speaker', 'Person')
                if speaker:
                    speakers.add(speaker)
            context = "\n".join([
                f"{s.get('speaker', 'Narrator')}: {s.get('text', '')}"
                for s in segments[:5]
            ])
        elif script:
            context = script[:500]
        
        if not context:
            return "Modern cartoon style, two animated friends with generous spacing between them having a friendly conversation in a cozy living room, warm lighting, clean composition"
        
        num_speakers = len(speakers) if speakers else 2
        speaker_names = ", ".join(list(speakers)[:3]) if speakers else "two people"
        
        prompt = f"""Based on this dialogue script, create ONE image prompt for a CONVERSATION SCENE.

DIALOGUE:
{context}

The image should show {num_speakers} CARTOON characters ({speaker_names}) in a natural conversation setting.

REQUIREMENTS:
- CARTOON/ANIMATED style ONLY - NO real people, NO photorealistic humans
- Characters must be stylized cartoon illustrations (like Pixar, anime, or modern 2D animation)
- GENEROUS SPACING between characters - they should NOT overlap or crowd together
- Leave at least 15-20% empty space around each character
- Show characters in DIALOGUE pose (facing each other, talking, listening)
- Natural setting: living room, cafe, park bench, office - pick what fits the topic
- Warm, friendly atmosphere with good lighting
- NO text, speech bubbles, words, or logos
- 16:9 aspect ratio, clean uncluttered composition

Return ONLY the image prompt (2-3 sentences describing the cartoon scene), nothing else:"""

        return await self._generate(prompt)

    async def generate_batch_prompts(self, segments: list, count: int = 0) -> list:
        """Generate multiple image prompts based on script segments - conversation style"""
        import json
        import re
        
        if not segments:
            return []
        
        total_duration = max(s.get("end", 0) for s in segments)
        num_images = count if count > 0 else max(2, min(len(segments), 6))
        
        # Get unique speakers
        speakers = set()
        for s in segments:
            speaker = s.get('speaker', '')
            if speaker:
                speakers.add(speaker)
        speaker_names = ", ".join(list(speakers)[:4]) if speakers else "two people"
        
        script_text = "\n".join([
            f"[{s.get('start', 0)}s] {s.get('speaker', '')}: {s.get('text', '')}"
            for s in segments
        ])
        
        prompt = f"""Create {num_images} CARTOON conversation scene image prompts for this dialogue video.

CHARACTERS: {speaker_names}
DIALOGUE ({total_duration}s total):
{script_text[:2500]}

CRITICAL STYLE RULES (apply to ALL prompts):
1. CARTOON/ANIMATED ONLY - NO real people, NO photorealistic humans
2. Style: modern 2D cartoon or anime (like Pixar, Disney, or anime studios)
3. SAME character appearances - same clothing, hair color, features throughout
4. SAME color palette and lighting mood
5. SAME background setting (all in same location)

SPACING RULES (VERY IMPORTANT):
- Characters must have GENEROUS SPACING between them
- NO overlapping, NO crowding - leave breathing room
- At least 15-20% empty space around each character
- Clean, uncluttered compositions

Create {num_images} images showing CARTOON characters in conversation - different poses but consistent style.

OUTPUT FORMAT (JSON only):
[
  {{"timestamp": 0, "prompt": "modern cartoon style, two stylized animated friends in cozy living room with generous spacing between them, character A with brown hair wearing blue sweater on left side, character B with black hair in green shirt on right side, warm golden lighting, clean composition"}},
  {{"timestamp": 10, "prompt": "modern cartoon style, same two animated friends well-spaced in same living room, character A gesturing on left, character B responding on right, ample space between characters, warm lighting"}}
]

IMPORTANT: Every prompt must specify cartoon/animated style and spacing between characters.

Return ONLY valid JSON array with exactly {num_images} items:"""

        result = await self._generate(prompt, max_tokens=8192)
        
        try:
            json_match = re.search(r'\[[\s\S]*\]', result)
            if json_match:
                return json.loads(json_match.group())[:num_images]
        except:
            pass
        
        return []

# Backward compatibility alias
GeminiService = AIService
