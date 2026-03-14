"""
pipeline/orchestrator.py — Pipeline Orchestrator v3

Điều phối toàn bộ pipeline theo thứ tự:
  1. HybridSubtitleExtractor  → lấy text tiếng Trung
  2. LLMPostProcessor         → cải thiện text (optional)
  3. PinyinConverter          → thêm pinyin
  4. Translator               → dịch tiếng Việt

Nhận progress_callback để cập nhật tiến trình lên DB.
"""
import logging
from typing import Callable, Optional

from pipeline.subtitle_extractor import check_youtube_captions
from pipeline.whisper_engine import transcribe_audio
from pipeline.llm_processor import post_process_subtitles, is_llm_available
from pipeline.adapters import add_pinyin, translate_subtitles
from pipeline.youtube import download_audio

logger = logging.getLogger(__name__)

# Type cho progress callback
ProgressCallback = Callable[[float, str], None]


def run_pipeline(
    url: str,
    progress_cb: Optional[ProgressCallback] = None,
) -> dict:
    """
    Chạy toàn bộ pipeline từ URL → subtitles hoàn chỉnh.

    Args:
        url: YouTube URL
        progress_cb: callback(progress_pct, stage_name) để update UI

    Returns:
        {
          "subtitles": [{"start", "end", "chinese", "pinyin", "vietnamese"}],
          "subtitle_source": "manual" | "whisper",
          "llm_used": bool,
        }
    """
    def progress(pct: float, stage: str):
        logger.info(f"[{pct:.0f}%] {stage}")
        if progress_cb:
            progress_cb(pct, stage)

    # ── Bước 1: Hybrid caption check ──
    progress(10, "Kiểm tra subtitle YouTube...")
    caption_result = check_youtube_captions(url)

    if caption_result.source == "manual" and caption_result.subtitles:
        # Dùng manual captions → bỏ qua Whisper
        progress(40, "Dùng subtitle gốc từ YouTube...")
        raw_subtitles = caption_result.subtitles
        subtitle_source = "manual"
        logger.info(f"Using manual captions: {len(raw_subtitles)} segments")
    else:
        # Cần chạy Whisper
        progress(15, "Tải audio từ YouTube...")
        audio_path = download_audio(url)

        progress(30, "Nhận dạng giọng nói (Whisper)...")
        raw_subtitles = transcribe_audio(audio_path)
        subtitle_source = "whisper"
        logger.info(f"Whisper transcribed: {len(raw_subtitles)} segments")

    if not raw_subtitles:
        raise ValueError("Không nhận dạng được nội dung trong video.")

    # ── Bước 2: LLM post-processing (optional) ──
    llm_used = False
    if is_llm_available():
        progress(55, "Cải thiện văn bản (AI)...")
        raw_subtitles = post_process_subtitles(raw_subtitles)
        llm_used = True
    else:
        progress(55, "Bỏ qua LLM (không có API key)...")

    # ── Bước 3: Pinyin ──
    progress(65, "Tạo Pinyin...")
    subtitles_with_pinyin = add_pinyin(raw_subtitles)

    # ── Bước 4: Dịch tiếng Việt ──
    progress(80, "Dịch sang tiếng Việt...")
    final_subtitles = translate_subtitles(subtitles_with_pinyin)

    progress(100, "Hoàn thành!")

    return {
        "subtitles": final_subtitles,
        "subtitle_source": subtitle_source,
        "llm_used": llm_used,
    }
