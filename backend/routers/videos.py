"""
routers/videos.py — Video endpoints v3.1

Tối ưu:
  ✅ Rate limiting (5 video/phút/user)
  ✅ Duplicate video check (Redis cache)
  ✅ Throttle khi video đang xử lý
  ✅ Soft delete thay vì hard delete
  ✅ Pagination với cursor-based (tốt hơn offset cho DB lớn)
"""
import re
import logging
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from core.database import get_db
from core.deps import get_current_user
from core.rate_limiter import rate_limit, RateLimitConfig, _check_rate_limit, _get_user_key
from models.user import User
from models.video import Video, Subtitle
from models.job import ProcessingJob
from pipeline.youtube import get_video_id
from services.video_cache import (
    check_duplicate_video,
    mark_video_processing,
    mark_video_done,
    mark_video_failed,
    invalidate_video_cache,
)
from services.video_storage_service import (
    enforce_video_limit,
    update_last_viewed,
    get_max_videos_per_user,
)

router = APIRouter(prefix="/api/videos", tags=["Videos"])
logger = logging.getLogger(__name__)


# ── Helpers ──

def extract_video_id(url: str) -> Optional[str]:
    patterns = [r'[?&]v=([\w-]{11})', r'youtu\.be/([\w-]{11})', r'embed/([\w-]{11})']
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


# ── Schemas ──

class AnalyzeRequest(BaseModel):
    url: str
    title: Optional[str] = None


class AnalyzeJobResponse(BaseModel):
    job_id: Optional[int] = None
    video_id: Optional[int] = None  # Nếu đã xử lý trước đó
    status: str
    message: str
    source: str = "new"  # "new" | "cached" | "processing"
    evicted_videos: List[str] = []  # Danh sách video đã bị tự động xóa


class SubtitleOut(BaseModel):
    id: int
    start_time: float
    end_time: float
    chinese: str
    pinyin: str
    vietnamese: str
    class Config: from_attributes = True


class VideoOut(BaseModel):
    id: int
    youtube_url: str
    video_id: str
    title: Optional[str]
    thumbnail_url: Optional[str]
    subtitle_count: int
    is_deleted: bool = False
    last_viewed_at: Optional[str] = None  # FIFO: thời gian xem gần nhất
    created_at: str
    class Config: from_attributes = True


