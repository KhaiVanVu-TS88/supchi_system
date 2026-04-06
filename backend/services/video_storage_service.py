"""
services/video_storage_service.py

Logic FIFO tự động theo thời gian xem:
1. Mỗi user lưu tối đa MAX_VIDEOS_PER_USER video.
2. Khi thêm video mới mà đạt giới hạn → tự động xóa video "ít giá trị nhất":
   a) Ưu tiên xóa video CHƯA TỪNG XEM (last_viewed_at = NULL)
   b) Nếu tất cả đã xem → xóa video có last_viewed_at CŨ NHẤT
   c) Nếu last_viewed_at bằng nhau → so sánh created_at CŨ NHẤT
3. Cascade xóa Subtitle liên quan.
4. Invalidate Redis cache sau khi xóa.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy.orm import Session

from core.config import get_settings
from core.database import SessionLocal
from models.video import Video, Subtitle
from services.video_cache import invalidate_video_cache

logger = logging.getLogger(__name__)


def get_max_videos_per_user() -> int:
    """Lấy giới hạn số video/user từ config."""
    return getattr(get_settings(), "MAX_VIDEOS_PER_USER", 5)


def enforce_video_limit(user_id: int, db: Session) -> List[str]:
    """
    Xóa video cũ nhất nếu user đã đạt giới hạn.
    Trả về danh sách video_id đã bị xóa (để log/notify).
    """
    max_videos = get_max_videos_per_user()

    active_count = db.query(Video).filter(
        Video.user_id == user_id,
        Video.is_deleted == 0,
    ).count()

    if active_count < max_videos:
        return []

    evicted: List[str] = []
    to_evict = active_count - max_videos + 1  # xóa 1 video để tạo chỗ

    # FIFO query: chưa xem trước → rồi mới xem → created_at cũ nhất
    candidates = (
        db.query(Video)
        .filter(
            Video.user_id == user_id,
            Video.is_deleted == 0,
        )
        .order_by(
            Video.last_viewed_at.asc(),   # NULLs-first: chưa xem lên đầu
            Video.created_at.asc(),        # Cũ nhất lên đầu
        )
        .limit(to_evict)
        .all()
    )

    for video in candidates:
        # Cascade soft-delete subtitles
        db.query(Subtitle).filter(Subtitle.video_id == video.id).update(
            {"is_deleted": 1}
        )

        # Soft-delete video
        video.is_deleted = 1
        video.deleted_at = datetime.now(timezone.utc)

        # Invalidate cache
        invalidate_video_cache(user_id, video.video_id)

        evicted.append(video.title or video.video_id)
        logger.info(
            f"FIFO evicted: video_id={video.id} title='{video.title}' "
            f"last_viewed={video.last_viewed_at} user={user_id}"
        )

    db.commit()
    return evicted


def update_last_viewed(video_id: int, user_id: int, db: Session) -> bool:
    """
    Cập nhật last_viewed_at khi user mở/xem video.
    Trả True nếu cập nhật thành công, False nếu video không tìm thấy.
    """
    video = db.query(Video).filter(
        Video.id == video_id,
        Video.user_id == user_id,
        Video.is_deleted == 0,
    ).first()

    if not video:
        return False

    video.last_viewed_at = datetime.now(timezone.utc)
    db.commit()
    return True
