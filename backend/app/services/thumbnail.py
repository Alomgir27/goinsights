"""Thumbnail service for font handling and text overlay."""

import os
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter


def get_unicode_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    """Get a font that supports multiple languages including Bengali, Hindi, Arabic, etc."""
    fonts_dir = "./storage/fonts"
    os.makedirs(fonts_dir, exist_ok=True)
    noto_font_path = f"{fonts_dir}/NotoSans-Regular.ttf"
    
    if not os.path.exists(noto_font_path):
        try:
            import urllib.request
            url = "https://cdn.jsdelivr.net/gh/nicokempe/Noto-Sans-Font@main/fonts/NotoSans-Regular.ttf"
            urllib.request.urlretrieve(url, noto_font_path)
        except Exception as e:
            print(f"Failed to download Noto Sans: {e}")
    
    font_paths = [
        "/System/Library/Fonts/KohinoorBangla.ttc",
        "/System/Library/Fonts/Kohinoor.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/Library/Fonts/Arial Unicode.ttf",
        noto_font_path,
        "/usr/share/fonts/truetype/noto/NotoSansBengali-Bold.ttf",
        "/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf",
        "/usr/share/fonts/truetype/lohit-bengali/Lohit-Bengali.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ]
    
    for path in font_paths:
        if os.path.exists(path):
            try:
                if path.endswith(".ttc"):
                    font = ImageFont.truetype(path, size, index=0)
                else:
                    font = ImageFont.truetype(path, size)
                return font
            except Exception as e:
                print(f"Failed to load font {path}: {e}")
                continue
    
    try:
        result = subprocess.run(["fc-list", ":lang=bn", "-f", "%{file}\n"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            for font_file in result.stdout.strip().split("\n"):
                if font_file and os.path.exists(font_file):
                    try:
                        return ImageFont.truetype(font_file, size)
                    except:
                        continue
    except:
        pass
    
    print("WARNING: No Bengali font found, using default font")
    return ImageFont.load_default()


def add_animated_text(
    img: Image.Image,
    title: str,
    font: ImageFont.FreeTypeFont,
    position: str,
    text_color: str,
    stroke_color: str,
    effect: str
) -> Image.Image:
    """Add animated-style text with effects like glow, shadow, gradient."""
    w, h = img.size
    bbox = font.getbbox(title)
    text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (w - text_w) // 2
    
    if position == "top":
        y = int(h * 0.08)
    elif position == "center":
        y = (h - text_h) // 2
    else:
        y = int(h * 0.85) - text_h
    
    if effect == "glow":
        glow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow_layer)
        glow_color = text_color.replace("#", "")
        r, g, b = int(glow_color[0:2], 16), int(glow_color[2:4], 16), int(glow_color[4:6], 16)
        for i in range(15, 0, -3):
            alpha = int(80 - i * 4)
            glow_draw.text((x, y), title, font=font, fill=(r, g, b, alpha))
        glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(radius=8))
        img = Image.alpha_composite(img, glow_layer)
    
    text_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    text_draw = ImageDraw.Draw(text_layer)
    
    if effect == "shadow" or effect == "glow":
        shadow_offset = max(4, int(text_h * 0.08))
        text_draw.text((x + shadow_offset, y + shadow_offset), title, font=font, fill=(0, 0, 0, 180))
    
    stroke_w = max(3, int(text_h * 0.06))
    for dx in range(-stroke_w, stroke_w + 1):
        for dy in range(-stroke_w, stroke_w + 1):
            if dx * dx + dy * dy <= stroke_w * stroke_w:
                text_draw.text((x + dx, y + dy), title, font=font, fill=stroke_color)
    
    text_draw.text((x, y), title, font=font, fill=text_color)
    
    return Image.alpha_composite(img, text_layer)


class ThumbnailService:
    """Service for thumbnail generation and text overlay."""
    
    FONT_SIZE_MAP = {
        "small": 0.07,
        "medium": 0.10,
        "large": 0.14,
        "xlarge": 0.18
    }
    
    def create_from_media(
        self,
        media_path: str,
        output_path: str,
        title: str = "",
        font_size: str = "medium",
        font_style: str = "bold",
        position: str = "bottom",
        text_color: str = "#FFFFFF",
        stroke_color: str = "#000000",
        effect: str = "glow"
    ) -> bool:
        """Create thumbnail from media with optional text overlay."""
        if not os.path.exists(media_path):
            return False
        
        img = Image.open(media_path).convert("RGBA")
        
        if title:
            w, h = img.size
            size_ratio = self.FONT_SIZE_MAP.get(font_size, 0.10)
            font_size_px = int(h * size_ratio)
            font = get_unicode_font(font_size_px, font_style == "bold")
            img = add_animated_text(img, title, font, position, text_color, stroke_color, effect)
        
        img.convert("RGB").save(output_path, "PNG")
        return True

