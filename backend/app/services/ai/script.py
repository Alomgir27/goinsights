import json
import re
from .base import BaseAIService
from .prompts import get_style_prompt


class ScriptService(BaseAIService):
    async def _extract_key_points(self, transcript_text: str, target_segments: int = 20) -> str:
        lines = transcript_text.split('\n')
        chunk_size = 50
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
    
    async def generate_script(self, transcript_text: str, duration_seconds: int = 300, language: str = "English") -> dict:
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
        try:
            json_match = re.search(r'\[[\s\S]*\]', result)
            if json_match:
                raw_segments = json.loads(json_match.group())
                raw_segments = raw_segments[:num_segments]
                
                output_seg_duration = max(5, duration_seconds // len(raw_segments))
                
                segments = []
                current_output_time = 0
                
                for i, s in enumerate(raw_segments):
                    source_start = s.get("source_start", 0)
                    source_end = s.get("source_end", source_start + 8)
                    
                    clip_duration = source_end - source_start
                    if clip_duration < 6:
                        source_end = source_start + 8
                    elif clip_duration > 12:
                        source_end = source_start + 10
                    
                    segments.append({
                        "text": s.get("text", ""),
                        "start": current_output_time,
                        "end": current_output_time + output_seg_duration,
                        "source_start": int(source_start),
                        "source_end": int(source_end)
                    })
                    current_output_time += output_seg_duration
                
                script = " ".join([s["text"] for s in segments])
                return {"script": script, "segments": segments}
        except Exception as e:
            print(f"Parse error: {e}")
        
        return {"script": result, "segments": []}

    async def generate_script_from_prompt(self, prompt: str, duration_seconds: int, language: str, num_segments: int, video_style: str = "dialogue") -> dict:
        if num_segments > 30:
            return await self._generate_long_dialogue(prompt, duration_seconds, language, num_segments, video_style)
        
        ai_prompt = get_style_prompt(prompt, duration_seconds, num_segments, language, video_style)
        result = await self._generate(ai_prompt, max_tokens=8192)
        return self._parse_style_result(result, duration_seconds, video_style)
    
    def _parse_style_result(self, result: str, duration_seconds: int, video_style: str) -> dict:
        try:
            json_match = re.search(r'\[[\s\S]*\]', result)
            if json_match:
                json_str = json_match.group()
                json_str = re.sub(r',\s*]', ']', json_str)
                json_str = re.sub(r',\s*}', '}', json_str)
                json_str = json_str.replace('\n', ' ').replace('\r', '')
                raw_segments = json.loads(json_str)
                seg_duration = duration_seconds // max(len(raw_segments), 1)
                
                voice_map = {}
                available_voices = ["aria", "roger", "sarah", "george", "lily", "charlie"]
                voice_index = 0
                
                segments = []
                current_time = 0
                for s in raw_segments:
                    dur = s.get("duration", seg_duration)
                    speaker = s.get("speaker", "Narrator")
                    text = s.get("text", "")
                    
                    if speaker not in voice_map:
                        voice_map[speaker] = available_voices[voice_index % len(available_voices)]
                        voice_index += 1
                    
                    segments.append({
                        "text": text,
                        "display_text": f"{speaker}: {text}" if speaker else text,
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
        
        return {"script": result, "segments": []}
    
    async def generate_wikipedia_script(self, article_content: str, images: list, duration_seconds: int, language: str) -> dict:
        num_segments = max(5, duration_seconds // 8)
        media_count = len(images)
        
        media_info = []
        for i, img in enumerate(images):
            media_type = img.get("type", "image")
            title = img.get("title", "").replace("File:", "").replace(".jpg", "").replace(".png", "").replace("_", " ")
            desc = img.get("description", "")[:250]
            media_info.append(f"{i+1}. [{media_type.upper()}] {title} | {desc}")
        media_list = "\n".join(media_info) if media_info else "No media available"
        
        prompt = f"""Create {num_segments} segments for a {duration_seconds}s documentary in {language}.

TOPIC:
{article_content[:4000]}

MEDIA LIBRARY ({media_count} items):
{media_list}

YOUR TASK:
1. Write narration for each segment (25-45 words)
2. For EACH segment, pick the BEST matching media by analyzing:
   - What the segment talks about (people, places, events, objects)
   - What the media shows (from title and description)
   - Semantic match: war text → battle media, leader mention → portrait media

MATCHING EXAMPLES:
- Segment about "soldiers attacked the city" → pick media showing battle/military
- Segment about "the president announced" → pick media showing the leader/speech
- Segment about "aftermath destruction" → pick media showing ruins/damage
- Segment about "map of the region" → pick media showing map/geography

OUTPUT FORMAT:
[
  {{"text": "narration text...", "media_index": N, "type": "hook|background|incident|aftermath|conclusion", "duration": 7}}
]

RULES:
- {language.upper()} language, convert years to words
- media_index must be 1-{media_count}
- Pick media that VISUALLY matches what the narration describes
- Same media CAN be reused if it fits multiple segments

Return JSON array only:"""

        result = await self._generate(prompt, max_tokens=8192)
        return self._parse_wikipedia_result(result, images, duration_seconds)

    def _parse_wikipedia_result(self, result: str, images: list, duration_seconds: int) -> dict:
        try:
            json_match = re.search(r'\[[\s\S]*\]', result)
            if json_match:
                json_str = json_match.group()
                json_str = re.sub(r',\s*]', ']', json_str)
                raw_segments = json.loads(json_str)
                
                segments = []
                current_time = 0
                for s in raw_segments:
                    dur = s.get("duration", 7)
                    media_idx = s.get("media_index") or s.get("image_index", 0)
                    media_id = None
                    media_type = "image"
                    
                    if 0 < media_idx <= len(images):
                        media = images[media_idx - 1]
                        media_id = media.get("id")
                        media_type = media.get("type", "image")
                    
                    segments.append({
                        "text": s.get("text", ""),
                        "start": current_time,
                        "end": current_time + dur,
                        "duration": dur,
                        "type": s.get("type", "content"),
                        "media_id": media_id,
                        "media_type": media_type,
                        "voice_id": "aria"
                    })
                    current_time += dur
                
                script = " ".join([s["text"] for s in segments])
                return {"script": script, "segments": segments}
        except Exception as e:
            print(f"Wikipedia script parse error: {e}")
        
        return {"script": result, "segments": []}

    async def _generate_long_dialogue(self, prompt: str, duration_seconds: int, language: str, total_segments: int, video_style: str = "dialogue") -> dict:
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
        
        current_time = 0
        for seg in all_segments:
            seg["start"] = current_time
            seg["end"] = current_time + seg["duration"]
            current_time += seg["duration"]
        
        script = "\n".join([s["display_text"] for s in all_segments])
        return {"script": script, "segments": all_segments}

    async def reassign_media_to_segments(self, segments: list, media_list: list) -> list:
        seg_info = []
        for i, s in enumerate(segments):
            text = s.get("text", "")[:100]
            seg_info.append(f"{i+1}. \"{text}\"")
        
        media_info = []
        for i, m in enumerate(media_list):
            title = m.get("title", "").replace("File:", "").replace("_", " ")[:80]
            desc = m.get("description", "")[:120]
            media_info.append(f"{i+1}. [{m.get('type', 'image').upper()}] {title}: {desc}")
        
        prompt = f"""Match each segment to the BEST fitting media based on content.

SEGMENTS ({len(segments)}):
{chr(10).join(seg_info)}

MEDIA ({len(media_list)} items):
{chr(10).join(media_info)}

For each segment, return the media index (1-{len(media_list)}) that BEST matches the segment content.
Match by: people mentioned, places, events, objects, actions described.

Return JSON array of {len(segments)} numbers (media indices):
[3, 1, 5, 2, ...]

Return ONLY the JSON array:"""

        result = await self._generate(prompt, max_tokens=4096)
        
        try:
            json_match = re.search(r'\[[\s\S]*?\]', result)
            if json_match:
                indices = json.loads(json_match.group())
                for i, seg in enumerate(segments):
                    if i < len(indices):
                        idx = indices[i]
                        if 0 < idx <= len(media_list):
                            seg["media_id"] = media_list[idx - 1].get("id")
                            seg["media_type"] = media_list[idx - 1].get("type", "image")
        except Exception as e:
            print(f"Reassign media error: {e}")
        
        return segments
