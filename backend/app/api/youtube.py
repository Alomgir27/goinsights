from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
import os
from app.database import get_db
from app.services.youtube import YouTubeService
from app.models.project import Project

router = APIRouter()

class ExtractRequest(BaseModel):
    url: str

class ExtractResponse(BaseModel):
    project_id: str
    video_id: str
    title: str
    description: str
    thumbnail: str
    duration: int
    transcript: list[dict]
    channel: Optional[str] = None
    view_count: Optional[int] = None
    tags: Optional[list[str]] = None

class TranscriptionResponse(BaseModel):
    project_id: str
    status: str
    transcription: Optional[dict] = None

@router.post("/extract", response_model=ExtractResponse)
async def extract_video(request: ExtractRequest, db: AsyncSession = Depends(get_db)):
    """Extract basic video info and quick transcript"""
    try:
        service = YouTubeService()
        info = service.get_video_info(request.url)
        
        project = Project(
            youtube_url=request.url,
            video_id=info["video_id"],
            title=info["title"],
            description=info["description"],
            thumbnail_url=info["thumbnail"],
            duration=info["duration"],
            transcript=info["transcript"],
            channel=info.get("channel"),
            tags=info.get("tags", []),
            status="extracted"
        )
        db.add(project)
        await db.commit()
        await db.refresh(project)
        
        return ExtractResponse(
            project_id=project.id,
            video_id=info["video_id"],
            title=info["title"],
            description=info["description"],
            thumbnail=info["thumbnail"],
            duration=info["duration"],
            transcript=info["transcript"],
            channel=info.get("channel"),
            view_count=info.get("view_count"),
            tags=info.get("tags", [])
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract video: {str(e)}")

@router.post("/transcribe/{project_id}", response_model=TranscriptionResponse)
async def transcribe_video(project_id: str, db: AsyncSession = Depends(get_db)):
    """Get detailed transcription with AssemblyAI (speaker diarization, chapters, etc.)"""
    try:
        # Get project
        project = await db.get(Project, project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if already transcribed
        if project.detailed_transcription:
            return TranscriptionResponse(
                project_id=project_id,
                status="completed",
                transcription=project.detailed_transcription
            )
        
        # Update status
        project.status = "transcribing"
        await db.commit()
        
        # Get detailed transcription
        service = YouTubeService()
        result = await service.get_detailed_transcription(project.youtube_url)
        
        # Update project with transcription
        project.detailed_transcription = result.get("transcription")
        project.status = "transcribed"
        await db.commit()
        
        return TranscriptionResponse(
            project_id=project_id,
            status="completed",
            transcription=project.detailed_transcription
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@router.get("/transcription-status/{project_id}")
async def get_transcription_status(project_id: str, db: AsyncSession = Depends(get_db)):
    """Check transcription status"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "project_id": project_id,
        "status": project.status,
        "has_transcription": project.detailed_transcription is not None
    }

@router.get("/auth-url")
async def get_auth_url():
    """Get Google OAuth URL for YouTube authorization"""
    from app.config import get_settings
    settings = get_settings()
    
    if not settings.google_client_id:
        return {"configured": False, "message": "YouTube OAuth not configured"}
    
    # Include scopes for upload and playlist management
    scopes = [
        "https://www.googleapis.com/auth/youtube.readonly",
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube"
    ]
    scope = " ".join(scopes)
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={settings.google_client_id}&redirect_uri={settings.google_redirect_uri}"
        f"&response_type=code&scope={scope}&access_type=offline&prompt=consent"
    )
    return {"configured": True, "auth_url": auth_url}

class AuthCallbackRequest(BaseModel):
    code: str

@router.post("/auth-callback")
async def auth_callback(request: AuthCallbackRequest):
    """Handle OAuth callback and exchange code for token"""
    import httpx
    from app.config import get_settings
    settings = get_settings()
    
    async with httpx.AsyncClient() as client:
        resp = await client.post("https://oauth2.googleapis.com/token", data={
            "code": request.code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_redirect_uri,
            "grant_type": "authorization_code"
        })
        
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange code")
        
        tokens = resp.json()
        return {"access_token": tokens.get("access_token"), "refresh_token": tokens.get("refresh_token")}

@router.get("/channel-videos")
async def get_channel_videos():
    """Get videos from connected YouTube channel - requires OAuth"""
    return {"videos": [], "suggested": []}


@router.get("/trending-topics")
async def get_trending_topics(style: str = "dialogue", topic: str = ""):
    """Get trending topics based on video style and optional topic keyword"""
    import subprocess
    import json
    import random
    from datetime import datetime
    
    style_queries = {
        "dialogue": ["conversation interview", "discussion debate", "talk show chat"],
        "storytelling": ["story explained", "narrative documentary", "real story"],
        "tutorial": ["tutorial how to", "step by step guide", "learn how"],
        "documentary": ["documentary facts", "explained deep dive", "investigation"],
        "podcast": ["podcast episode", "talk show interview", "conversation"],
        "product_demo": ["product review", "unboxing hands on", "first look"],
        "testimonial": ["honest review", "real experience", "testimonial"],
        "social_ad": ["viral trending", "shorts viral", "trending now"],
        "promo": ["launch trailer", "announcement promo", "coming soon"]
    }
    
    time_filters = ["this week", "this month", "2024", "latest", "new"]
    queries = style_queries.get(style, ["trending popular viral"])
    base_query = random.choice(queries)
    time_filter = random.choice(time_filters)
    search_query = f"{topic} {base_query} {time_filter}".strip() if topic else f"{base_query} {time_filter}"
    
    try:
        result = subprocess.run(
            ["yt-dlp", "--cookies", "www.youtube.com_cookies.txt", "-j", "--flat-playlist",
             "--playlist-end", "15", f"ytsearch15:{search_query}"],
            capture_output=True, text=True, timeout=30,
            cwd="/Users/alomgir/workspace/goinsights/backend"
        )
        
        topics = []
        for line in result.stdout.strip().split('\n'):
            if not line: continue
            try:
                item = json.loads(line)
                title = item.get("title", "")
                if title and len(title) > 10:
                    topics.append({
                        "title": title,
                        "views": item.get("view_count", 0),
                        "channel": item.get("channel", item.get("uploader", "")),
                        "url": f"https://youtube.com/watch?v={item.get('id', '')}"
                    })
            except: pass
        
        random.shuffle(topics)
        return {"topics": topics[:10], "query": search_query}
    except Exception as e:
        return {"topics": [], "error": str(e)}


@router.get("/suggestions")
async def get_video_suggestions():
    """Get trending/popular English videos using yt-dlp (no API quota)"""
    import subprocess
    import json
    
    try:
        # English-focused searches - documentaries, educational, viral
        searches = [
            "ytsearch20:documentary english 2024",
            "ytsearch15:educational explained english",
            "ytsearch15:viral trending english",
        ]
        
        all_videos = []
        seen_ids = set()
        
        for search_url in searches:
            if len(all_videos) >= 24:
                break
                
            result = subprocess.run(
                [
                    "yt-dlp",
                    "--cookies", "www.youtube.com_cookies.txt",
                    "-j",
                    "--flat-playlist",
                    "--playlist-end", "20",
                    "--extractor-args", "youtube:lang=en",
                    search_url
                ],
                capture_output=True,
                text=True,
                timeout=45,
                cwd="/Users/alomgir/workspace/goinsights/backend"
            )
            
            for line in result.stdout.strip().split('\n'):
                if not line or len(all_videos) >= 24:
                    continue
                try:
                    item = json.loads(line)
                    video_id = item.get("id", "")
                    title = item.get("title", "")
                    
                    # Skip if already seen or no ID
                    if not video_id or video_id in seen_ids:
                        continue
                    
                    # Skip non-English looking titles (basic filter)
                    if not any(c.isascii() for c in title[:20]):
                        continue
                    
                    seen_ids.add(video_id)
                    
                    duration_secs = item.get("duration", 0) or 0
                    duration = f"{int(duration_secs // 60)}:{int(duration_secs % 60):02d}" if duration_secs else ""
                    
                    views = format_views(item.get("view_count", 0) or 0)
                    description = (item.get("description", "") or "")[:200]
                    
                    all_videos.append({
                        "id": video_id,
                        "title": title,
                        "description": description,
                        "thumbnail": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                        "duration": duration,
                        "views": views,
                        "likes": format_views(item.get("like_count", 0) or 0),
                        "channel": item.get("channel", "") or item.get("uploader", ""),
                        "channelId": item.get("channel_id", ""),
                        "publishedAt": item.get("upload_date", ""),
                    })
                except json.JSONDecodeError:
                    continue
        
        return {"videos": all_videos}
        
    except Exception as e:
        print(f"yt-dlp suggestions error: {e}")
        return {"videos": []}
        

@router.get("/channel/{channel_id}/videos")
async def get_channel_videos_by_id(channel_id: str):
    """Get videos from a specific channel using yt-dlp"""
    import subprocess
    import json
    
    try:
        channel_url = f"https://www.youtube.com/channel/{channel_id}/videos"
        result = subprocess.run(
            [
                "yt-dlp",
                "--cookies", "www.youtube.com_cookies.txt",
                "-j",
                "--flat-playlist",
                "--playlist-end", "20",
                channel_url
            ],
            capture_output=True,
            text=True,
            timeout=30,
            cwd="/Users/alomgir/workspace/goinsights/backend"
        )
        
        videos = []
        channel_info = {}
        
        for line in result.stdout.strip().split('\n'):
            if not line:
                continue
            try:
                item = json.loads(line)
                video_id = item.get("id", "")
                if not video_id:
                    continue
                
                # Get channel info from first video
                if not channel_info:
                    channel_info = {
                        "id": channel_id,
                        "name": item.get("channel", "") or item.get("uploader", ""),
                        "thumbnail": "",
                        "subscribers": "",
                        "videoCount": ""
                    }
                
                duration_secs = item.get("duration", 0) or 0
                duration = f"{int(duration_secs // 60)}:{int(duration_secs % 60):02d}" if duration_secs else ""
                
                views = format_views(item.get("view_count", 0) or 0)
                
                videos.append({
                    "id": video_id,
                    "title": item.get("title", ""),
                    "thumbnail": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                    "duration": duration,
                    "views": views,
                    "likes": "",
                    "channel": item.get("channel", "") or item.get("uploader", ""),
                    "channelId": channel_id,
                    "publishedAt": "",
                })
            except json.JSONDecodeError:
                continue
        
        return {"channel": channel_info, "videos": videos}
        
    except Exception as e:
        print(f"yt-dlp channel videos error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch channel videos: {str(e)}")


@router.get("/channel/search")
async def search_channels(q: str):
    """Search for YouTube channels using yt-dlp"""
    import subprocess
    import json
    
    try:
        # Search for channels
        search_url = f"ytsearchall:{q} channel"
        result = subprocess.run(
            [
                "yt-dlp",
                "--cookies", "www.youtube.com_cookies.txt",
                "-j",
                "--flat-playlist",
                "--playlist-end", "10",
                search_url
            ],
            capture_output=True,
            text=True,
            timeout=30,
            cwd="/Users/alomgir/workspace/goinsights/backend"
        )
        
        channels = []
        seen_channels = set()
        
        for line in result.stdout.strip().split('\n'):
            if not line:
                continue
            try:
                item = json.loads(line)
                channel_id = item.get("channel_id", "")
                channel_name = item.get("channel", "") or item.get("uploader", "")
                
                if channel_id and channel_id not in seen_channels and channel_name:
                    seen_channels.add(channel_id)
                    channels.append({
                        "id": channel_id,
                        "name": channel_name,
                        "description": "",
                        "thumbnail": f"https://www.youtube.com/channel/{channel_id}",
                    })
                    
                if len(channels) >= 10:
                    break
            except json.JSONDecodeError:
                continue
        
        return {"channels": channels}
        
    except Exception as e:
        print(f"yt-dlp channel search error: {e}")
        raise HTTPException(status_code=500, detail=f"Channel search failed: {str(e)}")


def parse_duration(duration_str: str) -> str:
    """Parse ISO 8601 duration to readable format"""
    import re
    if not duration_str:
        return ""
    
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_str)
    if not match:
        return ""
    
    hours, minutes, seconds = match.groups()
    hours = int(hours) if hours else 0
    minutes = int(minutes) if minutes else 0
    seconds = int(seconds) if seconds else 0
    
    if hours > 0:
        return f"{hours}:{minutes:02d}:{seconds:02d}"
    else:
        return f"{minutes}:{seconds:02d}"


def format_views(count: int) -> str:
    """Format view count to readable format"""
    if count >= 1_000_000_000:
        return f"{count / 1_000_000_000:.1f}B"
    elif count >= 1_000_000:
        return f"{count / 1_000_000:.1f}M"
    elif count >= 1_000:
        return f"{count / 1_000:.1f}K"
    else:
        return str(count)

class PlaylistsRequest(BaseModel):
    access_token: str

@router.post("/playlists")
async def get_playlists(request: PlaylistsRequest):
    """Fetch user's YouTube playlists"""
    import httpx
    
    if not request.access_token:
        print("No access token provided for playlists")
        return {"playlists": [], "error": "No access token"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            "https://www.googleapis.com/youtube/v3/playlists",
            params={"part": "snippet", "mine": "true", "maxResults": 50},
            headers={"Authorization": f"Bearer {request.access_token}"}
        )
        
        print(f"Playlists API response: {resp.status_code}")
        
        if resp.status_code != 200:
            print(f"Playlists error: {resp.text[:500]}")
            return {"playlists": [], "error": resp.text[:200]}
        
        data = resp.json()
        playlists = [
            {"id": item["id"], "title": item["snippet"]["title"]}
            for item in data.get("items", [])
        ]
        print(f"Found {len(playlists)} playlists")
        return {"playlists": playlists}

@router.get("/search")
async def search_videos(q: str):
    """Search YouTube videos - prioritize English content"""
    import subprocess
    import json
    
    try:
        search_url = f"ytsearch25:{q}"
        result = subprocess.run(
            [
                "yt-dlp",
                "--cookies", "www.youtube.com_cookies.txt",
                "-j",
                "--flat-playlist",
                "--extractor-args", "youtube:lang=en",
                search_url
            ],
            capture_output=True,
            text=True,
            timeout=45,
            cwd="/Users/alomgir/workspace/goinsights/backend"
        )
        
        videos = []
        seen_ids = set()
        
        for line in result.stdout.strip().split('\n'):
            if not line or len(videos) >= 20:
                continue
            try:
                item = json.loads(line)
                video_id = item.get("id", "")
                title = item.get("title", "")
                
                if not video_id or video_id in seen_ids:
                    continue
                
                # Filter non-English titles (skip if mostly non-ASCII)
                ascii_chars = sum(1 for c in title[:30] if c.isascii())
                if ascii_chars < len(title[:30]) * 0.6:
                    continue
                    
                seen_ids.add(video_id)
                
                duration_secs = item.get("duration", 0) or 0
                duration = f"{int(duration_secs // 60)}:{int(duration_secs % 60):02d}" if duration_secs else ""
                
                videos.append({
                    "id": video_id,
                    "title": title,
                    "description": (item.get("description", "") or "")[:200],
                    "thumbnail": f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                    "duration": duration,
                    "views": format_views(item.get("view_count", 0) or 0),
                    "likes": format_views(item.get("like_count", 0) or 0),
                    "channel": item.get("channel", "") or item.get("uploader", ""),
                    "channelId": item.get("channel_id", ""),
                    "publishedAt": item.get("upload_date", ""),
                })
            except json.JSONDecodeError:
                continue
        
        return {"videos": videos, "query": q}
        
    except Exception as e:
        print(f"yt-dlp search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


class PublishRequest(BaseModel):
    project_id: str
    title: str
    description: str
    tags: str = ""
    privacy: str = "private"
    playlist_id: Optional[str] = None
    access_token: str
    schedule_time: Optional[str] = None  # "morning" or "evening"
    made_for_kids: bool = False
    category_id: str = "22"  # Default: People & Blogs


def calculate_schedule_time(time_preference: str) -> str:
    """Calculate scheduled publish time (at least 24h later, morning 9AM or evening 7PM UTC)"""
    from datetime import datetime, timedelta
    
    now = datetime.utcnow()
    tomorrow = now + timedelta(hours=26)  # 26h to ensure at least 24h buffer
    
    target_hour = 9 if time_preference == "morning" else 19
    scheduled = tomorrow.replace(hour=target_hour, minute=0, second=0, microsecond=0)
    
    if scheduled <= now + timedelta(hours=24):
        scheduled += timedelta(days=1)
    
    return scheduled.strftime("%Y-%m-%dT%H:%M:%S.000Z")


@router.post("/publish")
async def publish_to_youtube(request: PublishRequest, db: AsyncSession = Depends(get_db)):
    """Upload video to YouTube"""
    import httpx
    import json
    
    print(f"Publishing video for project: {request.project_id}")
    print(f"Token length: {len(request.access_token) if request.access_token else 0}")
    
    if not request.access_token or len(request.access_token) < 20:
        raise HTTPException(status_code=401, detail="Invalid or missing access token. Please reconnect YouTube.")
    
    project = await db.get(Project, request.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    video_path = f"./storage/{request.project_id}/final.mp4"
    thumbnail_path = f"./storage/{request.project_id}/thumbnail.png"
    
    if not os.path.exists(video_path):
        raise HTTPException(status_code=400, detail="Final video not found. Please create the video first.")
    
    video_size = os.path.getsize(video_path)
    print(f"Video size: {video_size / 1024 / 1024:.2f} MB")
    
    # Parse tags
    tags_list = [t.strip() for t in request.tags.split(",") if t.strip()][:500]
    
    # Build status with optional scheduling
    status_data = {"privacyStatus": "private", "selfDeclaredMadeForKids": request.made_for_kids}
    scheduled_time = None
    
    if request.schedule_time in ("morning", "evening"):
        scheduled_time = calculate_schedule_time(request.schedule_time)
        status_data["publishAt"] = scheduled_time
        print(f"Scheduled for: {scheduled_time}")
    elif request.privacy != "private":
        status_data["privacyStatus"] = request.privacy
    
    # Video metadata
    metadata = {
        "snippet": {
            "title": request.title[:100],
            "description": request.description[:5000],
            "tags": tags_list,
            "categoryId": request.category_id
        },
        "status": status_data
    }
    
    try:
        async with httpx.AsyncClient(timeout=600.0) as client:  # Increased timeout for large files
            # Step 1: Initialize resumable upload
            print("Initializing upload...")
            init_response = await client.post(
                "https://www.googleapis.com/upload/youtube/v3/videos",
                params={
                    "uploadType": "resumable",
                    "part": "snippet,status"
                },
                headers={
                    "Authorization": f"Bearer {request.access_token}",
                    "Content-Type": "application/json",
                    "X-Upload-Content-Type": "video/mp4",
                    "X-Upload-Content-Length": str(video_size)
                },
                json=metadata
            )
            
            print(f"Init response status: {init_response.status_code}")
            
            if init_response.status_code != 200:
                error_detail = init_response.text
                print(f"Init error: {error_detail}")
                
                # Check for quota error specifically
                if "quotaExceeded" in error_detail or init_response.status_code == 403:
                    raise HTTPException(
                        status_code=403, 
                        detail="YouTube API quota exceeded. Quota resets at midnight Pacific Time. For now, download the video and upload manually to YouTube Studio."
                    )
                
                raise HTTPException(status_code=init_response.status_code, detail=f"Failed to init upload: {error_detail}")
            
            upload_url = init_response.headers.get("Location")
            if not upload_url:
                raise HTTPException(status_code=500, detail="No upload URL returned")
            
            print(f"Upload URL received, starting upload of {video_size / 1024 / 1024:.2f} MB...")
            
            # Step 2: Upload video file - always use chunked for files > 20MB
            if video_size < 20 * 1024 * 1024:  # < 20MB - direct upload
                print("Using direct upload for small file...")
                with open(video_path, "rb") as f:
                    video_data = f.read()
                
                upload_response = await client.put(
                    upload_url,
                    headers={
                        "Authorization": f"Bearer {request.access_token}",
                        "Content-Type": "video/mp4",
                        "Content-Length": str(video_size)
                    },
                    content=video_data,
                    timeout=300.0
                )
                print(f"Direct upload response: {upload_response.status_code}")
            else:
                # For larger files, upload in chunks using resumable upload with retry
                print(f"Using chunked upload for large file ({video_size / 1024 / 1024:.2f} MB)...")
                chunk_size = 5 * 1024 * 1024  # 5MB chunks (smaller for stability)
                uploaded = 0
                upload_response = None
                max_retries = 3
                
                with open(video_path, "rb") as f:
                    while uploaded < video_size:
                        chunk = f.read(chunk_size)
                        if not chunk:
                            break
                        
                        chunk_end = min(uploaded + len(chunk) - 1, video_size - 1)
                        content_range = f"bytes {uploaded}-{chunk_end}/{video_size}"
                        
                        # Retry logic for network errors
                        for attempt in range(max_retries):
                            try:
                                print(f"Uploading chunk: {content_range} ({len(chunk) / 1024 / 1024:.2f} MB) - attempt {attempt + 1}")
                                
                                chunk_response = await client.put(
                                    upload_url,
                                    headers={
                                        "Authorization": f"Bearer {request.access_token}",
                                        "Content-Type": "video/mp4",
                                        "Content-Length": str(len(chunk)),
                                        "Content-Range": content_range
                                    },
                                    content=chunk,
                                    timeout=180.0  # 3 minutes per chunk
                                )
                                
                                print(f"Chunk response: {chunk_response.status_code}")
                                break  # Success, exit retry loop
                                
                            except (httpx.ReadError, httpx.WriteError, httpx.ConnectError) as e:
                                print(f"Network error on attempt {attempt + 1}: {e}")
                                if attempt < max_retries - 1:
                                    import asyncio
                                    await asyncio.sleep(2 ** attempt)  # Exponential backoff
                                    continue
                                else:
                                    raise HTTPException(status_code=500, detail=f"Upload failed after {max_retries} retries: {str(e)}")
                        
                        # 308 = Resume Incomplete (more chunks needed), 200/201 = Complete
                        if chunk_response.status_code not in [200, 201, 308]:
                            error_text = chunk_response.text[:500]
                            print(f"Chunk upload failed: {chunk_response.status_code} - {error_text}")
                            raise HTTPException(status_code=chunk_response.status_code, detail=f"Chunk upload failed: {error_text}")
                        
                        uploaded += len(chunk)
                        percent = (uploaded / video_size) * 100
                        print(f"Progress: {uploaded / 1024 / 1024:.2f} MB / {video_size / 1024 / 1024:.2f} MB ({percent:.1f}%)")
                        
                        upload_response = chunk_response
                        
                        if chunk_response.status_code in [200, 201]:
                            print("Upload complete!")
                            break
                
                if upload_response is None:
                    raise HTTPException(status_code=500, detail="Upload failed - no response received")
            
            print(f"Upload response: {upload_response.status_code}")
            
            if upload_response.status_code not in [200, 201]:
                raise HTTPException(status_code=upload_response.status_code, detail=f"Upload failed: {upload_response.text}")
            
            video_result = upload_response.json()
            video_id = video_result.get("id")
            
            # Step 3: Upload thumbnail if exists
            thumbnail_uploaded = False
            if os.path.exists(thumbnail_path) and video_id:
                try:
                    with open(thumbnail_path, "rb") as f:
                        thumb_data = f.read()
                    
                    thumb_response = await client.post(
                        f"https://www.googleapis.com/upload/youtube/v3/thumbnails/set",
                        params={"videoId": video_id},
                        headers={
                            "Authorization": f"Bearer {request.access_token}",
                            "Content-Type": "image/png"
                        },
                        content=thumb_data
                    )
                    thumbnail_uploaded = thumb_response.status_code == 200
                except:
                    pass
            
            # Step 4: Add to playlist if specified
            playlist_added = False
            if request.playlist_id and video_id:
                print(f"Adding video {video_id} to playlist {request.playlist_id}")
                try:
                    playlist_resp = await client.post(
                        "https://www.googleapis.com/youtube/v3/playlistItems",
                        params={"part": "snippet"},
                        headers={"Authorization": f"Bearer {request.access_token}", "Content-Type": "application/json"},
                        json={
                            "snippet": {
                                "playlistId": request.playlist_id,
                                "resourceId": {
                                    "kind": "youtube#video",
                                    "videoId": video_id
                                }
                            }
                        }
                    )
                    print(f"Playlist response: {playlist_resp.status_code} - {playlist_resp.text[:200]}")
                    playlist_added = playlist_resp.status_code in [200, 201]
                except Exception as e:
                    print(f"Playlist add error: {e}")
            
            return {
                "success": True,
                "video_id": video_id,
                "video_url": f"https://www.youtube.com/watch?v={video_id}",
                "thumbnail_uploaded": thumbnail_uploaded,
                "playlist_added": playlist_added,
                "privacy": request.privacy,
                "scheduled_at": scheduled_time
            }
            
    except httpx.TimeoutException as e:
        print(f"Timeout error: {e}")
        raise HTTPException(status_code=408, detail="Upload timed out. Video might be too large. Try with a shorter video.")
    except httpx.ReadTimeout as e:
        print(f"Read timeout: {e}")
        raise HTTPException(status_code=408, detail="Upload read timeout. Please try again.")
    except httpx.WriteTimeout as e:
        print(f"Write timeout: {e}")
        raise HTTPException(status_code=408, detail="Upload write timeout. Please try again.")
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Upload error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Upload error: {str(e)}")
