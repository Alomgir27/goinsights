import httpx
import asyncio
from typing import Optional
from app.config import get_settings

class AssemblyAIService:
    BASE_URL = "https://api.assemblyai.com/v2"
    
    def __init__(self):
        settings = get_settings()
        self.api_key = settings.assemblyai_api_key
        self.headers = {"authorization": self.api_key}
    
    async def transcribe_from_url(self, audio_url: str, speaker_labels: bool = True) -> dict:
        """Transcribe audio/video from URL with speaker diarization"""
        async with httpx.AsyncClient(timeout=300) as client:
            # Submit transcription job
            response = await client.post(
                f"{self.BASE_URL}/transcript",
                headers=self.headers,
                json={
                    "audio_url": audio_url,
                    "speaker_labels": speaker_labels,
                    "auto_chapters": True,
                    "entity_detection": True,
                    "sentiment_analysis": True,
                    "auto_highlights": True,
                    "punctuate": True,
                    "format_text": True
                }
            )
            result = response.json()
            transcript_id = result["id"]
            
            # Poll for completion
            while True:
                response = await client.get(
                    f"{self.BASE_URL}/transcript/{transcript_id}",
                    headers=self.headers
                )
                result = response.json()
                
                if result["status"] == "completed":
                    return self._format_transcript(result)
                elif result["status"] == "error":
                    raise Exception(f"Transcription failed: {result.get('error', 'Unknown error')}")
                
                await asyncio.sleep(3)
    
    def _format_transcript(self, result: dict) -> dict:
        """Format AssemblyAI response into structured data"""
        # Extract sentences with timestamps
        sentences = []
        if result.get("words"):
            current_sentence = {"text": "", "start": 0, "end": 0, "speaker": None, "words": []}
            for word in result["words"]:
                if not current_sentence["text"]:
                    current_sentence["start"] = word["start"] / 1000  # Convert to seconds
                    current_sentence["speaker"] = word.get("speaker")
                
                current_sentence["text"] += word["text"] + " "
                current_sentence["end"] = word["end"] / 1000
                current_sentence["words"].append({
                    "text": word["text"],
                    "start": word["start"] / 1000,
                    "end": word["end"] / 1000,
                    "confidence": word.get("confidence", 1.0)
                })
                
                # End sentence on punctuation
                if word["text"].rstrip().endswith((".", "!", "?", ":", ";")):
                    current_sentence["text"] = current_sentence["text"].strip()
                    sentences.append(current_sentence)
                    current_sentence = {"text": "", "start": 0, "end": 0, "speaker": None, "words": []}
            
            # Add remaining text
            if current_sentence["text"].strip():
                current_sentence["text"] = current_sentence["text"].strip()
                sentences.append(current_sentence)
        
        # Extract paragraphs (from utterances if available)
        paragraphs = []
        if result.get("utterances"):
            for utterance in result["utterances"]:
                paragraphs.append({
                    "text": utterance["text"],
                    "start": utterance["start"] / 1000,
                    "end": utterance["end"] / 1000,
                    "speaker": utterance.get("speaker"),
                    "confidence": utterance.get("confidence", 1.0)
                })
        
        # Extract chapters
        chapters = []
        if result.get("chapters"):
            for chapter in result["chapters"]:
                chapters.append({
                    "headline": chapter.get("headline", ""),
                    "summary": chapter.get("summary", ""),
                    "start": chapter["start"] / 1000,
                    "end": chapter["end"] / 1000
                })
        
        # Extract highlights
        highlights = []
        if result.get("auto_highlights_result", {}).get("results"):
            for highlight in result["auto_highlights_result"]["results"]:
                highlights.append({
                    "text": highlight["text"],
                    "count": highlight["count"],
                    "timestamps": [{"start": t["start"] / 1000, "end": t["end"] / 1000} for t in highlight.get("timestamps", [])]
                })
        
        # Get unique speakers
        speakers = list(set(s["speaker"] for s in sentences if s.get("speaker")))
        
        return {
            "text": result.get("text", ""),
            "sentences": sentences,
            "paragraphs": paragraphs,
            "chapters": chapters,
            "highlights": highlights,
            "speakers": speakers,
            "duration": result.get("audio_duration", 0),
            "confidence": result.get("confidence", 0),
            "word_count": len(result.get("words", []))
        }

