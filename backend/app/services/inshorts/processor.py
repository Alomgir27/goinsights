import subprocess

ASPECT_RATIOS = {"9:16": (1080, 1920), "1:1": (1080, 1080)}


def apply_effects(input_path: str, output_path: str, effects: dict, aspect_ratio: str = "9:16", anti_copyright: bool = True) -> str:
    width, height = ASPECT_RATIOS.get(aspect_ratio, (1080, 1920))
    speed = effects.get("speed", 1.0)
    use_blur = effects.get("blur", False)
    
    print(f"[EFFECTS] Applying: {effects}, anti_copyright: {anti_copyright}")
    
    try:
        if use_blur:
            process_with_blur(input_path, output_path, effects, width, height, speed, anti_copyright)
        else:
            process_simple(input_path, output_path, effects, width, height, speed, anti_copyright)
    except Exception as e:
        print(f"[EFFECTS] Failed, trying basic: {e}")
        process_basic(input_path, output_path, width, height)
    
    return output_path


def process_with_blur(input_path: str, output_path: str, effects: dict, w: int, h: int, speed: float, anti_copyright: bool = True):
    fc = f"[0:v]split=2[o][b];[b]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},boxblur=20:20[bg];[o]scale={w}:{h}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2"
    
    post = build_filters(effects, w, h)
    print(f"[EFFECTS] Filters built: {post}")
    if post:
        fc += f",{post}"
    if speed != 1.0:
        fc += f",setpts={1/speed}*PTS"
    fc += "[v]"
    
    cmd = ["ffmpeg", "-y", "-i", input_path, "-filter_complex", fc, "-map", "[v]", "-map", "0:a?"]
    add_encoding(cmd, speed, anti_copyright)
    cmd.append(output_path)
    run_cmd(cmd, "blur")


def process_simple(input_path: str, output_path: str, effects: dict, w: int, h: int, speed: float, anti_copyright: bool = True):
    vf = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black"
    
    post = build_filters(effects, w, h)
    if post:
        vf += f"," + post
    if speed != 1.0:
        vf += f",setpts={1/speed}*PTS"
    
    cmd = ["ffmpeg", "-y", "-i", input_path, "-vf", vf]
    add_encoding(cmd, speed, anti_copyright)
    cmd.append(output_path)
    run_cmd(cmd, "simple")


def process_basic(input_path: str, output_path: str, w: int, h: int):
    vf = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black"
    cmd = ["ffmpeg", "-y", "-i", input_path, "-vf", vf, "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac", output_path]
    run_cmd(cmd, "basic")


