"""
pronunciation/schemas.py

Pydantic schemas cho module kiểm tra phát âm — phiên bản nâng cấp với per-syllable scoring.
"""
from typing import List, Optional
from pydantic import BaseModel, Field


# ── Per-syllable scoring ──────────────────────────────────────────────────

class SyllableScore(BaseModel):
    """
    Điểm chi tiết cho từng âm tiết.
    """
    character: str = Field(..., description="Ký tự Hán")
    pinyin: str = Field(..., description="Pinyin của ký tự")
    expected_tone: int = Field(..., description="Tone kỳ vọng (1-4, sau sandhi)")
    user_tone: int = Field(..., description="Tone người dùng đọc (0 = unknown)")
    tone_score: float = Field(..., ge=0.0, le=1.0, description="Điểm thanh điệu 0..1")
    initial_score: float = Field(0.85, ge=0.0, le=1.0, description="Điểm thanh mẫu")
    final_score: float = Field(0.85, ge=0.0, le=1.0, description="Điểm vận mẫu")
    overall_score: float = Field(..., ge=0.0, le=1.0, description="Điểm tổng âm tiết 0..1")
    errors: List[str] = Field(default_factory=list, description="Lỗi cụ thể của âm tiết này")
    start_time: float = Field(0.0, description="Thời điểm bắt đầu (giây)")
    end_time: float = Field(0.0, description="Thời điểm kết thúc (giây)")


class Recommendation(BaseModel):
    """
    Khuyến nghị học tập cụ thể cho người dùng.
    """
    type: str = Field(..., description="Loại khuyến nghị: tone / initial / final")
    focus: str = Field(..., description="Trọng tâm cần cải thiện")
    message: str = Field(..., description="Hướng dẫn cụ thể")
    examples: Optional[str] = Field(None, description="Ví dụ minh họa")


# ── Main response ────────────────────────────────────────────────────────

class PronunciationCheckResponse(BaseModel):
    """
    Response chính trả về cho frontend — nâng cấp với per-syllable scores.
    """
    overall_score: float = Field(..., ge=0.0, le=100.0, description="Điểm tổng 0..100")
    syllable_results: List[SyllableScore] = Field(
        default_factory=list,
        description="Kết quả chi tiết từng âm tiết"
    )
    summary: str = Field(..., description="Tóm tắt bằng tiếng Việt")
    recommendations: List[Recommendation] = Field(
        default_factory=list,
        description="Khuyến nghị học tập cụ thể"
    )

    # Metadata
    recognized_text: Optional[str] = Field(None, description="Text nhận diện từ STT")
    text_similarity_score: float = Field(0.0, ge=0.0, le=100.0)
    tone_score: float = Field(0.0, ge=0.0, le=100.0, description="Điểm tone trung bình")
    acoustic_score: float = Field(0.0, ge=0.0, le=100.0)
    duration_seconds: float = Field(0.0, ge=0.0)


# ── Legacy compatibility (để router cũ vẫn chạy được) ──────────────────

class ToneFeedbackItem(BaseModel):
    """
    Feedback cho từng âm tiết (legacy format).
    """
    sentence: str
    expected_tone: str
    user_tone: str
    correct: bool
    note: Optional[str] = None


class PronunciationHistoryItem(BaseModel):
    """
    Item cho endpoint lịch sử (nếu mở rộng sau).
    """
    id: int
    video_id: Optional[int]
    sentence_id: Optional[int]
    reference_text: str
    recognized_text: Optional[str]
    score: float
    suggestion: Optional[str]
    created_at: str
