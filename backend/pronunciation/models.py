"""
pronunciation/models.py

SQLAlchemy models cho module kiểm tra phát âm tiếng Trung.

Mục tiêu:
- Lưu lịch sử chấm điểm phát âm theo user
- Lưu chi tiết tone feedback để frontend hiển thị lại
- Hỗ trợ query theo user/video/sentence
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.types import JSON

from core.database import Base


class PronunciationCheckResult(Base):
    """
    Bảng lưu kết quả kiểm tra phát âm.

    Lưu ý thiết kế:
    - tone_feedback dùng JSON để lưu danh sách per-syllable/per-sentence
    - reference_* lưu dữ liệu chuẩn tại thời điểm chấm điểm (để audit)
    - recognized_text lưu transcript từ STT (Whisper)
    """
    __tablename__ = "pronunciation_check_results"

    id = Column(Integer, primary_key=True, index=True)

    # Chủ sở hữu kết quả
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Liên kết ngữ cảnh luyện tập
    video_id = Column(Integer, ForeignKey("videos.id", ondelete="SET NULL"), nullable=True, index=True)
    sentence_id = Column(Integer, ForeignKey("subtitles.id", ondelete="SET NULL"), nullable=True, index=True)

    # Dữ liệu câu chuẩn
    reference_text = Column(Text, nullable=False)
    reference_pinyin = Column(Text, nullable=True)

    # Dữ liệu nhận diện từ audio người dùng
    recognized_text = Column(Text, nullable=True)

    # Điểm số thành phần
    text_similarity_score = Column(Float, default=0.0, nullable=False)   # 0..100
    tone_score = Column(Float, default=0.0, nullable=False)              # 0..100
    acoustic_score = Column(Float, default=0.0, nullable=False)          # 0..100
    overall_score = Column(Float, default=0.0, nullable=False)           # 0..100

    # Chi tiết tone (list JSON)
    # Ví dụ:
    # [
    #   {"syllable":"ni", "expected_tone":"3", "user_tone":"2", "correct":false},
    #   ...
    # ]
    tone_feedback = Column(JSON, nullable=True)

    # Nhận xét tổng hợp cho người học
    suggestion = Column(Text, nullable=True)

    # Metadata
    audio_duration_seconds = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    def __repr__(self):
        return f"<PronunciationCheckResult id={self.id} user_id={self.user_id} overall={self.overall_score:.1f}>"
