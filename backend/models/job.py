"""
models/job.py — Bảng theo dõi trạng thái xử lý video
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from core.database import Base


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id",  ondelete="CASCADE"), nullable=False, index=True)
    video_id    = Column(Integer, ForeignKey("videos.id", ondelete="SET NULL"), nullable=True)

    status      = Column(String(20), default="queued", nullable=False, index=True)
    progress    = Column(Float, default=0.0, nullable=False)

    youtube_url     = Column(String(500), nullable=False)
    title           = Column(String(500), nullable=True)
    subtitle_source = Column(String(50),  nullable=True)
    llm_used        = Column(String(10),  nullable=True)
    error_message   = Column(Text,        nullable=True)
    celery_task_id  = Column(String(200), nullable=True)

    created_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at  = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                         onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    finished_at = Column(DateTime, nullable=True)

    # Không dùng relationship() string — tránh lỗi khi models chưa load đủ
    # Truy cập user/video qua join query khi cần

    def __repr__(self):
        return f"<Job id={self.id} status={self.status} progress={self.progress}>"