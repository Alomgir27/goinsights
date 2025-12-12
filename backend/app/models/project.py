from sqlalchemy import Column, String, Text, JSON, DateTime, ForeignKey, Integer, Float
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_type = Column(String, default="youtube")  # "youtube" | "custom"
    
    # YouTube project fields
    youtube_url = Column(String, nullable=True)
    video_id = Column(String, nullable=True)
    
    # Common fields
    title = Column(String)
    description = Column(Text)
    thumbnail_url = Column(String)
    duration = Column(Integer)
    channel = Column(String)
    tags = Column(JSON)
    
    # Custom project fields
    prompt = Column(Text)  # User instruction for script generation
    video_style = Column(String, default="dialogue")  # dialogue, storytelling, tutorial, documentary, podcast
    character_sheet = Column(JSON)  # Consistent character descriptions for image generation
    language = Column(String, default="English")  # Output language for script
    
    # Transcript (YouTube projects)
    transcript = Column(JSON)
    detailed_transcription = Column(JSON)
    
    # AI-generated content
    summary = Column(Text)
    script = Column(Text)
    segments_data = Column(JSON)  # Segments with voice_id, media_id, duration, trim
    wiki_data = Column(JSON)  # Wikipedia article data for wiki projects
    
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)
    
    clips = relationship("VideoClip", back_populates="project", cascade="all, delete-orphan")
    audios = relationship("GeneratedAudio", back_populates="project", cascade="all, delete-orphan")
    media_assets = relationship("MediaAsset", back_populates="project", cascade="all, delete-orphan")

class VideoClip(Base):
    __tablename__ = "video_clips"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    start_time = Column(Integer)
    end_time = Column(Integer)
    file_path = Column(String)
    order = Column(Integer)
    
    project = relationship("Project", back_populates="clips")

class GeneratedAudio(Base):
    __tablename__ = "generated_audios"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    text = Column(Text)
    voice = Column(String, default="female-1")
    file_path = Column(String)
    segments = Column(JSON)
    
    project = relationship("Project", back_populates="audios")

class MediaAsset(Base):
    __tablename__ = "media_assets"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    project_id = Column(String, ForeignKey("projects.id"), nullable=False)
    media_type = Column(String)  # "image" | "video"
    source = Column(String)  # "upload" | "ai_generated"
    file_path = Column(String)
    original_filename = Column(String)
    duration = Column(Float)  # For videos, or display duration for images
    width = Column(Integer)
    height = Column(Integer)
    prompt = Column(Text)  # For AI-generated images
    order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="media_assets")
