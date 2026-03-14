"""
routers/videos.py — Video endpoints v3

POST /api/videos/analyze  → tạo Job, push Celery task, trả về job_id ngay
GET  /api/videos          → danh sách video đã hoàn thành
GET  /api/videos/{id}     → chi tiết video + subtitles
DELETE /api/videos/{id}   → xoá video
"""
import re
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.video import Video, Subtitle
from models.job import ProcessingJob

router = APIRouter(prefix="/api/videos", tags=["Videos"])
logger = logging.getLogger(__name__)


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
    """Trả về ngay sau khi submit — không phải kết quả cuối."""
    job_id: int
    status: str = "queued"
    message: str = "Video đang được xử lý. Vui lòng đợi."


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
    created_at: str
    class Config: from_attributes = True


class VideoDetailOut(VideoOut):
    subtitles: List[SubtitleOut]


# ── Endpoints ──

@router.post("/analyze", response_model=AnalyzeJobResponse, status_code=202)
def analyze_video(
    request: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit video để xử lý trong background.

    Trả về 202 Accepted + job_id ngay lập tức.
    Frontend poll GET /api/jobs/{job_id} để theo dõi tiến trình.
    """
    url = request.url.strip()
    if not extract_video_id(url):
        raise HTTPException(status_code=400, detail="URL YouTube không hợp lệ.")

    # Tạo Job record
    job = ProcessingJob(
        user_id=current_user.id,
        youtube_url=url,
        title=request.title,
        status="queued",
        progress=0.0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Push Celery task
    from worker.tasks import process_video_task
    process_video_task.delay(job.id)

    logger.info(f"Job {job.id} queued for user {current_user.id}: {url}")

    return AnalyzeJobResponse(job_id=job.id)


@router.get("", response_model=List[VideoOut])
def list_videos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20,
):
    videos = (
        db.query(Video)
        .filter(Video.user_id == current_user.id)
        .order_by(Video.created_at.desc())
        .offset(skip).limit(limit).all()
    )
    return [_video_out(v) for v in videos]


@router.get("/{video_id}", response_model=VideoDetailOut)
def get_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = db.query(Video).filter(
        Video.id == video_id,
        Video.user_id == current_user.id,
    ).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video không tồn tại.")
    return _video_detail_out(video)


@router.delete("/{video_id}", status_code=204)
def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    video = db.query(Video).filter(
        Video.id == video_id,
        Video.user_id == current_user.id,
    ).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video không tồn tại.")
    db.delete(video)
    db.commit()


# ── Helpers ──

def _video_out(v: Video) -> VideoOut:
    return VideoOut(
        id=v.id, youtube_url=v.youtube_url, video_id=v.video_id,
        title=v.title, thumbnail_url=v.thumbnail_url,
        subtitle_count=len(v.subtitles), created_at=v.created_at.isoformat(),
    )


def _video_detail_out(v: Video) -> VideoDetailOut:
    return VideoDetailOut(
        id=v.id, youtube_url=v.youtube_url, video_id=v.video_id,
        title=v.title, thumbnail_url=v.thumbnail_url,
        subtitle_count=len(v.subtitles), created_at=v.created_at.isoformat(),
        subtitles=[
            SubtitleOut(
                id=s.id, start_time=s.start_time, end_time=s.end_time,
                chinese=s.chinese, pinyin=s.pinyin, vietnamese=s.vietnamese,
            ) for s in v.subtitles
        ],
    )