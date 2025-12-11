import re
from pathlib import Path

STYLE_CONFIGS = {
    "karaoke": {"hl": "&H00FFFF&", "base": "&HFFFFFF&", "font": "Arial Black", "effect": "color"},
    "neon": {"hl": "&H00FF00&", "base": "&HFF00FF&", "font": "Impact", "effect": "glow"},
    "fire": {"hl": "&H0045FF&", "base": "&H00A5FF&", "font": "Arial Black", "effect": "color"},
    "minimal": {"hl": "&HFFFFFF&", "base": "&HCCCCCC&", "font": "Helvetica", "effect": "color"},
    "bold": {"hl": "&H00FFFF&", "base": "&HFFFFFF&", "font": "Impact", "effect": "scale"},
    "typewriter": {"hl": "&H00FF00&", "base": "&HFFFFFF&", "font": "Courier New", "effect": "typewriter"},
    "glitch": {"hl": "&HFF00FF&", "base": "&H00FFFF&", "font": "Impact", "effect": "glitch"},
    "bounce": {"hl": "&H00FF88&", "base": "&HFFFFFF&", "font": "Arial Black", "effect": "bounce"},
    "wave": {"hl": "&HFFCC00&", "base": "&HFF8800&", "font": "Arial Black", "effect": "wave"},
    "shadow": {"hl": "&HFFFFFF&", "base": "&HDDDDDD&", "font": "Impact", "effect": "shadow"},
    "gradient": {"hl": "&HFF88FF&", "base": "&H88FFFF&", "font": "Arial Black", "effect": "gradient"},
    "retro": {"hl": "&H00CCFF&", "base": "&H66FFFF&", "font": "Courier New", "effect": "retro"},
}

RES_MAP = {"16:9": (1920, 1080), "9:16": (1080, 1920), "1:1": (1080, 1080)}
POSITION_MAP = {"bottom": 2, "middle": 5, "top": 8}


def ms_to_ass(ms: int) -> str:
    return f"{ms//3600000}:{(ms//60000)%60:02}:{(ms//1000)%60:02}.{(ms%1000)//10:02}"


def get_effect_text(effect_type: str, cfg: dict, word: str, word_idx: int = 0) -> str:
    # Alternating positions for bounce/wave effects
    y_offset = -15 if word_idx % 2 == 0 else 15
    
    effects = {
        "scale": f"{{\\c{cfg['hl']}\\fscx130\\fscy130\\t(0,80,\\fscx100\\fscy100)}}{word}",
        "glow": f"{{\\c{cfg['hl']}\\bord8\\blur5\\3c&H00FF00&}}{word}{{\\bord4\\blur0}}",
        "glitch": f"{{\\c{cfg['hl']}\\shad-3\\4c&HFF00FF&\\fscx110\\frz2}}{word}{{\\shad2\\fscx100\\frz0}}",
        "bounce": f"{{\\c{cfg['hl']}\\fscx130\\fscy130\\fsp3\\pos(0,{y_offset})}}{word}{{\\fscx100\\fscy100\\fsp0}}",
        "wave": f"{{\\c{cfg['hl']}\\frz{y_offset // 3}\\fscx110}}{word}{{\\frz0\\fscx100}}",
        "shadow": f"{{\\c{cfg['hl']}\\shad6\\4c&H000000&\\bord3}}{word}{{\\shad2\\bord4}}",
        "gradient": f"{{\\c{cfg['hl']}\\bord5\\3c&HFF00FF&\\fscx115\\fscy115}}{word}{{\\bord4\\fscx100\\fscy100}}",
        "retro": f"{{\\c{cfg['hl']}\\bord3\\shad4\\4c&H003366&\\fsp4}}{word}{{\\bord4\\shad2\\fsp0}}",
    }
    return effects.get(effect_type, f"{{\\c{cfg['hl']}}}{word}")


def create_animated_subtitles(srt_path: str, project_dir: Path, resize: str, style: str = "karaoke", font_size: int = 72, position: str = "bottom") -> str:
    ass_path = str(project_dir / "subtitles.ass")
    w, h = RES_MAP.get(resize, (1920, 1080))
    
    if resize == "9:16" and font_size > 64:
        font_size = int(font_size * 0.85)
    max_words = 4 if resize == "9:16" else 5
    
    cfg = STYLE_CONFIGS.get(style, STYLE_CONFIGS["karaoke"])
    alignment = POSITION_MAP.get(position, 2)
    margin_v = 60 if position == "bottom" else (40 if position == "top" else 0)
    
    ass_header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {w}
PlayResY: {h}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{cfg['font']},{font_size},{cfg['base']},&H000000FF,&H00000000,&H80000000,1,0,0,0,100,100,0,0,1,4,2,{alignment},20,20,{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    events = []
    try:
        with open(srt_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        blocks = re.split(r"\n\n+", content.strip())
        
        for block in blocks:
            lines = block.strip().split("\n")
            if len(lines) < 3:
                continue
                
            match = re.match(r"(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})", lines[1])
            if not match:
                continue
            
            sh, sm, ss, sms, eh, em, es, ems = match.groups()
            start_ms = int(sh)*3600000 + int(sm)*60000 + int(ss)*1000 + int(sms)
            end_ms = int(eh)*3600000 + int(em)*60000 + int(es)*1000 + int(ems)
            
            text = " ".join(lines[2:]).replace("\n", " ").strip()
            words = text.split()
            if not words:
                continue
            
            duration = end_ms - start_ms
            per_word = max(150, duration // len(words))
            
            for i in range(0, len(words), max_words):
                chunk = words[i:i + max_words]
                chunk_start = start_ms + i * per_word
                chunk_end = min(start_ms + (i + len(chunk)) * per_word, end_ms)
                chunk_dur = chunk_end - chunk_start
                word_time = chunk_dur // len(chunk)
                
                is_typewriter = cfg.get("effect") == "typewriter"
                
                for j, word in enumerate(chunk):
                    ws = ms_to_ass(chunk_start + j * word_time)
                    we = ms_to_ass(chunk_start + (j + 1) * word_time if j < len(chunk) - 1 else chunk_end)
                    
                    if is_typewriter:
                        visible = chunk[:j + 1]
                        text = f"{{\\c{cfg['base']}}}" + " ".join(visible) + f"{{\\c{cfg['hl']}}}|"
                        events.append(f"Dialogue: 0,{ws},{we},Default,,0,0,0,,{text}")
                    else:
                        parts = []
                        for k, w in enumerate(chunk):
                            if k == j:
                                parts.append(get_effect_text(cfg.get("effect", "color"), cfg, w, k))
                            else:
                                parts.append(f"{{\\c{cfg['base']}}}{w}")
                        events.append(f"Dialogue: 0,{ws},{we},Default,,0,0,0,,{' '.join(parts)}")
        
        with open(ass_path, "w", encoding="utf-8") as f:
            f.write(ass_header + "\n".join(events))
        return ass_path
    except Exception as e:
        print(f"ASS creation error: {e}")
        return None

