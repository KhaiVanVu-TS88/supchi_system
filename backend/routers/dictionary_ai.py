import sys
sys.path.insert(0, "/app")

"""
routers/dictionary_ai.py — AI-Enhanced Dictionary API

GET /api/dictionary/ai/quick    ?word=...&meanings_vi=...&definitions_en=...
    → Popup giải nghĩa nhanh (dùng Claude Haiku)

GET /api/dictionary/ai/full     ?word=...&pinyin=...&meanings_vi=...&definitions_en=...
    → Phân tích sâu đầy đủ (dùng Claude Sonnet)

GET /api/dictionary/ai/tokenize?sentence=...&translation=...
    → Tách câu thành từ có nghĩa độc lập (dùng Claude Haiku)
"""
import logging
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/dictionary/ai", tags=["Dictionary AI"])


# ── Quick Lookup ───────────────────────────────────────────────────────────

class QuickLookupResponse(BaseModel):
    word: str
    pinyin: str
    han_viet: str
    meaning_vi: str
    quick_example: dict


# ── Full Analysis ───────────────────────────────────────────────────────────

class FullAnalysisResponse(BaseModel):
    word: str
    pinyin: str
    strokes: int
    radical: str
    radical_info: dict
    decomposition: str
    character_analysis: list
    meanings: dict
    usage: dict
    grammar_pattern: str
    examples: list
    memorization: dict
    related: dict
    mistakes: list
    tips: str


# ── Smart Tokenize ──────────────────────────────────────────────────────────

class TokenItem(BaseModel):
    word: str
    start: int
    end: int
    is_clickable: bool
    note: str

    class Config:
        # Cho phép field không được định nghĩa trong model
        extra = "allow"


# ── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/quick")
def ai_quick_lookup(
    word: str = Query(..., min_length=1, max_length=20, description="Từ cần tra"),
    meanings_vi: str = Query(
        default="",
        description="Nghĩa tiếng Việt (nhiều nghĩa cách nhau bằng |, max 5 nghĩa đầu tiên)"
    ),
    definitions_en: str = Query(
        default="",
        description="Nghĩa tiếng Anh gốc từ CC-CEDICT (nhiều nghĩa cách nhau bằng |, max 5 nghĩa đầu tiên)"
    ),
):
    """
    Tra nghĩa nhanh cho popup — dùng Claude Haiku.

    Sử dụng khi người dùng click vào một từ trong subtitle video.
    Trả về: Chữ Hán + Pinyin + Hán Việt + Nghĩa Việt ngắn + 1 ví dụ nhanh.
    """
    from services.dictionary_ai_service import quick_lookup, is_ai_available

    if not is_ai_available():
        return JSONResponse(
            status_code=503,
            content={"detail": "AI không khả dụng. Vui lòng liên hệ quản trị viên."},
        )

    # Parse danh sách nghĩa từ query string
    meanings_list = _parse_list(meanings_vi) if meanings_vi else []
    defs_list = _parse_list(definitions_en) if definitions_en else []

    result = quick_lookup(word, meanings_list, defs_list)
    if not result:
        return JSONResponse(
            status_code=500,
            content={"detail": "AI xử lý thất bại. Thử lại sau."},
        )

    return result


@router.get("/full")
def ai_full_analysis(
    word: str = Query(..., min_length=1, max_length=20, description="Từ cần tra"),
    pinyin: str = Query(..., description="Pinyin của từ"),
    meanings_vi: str = Query(
        default="",
        description="Nghĩa tiếng Việt (nhiều nghĩa cách nhau bằng |)"
    ),
    definitions_en: str = Query(
        default="",
        description="Nghĩa tiếng Anh gốc từ CC-CEDICT (nhiều nghĩa cách nhau bằng |)"
    ),
):
    """
    Phân tích sâu từ điển — dùng Claude Sonnet.

    Sử dụng khi người dùng vào trang Dictionary để tra cứu chi tiết.
    Trả về đầy đủ: Bộ thủ, Hán Việt, cấu tạo chữ, ví dụ, mẹo ghi nhớ, lỗi thường gặp.
    """
    from services.dictionary_ai_service import full_analysis, is_ai_available

    if not is_ai_available():
        return JSONResponse(
            status_code=503,
            content={"detail": "AI không khả dụng. Vui lòng liên hệ quản trị viên."},
        )

    meanings_list = _parse_list(meanings_vi) if meanings_vi else []
    defs_list = _parse_list(definitions_en) if definitions_en else []

    result = full_analysis(word, pinyin, meanings_list, defs_list)
    if not result:
        return JSONResponse(
            status_code=500,
            content={"detail": "AI xử lý thất bại. Thử lại sau."},
        )

    return result


@router.get("/tokenize")
def ai_smart_tokenize(
    sentence: str = Query(..., min_length=1, max_length=200, description="Câu tiếng Trung"),
    translation: str = Query(default="", description="Dịch tiếng Việt của câu"),
):
    """
    Tách câu thành từ có nghĩa độc lập — dùng Claude Haiku.

    Trả về danh sách từ/cụm từ trong câu với:
    - start/end: vị trí ký tự trong câu gốc
    - is_clickable: từ nào nên cho click tra từ điển
    - note: ghi chú ngắn về từ loại / nghĩa
    """
    from services.dictionary_ai_service import smart_tokenize, is_ai_available

    if not is_ai_available():
        return JSONResponse(
            status_code=503,
            content={"detail": "AI không khả dụng. Vui lòng liên hệ quản trị viên."},
        )

    result = smart_tokenize(sentence, translation)
    if not result:
        return JSONResponse(
            status_code=500,
            content={"detail": "AI xử lý thất bại. Thử lại sau."},
        )

    return result


# ── Helpers ─────────────────────────────────────────────────────────────────

def _parse_list(text: str, sep: str = "|") -> list[str]:
    """Parse chuỗi nhiều nghĩa cách nhau bằng sep."""
    items = [s.strip() for s in text.split(sep) if s.strip()]
    return items[:5]  # Giới hạn 5 nghĩa cho AI
