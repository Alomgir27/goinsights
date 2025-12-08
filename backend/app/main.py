from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import time
from app.database import engine, Base
from app.api import youtube, ai, clips, projects, voice, video

import sys
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s', stream=sys.stdout)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="GoInsights - YouTube AI Shorts Generator", lifespan=lifespan)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = time.time() - start
    print(f">> {request.method} {request.url.path} - {response.status_code} ({duration:.2f}s)", flush=True)
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(youtube.router, prefix="/api/youtube", tags=["YouTube"])
app.include_router(ai.router, prefix="/api/ai", tags=["AI"])
app.include_router(clips.router, prefix="/api/clips", tags=["Clips"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice"])
app.include_router(video.router, prefix="/api/video", tags=["Video"])
app.include_router(projects.router, prefix="/api/projects", tags=["Projects"])

@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/")
async def root():
    return {"message": "Hello World"}

    
