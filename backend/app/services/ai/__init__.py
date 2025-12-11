from .base import BaseAIService
from .script import ScriptService
from .thumbnail import ThumbnailService
from .image import ImageService
from .youtube import YouTubeService


class AIService(ImageService, ScriptService, YouTubeService):
    """Combined AI service with all capabilities"""
    pass


GeminiService = AIService

__all__ = ["AIService", "GeminiService", "BaseAIService", "ScriptService", "ThumbnailService", "ImageService", "YouTubeService"]

