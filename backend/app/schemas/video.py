"""Video API request schemas."""

from pydantic import BaseModel
from typing import List


class SegmentData(BaseModel):
    start: int
    end: int
    text: str


class DownloadRequest(BaseModel):
    project_id: str


class MergeRequest(BaseModel):
    project_id: str
    segments: List[SegmentData]
    subtitles: bool = False
    animated_subtitles: bool = True
    subtitle_style: str = "karaoke"
    resize: str = "16:9"
    bg_music: str = ""
    bg_music_volume: float = 0.3


class ThumbnailRequest(BaseModel):
    project_id: str
    script: str = ""
    language: str = "English"
    model: str = "gemini-3-pro"


class ThumbnailPromptRequest(BaseModel):
    project_id: str
    script: str = ""
    language: str = "English"
    image_style: str = "cartoon"
    video_type: str = "tutorial"


class ThumbnailFromPromptRequest(BaseModel):
    project_id: str
    prompt: str
    model: str = "gemini-3-pro"
    image_style: str = "cartoon"
    video_type: str = "tutorial"
    title: str = ""
    title_position: str = ""


class ThumbnailFromMediaRequest(BaseModel):
    project_id: str
    media_id: str
    title: str = ""
    font_size: str = "medium"
    font_style: str = "bold"
    position: str = "bottom"
    text_color: str = "#FFFFFF"
    stroke_color: str = "#000000"
    stroke_width: int = 3
    effect: str = "glow"


class ExtractClipRequest(BaseModel):
    project_id: str
    index: int
    start: int
    end: int


class BubblePosition(BaseModel):
    id: str
    segmentIndex: int
    mediaId: str = ""
    x: float
    y: float
    width: float
    tailDirection: str = "bottom"
    animation: str = "pop"
    colorIndex: int = 0
    shape: str = "rounded"
    transparent: bool = False


class MediaTimelineItem(BaseModel):
    id: str
    startTime: float = 0
    endTime: float = 5
    assignedSegments: List[int] = []


class WatermarkConfig(BaseModel):
    enabled: bool = False
    text: str = ""
    position: str = "bottom-right"
    font_size: int = 28
    opacity: float = 0.7


class CreateBubbleVideoRequest(BaseModel):
    project_id: str
    bubble_positions: List[BubblePosition] = []
    media_timeline: List[MediaTimelineItem] = []
    resize: str = "16:9"
    subtitles: bool = False
    animated_subtitles: bool = True
    subtitle_style: str = "karaoke"
    subtitle_size: int = 72
    subtitle_position: str = "bottom"
    dialogue_mode: bool = False
    speaker1_position: str = "top-left"
    speaker2_position: str = "top-right"
    dialogue_bg_style: str = "transparent"
    bg_music: bool = False
    bg_music_volume: float = 0.3
    watermark: WatermarkConfig = WatermarkConfig()


class GenerateMusicRequest(BaseModel):
    project_id: str
    preset_id: str


class DownloadMusicRequest(BaseModel):
    video_id: str
    project_id: str

