import os
import subprocess
import shutil
from pathlib import Path

STYLE_CONFIGS = {
    "karaoke": {"hl": "&H00FFFF&", "base": "&HFFFFFF&", "font": "Arial Black"},
    "neon": {"hl": "&H00FF00&", "base": "&HFF88FF&", "font": "Impact"},
    "fire": {"hl": "&H0088FF&", "base": "&H00CCFF&", "font": "Arial Black"},
    "minimal": {"hl": "&HFFFFFF&", "base": "&HFFFFFF&", "font": "Arial"},
    "bold": {"hl": "&H00FFFF&", "base": "&HFFFFFF&", "font": "Impact"},
}

RES_MAP = {"16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1080, 1080)}

BG_MAP = {
    "none": "&H00000000", "transparent": "&HC0000000",
    "solid": "&H90000000", "blur": "&HA0000000", "gradient": "&HB0000000",
}


def ms_to_ass(ms: int) -> str:
    return f"{ms//3600000}:{(ms//60000)%60:02}:{(ms//1000)%60:02}.{(ms%1000)//10:02}"


def create_dialogue_ass(
    segments: list, speakers: list, project_dir: Path,
    resize: str, font_size: int, speaker1_pos: str, speaker2_pos: str, style: str, bg_style: str = "transparent"
) -> str:
    ass_path = str(project_dir / "dialogue.ass")
    w, h = RES_MAP.get(resize, (1920, 1080))
    
    cfg = STYLE_CONFIGS.get(style, STYLE_CONFIGS["karaoke"])
    back_color = BG_MAP.get(bg_style, "&HC0000000")
    
    margin = 100
    pos_config = {
        "top-left": (margin, margin + 50, 7),
        "top-right": (w - margin, margin + 50, 9),
        "bottom-left": (margin, h - margin - 80, 1),
        "bottom-right": (w - margin, h - margin - 80, 3),
    }
    
    ass_header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Speaker1,{cfg['font']},{font_size},{cfg['base']},{cfg['hl']},&H00000000,{back_color},1,0,0,0,100,100,2,0,3,0,12,7,{margin},{margin},{margin},1
Style: Speaker2,{cfg['font']},{font_size},{cfg['base']},{cfg['hl']},&H00000000,{back_color},1,0,0,0,100,100,2,0,3,0,12,3,{margin},{margin},{margin},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    events = []
    for seg in segments:
        text = seg.get("text", "")
        speaker = seg.get("speaker", "")
        start_sec = seg.get("start", 0)
        end_sec = seg.get("end", start_sec + 5)
        
        if speaker and speaker in speakers:
            is_speaker1 = speakers.index(speaker) % 2 == 0
            style_name = "Speaker1" if is_speaker1 else "Speaker2"
            pos = speaker1_pos if is_speaker1 else speaker2_pos
        else:
            style_name = "Speaker1"
            pos = speaker1_pos
        
        x, y, an = pos_config.get(pos, pos_config["bottom-left"])
        
        words = text.split()
        if not words:
            continue
        
        start_ms = int(start_sec * 1000)
        end_ms = int(end_sec * 1000)
        duration_ms = end_ms - start_ms
        word_duration_ms = duration_ms // len(words)
        
        max_words_per_line = 6 if resize != "9:16" else 4
        lines = []
        for i in range(0, len(words), max_words_per_line):
            lines.append(words[i:i + max_words_per_line])
        
        karaoke_text = f"{{\\an{an}\\pos({x},{y})}}"
        for line_idx, line_words in enumerate(lines):
            for word in line_words:
                word_time = word_duration_ms // 10
                karaoke_text += f"{{\\k{word_time}}}{word} "
            if line_idx < len(lines) - 1:
                karaoke_text = karaoke_text.rstrip() + "\\N"
        
        events.append(f"Dialogue: 0,{ms_to_ass(start_ms)},{ms_to_ass(end_ms)},{style_name},,0,0,0,,{karaoke_text.strip()}")
    
    with open(ass_path, "w", encoding="utf-8") as f:
        f.write(ass_header + "\n".join(events))
    
    return ass_path


def create_dialogue_video(
    project_dir: Path,
    base_video: str,
    segments: list,
    resize: str,
    font_size: int,
    speaker1_pos: str,
    speaker2_pos: str,
    subtitle_style: str = "karaoke",
    bg_style: str = "transparent"
) -> str:
    print(f"[create_dialogue_video] Starting with {len(segments)} segments, font={font_size}")
    
    base_temp = str(project_dir / "base_video_temp.mp4")
    if os.path.exists(base_video):
        os.rename(base_video, base_temp)
        base_video = base_temp
    print(f"[create_dialogue_video] Base video: {base_video}")
    
    speakers = []
    for seg in segments:
        sp = seg.get("speaker", "")
        if sp and sp not in speakers:
            speakers.append(sp)
    
    ass_path = create_dialogue_ass(
        segments, speakers, project_dir, resize, font_size,
        speaker1_pos, speaker2_pos, subtitle_style, bg_style
    )
    
    output_path = str(project_dir / "final.mp4")
    ass_escaped = ass_path.replace("\\", "/").replace(":", "\\:")
    
    cmd = [
        "ffmpeg", "-y", "-i", base_video,
        "-vf", f"ass='{ass_escaped}'",
        "-c:a", "copy", output_path
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[create_dialogue_video] FFmpeg error: {result.stderr[-500:]}")
        shutil.copy(base_video, output_path)
    else:
        print(f"[create_dialogue_video] Success! Output: {output_path}")
    
    return output_path

