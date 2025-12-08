from sqlalchemy import Column, String, Text, JSON, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from app.database import Base

def generate_uuid():
    return str(uuid.uuid4())

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    youtube_url = Column(String, nullable=False)
    video_id = Column(String, nullable=False)
    title = Column(String)
    description = Column(Text)
    thumbnail_url = Column(String)
    duration = Column(Integer)
    channel = Column(String)
    tags = Column(JSON)
    
    # Basic transcript from YouTube
    transcript = Column(JSON)
    
    # Detailed transcription from AssemblyAI
    detailed_transcription = Column(JSON)  # Contains sentences, paragraphs, speakers, chapters
    
    # AI-generated content
    summary = Column(Text)
    script = Column(Text)
    segments_data = Column(JSON)  # AI-generated segments with timestamps
    
    status = Column(String, default="pending")  # pending, extracted, transcribing, transcribed, completed
    created_at = Column(DateTime, default=datetime.utcnow)
    
    clips = relationship("VideoClip", back_populates="project", cascade="all, delete-orphan")
    audios = relationship("GeneratedAudio", back_populates="project", cascade="all, delete-orphan")

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
    segments = Column(JSON)  # Store timestamped segments
    
    project = relationship("Project", back_populates="audios")
