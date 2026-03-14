"""
routers/jobs.py — Job status endpoints

GET /api/jobs/{job_id}  — Lấy trạng thái xử lý
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.job import ProcessingJob

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


class JobStatusResponse(BaseModel):
    id: int
    status: str          # queued | processing | done | failed
    progress: float      # 0–100
    youtube_url: str
    title: Optional[str]
    subtitle_source: Optional[str]   # manual | whisper
    llm_used: Optional[str]
    error_message: Optional[str]
    video_id: Optional[int]          # Có khi status=done
    created_at: str
    finished_at: Optional[str]


@router.get("/{job_id}", response_model=JobStatusResponse)
def get_job_status(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Poll trạng thái của một job xử lý video.
    Frontend gọi endpoint này mỗi 3 giây để cập nhật progress bar.
    """
    job = db.query(ProcessingJob).filter(
        ProcessingJob.id == job_id,
        ProcessingJob.user_id == current_user.id,
    ).first()

    if not job:
        raise HTTPException(status_code=404, detail="Job không tồn tại.")

    return JobStatusResponse(
        id=job.id,
        status=job.status,
        progress=job.progress,
        youtube_url=job.youtube_url,
        title=job.title,
        subtitle_source=job.subtitle_source,
        llm_used=job.llm_used,
        error_message=job.error_message,
        video_id=job.video_id,
        created_at=job.created_at.isoformat(),
        finished_at=job.finished_at.isoformat() if job.finished_at else None,
    )
