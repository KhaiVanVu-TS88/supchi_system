"""
worker/tasks_ocr.py — OCR & Handwriting Celery Tasks

Queue: ocr_queue (light tasks, CPU nhẹ hơn Whisper)
"""
import sys
sys.path.insert(0, "/app")

import logging
from celery.utils.log import get_task_logger
from worker.celery_app import celery_app, QUEUE_OCR

logger = get_task_logger(__name__)


@celery_app.task(
    bind=True,
    name="worker.tasks_ocr.ocr_image_task",
    queue=QUEUE_OCR,
    max_retries=2,
    soft_time_limit=60,
    hard_time_limit=120,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
)
def ocr_image_task(self, image_data_b64: str, user_id: int):
    """
    OCR task cho ảnh upload.

    Args:
        image_data_b64: Ảnh dạng base64
        user_id: ID user (cho logging)
    """
    from services.ocr_service import ocr_from_bytes
    import base64
    import io

    logger.info(f"OCR task started for user {user_id}")

    try:
        image_bytes = base64.b64decode(image_data_b64)
        result = ocr_from_bytes(image_bytes)
        logger.info(f"OCR task completed for user {user_id}")
        return result
    except Exception as e:
        logger.error(f"OCR task failed for user {user_id}: {e}")
        raise


@celery_app.task(
    bind=True,
    name="worker.tasks_ocr.handwriting_task",
    queue=QUEUE_OCR,
    max_retries=2,
    soft_time_limit=30,
    hard_time_limit=60,
    autoretry_for=(Exception,),
    retry_backoff=True,
)
def handwriting_task(self, canvas_data_b64: str, user_id: int):
    """
    Handwriting recognition task.

    Args:
        canvas_data_b64: Canvas PNG dạng base64
        user_id: ID user
    """
    from services.handwriting_service import recognize_handwriting
    import base64

    logger.info(f"Handwriting task started for user {user_id}")

    try:
        image_bytes = base64.b64decode(canvas_data_b64)
        result = recognize_handwriting(image_bytes)
        logger.info(f"Handwriting task completed for user {user_id}")
        return result
    except Exception as e:
        logger.error(f"Handwriting task failed for user {user_id}: {e}")
        raise
