"""
worker/tasks_cleanup.py — Cleanup & Maintenance Tasks

Chạy định kỳ qua Celery Beat:
  1. cleanup_stale_jobs    — Xóa jobs fail lâu (>2h), xóa Redis markers
  2. cleanup_old_results   — Xóa Redis cache subtitle cũ
  3. vacuum_database       — VACUUM SQLite/PostgreSQL (tối ưu disk)
  4. archive_old_videos    — Archive video cũ (>90 ngày) để giảm DB size

Cách chạy thủ công:
  celery -A worker.celery_app call worker.tasks_cleanup.cleanup_stale_jobs
  celery -A worker.celery_app call worker.tasks_cleanup.cleanup_old_results
"""
import sys
sys.path.insert(0, "/app")

import logging
from datetime import datetime, timezone, timedelta
from celery.utils.log import get_task_logger
from worker.celery_app import celery_app, QUEUE_MISC

logger = get_task_logger(__name__)


@celery_app.task(
    name="worker.tasks_cleanup.cleanup_stale_jobs",
    queue=QUEUE_MISC,
    max_retries=1,
    soft_time_limit=120,
)
def cleanup_stale_jobs():
    """
    Dọn dẹp jobs fail lâu và Redis markers.

    Logic:
    1. Tìm jobs "processing" kéo dài > 30 phút → đánh dấu "failed"
    2. Xóa Redis processing markers hết hạn
    3. Xóa jobs "queued" cũ hơn 24 giờ (user có thể đã bỏ đi)
    """
    from core.database import SessionLocal
    from models.job import ProcessingJob
    from services.video_cache import mark_video_failed

    db = SessionLocal()
    cleaned = 0

    try:
        now = datetime.now(timezone.utc)
        stale_threshold = now - timedelta(minutes=30)
        old_queued_threshold = now - timedelta(hours=24)

        # 1. Jobs đang "processing" nhưng đã quá 30 phút → fail
        stale_processing = (
            db.query(ProcessingJob)
            .filter(
                ProcessingJob.status == "processing",
                ProcessingJob.updated_at < stale_threshold,
            )
            .all()
        )

        for job in stale_processing:
            job.status = "failed"
            job.error_message = "Job bị timeout do hệ thống cleanup (quá 30 phút)."
            job.finished_at = now
            # Xóa Redis marker để cho phép retry
            mark_video_failed(job.youtube_url)
            cleaned += 1
            logger.warning(f"Marked stale job {job.id} as failed")

        # 2. Jobs "queued" cũ hơn 24 giờ → xóa
        old_queued = (
            db.query(ProcessingJob)
            .filter(
                ProcessingJob.status == "queued",
                ProcessingJob.created_at < old_queued_threshold,
            )
            .all()
        )

        for job in old_queued:
            mark_video_failed(job.youtube_url)
            db.delete(job)
            cleaned += 1

        db.commit()
        logger.info(f"Cleanup complete: {cleaned} stale jobs cleaned")

    except Exception as e:
        logger.error(f"Cleanup failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()

    return {"cleaned": cleaned}


@celery_app.task(
    name="worker.tasks_cleanup.cleanup_old_results",
    queue=QUEUE_MISC,
    max_retries=1,
    soft_time_limit=60,
)
def cleanup_old_results():
    """
    Dọn Redis cache cũ.

    Xóa keys video:result:* đã hết hạn nhưng có thể chưa được Redis TTL xóa.
    Thực ra Redis TTL tự xóa, nhưng kiểm tra để logging.
    """
    try:
        import redis
        REDIS_URL = "redis://redis:6379/1"
        r = redis.from_url(REDIS_URL, decode_responses=True)

        # Đếm keys cache
        info = r.info("memory")
        logger.info(f"Redis memory: {info.get('used_memory_human', 'N/A')}")

        # Scan và đếm video cache keys
        cursor = 0
        video_keys = 0
        while True:
            cursor, keys = r.scan(cursor, match="video:*", count=100)
            video_keys += len(keys)
            if cursor == 0:
                break

        logger.info(f"Video cache keys in Redis: {video_keys}")
        return {"video_cache_keys": video_keys}

    except Exception as e:
        logger.warning(f"Redis cleanup check failed: {e}")
        return {"error": str(e)}


@celery_app.task(
    name="worker.tasks_cleanup.vacuum_database",
    queue=QUEUE_MISC,
    max_retries=1,
    soft_time_limit=300,
)
def vacuum_database():
    """
    VACUUM database để giải phóng disk space.
    """
    from core.database import engine
    from core.config import get_settings
    from sqlalchemy import text

    settings = get_settings()
    db_url = settings.DATABASE_URL

    try:
        if db_url.startswith("postgresql"):
            # PostgreSQL: dùng connection level execute
            with engine.connect() as conn:
                conn.execute(text("VACUUM ANALYZE"))
            logger.info("PostgreSQL VACUUM ANALYZE completed")
        elif db_url.startswith("sqlite"):
            # SQLite: dùng raw connection để bỏ qua SQLAlchemy
            with engine.connect() as conn:
                raw_conn = conn.connection.dbapi_connection
                raw_conn.execute("VACUUM")
            logger.info("SQLite VACUUM completed")

        return {"status": "ok"}

    except Exception as e:
        logger.error(f"VACUUM failed: {e}")
        raise


@celery_app.task(
    name="worker.tasks_cleanup.archive_old_videos",
    queue=QUEUE_MISC,
    max_retries=1,
    soft_time_limit=300,
)
def archive_old_videos(days: int = 90):
    """
    Archive video cũ (soft delete + ghi log).

    Videos được soft delete từ trước → đánh dấu permanent_deleted sau N ngày.
    Hoặc videos không có subtitles + > 30 ngày → auto-archive.

    Args:
        days: Số ngày không hoạt động trước khi archive
    """
    from core.database import SessionLocal
    from models.video import Video
    from models.job import ProcessingJob

    db = SessionLocal()
    archived = 0

    try:
        threshold = datetime.now(timezone.utc) - timedelta(days=days)

        # Videos đã soft-delete nhưng chưa permanent
        old_deleted = (
            db.query(Video)
            .filter(
                Video.is_deleted == 1,
                Video.deleted_at < threshold,
            )
            .all()
        )

        for video in old_deleted:
            # Xóa vĩnh viễn (hoặc move sang bảng archive)
            db.delete(video)
            archived += 1
            logger.info(f"Archived video {video.id}")

        db.commit()
        logger.info(f"Archived {archived} old videos")
        return {"archived": archived}

    except Exception as e:
        logger.error(f"Archive failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()
