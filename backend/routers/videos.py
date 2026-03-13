"""
routers/videos.py — Video endpoints

POST /api/videos/analyze     — Phân tích video YouTube (cần đăng nhập)
GET  /api/videos             — Lấy danh sách video của user
GET  /api/videos/{id}        — Lấy chi tiết một video + subtitles
DELETE /api/videos/{id}      — Xoá video khỏi lịch sử
"""
import re
import logging
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.video import Video, Subtitle
from pipeline import process_video

router = APIRouter(prefix="/api/videos", tags=["Videos"])
logger = logging.getLogger(__name__)


# ── Helper ──

def extract_video_id(url: str) -> Optional[str]:
    patterns = [r'[?&]v=([\w-]{11})', r'youtu\.be/([\w-]{11})', r'embed/([\w-]{11})']
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    return None


def make_thumbnail(video_id: str) -> str:
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


# ── Pydantic Schemas ──

class AnalyzeRequest(BaseModel):
    url: str
    title: Optional[str] = None   # Tiêu đề tuỳ chỉnh (optional)


class SubtitleOut(BaseModel):
    id: int
    start_time: float
    end_time: float
    chinese: str
    pinyin: str
    vietnamese: str

    class Config:
        from_attributes = True


class VideoOut(BaseModel):
    id: int
    youtube_url: str
    video_id: str
    title: Optional[str]
    thumbnail_url: Optional[str]
    subtitle_count: int
    created_at: str

    class Config:
        from_attributes = True


class VideoDetailOut(VideoOut):
    subtitles: List[SubtitleOut]


# ── Endpoints ──

@router.post("/analyze", response_model=VideoDetailOut, status_code=201)
def analyze_video(
    request: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Phân tích video YouTube và lưu vào lịch sử của user.

    Pipeline:
    1. Validate URL
    2. Chạy AI pipeline (Whisper + Pinyin + Dịch)
    3. Lưu Video + Subtitles vào DB
    4. Trả về kết quả
    """
    url = request.url.strip()
    vid = extract_video_id(url)
    if not vid:
        raise HTTPException(status_code=400, detail="URL YouTube không hợp lệ.")

    logger.info(f"User {current_user.id} analyzing video {vid}")

    try:
        # ── Chạy AI pipeline ──
        raw_subtitles = process_video(url)

        if not raw_subtitles:
            raise HTTPException(status_code=422, detail="Không nhận dạng được giọng nói trong video.")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pipeline error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Lỗi xử lý video: {str(e)}")

    # ── Lưu vào DB ──
    video = Video(
        user_id=current_user.id,
        youtube_url=url,
        video_id=vid,
        title=request.title or f"Video {vid}",
        thumbnail_url=make_thumbnail(vid),
    )
    db.add(video)
    db.flush()   # Lấy video.id trước khi commit

    # Bulk insert subtitles
    subtitles_db = [
        Subtitle(
            video_id=video.id,
            start_time=s["start"],
            end_time=s["end"],
            chinese=s["chinese"],
            pinyin=s["pinyin"],
            vietnamese=s["vietnamese"],
        )
        for s in raw_subtitles
    ]
    db.bulk_save_objects(subtitles_db)
    db.commit()
    db.refresh(video)

    logger.info(f"Saved video {video.id} with {len(subtitles_db)} subtitles for user {current_user.id}")

    return _video_detail_out(video)


@router.get("", response_model=List[VideoOut])
def list_videos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 20,
):
    """Lấy danh sách video đã xử lý của user (mới nhất trước)."""
    videos = (
        db.query(Video)
        .filter(Video.user_id == current_user.id)
        .order_by(Video.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_video_out(v) for v in videos]


@router.get("/{video_id}", response_model=VideoDetailOut)
def get_video(
    video_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Lấy chi tiết video + toàn bộ subtitles."""
    video = db.query(Video).filter(
        Video.id == video_id,
        Video.user_id == current_user.id,   # Chỉ xem video của chính mình
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
    """Xoá video và toàn bộ subtitle khỏi lịch sử."""
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
        id=v.id,
        youtube_url=v.youtube_url,
        video_id=v.video_id,
        title=v.title,
        thumbnail_url=v.thumbnail_url,
        subtitle_count=v.subtitle_count,
        created_at=v.created_at.isoformat(),
    )


def _video_detail_out(v: Video) -> VideoDetailOut:
    return VideoDetailOut(
        id=v.id,
        youtube_url=v.youtube_url,
        video_id=v.video_id,
        title=v.title,
        thumbnail_url=v.thumbnail_url,
        subtitle_count=v.subtitle_count,
        created_at=v.created_at.isoformat(),
        subtitles=[
            SubtitleOut(
                id=s.id,
                start_time=s.start_time,
                end_time=s.end_time,
                chinese=s.chinese,
                pinyin=s.pinyin,
                vietnamese=s.vietnamese,
            )
            for s in v.subtitles
        ],
    )
