"""
translator.py - Module dịch tiếng Trung sang tiếng Việt

Sử dụng deep-translator với Google Translate (không cần API key).
Thử zh-CN trước, sau đó auto/en cho câu không phải tiếng Trung (subtitle song ngữ).
Có retry khi lỗi mạng/SSL và fallback MyMemory.
"""

import logging
import time
from typing import List, Optional

from deep_translator import GoogleTranslator, MyMemoryTranslator

logger = logging.getLogger(__name__)

_GOOGLE_ATTEMPTS = 3
_GOOGLE_BACKOFF_BASE = 0.6


def translate_to_vietnamese(chinese_text: str) -> str:
    """
    Dịch một dòng subtitle sang tiếng Việt (zh / en / ngôn ngữ khác → vi).

    Args:
        chinese_text: Văn bản (thường là tiếng Trung; có thể lẫn tiếng Anh)

    Returns:
        Văn bản tiếng Việt đã dịch
    """
    if not (chinese_text and chinese_text.strip()):
        return chinese_text

    last_error: Exception | None = None

    def try_google(source: str, attempts: int, label: str) -> Optional[str]:
        nonlocal last_error
        for attempt in range(attempts):
            try:
                translator = GoogleTranslator(source=source, target="vi")
                out = translator.translate(chinese_text)
                if out and str(out).strip():
                    return str(out).strip()
            except Exception as e:
                last_error = e
                logger.warning(
                    "Google (%s) lần %s/%s thất bại (%s…): %s",
                    label,
                    attempt + 1,
                    attempts,
                    chinese_text[:24],
                    e,
                )
                if attempt < attempts - 1:
                    time.sleep(_GOOGLE_BACKOFF_BASE * (2**attempt))
        return None

    # Thứ tự: Trung giản thể → tự nhận ngôn ngữ → tiếng Anh (subtitle chỉ có EN)
    for source, attempts, label in (
        ("zh-CN", _GOOGLE_ATTEMPTS, "zh-CN"),
        ("auto", 2, "auto"),
        ("en", 2, "en"),
    ):
        got = try_google(source, attempts, label)
        if got:
            return got

    for src, lab in (("zh-CN", "zh-CN"), ("en", "en"), ("auto", "auto")):
        try:
            mm = MyMemoryTranslator(source=src, target="vi")
            alt = mm.translate(chinese_text)
            if alt and str(alt).strip():
                logger.info("MyMemory (%s) thành công: %s…", lab, chinese_text[:24])
                return str(alt).strip()
        except Exception as e:
            logger.warning("MyMemory (%s) thất bại: %s", lab, e)

    logger.error("Không dịch được: %s… | lỗi cuối: %s", chinese_text[:40], last_error)
    return f"[Lỗi dịch] {chinese_text}"


def translate_batch(texts: List[str], delay: float = 0.3) -> List[str]:
    """
    Dịch nhiều câu sang tiếng Việt.

    Có delay giữa các request để tránh bị Google chặn do gọi quá nhiều.

    Args:
        texts: Danh sách dòng subtitle
        delay: Thời gian chờ giữa các request (giây)

    Returns:
        Danh sách bản dịch tiếng Việt
    """
    results: List[str] = []

    for i, text in enumerate(texts):
        translation = translate_to_vietnamese(text)
        results.append(translation)

        if i < len(texts) - 1:
            time.sleep(delay)

    return results
