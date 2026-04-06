"""
models/video.py — SQLAlchemy models cho bảng Videos và Subtitles

Schema:
  videos(id, user_id, youtube_url, video_id, title, thumbnail_url, duration, created_at)
  subtitles(id, video_id, start_time, end_time, chinese, pinyin, vietnamese)
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from core.database import Base


class Video(Base):
    __tablename__ = "videos"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    youtube_url   = Column(String(500), nullable=False, index=True)   # index cho lookup theo URL
    video_id      = Column(String(20),  nullable=False, index=True)   # YouTube video ID (11 ký tự)
    title         = Column(String(500), nullable=True)
    thumbnail_url = Column(String(500), nullable=True)
    is_deleted    = Column(Integer, default=0, nullable=False)       # Soft delete flag (0=active, 1=deleted)
    deleted_at    = Column(DateTime, nullable=True)                  # Thời gian xóa
    last_viewed_at = Column(DateTime, nullable=True, index=True)     # Thời gian xem gần nhất (FIFO)
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user      = relationship("User",     back_populates="videos")
    subtitles = relationship("Subtitle", back_populates="video", cascade="all, delete-orphan",
                             order_by="Subtitle.start_time")

    @property
    def subtitle_count(self) -> int:
        return len(self.subtitles)

    def __repr__(self):
        return f"<Video id={self.id} video_id={self.video_id}>"


class Subtitle(Base):
    __tablename__ = "subtitles"

    id          = Column(Integer, primary_key=True, index=True)
    video_id    = Column(Integer, ForeignKey("videos.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time  = Column(Float,  nullable=False)
    end_time    = Column(Float,  nullable=False)
    chinese     = Column(Text,   nullable=False)
    pinyin      = Column(Text,   nullable=False)
    vietnamese  = Column(Text,   nullable=False)
    is_deleted  = Column(Integer, default=0, nullable=False)  # Soft delete flag

    # Relationship
    video = relationship("Video", back_populates="subtitles")

    def __repr__(self):
        return f"<Subtitle id={self.id} start={self.start_time}>"
