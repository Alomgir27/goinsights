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
    import os
    if not os.path.exists(image_path):
        raise Exception(f"Image not found: {image_path}")
    
    frames = int(duration * 25)
    res, scale_dim = get_resolution(resize)
    is_gif = image_path.lower().endswith('.gif')
    
    fade_dur = min(0.5, duration * 0.15)
    fade_out = max(0.1, duration - fade_dur)
    
    if is_gif:
        scale_filter = f"scale={scale_dim}:force_original_aspect_ratio=decrease,pad={scale_dim}:(ow-iw)/2:(oh-ih)/2"
        effects_map = {
            "none": scale_filter,
            "fade": f"{scale_filter},fade=t=in:d={fade_dur},fade=t=out:st={fade_out}:d={fade_dur}",
            "pop": scale_filter,
            "slide": scale_filter,
            "zoom": f"{scale_filter},zoompan=z='1+on/{frames}*0.1':d={frames}:s={res}",
        }
        cmd = [
            "ffmpeg", "-y", "-ignore_loop", "0", "-i", image_path,
            "-vf", effects_map.get(effect, scale_filter),
            "-t", str(duration), "-r", "25",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast",
            output_path
        ]
    else:
        base = f"scale=4000:-1,zoompan=z='1+on/{frames}*0.05':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={res}"
        effects_map = {
            "none": base,
            "fade": f"{base},fade=t=in:d={fade_dur},fade=t=out:st={fade_out}:d={fade_dur}",
            "pop": f"scale=4000:-1,zoompan=z='if(lt(on,15),0.85+0.2*on/15,1.05-0.05*min((on-15)/15,1))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={res}",
            "slide": f"scale=2400:-1,zoompan=z='1.1':x='if(lt(on,25),on*8,200)':y='ih/2-(ih/zoom/2)':d={frames}:s={res}",
            "zoom": f"scale=4000:-1,zoompan=z='1+on/{frames}*0.15':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s={res}",
        }
        cmd = [
            "ffmpeg", "-y", "-loop", "1", "-i", image_path,
            "-vf", effects_map.get(effect, effects_map["none"]),
            "-t", str(duration), "-r", "25",
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "fast",
            output_path
        ]
    
    print(f"[EFFECT] Running: {effect} on {os.path.basename(image_path)} {'(GIF)' if is_gif else ''}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        err = result.stderr or ""
        for line in err.split('\n'):
            if line.strip() and 'version' not in line.lower() and 'built' not in line.lower():
                print(f"[EFFECT] {line.strip()}")
        raise Exception(f"Effect '{effect}' failed for {image_path}")
    
    return output_path

