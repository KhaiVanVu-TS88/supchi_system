import sys
sys.path.insert(0, "/app")

"""
services/ocr_service.py — Chinese OCR Service

Dùng EasyOCR để nhận dạng chữ Hán từ ảnh.
Sau đó pipe qua NLP pipeline có sẵn: jieba → pinyin → dịch tiếng Việt.

Singleton pattern cho EasyOCR reader (tải model 1 lần duy nhất ~500MB).
"""
import io
import hashlib
import logging
import re
from pathlib import Path
from typing import Optional
from functools import lru_cache

logger = logging.getLogger(__name__)

# Cache OCR results theo MD5 của ảnh (tránh xử lý lại cùng ảnh)
_ocr_cache: dict[str, dict] = {}
_reader = None   # Singleton EasyOCR reader


def get_reader():
    """Lazy-load EasyOCR reader — tải model lần đầu mất ~30s."""
    global _reader
    if _reader is None:
        import easyocr
        logger.info("Loading EasyOCR model (first time ~30s)...")
        # ch_sim: giản thể, en: để nhận số/ký tự Latin trong ảnh
        _reader = easyocr.Reader(
            ["ch_sim", "en"],
            gpu=False,          # CPU only
            verbose=False,
        )
        logger.info("EasyOCR model loaded.")
    return _reader


def ocr_from_bytes(image_bytes: bytes) -> dict:
    """
    Nhận dạng chữ Hán từ bytes của ảnh.

    Returns:
        {
          "raw_text": "你好世界",
          "lines": ["你好", "世界"],
          "pinyin": "nǐ hǎo shì jiè",
          "vietnamese": "Xin chào thế giới",
          "words": [{"word": "你好", "pinyin": "nǐ hǎo", "meaning": "xin chào"}],
          "confidence": 0.95
        }
    """
    # Check cache
    img_hash = hashlib.md5(image_bytes).hexdigest()
    if img_hash in _ocr_cache:
        logger.debug(f"OCR cache hit: {img_hash[:8]}")
        return _ocr_cache[img_hash]

    # Chạy EasyOCR
    reader = get_reader()
    import numpy as np
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_array = np.array(img)

    results = reader.readtext(
        img_array,
        detail=1,           # Trả về bounding box + confidence
        paragraph=False,    # Giữ từng dòng riêng
    )

    if not results:
        return {"error": "Không phát hiện chữ trong ảnh."}

    # Lọc chỉ lấy text tiếng Trung (có chứa ký tự Hán)
    chinese_lines = []
    total_conf = 0.0

    for (bbox, text, confidence) in results:
        text = text.strip()
        # Giữ dòng nếu có ít nhất 1 ký tự Hán
        if text and any('\u4e00' <= c <= '\u9fff' for c in text):
            chinese_lines.append(text)
            total_conf += confidence

    if not chinese_lines:
        return {"error": "Không tìm thấy chữ Hán trong ảnh. Hãy chụp rõ hơn."}

    # Gộp tất cả dòng thành 1 đoạn
    full_text = " ".join(chinese_lines)
    avg_confidence = total_conf / len(chinese_lines)

    # Pipe qua NLP pipeline có sẵn
    result = _process_through_nlp(full_text, chinese_lines, avg_confidence)

    # Lưu cache
    _ocr_cache[img_hash] = result
    # Giới hạn cache size
    if len(_ocr_cache) > 100:
        oldest = next(iter(_ocr_cache))
        del _ocr_cache[oldest]

    return result


def _process_through_nlp(full_text: str, lines: list[str], confidence: float) -> dict:
    """Xử lý text qua NLP pipeline: segment → pinyin → dịch."""
    from pipeline.pinyin_converter import convert_to_pinyin
    from pipeline.translator import translate_to_vietnamese
    from services.dictionary_service import segment_text, lookup

    # Tách từ
    words_raw = segment_text(full_text)

    # Pinyin cho toàn bộ text
    pinyin_full = convert_to_pinyin(full_text)

    # Dịch toàn bộ
    vietnamese = translate_to_vietnamese(full_text)

    # Chi tiết từng từ (chỉ lấy chữ Hán)
    word_details = []
    seen = set()
    for w in words_raw:
        if w in seen or not any('\u4e00' <= c <= '\u9fff' for c in w):
            continue
        seen.add(w)

        pinyin_w = convert_to_pinyin(w)
        # Thử lookup từ điển trước, nếu không có thì dịch
        entry = lookup(w)
        if entry and entry.get("meanings_vi"):
            meaning = entry["meanings_vi"][0]
        else:
            meaning = translate_to_vietnamese(w)

        word_details.append({
            "word": w,
            "pinyin": pinyin_w,
            "meaning": meaning,
        })

    return {
        "raw_text":   full_text,
        "lines":      lines,
        "pinyin":     pinyin_full,
        "vietnamese": vietnamese,
        "words":      word_details,
        "confidence": round(avg_confidence := confidence, 3),
    }
