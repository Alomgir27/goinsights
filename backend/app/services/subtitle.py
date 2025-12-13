"""Subtitle service for SRT generation."""


def format_srt_time(seconds: float) -> str:
    """Format seconds to SRT timestamp format."""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def generate_srt_from_segments(segments: list, output_path: str) -> None:
    """Generate SRT subtitle file from segments."""
    with open(output_path, "w", encoding="utf-8") as f:
        for i, seg in enumerate(segments, 1):
            start = seg.get("start", 0)
            end = seg.get("end", start + 5)
            text = seg.get("text", "")
            if text:
                f.write(f"{i}\n{format_srt_time(start)} --> {format_srt_time(end)}\n{text}\n\n")

