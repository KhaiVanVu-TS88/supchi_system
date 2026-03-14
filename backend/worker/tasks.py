"""
worker/tasks.py — Celery Tasks
"""
import sys
sys.path.insert(0, "/app")

# Import TẤT CẢ models ngay từ đầu để SQLAlchemy registry đầy đủ
# trước khi bất kỳ query nào chạy
import models.user   # noqa: F401
import models.video  # noqa: F401
import models.job    # noqa: F401

import logging
from datetime import datetime, timezone
from celery.utils.log import get_task_logger
from worker.celery_app import celery_app

logger = get_task_logger(__name__)


@celery_app.task(
    bind=True,
    name="worker.tasks.process_video_task",
    max_retries=1,
)
def process_video_task(self, job_id: int):
    """Celery task xử lý video YouTube trong background."""
    from core.database import SessionLocal
    from models.job import ProcessingJob
    from models.video import Video, Subtitle

    db = SessionLocal()
    job = None

    try:
        job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
        if not job:
            logger.error(f"Job {job_id} not found")
            return

        url = job.youtube_url

        job.status         = "processing"
        job.progress       = 5.0
        job.celery_task_id = self.request.id
        db.commit()
        logger.info(f"Job {job_id} started: {url}")

        def on_progress(pct: float, stage: str):
            try:
                db.query(ProcessingJob).filter(ProcessingJob.id == job_id).update(
                    {"progress": pct}, synchronize_session=False
                )
                db.commit()
            except Exception as e:
                logger.warning(f"Progress update failed: {e}")

        from pipeline.orchestrator import run_pipeline
        result = run_pipeline(url, progress_cb=on_progress)

        subtitles  = result["subtitles"]
        sub_source = result["subtitle_source"]
        llm_used   = result["llm_used"]

        if not subtitles:
            raise ValueError("Pipeline không tạo được subtitle nào.")

        from pipeline.youtube import get_video_id
        vid       = get_video_id(url)
        thumbnail = f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"

        video = Video(
            user_id=job.user_id,
            youtube_url=url,
            video_id=vid,
            title=job.title or f"Video {vid}",
            thumbnail_url=thumbnail,
        )
        db.add(video)
        db.flush()

        db.bulk_save_objects([
            Subtitle(
                video_id=video.id,
                start_time=s["start"],
                end_time=s["end"],
                chinese=s["chinese"],
                pinyin=s["pinyin"],
                vietnamese=s["vietnamese"],
            )
            for s in subtitles
        ])

        job.status          = "done"
        job.progress        = 100.0
        job.video_id        = video.id
        job.subtitle_source = sub_source
        job.llm_used        = "yes" if llm_used else "no"
        job.finished_at     = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"Job {job_id} done: video_id={video.id}, {len(subtitles)} subtitles, source={sub_source}")

    except Exception as exc:
        logger.error(f"Job {job_id} failed: {exc}", exc_info=True)
        try:
            db.query(ProcessingJob).filter(ProcessingJob.id == job_id).update({
                "status": "failed",
                "error_message": str(exc)[:500],
                "finished_at": datetime.now(timezone.utc),
            }, synchronize_session=False)
            db.commit()
        except Exception as db_err:
            logger.error(f"Failed to update job status: {db_err}")
        raise

    finally:
        db.close()