def build_filters(effects: dict, w: int, h: int) -> str:
    parts = []
    
    # === ZOOM ===
    zoom = effects.get("zoom", "none")
    if zoom == "in":
        parts.append(f"scale={int(w*1.15)}:{int(h*1.15)},crop={w}:{h}")
    elif zoom == "out":
        parts.append(f"scale={int(w*0.85)}:{int(h*0.85)},pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black")
    elif zoom == "ken_burns":
        parts.append(f"scale={int(w*1.2)}:-1,crop={w}:{h}")
    
    # === ANIMATION ===
    anim = effects.get("animation", "none")
    if anim == "fade":
        parts.append("fade=t=in:d=1")
    elif anim == "flash":
        parts.append("eq=brightness=0.1")
    elif anim == "pulse":
        parts.append(f"scale={int(w*1.05)}:-1,crop={w}:{h}")
    elif anim == "letterbox":
        bh = int(h * 0.12)
        parts.append(f"drawbox=y=0:w={w}:h={bh}:c=black:t=fill,drawbox=y={h-bh}:w={w}:h={bh}:c=black:t=fill")
    elif anim == "glitch":
        parts.append("noise=alls=30:allf=t,hue=s=1.3")
    elif anim == "mirror_h":
        parts.append("hflip")
    elif anim == "mirror_v":
        parts.append("vflip")
    elif anim == "mirror_split":
        parts.append("hflip,eq=contrast=1.1")
    elif anim == "rotate":
        parts.append("rotate=0.05:fillcolor=black")
    elif anim == "shake":
        parts.append(f"crop={int(w*0.92)}:{int(h*0.92)},scale={w}:{h}")
    
    # === VIGNETTE ===
    if effects.get("vignette"):
        parts.append("vignette=PI/4")
    
    # === COLOR GRADING ===
    color = effects.get("colorGrade", "none")
    if color == "cinematic":
        parts.append("eq=contrast=1.2:brightness=0.03:saturation=0.75")
    elif color == "warm":
        parts.append("colorbalance=rs=0.2:gs=0.1:bs=-0.15")
    elif color == "cool":
        parts.append("colorbalance=rs=-0.15:gs=0:bs=0.2")
    elif color == "vintage":
        parts.append("eq=saturation=0.6:contrast=1.15:brightness=0.05")
    elif color == "vibrant":
        parts.append("eq=saturation=1.5:contrast=1.1")
    elif color == "bw":
        parts.append("hue=s=0")
    elif color == "sepia":
        parts.append("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131")
    
    # === OVERLAY / LIGHT EFFECTS ===
    overlay = effects.get("overlay", "none")
    if overlay == "grain":
        parts.append("noise=alls=40:allf=t")
    elif overlay == "scanlines":
        parts.append("drawgrid=w=0:h=3:t=1:c=black@0.5")
    elif overlay == "vhs":
        parts.append("noise=alls=50:allf=t,eq=saturation=0.5,hue=h=15")
    elif overlay == "sparkle":
        parts.append("noise=alls=35:allf=t,eq=brightness=0.1:contrast=1.1")
    elif overlay == "light_leak":
        parts.append("colorbalance=rs=0.4:gs=0.2:bs=-0.2,eq=brightness=0.1")
    elif overlay == "dust":
        parts.append("noise=alls=20:allf=t")
    elif overlay == "rainbow":
        parts.append("hue=h=40,eq=saturation=1.3")
    elif overlay == "strobe":
        parts.append("eq=brightness=0.25:contrast=1.2")
    elif overlay == "glow":
        parts.append("eq=brightness=0.15,gblur=sigma=1.5")
    
    return ",".join(parts) if parts else ""


def add_encoding(cmd: list, speed: float, anti_copyright: bool = True):
    audio_filters = []
    if speed != 1.0 and 0.5 <= speed <= 2.0:
        audio_filters.append(f"atempo={speed}")
    if anti_copyright:
        # Very aggressive anti-copyright to break Content ID fingerprint
        # 1. Pitch shift 8% + speed 5% to change audio signature
        audio_filters.append("asetrate=44100*1.08,aresample=44100,atempo=1.05")
        # 2. Frequency modifications (bass up, treble down)
        audio_filters.append("bass=g=6:f=110,treble=g=-4")
        # 3. Brief volume drops every 4 seconds to break fingerprint continuity
        audio_filters.append("volume='if(lt(mod(t,4),0.05),0.3,1)':eval=frame")
        # 4. Echo + slight phaser to change spatial signature
        audio_filters.append("aecho=0.8:0.5:20:0.15")
        # 5. Flanger effect to further modify
        audio_filters.append("flanger=delay=2:depth=1:speed=0.3")
    if audio_filters:
        cmd.extend(["-af", ",".join(audio_filters)])
    cmd.extend(["-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", "-shortest"])


def run_cmd(cmd: list, label: str):
    print(f"[EFFECTS] Running {label}...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"{label} failed: {result.stderr[-500:]}")
    print(f"[EFFECTS] {label} done")


def extract_segment(input_path: str, output_path: str, start: float, end: float, keep_audio: bool = True) -> str:
    duration = end - start
    cmd = ["ffmpeg", "-y", "-ss", str(start), "-i", input_path, "-t", str(duration), "-c:v", "libx264", "-preset", "fast", "-crf", "23"]
    cmd.extend(["-c:a", "aac", "-b:a", "128k"] if keep_audio else ["-an"])
    cmd.append(output_path)
    
    print(f"[EFFECTS] Extracting {start:.1f}s - {end:.1f}s")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"Extract failed: {result.stderr[-300:]}")
    return output_path
