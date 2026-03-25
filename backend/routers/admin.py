import sys
sys.path.insert(0, "/app")

"""
routers/admin.py — Admin API

Tất cả route đều yêu cầu role=admin qua get_current_admin dependency.

GET  /api/admin/stats          — Tổng quan dashboard
GET  /api/admin/users          — Danh sách users (search, filter, pagination)
PUT  /api/admin/users/{id}     — Cập nhật user (role, is_active)
DEL  /api/admin/users/{id}     — Xoá user
GET  /api/admin/jobs           — Tất cả jobs (filter, pagination)
POST /api/admin/jobs/{id}/retry— Retry job thất bại
GET  /api/admin/videos         — Tất cả videos
DEL  /api/admin/videos/{id}    — Xoá video
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel

from core.database import get_db
from core.deps import get_current_admin
from models.user import User
from models.video import Video, Subtitle
from models.job import ProcessingJob

router = APIRouter(prefix="/api/admin", tags=["Admin"])


# ═══════════════════════════════════════
#  SCHEMAS
# ═══════════════════════════════════════

class UserAdminResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: str
    video_count: int
    job_count: int

class UpdateUserRequest(BaseModel):
    role: Optional[str] = None        # 'user' | 'admin'
    is_active: Optional[bool] = None

class JobAdminResponse(BaseModel):
    id: int
    user_id: int
    username: str
    status: str
    progress: float
    youtube_url: str
    title: Optional[str]
    subtitle_source: Optional[str]
    llm_used: Optional[str]
    error_message: Optional[str]
    created_at: str
    finished_at: Optional[str]

class VideoAdminResponse(BaseModel):
    id: int
    user_id: int
    username: str
    video_id: str
    title: Optional[str]
    subtitle_count: int
    created_at: str

class StatsResponse(BaseModel):
    total_users: int
    active_users: int
    admin_users: int
    total_videos: int
    total_subtitles: int
    total_jobs: int
    jobs_queued: int
    jobs_processing: int
    jobs_done: int
    jobs_failed: int
    new_users_7d: int
    new_videos_7d: int

class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int


# ═══════════════════════════════════════
#  STATS — Dashboard overview
# ═══════════════════════════════════════

@router.get("/stats", response_model=StatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)

    total_users      = db.query(func.count(User.id)).scalar()
    active_users     = db.query(func.count(User.id)).filter(User.is_active == True).scalar()
    admin_users      = db.query(func.count(User.id)).filter(User.role == "admin").scalar()
    total_videos     = db.query(func.count(Video.id)).scalar()
    total_subtitles  = db.query(func.count(Subtitle.id)).scalar()
    total_jobs       = db.query(func.count(ProcessingJob.id)).scalar()
    jobs_queued      = db.query(func.count(ProcessingJob.id)).filter(ProcessingJob.status == "queued").scalar()
    jobs_processing  = db.query(func.count(ProcessingJob.id)).filter(ProcessingJob.status == "processing").scalar()
    jobs_done        = db.query(func.count(ProcessingJob.id)).filter(ProcessingJob.status == "done").scalar()
    jobs_failed      = db.query(func.count(ProcessingJob.id)).filter(ProcessingJob.status == "failed").scalar()
    new_users_7d     = db.query(func.count(User.id)).filter(User.created_at >= week_ago).scalar()
    new_videos_7d    = db.query(func.count(Video.id)).filter(Video.created_at >= week_ago).scalar()

    return StatsResponse(
        total_users=total_users, active_users=active_users, admin_users=admin_users,
        total_videos=total_videos, total_subtitles=total_subtitles,
        total_jobs=total_jobs, jobs_queued=jobs_queued, jobs_processing=jobs_processing,
        jobs_done=jobs_done, jobs_failed=jobs_failed,
        new_users_7d=new_users_7d, new_videos_7d=new_videos_7d,
    )


# ═══════════════════════════════════════
#  USERS
# ═══════════════════════════════════════

@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    q = db.query(User)
    if search:
        q = q.filter(
            (User.username.ilike(f"%{search}%")) |
            (User.email.ilike(f"%{search}%"))
        )
    if role:
        q = q.filter(User.role == role)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)

    total = q.count()
    users = q.order_by(desc(User.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for u in users:
        video_count = db.query(func.count(Video.id)).filter(Video.user_id == u.id).scalar()
        job_count   = db.query(func.count(ProcessingJob.id)).filter(ProcessingJob.user_id == u.id).scalar()
        items.append(UserAdminResponse(
            id=u.id, username=u.username, email=u.email,
            role=u.role, is_active=u.is_active,
            created_at=u.created_at.isoformat(),
            video_count=video_count, job_count=job_count,
        ))

    return {
        "items": [i.model_dump() for i in items],
        "total": total, "page": page, "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    body: UpdateUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy user.")
    # Không cho admin tự đổi role của chính mình
    if user.id == admin.id and body.role and body.role != "admin":
        raise HTTPException(status_code=400, detail="Không thể tự bỏ quyền admin của bản thân.")
    if body.role is not None:
        if body.role not in ("user", "admin"):
            raise HTTPException(status_code=400, detail="Role không hợp lệ.")
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    db.commit()
    return {"ok": True, "user_id": user_id}


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Không thể xoá tài khoản của chính mình.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy user.")
    db.delete(user)
    db.commit()


# ═══════════════════════════════════════
#  JOBS
# ═══════════════════════════════════════

@router.get("/jobs")
def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    q = db.query(ProcessingJob, User.username).join(
        User, ProcessingJob.user_id == User.id, isouter=True
    )
    if status:
        q = q.filter(ProcessingJob.status == status)
    if user_id:
        q = q.filter(ProcessingJob.user_id == user_id)

    total = q.count()
    rows  = q.order_by(desc(ProcessingJob.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for job, username in rows:
        items.append(JobAdminResponse(
            id=job.id, user_id=job.user_id, username=username or "?",
            status=job.status, progress=job.progress,
            youtube_url=job.youtube_url, title=job.title,
            subtitle_source=job.subtitle_source, llm_used=job.llm_used,
            error_message=job.error_message,
            created_at=job.created_at.isoformat(),
            finished_at=job.finished_at.isoformat() if job.finished_at else None,
        ).model_dump())

    return {
        "items": items, "total": total, "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("/jobs/{job_id}/retry")
def retry_job(
    job_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Không tìm thấy job.")
    if job.status != "failed":
        raise HTTPException(status_code=400, detail="Chỉ có thể retry job bị lỗi.")

    # Reset job về queued rồi push lại vào Celery
    job.status = "queued"
    job.progress = 0
    job.error_message = None
    job.finished_at = None
    db.commit()

    try:
        from worker.tasks import process_video_task
        task = process_video_task.delay(job.id, job.youtube_url, job.user_id)
        job.celery_task_id = task.id
        db.commit()
    except Exception as e:
        job.status = "failed"
        job.error_message = f"Retry failed: {str(e)}"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Không thể retry: {str(e)}")

    return {"ok": True, "job_id": job_id, "new_status": "queued"}


# ═══════════════════════════════════════
#  VIDEOS
# ═══════════════════════════════════════

@router.get("/videos")
def list_videos(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    q = db.query(Video, User.username).join(User, Video.user_id == User.id, isouter=True)
    if user_id:
        q = q.filter(Video.user_id == user_id)
    if search:
        q = q.filter(Video.title.ilike(f"%{search}%"))

    total = q.count()
    rows  = q.order_by(desc(Video.created_at)).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for video, username in rows:
        sub_count = db.query(func.count(Subtitle.id)).filter(Subtitle.video_id == video.id).scalar()
        items.append(VideoAdminResponse(
            id=video.id, user_id=video.user_id, username=username or "?",
            video_id=video.video_id, title=video.title,
            subtitle_count=sub_count,
            created_at=video.created_at.isoformat(),
        ).model_dump())

    return {
        "items": items, "total": total, "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.delete("/videos/{video_id}", status_code=204)
def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(get_current_admin),
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Không tìm thấy video.")
    db.delete(video)
    db.commit()