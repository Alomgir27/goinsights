import subprocess
import math


SCALE_MAP = {"16:9": "1920x1080", "9:16": "1080x1920", "1:1": "1080x1080"}


def get_video_duration(video_path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video_path],
        capture_output=True, text=True
    )
    return float(result.stdout.strip()) if result.returncode == 0 and result.stdout.strip() else 0


def video_to_clip(video_path: str, output_path: str, duration: float, resize: str = "16:9") -> str:
    """Convert video to clip with looping if shorter than duration, trim if longer"""
    res, scale_dim = get_resolution(resize)
    video_duration = get_video_duration(video_path)
    
    # Ensure minimum duration
    duration = max(duration, 0.5)
    
    if video_duration <= 0:
        video_duration = duration
    
    # Scale and pad to fit target resolution, ensure constant framerate
    scale_filter = f"scale={scale_dim}:force_original_aspect_ratio=decrease,pad={scale_dim}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=25"
    
    try:
        if video_duration >= duration:
            # Trim video to exact duration
            cmd = [
                "ffmpeg", "-y", 
                "-ss", "0", "-i", video_path, "-t", str(duration),
                "-vf", scale_filter,
                "-c:v", "libx264", "-an", "-pix_fmt", "yuv420p", 
                "-preset", "fast", "-avoid_negative_ts", "make_zero",
                output_path
            ]
        else:
            # Loop video to reach target duration
            loop_count = math.ceil(duration / video_duration)
            cmd = [
                "ffmpeg", "-y", 
                "-stream_loop", str(loop_count), "-i", video_path,
                "-t", str(duration), "-vf", scale_filter,
                "-c:v", "libx264", "-an", "-pix_fmt", "yuv420p", 
                "-preset", "fast", "-avoid_negative_ts", "make_zero",
                output_path
            ]
        
        print(f"[VIDEO] src={video_duration:.1f}s, need={duration:.1f}s, loop={video_duration < duration}")
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(f"[VIDEO] Error: {result.stderr[:200] if result.stderr else 'unknown'}")
            # Fallback: simple trim/loop without complex filters
            fallback_cmd = [
                "ffmpeg", "-y", "-i", video_path, "-t", str(duration),
                "-vf", f"scale={scale_dim}:force_original_aspect_ratio=decrease,pad={scale_dim}:(ow-iw)/2:(oh-ih)/2",
                "-c:v", "libx264", "-an", "-preset", "fast", output_path
            ]
            subprocess.run(fallback_cmd, check=True, capture_output=True)
        
        return output_path
    except Exception as e:
        print(f"[VIDEO] Exception: {e}")
        raise

def get_resolution(resize: str) -> tuple[str, str]:
    res = SCALE_MAP.get(resize, "1920x1080")
    return res, res.replace("x", ":")


def image_to_video(image_path: str, output_path: str, duration: float = 5.0, effect: str = "zoom_in", resize: str = "16:9") -> str:
    frames = int(duration * 25)
    res, scale_dim = get_resolution(resize)
    
    effects = {
        "zoom_in": f"scale=8000:-1,zoompan=z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={res}:fps=25",
        "zoom_out": f"scale=8000:-1,zoompan=z='if(lte(zoom,1.0),1.5,max(1.001,zoom-0.0015))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={res}:fps=25",
        "pan_left": f"scale=3840:-1,zoompan=z='1.1':x='if(lte(on,1),0,min(x+2,iw-iw/zoom))':y='ih/2-(ih/zoom/2)':d={frames}:s={res}:fps=25",
        "pan_right": f"scale=3840:-1,zoompan=z='1.1':x='if(lte(on,1),iw,max(0,x-2))':y='ih/2-(ih/zoom/2)':d={frames}:s={res}:fps=25",
        "static": f"scale={scale_dim}:force_original_aspect_ratio=decrease,pad={scale_dim}:(ow-iw)/2:(oh-ih)/2"
    }
    vf = effects.get(effect, effects["zoom_in"])
    
    cmd = [
        "ffmpeg", "-y", "-loop", "1", "-i", image_path,
        "-vf", vf, "-c:v", "libx264", "-t", str(duration),
        "-pix_fmt", "yuv420p", "-preset", "fast", output_path
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    return output_path


def image_to_video_with_effect(image_path: str, output_path: str, duration: float, effect: str = "none", resize: str = "16:9") -> str:
    frames = int(duration * 25)
    res, scale_dim = get_resolution(resize)
    
    scale = f"scale={scale_dim}:force_original_aspect_ratio=decrease,pad={scale_dim}:(ow-iw)/2:(oh-ih)/2"
    
    # Timing based on duration
    fade_duration = min(0.8, duration * 0.2)  # Longer fade for visibility
    fade_out_start = max(0.1, duration - fade_duration)
    
    # Pop: happens in first 0.6s or 10% of clip
    pop_frames = max(15, min(int(frames * 0.1), 20))
    
    # Slide: complete in first 25% of clip  
    slide_frames = max(30, int(frames * 0.25))
    
    # Zoom speed
    zoom_speed = 0.25 / duration
    
    print(f"[EFFECT] '{effect}' | duration={duration:.1f}s | fade={fade_duration:.2f}s")
    
    if effect == "none":
        # Subtle slow zoom for "none" to avoid static feeling
        vf = f"scale=8000:-1,zoompan=z='min(zoom+0.0003,1.05)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={res}:fps=25"
    elif effect == "fade":
        # Strong fade with slight zoom
        vf = f"scale=8000:-1,zoompan=z='min(zoom+0.0005,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={res}:fps=25,fade=t=in:st=0:d={fade_duration},fade=t=out:st={fade_out_start}:d={fade_duration}"
    elif effect == "pop":
        # Pop: start at 0.7x zoom and quickly scale to 1.05x (overshoot)
        vf = f"scale=8000:-1,zoompan=z='if(lt(on,{pop_frames}),0.7+0.35*on/{pop_frames},if(lt(on,{pop_frames*2}),1.05-0.05*(on-{pop_frames})/{pop_frames},1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={res}:fps=25"
    elif effect == "slide":
        # Slide from left with slight zoom
        vf = f"scale=3000:-1,zoompan=z='1.15':x='if(lt(on,{slide_frames}),on*{200/slide_frames},200)':y='ih/2-(ih/zoom/2)':d={frames}:s={res}:fps=25,fade=t=in:st=0:d=0.3"
    elif effect == "zoom":
        # Strong continuous zoom
        vf = f"scale=8000:-1,zoompan=z='min(zoom+{zoom_speed/25},1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={res}:fps=25"
    else:
        vf = f"{scale},fade=t=in:st=0:d={fade_duration}"
    
    cmd = [
        "ffmpeg", "-y", "-loop", "1", "-i", image_path,
        "-vf", vf, "-c:v", "libx264", "-t", str(duration),
        "-pix_fmt", "yuv420p", "-preset", "fast", output_path
    ]
    
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        print(f"[EFFECT] Failed '{effect}', fallback: {e.stderr[:100] if e.stderr else ''}")
        cmd[cmd.index("-vf") + 1] = scale
        subprocess.run(cmd, check=True, capture_output=True)
    
    return output_path

