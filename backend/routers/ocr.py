import sys
sys.path.insert(0, "/app")

"""
routers/ocr.py — OCR & Handwriting API

POST /api/ocr          — Upload ảnh → nhận dạng chữ Hán → NLP
POST /api/handwriting  — Canvas PNG → nhận dạng chữ viết tay → NLP

Cả hai dùng sync processing (thường < 3s, không cần Celery).
"""
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import base64
import io

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["OCR"])

# ── Response Schemas ──

class WordDetail(BaseModel):
    word: str
    pinyin: str
    meaning: str

class OCRResponse(BaseModel):
    raw_text: str
    lines: List[str]
    pinyin: str
    vietnamese: str
    words: List[WordDetail]
    confidence: float

class HandwritingResponse(BaseModel):
    candidates: List[str]
    best: str
    pinyin: List[str]
    pinyin_full: str
    meanings: List[str]
    vietnamese: str
    confidence: float

class HandwritingRequest(BaseModel):
    """Frontend gửi canvas data URI: data:image/png;base64,..."""
    image_data: str     # base64 encoded PNG


# ── Endpoints ──

@router.post("/ocr", response_model=OCRResponse)
async def ocr_image(file: UploadFile = File(...)):
    """
    Nhận dạng chữ Hán từ ảnh upload.

    Supported formats: JPG, PNG, WEBP, BMP
    Max size: 10MB
    """
    # Validate
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/bmp"):
        raise HTTPException(
            status_code=400,
            detail=f"Định dạng không hỗ trợ: {file.content_type}. Dùng JPG/PNG/WEBP."
        )

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:  # 10MB
        raise HTTPException(status_code=400, detail="Ảnh quá lớn. Tối đa 10MB.")

    # Xử lý OCR
    from services.ocr_service import ocr_from_bytes
    result = ocr_from_bytes(image_bytes)

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    return OCRResponse(**result)


@router.post("/handwriting", response_model=HandwritingResponse)
async def recognize_handwriting(request: HandwritingRequest):
    """
    Nhận dạng chữ viết tay từ canvas.

    Frontend gửi: { "image_data": "data:image/png;base64,..." }
    """
    # Parse base64
    try:
        if "," in request.image_data:
            # Bỏ prefix "data:image/png;base64,"
            b64_data = request.image_data.split(",", 1)[1]
        else:
            b64_data = request.image_data

        image_bytes = base64.b64decode(b64_data)
    except Exception:
        raise HTTPException(status_code=400, detail="Dữ liệu ảnh không hợp lệ.")

    if len(image_bytes) < 100:
        raise HTTPException(status_code=400, detail="Canvas trống. Hãy vẽ chữ trước.")

    # Nhận dạng
    from services.handwriting_service import recognize_handwriting
    result = recognize_handwriting(image_bytes)

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    return HandwritingResponse(**result)
