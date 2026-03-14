"""
pipeline/subtitle_extractor.py — Hybrid Subtitle Strategy

Logic:
  1. Kiểm tra YouTube captions
  2. Nếu có manual captions → dùng luôn (nhanh, chính xác)
  3. Nếu chỉ có auto-generated → dùng Whisper (auto thường kém)
  4. Không có gì → dùng Whisper

Tại sao không dùng auto-generated captions?
  - Auto captions không có dấu câu
  - Thường sai từ và thiếu ngữ cảnh
  - Whisper cho kết quả tốt hơn trong hầu hết trường hợp
"""
import logging
import re
from typing import Optional
import yt_dlp

logger = logging.getLogger(__name__)


class CaptionResult:
    """Kết quả kiểm tra captions của video."""
    def __init__(self, source: str, subtitles: Optional[list] = None):
        self.source = source          # "manual" | "whisper"
        self.subtitles = subtitles    # List[dict] nếu dùng captions, None nếu cần Whisper


def check_youtube_captions(url: str) -> CaptionResult:
    """
    Kiểm tra và lấy captions từ YouTube nếu có manual subtitles tiếng Trung.

    Returns:
        CaptionResult với source="manual" và subtitles đã parse,
        hoặc source="whisper" nếu cần chạy Whisper.
    """
    logger.info(f"Checking YouTube captions for: {url}")

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "writesubtitles": False,
        "writeautomaticsub": False,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)

        manual_subs  = info.get("subtitles", {})
        auto_subs    = info.get("automatic_captions", {})

        # Tìm manual subtitles tiếng Trung
        zh_manual = _find_chinese_captions(manual_subs)

        if zh_manual:
            logger.info(f"Found manual Chinese subtitles: {zh_manual['lang']}")
            subtitles = _download_and_parse_captions(url, zh_manual['lang'], is_auto=False)
            if subtitles:
                logger.info(f"Using manual captions: {len(subtitles)} segments")
                return CaptionResult(source="manual", subtitles=subtitles)

        # Không có manual → dùng Whisper
        has_auto = bool(_find_chinese_captions(auto_subs))
        logger.info(f"No usable manual captions (auto_available={has_auto}). Using Whisper.")
        return CaptionResult(source="whisper")

    except Exception as e:
        logger.warning(f"Caption check failed: {e}. Falling back to Whisper.")
        return CaptionResult(source="whisper")


def _find_chinese_captions(subs_dict: dict) -> Optional[dict]:
    """
    Tìm caption tiếng Trung trong dict subtitles của yt-dlp.
    Các key thường gặp: 'zh', 'zh-Hans', 'zh-Hant', 'zh-CN', 'zh-TW'
    """
    if not subs_dict:
        return None

    # Ưu tiên: zh-Hans (giản thể) > zh > zh-CN > zh-TW > zh-Hant
    priority = ["zh-Hans", "zh", "zh-CN", "zh-TW", "zh-Hant", "zh-HK"]

    for lang in priority:
        if lang in subs_dict:
            return {"lang": lang, "formats": subs_dict[lang]}

    # Tìm bất kỳ key nào bắt đầu bằng "zh"
    for lang in subs_dict:
        if lang.startswith("zh"):
            return {"lang": lang, "formats": subs_dict[lang]}

    return None


def _download_and_parse_captions(url: str, lang: str, is_auto: bool) -> Optional[list]:
    """
    Tải và parse captions thành format chuẩn của hệ thống.

    Returns:
        List[{"start": float, "end": float, "chinese": str}]
        hoặc None nếu lỗi
    """
    import tempfile, os, json

    with tempfile.TemporaryDirectory() as tmpdir:
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
            "writesubtitles": not is_auto,
            "writeautomaticsub": is_auto,
            "subtitleslangs": [lang],
            "subtitlesformat": "json3/srv3/ttml/vtt/best",
            "outtmpl": os.path.join(tmpdir, "%(id)s.%(ext)s"),
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                video_id = info.get("id", "video")

            # Tìm file subtitle đã tải
            sub_file = None
            for fname in os.listdir(tmpdir):
                if fname.startswith(video_id) and (
                    fname.endswith(".json3") or fname.endswith(".vtt") or
                    fname.endswith(".srv3") or fname.endswith(".ttml")
                ):
                    sub_file = os.path.join(tmpdir, fname)
                    break

            if not sub_file:
                logger.warning("No subtitle file found after download")
                return None

            # Parse theo định dạng
            if sub_file.endswith(".json3"):
                return _parse_json3(sub_file)
            elif sub_file.endswith(".vtt"):
                return _parse_vtt(sub_file)
            else:
                logger.warning(f"Unsupported subtitle format: {sub_file}")
                return None

        except Exception as e:
            logger.error(f"Caption download failed: {e}")
            return None


def _parse_json3(filepath: str) -> list:
    """Parse YouTube json3 subtitle format."""
    import json

    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)

    segments = []
    events = data.get("events", [])

    for event in events:
        start_ms = event.get("tStartMs", 0)
        dur_ms   = event.get("dDurationMs", 2000)
        segs     = event.get("segs", [])

        text = "".join(s.get("utf8", "") for s in segs).strip()
        text = text.replace("\n", " ").strip()

        if not text or text == "\n":
            continue

        start = start_ms / 1000.0
        end   = (start_ms + dur_ms) / 1000.0

        segments.append({"start": start, "end": end, "chinese": text})

    return segments


def _parse_vtt(filepath: str) -> list:
    """Parse WebVTT subtitle format."""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()

    # Pattern: timestamp --> timestamp \n text
    pattern = re.compile(
        r"(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})"
        r"\s*\n([\s\S]*?)(?=\n\n|\Z)"
    )

    segments = []
    for match in pattern.finditer(content):
        start_str, end_str, text_block = match.groups()
        text = re.sub(r"<[^>]+>", "", text_block).strip()
        text = re.sub(r"\n+", " ", text).strip()

        if not text:
            continue

        segments.append({
            "start": _vtt_time_to_sec(start_str),
            "end":   _vtt_time_to_sec(end_str),
            "chinese": text,
        })

    return segments


def _vtt_time_to_sec(t: str) -> float:
    """'00:01:23.456' → 83.456"""
    t = t.replace(",", ".")
    parts = t.split(":")
    h, m, s = int(parts[0]), int(parts[1]), float(parts[2])
    return h * 3600 + m * 60 + s
