"""
worker/celery_app.py — Celery v4.0: Multiple Queues + Optimized Config

Queues:
  🔴 video_queue    — Heavy: Whisper, subtitle processing (15-20 phút)
  🟡 ocr_queue      — Light: EasyOCR, handwriting (3-5 phút)
  🔵 default        — Misc: cleanup, notifications

Worker commands:
  # Worker chỉ xử lý video (CPU-bound, RAM-heavy)
  celery -A worker.celery_app worker -Q video_queue --concurrency=1 --max-memory-per-child=4000000

  # Worker chỉ xử lý OCR (CPU nhẹ hơn)
  celery -A worker.celery_app worker -Q ocr_queue --concurrency=2 --max-memory-per-child=1500000

  # Worker xử lý tất cả (mặc định)
  celery -A worker.celery_app worker -Q video_queue,ocr_queue,celery
"""
import os
import sys

sys.path.insert(0, "/app")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

from celery import Celery

# ── Queue definitions ──
QUEUE_VIDEO = "video_queue"   # Heavy AI tasks
QUEUE_OCR   = "ocr_queue"     # Light OCR tasks
QUEUE_MISC  = "celery"        # System tasks (cleanup, etc.)

celery_app = Celery(
    "supchi4",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "worker.tasks",          # Video processing
        "worker.tasks_ocr",      # OCR tasks
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
celery_app.conf.task_acks_late = True        # Ack sau khi hoàn thành, không phải lúc nhận
celery_app.conf.worker_prefetch_multiplier = 1  # 1 task/worker — tránh task chờ lâu

# ── Retry policy ──
celery_app.conf.task_max_retries = 2
celery_app.conf.task_default_retry_delay = 30  # 30 giây

# ── Hard/Soft time limits ──
# Soft: gửi signal để task tự cleanup trước khi kill
# Hard: kill vô điều kiện
celery_app.conf.task_soft_time_limit = 900   # 15 phút soft
celery_app.conf.task_time_limit = 1200        # 20 phút hard

# ── Result expiration ──
celery_app.conf.result_expires = 60 * 60 * 24  # Kết quả hết hạn sau 24 giờ

# ── Queue routing mặc định ──
celery_app.conf.task_default_queue = QUEUE_MISC
celery_app.conf.task_default_exchange = "default"
celery_app.conf.task_default_routing_key = "default"

# ── Queue-specific rate limits ──
# Video queue: max 1 task mới mỗi 10 giây (tránh overload worker)
# OCR queue: max 5 tasks mới mỗi giây
celery_app.conf.task_routes = {
    "worker.tasks.process_video_task": {"queue": QUEUE_VIDEO, "routing_key": "video"},
    "worker.tasks_ocr.ocr_image_task": {"queue": QUEUE_OCR, "routing_key": "ocr"},
    "worker.tasks_ocr.handwriting_task": {"queue": QUEUE_OCR, "routing_key": "ocr"},
    "worker.tasks_cleanup.*": {"queue": QUEUE_MISC, "routing_key": "cleanup"},
}

# ── Periodic tasks (Celery Beat) ──
celery_app.conf.beat_schedule = {
    "cleanup-failed-jobs-every-hour": {
        "task": "worker.tasks_cleanup.cleanup_stale_jobs",
        "schedule": 3600.0,  # Mỗi giờ
        "options": {"queue": QUEUE_MISC},
    },
    "cleanup-old-results-every-6h": {
        "task": "worker.tasks_cleanup.cleanup_old_results",
        "schedule": 21600.0,  # Mỗi 6 giờ
        "options": {"queue": QUEUE_MISC},
    },
}

# ── Prometheus metrics (optional) ──
celery_app.conf.worker_send_task_events = True
celery_app.conf.task_send_sent_event = True
