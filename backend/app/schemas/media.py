"""Media API request schemas."""

from pydantic import BaseModel


class GenerateImageRequest(BaseModel):
    project_id: str
    prompt: str
    segment_index: int = 0
    model: str = "gemini-2.5-flash"
    image_style: str = "cartoon"
    aspect_ratio: str = "16:9"


class SuggestPromptRequest(BaseModel):
    project_id: str
    segments: list = []
    script: str = ""
    image_style: str = "cartoon"
    aspect_ratio: str = "16:9"
    prompt_language: str = "en"


class BatchGenerateRequest(BaseModel):
    project_id: str
    segments: list
    model: str = "gemini-2.5-flash"
    count: int = 0
    regenerate_characters: bool = False
    language: str = "English"
    image_style: str = "cartoon"
    aspect_ratio: str = "16:9"
    prompt_language: str = "en"


class ImageToVideoRequest(BaseModel):
    project_id: str
    media_id: str
    duration: float = 5.0
    effect: str = "zoom_in"


class RegenerateImageRequest(BaseModel):
    media_id: str
    prompt: str = ""
    model: str = "gemini-2.5-flash"
    image_style: str = ""
    aspect_ratio: str = ""


class UpdatePromptRequest(BaseModel):
    media_id: str
    prompt: str


class UpdateMediaOrderRequest(BaseModel):
    project_id: str
    media_order: list


class StockDownloadRequest(BaseModel):
    project_id: str
    url: str
    source: str = "pexels"
    media_type: str = "image"


class GeneratePromptsRequest(BaseModel):
    project_id: str
    segments: list
    count: int = 3
    language: str = "English"
    existing_prompts: list = []
    image_style: str = "cartoon"
    aspect_ratio: str = "16:9"
    prompt_language: str = "en"

