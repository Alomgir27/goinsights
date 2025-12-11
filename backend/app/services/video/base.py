import os
from pathlib import Path
from app.config import get_settings


class BaseVideoService:
    def __init__(self):
        self.settings = get_settings()
        self.storage = Path(self.settings.storage_path)
        self.storage.mkdir(parents=True, exist_ok=True)

