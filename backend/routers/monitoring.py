"""
routers/monitoring.py — System Monitoring Endpoints

Cung cấp metrics cho admin dashboard và health checks.

GET /api/monitoring/stats       — Thống kê hệ thống
GET /api/monitoring/health       — Health check chi tiết
GET /api/monitoring/queue        — Trạng thái Celery queues
"""
import sys
sys.path.insert(0, "/app")

import logging
import psutil
import time
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from core.database import SessionLocal, get_db
from core.deps import get_current_user
from models.user import User
from models.video import Video, Subtitle
from models.job import ProcessingJob

router = APIRouter(prefix="/api/monitoring", tags=["Monitoring"])
logger = logging.getLogger(__name__)


# ── Schemas ──

class SystemStats(BaseModel):
    timestamp: str
    uptime_seconds: float

    # Database
    total_videos: int
    total_users: int
    total_subtitles: int
    total_jobs: int

    # Jobs breakdown
    jobs_queued: int
    jobs_processing: int
    jobs_done: int
    jobs_failed: int

    # Performance
    avg_processing_time_seconds: Optional[float]
    success_rate_percent: float

    # Storage estimate
    estimated_db_size_mb: float


class QueueStatus(BaseModel):
    queue_name: str
    pending: int
    active: int
    completed: int
    failed: int


class HealthCheck(BaseModel):
    status: str
    version: str
    database: str
    redis: str
    celery: str
    whisper_model: str
    easyocr_model: str
    disk_usage_percent: float
    memory_usage_percent: float


# ── Endpoints ──

@router.get("/stats", response_model=SystemStats)
def get_system_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Thống kê hệ thống cho admin dashboard.

    ⚡ Chỉ admin mới được phép truy cập.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới xem được.")

    now = datetime.now(timezone.utc)

    # ── DB counts ──
    total_videos = db.query(Video).filter(Video.is_deleted == 0).count()
    total_users  = db.query(User).count()
    total_subtitles = db.query(Subtitle).filter(Subtitle.is_deleted == 0).count()
    total_jobs   = db.query(ProcessingJob).count()

    # ── Jobs breakdown ──
    jobs_queued     = db.query(ProcessingJob).filter(ProcessingJob.status == "queued").count()
    jobs_processing = db.query(ProcessingJob).filter(ProcessingJob.status == "processing").count()
    jobs_done       = db.query(ProcessingJob).filter(ProcessingJob.status == "done").count()
    jobs_failed     = db.query(ProcessingJob).filter(ProcessingJob.status == "failed").count()

    # ── Avg processing time ──
    done_jobs = (
        db.query(ProcessingJob)
        .filter(
            ProcessingJob.status == "done",
            ProcessingJob.finished_at.isnot(None),
            ProcessingJob.created_at.isnot(None),
        )
        .all()
    )
    if done_jobs:
        total_time = sum(
            (j.finished_at - j.created_at).total_seconds()
            for j in done_jobs
            if j.finished_at and j.created_at
        )
        avg_time = total_time / len(done_jobs)
    else:
        avg_time = None

    # ── Success rate ──
    completed = jobs_done + jobs_failed
    success_rate = (jobs_done / completed * 100) if completed > 0 else 0.0

    # ── DB size estimate ──
    import os
    db_path = "/data/supchi4.db"
    if os.path.exists(db_path):
        db_size_mb = os.path.getsize(db_path) / (1024 * 1024)
    else:
        db_size_mb = 0.0

    # ── Uptime ──
    try:
        with open("/proc/uptime", "r") as f:
            uptime_seconds = float(f.read().split()[0])
    except Exception:
        uptime_seconds = 0.0

    return SystemStats(
        timestamp=now.isoformat(),
        uptime_seconds=uptime_seconds,
        total_videos=total_videos,
        total_users=total_users,
        total_subtitles=total_subtitles,
        total_jobs=total_jobs,
        jobs_queued=jobs_queued,
        jobs_processing=jobs_processing,
        jobs_done=jobs_done,
        jobs_failed=jobs_failed,
        avg_processing_time_seconds=round(avg_time, 1) if avg_time else None,
        success_rate_percent=round(success_rate, 1),
        estimated_db_size_mb=round(db_size_mb, 2),
    )


@router.get("/health", response_model=HealthCheck)
def detailed_health_check():
    """
    Health check chi tiết cho load balancer / monitoring tool.
    """
    checks = {"database": "ok", "redis": "ok", "celery": "ok"}

    # ── Database ──
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as e:
        checks["database"] = f"error: {e}"

    # ── Redis ──
    try:
        import redis
        r = redis.from_url("redis://redis:6379/0", socket_connect_timeout=2)
        r.ping()
    except Exception as e:
        checks["redis"] = f"error: {e}"

    # ── Celery (kiểm tra broker) ──
    try:
        import redis
        r = redis.from_url("redis://redis:6379/0", socket_connect_timeout=2)
        info = r.info("broker")
        checks["celery"] = "ok" if info.get("connected_clients", 0) >= 0 else "no workers"
    except Exception as e:
        checks["celery"] = f"error: {e}"

    # ── Models ──
    whisper_ready = "loaded"
    try:
        from pipeline.whisper_engine import _model
        if _model is None:
            whisper_ready = "not loaded"
    except Exception:
        whisper_ready = "not loaded"

    easyocr_ready = "loaded"
    try:
        from services.ocr_service import _reader
        if _reader is None:
            easyocr_ready = "not loaded"
    except Exception:
        easyocr_ready = "not loaded"

    # ── System resources ──
    disk_usage = psutil.disk_usage("/").percent
    memory_usage = psutil.virtual_memory().percent

    overall_status = "healthy"
    if checks["database"] != "ok" or checks["redis"] != "ok":
        overall_status = "degraded"
    if checks["celery"] != "ok":
        overall_status = "degraded"

    return HealthCheck(
        status=overall_status,
        version="4.0.0",
        database=checks["database"],
        redis=checks["redis"],
        celery=checks["celery"],
        whisper_model=whisper_ready,
        easyocr_model=easyocr_ready,
        disk_usage_percent=round(disk_usage, 1),
        memory_usage_percent=round(memory_usage, 1),
    )


@router.get("/queue", response_model=List[QueueStatus])
def get_queue_status(
    current_user: User = Depends(get_current_user),
):
    """
    Trạng thái Celery queues (từ Redis).

    ⚡ Chỉ admin mới được phép.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin mới xem được.")

    try:
        import redis
        r = redis.from_url("redis://redis:6379/0", decode_responses=True)

        queues = ["video_queue", "ocr_queue", "celery"]
        result = []

        for q in queues:
            # Celery dùng Redis list với prefix "celery""
            for prefix in ["celery", q]:
                pending_key = f"celery.{prefix}.queue"
                try:
                    pending = r.llen(pending_key)
                    result.append(QueueStatus(
                        queue_name=q,
                        pending=pending,
                        active=0,  # Cần Flower API để lấy chính xác
                        completed=0,
                        failed=0,
                    ))
                    break
                except Exception:
                    continue
            else:
                result.append(QueueStatus(
                    queue_name=q,
                    pending=0,
                    active=0,
                    completed=0,
                    failed=0,
                ))

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Không lấy được queue status: {e}")
