"""
routers/pronunciation_router.py

API module kiểm tra phát âm tiếng Trung.

Endpoint chính:
POST /api/pronunciation/check

Input:
- user_audio: file audio người dùng (wav/mp3/...)
- sentence_id hoặc reference_text (ít nhất 1 trong 2)
- video_id (optional, để lưu context)
- reference_audio (optional, audio chuẩn để so sánh acoustic)

Output:
- overall_score 0..100
- syllable_results per-syllable scores
- summary + recommendations
"""
import sys
sys.path.insert(0, "/app")

import json
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.video import Subtitle
from pronunciation.models import PronunciationCheckResult
from pronunciation.schemas import PronunciationCheckResponse
from pronunciation.pronunciation_service import check_pronunciation


router = APIRouter(prefix="/api/pronunciation", tags=["Pronunciation"])


@router.post("/check", response_model=PronunciationCheckResponse)
async def check_pronunciation_endpoint(
    # Audio người dùng (bắt buộc)
    user_audio: UploadFile = File(..., description="Audio người dùng đọc câu tiếng Trung (wav/mp3)"),

    # Context liên kết dữ liệu
    video_id: Optional[int] = Form(None),
    sentence_id: Optional[int] = Form(None),

    # Fallback nếu không có sentence_id
    reference_text: Optional[str] = Form(None),
    reference_pinyin: Optional[str] = Form(None),

    # Optional audio chuẩn để so sánh âm học
    reference_audio: Optional[UploadFile] = File(None),

    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Kiểm tra phát âm tiếng Trung của user.

    Luật input:
    - Bắt buộc có user_audio
    - Cần sentence_id HOẶC reference_text để có câu chuẩn

    Nếu truyền sentence_id:
      -> backend tự lấy reference_text/reference_pinyin từ bảng subtitles.
    """
    # 1) Validate audio user
    if not user_audio.content_type:
        raise HTTPException(status_code=400, detail="Thiếu content-type của file audio.")

    if not user_audio.content_type.startswith("audio/"):
        raise HTTPException(status_code=400, detail=f"File không phải audio: {user_audio.content_type}")

    user_audio_bytes = await user_audio.read()
    if not user_audio_bytes:
        raise HTTPException(status_code=400, detail="File audio rỗng.")

    # Giới hạn 20MB để tránh request quá nặng
    if len(user_audio_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Audio quá lớn. Giới hạn 20MB.")

    # 2) Resolve reference từ sentence_id (nếu có)
    resolved_text = reference_text
    resolved_pinyin = reference_pinyin

    if sentence_id is not None:
        subtitle = db.query(Subtitle).filter(
            Subtitle.id == sentence_id,
            Subtitle.is_deleted == 0,
        ).first()

        if not subtitle:
            raise HTTPException(status_code=404, detail="sentence_id không tồn tại.")

        resolved_text = subtitle.chinese
        resolved_pinyin = subtitle.pinyin

        # Nếu client chưa truyền video_id thì lấy theo subtitle
        if video_id is None:
            video_id = subtitle.video_id

    # 3) Validate reference
    if not resolved_text:
        raise HTTPException(
            status_code=400,
            detail="Cần truyền sentence_id hoặc reference_text để làm câu chuẩn.",
        )

    # 4) Optional reference audio
    reference_audio_bytes = None
    if reference_audio is not None:
        if reference_audio.content_type and not reference_audio.content_type.startswith("audio/"):
            raise HTTPException(status_code=400, detail="reference_audio phải là file audio.")
        reference_audio_bytes = await reference_audio.read()

    # 5) Chấm điểm phát âm
    try:
        result = check_pronunciation(
            user_audio_bytes=user_audio_bytes,
            reference_text=resolved_text,
            reference_pinyin=resolved_pinyin,
            reference_audio_bytes=reference_audio_bytes,
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý audio: {type(e).__name__}: {str(e)}")

    # 6) Lưu DB lịch sử chấm điểm
    row = PronunciationCheckResult(
        user_id=current_user.id,
        video_id=video_id,
        sentence_id=sentence_id,
        reference_text=resolved_text,
        reference_pinyin=resolved_pinyin,
        recognized_text=result.get("recognized_text"),
        text_similarity_score=result.get("text_similarity_score", 0.0),
        tone_score=result.get("tone_score", 0.0),
        acoustic_score=result.get("acoustic_score", 0.0),
        overall_score=float(result.get("overall_score", 0)),
        tone_feedback=json.dumps(result.get("syllable_results", [])),
        suggestion=result.get("summary", ""),
        audio_duration_seconds=result.get("duration_seconds", 0.0),
    )
    db.add(row)
    db.commit()

    # 7) Trả response cho frontend
    return PronunciationCheckResponse(**result)
