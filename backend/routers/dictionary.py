import sys
sys.path.insert(0, "/app")

"""
routers/dictionary.py — Dictionary API v2

GET /api/dictionary         ?word=你好   → đa nghĩa
GET /api/dictionary/segment ?text=...    → tách từ
GET /api/audio/{filename}               → audio
"""
import logging
import re
import threading
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Dictionary"])


# ── Response Schemas ──

class ExampleSentence(BaseModel):
    zh: str   # Câu ví dụ tiếng Trung
    vi: str   # Dịch tiếng Việt

class DictionaryResponse(BaseModel):
    word: str
    pinyin: str
    meanings_vi: List[str]          # ĐA NGHĨA tiếng Việt — KEY FIELD
    meaning_vi: str                 # Nghĩa đầu tiên (backward compat)
    pos: str
    grammar: str
    example: ExampleSentence
    audio_url: str
    definitions_en: List[str] = [] # Nghĩa tiếng Anh gốc từ CC-CEDICT

class SegmentResponse(BaseModel):
    text: str
    words: List[str]


# ── Endpoints ──

@router.get("/dictionary", response_model=DictionaryResponse)
def lookup_word(word: str = Query(..., min_length=1, max_length=20)):
    """
    Tra từ điển tiếng Trung CC-CEDICT.
    Trả về ĐA NGHĨA tiếng Việt trong field 'meanings_vi'.
    """
    from services.dictionary_service import lookup

    word = word.strip()
    if not word:
        raise HTTPException(status_code=400, detail="Từ không được để trống.")

    result = lookup(word)
    if not result:
        raise HTTPException(status_code=404, detail=f"Không tìm thấy '{word}' trong từ điển.")

    # Đảm bảo example là dict đúng format
    example = result.get("example", {})
    if isinstance(example, str):
        example = {"zh": example, "vi": ""}

    # Generate audio background
    threading.Thread(target=_gen_audio, args=(word,), daemon=True).start()

    return DictionaryResponse(
        word=result["word"],
        pinyin=result["pinyin"],
        meanings_vi=result.get("meanings_vi", [result.get("meaning_vi", "")]),
        meaning_vi=result.get("meaning_vi", ""),
        pos=result["pos"],
        grammar=result["grammar"],
        example=ExampleSentence(zh=example.get("zh", word), vi=example.get("vi", "")),
        audio_url=result["audio_url"],
        definitions_en=result.get("definitions_en", []),
    )


@router.get("/dictionary/segment", response_model=SegmentResponse)
def segment_text(text: str = Query(..., min_length=1, max_length=200)):
    """Tách văn bản tiếng Trung thành các từ (jieba)."""
    from services.dictionary_service import segment_text as seg
    words = seg(text.strip())
    return SegmentResponse(text=text, words=words)


@router.get("/audio/{filename}")
def serve_audio(filename: str):
    """Trả về file audio MP3."""
    if not re.match(r'^[a-f0-9]{12}\.mp3$', filename):
        raise HTTPException(status_code=400, detail="Invalid filename.")
    audio_path = Path("/tmp/audio_cache") / filename
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio chưa sẵn sàng.")
    return FileResponse(
        path=str(audio_path),
        media_type="audio/mpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


def _gen_audio(word: str):
    try:
        from services.tts_service import generate_audio
        generate_audio(word)
    except Exception as e:
        logger.warning(f"Audio gen failed for '{word}': {e}")