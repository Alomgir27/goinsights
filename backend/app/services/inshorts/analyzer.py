import google.generativeai as genai
from app.config import get_settings
import json

settings = get_settings()
genai.configure(api_key=settings.gemini_api_key)


async def analyze_for_shorts(transcript: list, duration: int, min_duration: int = 15, max_duration: int = 90) -> list:
    if not transcript:
        return generate_default_segments(duration, min_duration, max_duration)
    
    transcript_text = format_transcript(transcript)
    
    prompt = f"""Analyze this video transcript and identify the BEST segments for short-form content (YouTube Shorts, Reels, TikTok).

Video Duration: {duration} seconds
Target Segment Length: {min_duration}-{max_duration} seconds

Transcript:
{transcript_text[:8000]}

Find 3-5 viral-worthy segments. Look for:
- Surprising facts or reveals
- Emotional moments
- Funny or memorable quotes
- Key insights or tips
- Dramatic tension points

Return JSON array:
[
  {{"start": 0, "end": 45, "score": 95, "reason": "Hook with surprising fact", "transcript": "First 10 words..."}},
  ...
]

Only return the JSON array, no other text."""

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        
        segments = json.loads(text)
        return validate_segments(segments, duration, min_duration, max_duration)
    except Exception as e:
        print(f"AI analysis failed: {e}")
        return generate_default_segments(duration, min_duration, max_duration)


def format_transcript(transcript: list) -> str:
    lines = []
    for item in transcript:
        start = item.get("start", 0)
        text = item.get("text", "")
        minutes = int(start // 60)
        seconds = int(start % 60)
        lines.append(f"[{minutes}:{seconds:02d}] {text}")
    return "\n".join(lines)


def validate_segments(segments: list, duration: int, min_dur: int, max_dur: int) -> list:
    valid = []
    for seg in segments:
        start = max(0, float(seg.get("start", 0)))
        end = min(duration, float(seg.get("end", start + 60)))
        seg_duration = end - start
        
        if seg_duration < min_dur:
            end = min(duration, start + min_dur)
        elif seg_duration > max_dur:
            end = start + max_dur
        
        valid.append({
            "start": round(start, 1),
            "end": round(end, 1),
            "score": min(100, max(0, int(seg.get("score", 80)))),
            "reason": seg.get("reason", "Interesting segment"),
            "transcript": seg.get("transcript", "")[:100]
        })
    return valid[:5]


def generate_default_segments(duration: int, min_dur: int, max_dur: int) -> list:
    segments = []
    seg_len = min(max_dur, max(min_dur, 60))
    
    positions = [0, duration // 3, duration // 2, (2 * duration) // 3]
    reasons = ["Opening hook", "Key moment", "Highlight", "Climax"]
    
    for i, pos in enumerate(positions):
        if pos + seg_len <= duration:
            segments.append({
                "start": pos,
                "end": min(pos + seg_len, duration),
                "score": 80 - (i * 5),
                "reason": reasons[i] if i < len(reasons) else "Segment",
                "transcript": ""
            })
    
    return segments[:4]

