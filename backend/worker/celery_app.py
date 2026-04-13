"""
worker/celery_app.py — Celery v2.0: Video Queue + Optimized Config

Queues:
  red    video_queue    — Heavy: Whisper, subtitle processing
  blue   default        — Misc: cleanup, notifications

Worker commands:
  # Worker xu ly video
  celery -A worker.celery_app worker -Q video_queue --concurrency=1 --max-memory-per-child=4000000

  # Worker xu ly tat ca (mac dinh)
  celery -A worker.celery_app worker -Q video_queue,celery
"""
import os
import sys

sys.path.insert(0, "/app")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

from celery import Celery

# ── Queue definitions ──
QUEUE_VIDEO = "video_queue"   # Heavy AI tasks
QUEUE_MISC  = "celery"        # System tasks (cleanup, etc.)

celery_app = Celery(
    "supchi4",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "worker.tasks",          # Video processing
        "worker.tasks_cleanup",   # Cleanup tasks
    ],
)

# ── Broker settings ──
celery_app.conf.broker_connection_retry_on_startup = True

# ── Serialization ──
celery_app.conf.task_serializer = "json"
celery_app.conf.result_serializer = "json"
celery_app.conf.accept_content = ["json"]

# ── Timezone ──
celery_app.conf.timezone = "UTC"
celery_app.conf.enable_utc = True

# ── Task tracking ──
celery_app.conf.task_track_started = True
celery_app.conf.task_acks_late = True
celery_app.conf.worker_prefetch_multiplier = 1

# ── Retry policy ──
celery_app.conf.task_max_retries = 2
celery_app.conf.task_default_retry_delay = 30

# ── Hard/Soft time limits ──
celery_app.conf.task_soft_time_limit = 900
celery_app.conf.task_time_limit = 1200

# ── Result expiration ──
celery_app.conf.result_expires = 60 * 60 * 24

# ── Queue routing mac dinh ──
celery_app.conf.task_default_queue = QUEUE_MISC
celery_app.conf.task_default_exchange = "default"
celery_app.conf.task_default_routing_key = "default"

# ── Queue-specific rate limits ──
celery_app.conf.task_routes = {
    "worker.tasks.process_video_task": {"queue": QUEUE_VIDEO, "routing_key": "video"},
    "worker.tasks_cleanup.*": {"queue": QUEUE_MISC, "routing_key": "cleanup"},
}

# ── Periodic tasks (Celery Beat) ──
celery_app.conf.beat_schedule = {
    "cleanup-failed-jobs-every-hour": {
        "task": "worker.tasks_cleanup.cleanup_stale_jobs",
        "schedule": 3600.0,
        "options": {"queue": QUEUE_MISC},
    },
    "cleanup-old-results-every-6h": {
        "task": "worker.tasks_cleanup.cleanup_old_results",
        "schedule": 21600.0,
        "options": {"queue": QUEUE_MISC},
    },
}

# ── Prometheus metrics (optional) ──
celery_app.conf.worker_send_task_events = True
celery_app.conf.task_send_sent_event = True
