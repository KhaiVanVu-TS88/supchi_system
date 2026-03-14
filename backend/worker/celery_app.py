"""
worker/celery_app.py — Celery app configuration
"""
import os
import sys

# Thêm /app vào sys.path để worker tìm được core/, models/, pipeline/
sys.path.insert(0, "/app")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

from celery import Celery

celery_app = Celery(
    "supchi4",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=["worker.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_max_retries=2,
    task_default_retry_delay=30,
    task_soft_time_limit=900,
    task_time_limit=1200,
    # Tắt warning broker_connection_retry
    broker_connection_retry_on_startup=True,
)