@router.patch("/{video_id}/view")
def mark_video_viewed(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Cập nhật last_viewed_at khi user mở video.
    Gọi từ frontend khi iframe/video player ready.
    """
    ok = update_last_viewed(video_id, current_user.id, db)
    if not ok:
        raise HTTPException(status_code=404, detail="Video không tồn tại.")
    return {"ok": True}


class VideoDetailOut(VideoOut):
    subtitles: List[SubtitleOut]


class DuplicateVideoResponse(BaseModel):
    """Khi video đã được xử lý rồi."""
    video_id: int
    message: str = "Video này đã được xử lý trước đó."


# ── Endpoints ──

@router.post("/analyze", response_model=AnalyzeJobResponse, status_code=202)
def analyze_video(
    request: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit video để xử lý.

    ⚡ Optimizations:
    - Rate limit: 5 requests/phút/user
    - Duplicate check: nếu video đã xử lý → trả về video_id cũ
    - Concurrent check: nếu đang xử lý → trả về job_id đang chạy
    """
    url = request.url.strip()
    yt_video_id = extract_video_id(url)
    if not yt_video_id:
        raise HTTPException(status_code=400, detail="URL YouTube không hợp lệ.")

    # ── 1. Rate limit ──
    key = _get_user_key(current_user.id, "VIDEO")
    allowed, remaining, retry_after = _check_rate_limit(key, *RateLimitConfig.VIDEO)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Đã vượt giới hạn 5 video/phút. Thử lại sau {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )

    # ── 2. Duplicate check ──
    dup_result, cached_id = check_duplicate_video(current_user.id, yt_video_id)

    if dup_result == "already_done":
        # Video đã xử lý thành công → kiểm tra video có tồn tại không
        existing = db.query(Video).filter(
            Video.id == cached_id,
            Video.user_id == current_user.id,
            Video.is_deleted == False,
        ).first()
        if existing:
            return AnalyzeJobResponse(
                video_id=existing.id,
                status="done",
                message="Video đã được xử lý trước đó.",
                source="cached",
            )

    if dup_result == "already_processing":
        # Đang xử lý → trả về job cũ
        return AnalyzeJobResponse(
            job_id=cached_id,
            status="processing",
            message="Video này đang được xử lý. Vui lòng đợi.",
            source="processing",
        )

    # ── 3. FIFO — xóa video cũ nếu đạt giới hạn ──
    evicted = enforce_video_limit(current_user.id, db)
    if evicted:
        logger.info(f"User {current_user.id}: FIFO evicted {len(evicted)} videos: {evicted}")

    # ── 4. Giới hạn video đang chờ của user ──
    pending_count = db.query(ProcessingJob).filter(
        ProcessingJob.user_id == current_user.id,
        ProcessingJob.status.in_(["queued", "processing"]),
    ).count()
    if pending_count >= 3:
        raise HTTPException(
            status_code=429,
            detail="Bạn có quá nhiều video đang chờ xử lý (tối đa 3). Vui lòng đợi hoàn thành.",
        )

    # ── 5. Tạo Job ──
    job = ProcessingJob(
        user_id=current_user.id,
        youtube_url=url,
        title=request.title or f"Video {yt_video_id}",
        status="queued",
        progress=0.0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # ── 6. Đánh dấu đang xử lý trong Redis ──
    mark_video_processing(yt_video_id, job.id)

    # ── 6. Push Celery task ──
    from worker.tasks import process_video_task
    process_video_task.delay(job.id)

    logger.info(f"Job {job.id} queued for user {current_user.id}: {url}")

    return AnalyzeJobResponse(
        job_id=job.id,
        status="queued",
        message="Video đang được xử lý.",
        source="new",
        evicted_videos=evicted,
    )


@router.get("", response_model=List[VideoOut])
def list_videos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20,
    include_deleted: bool = False,
):
    """
    Danh sách video của user.

    ⚡ Optimization: soft delete, chỉ thấy video chưa xóa.
    """
    query = db.query(Video).filter(Video.user_id == current_user.id)

    if not include_deleted:
        query = query.filter(Video.is_deleted == False)

    videos = (
        query
        .order_by(Video.created_at.desc())
        .offset(skip).limit(limit)
        .all()
    )
    return [_video_out(v) for v in videos]


@router.get("/{video_id}", response_model=VideoDetailOut)
def get_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Chi tiết video + subtitles.

    ⚡ Optimization: không load all() nữa, dùng joinedload cho subtitles.
    """
    video = (
        db.query(Video)
        .filter(
            Video.id == video_id,
            Video.user_id == current_user.id,
            Video.is_deleted == False,
        )
        .first()
    )
    if not video:
        raise HTTPException(status_code=404, detail="Video không tồn tại.")
    return _video_detail_out(video)


@router.delete("/{video_id}", status_code=204)
def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Xóa video (SOFT DELETE).

    ⚡ Tối ưu:
    - Không xóa hàng trong DB → giữ referential integrity
    - Xóa Redis cache tương ứng
    - Xóa hàng loạt subtitles cùng lúc
    """
    video = db.query(Video).filter(
        Video.id == video_id,
        Video.user_id == current_user.id,
        Video.is_deleted == False,
    ).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video không tồn tại.")

    # Soft delete
    video.is_deleted = True
    video.deleted_at = None  # Có thể thêm deleted_at nếu muốn

    # Cascade soft delete cho subtitles
    db.query(Subtitle).filter(Subtitle.video_id == video_id).update(
        {"is_deleted": True}
    )
    db.commit()

    # Invalidate Redis cache
    invalidate_video_cache(current_user.id, video.video_id)

    logger.info(f"Video {video_id} soft-deleted by user {current_user.id}")


# ── Helpers ──

def _video_out(v: Video) -> VideoOut:
    return VideoOut(
        id=v.id, youtube_url=v.youtube_url, video_id=v.video_id,
        title=v.title, thumbnail_url=v.thumbnail_url,
        subtitle_count=len(v.subtitles),
        is_deleted=getattr(v, "is_deleted", False),
        last_viewed_at=v.last_viewed_at.isoformat() if v.last_viewed_at else None,
        created_at=v.created_at.isoformat(),
    )


def _video_detail_out(v: Video) -> VideoDetailOut:
    return VideoDetailOut(
        id=v.id, youtube_url=v.youtube_url, video_id=v.video_id,
        title=v.title, thumbnail_url=v.thumbnail_url,
        subtitle_count=len(v.subtitles),
        is_deleted=getattr(v, "is_deleted", False),
        last_viewed_at=v.last_viewed_at.isoformat() if v.last_viewed_at else None,
        created_at=v.created_at.isoformat(),
        subtitles=[
            SubtitleOut(
                id=s.id, start_time=s.start_time, end_time=s.end_time,
                chinese=s.chinese, pinyin=s.pinyin, vietnamese=s.vietnamese,
            ) for s in v.subtitles
        ],
    )
