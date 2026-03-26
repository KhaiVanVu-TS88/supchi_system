"""
services/video_cache.py — Video deduplication & processing cache

Kiến trúc:
  1. Trước khi tạo Job → kiểm tra Redis cache bằng video_id
  2. Nếu video đã xử lý thành công → trả về video_id cũ (không tạo job mới)
  3. Nếu video đang xử lý → trả về job_id cũ (đang chờ)
  4. Nếu video mới → cache key "processing:{video_id}" trong 10 phút

Cache keys:
  - done:{user_id}:{video_id}   → video_id (đã xử lý thành công)
  - processing:{video_id}        → job_id (đang xử lý, TTL 10 phút)
  - result:{video_id}            → JSON subtitle (kết quả, TTL 24 giờ)
"""
import json
import logging
from typing import Optional

try:
    import redis
    REDIS_URL = "redis://redis:6379/1"
    _redis = redis.from_url(REDIS_URL, decode_responses=True)
    REDIS_AVAILABLE = True
except Exception:
    _redis = None
    REDIS_AVAILABLE = False

logger = logging.getLogger(__name__)

# TTL settings
TTL_PROCESSING = 60 * 10    # 10 phút — job bị coi là fail nếu chưa xong
TTL_RESULT     = 60 * 60 * 24  # 24 giờ — kết quả subtitle được cache

# ── Key builders ──

def _key_done(user_id: int, video_id: str) -> str:
    return f"video:done:{user_id}:{video_id}"

def _key_processing(video_id: str) -> str:
    return f"video:processing:{video_id}"

def _key_result(video_id: str) -> str:
    return f"video:result:{video_id}"


# ── Check before creating job ──

class DuplicateCheckResult:
    """Kết quả kiểm tra duplicate."""
    NEW = "new"                      # Video mới hoàn toàn, tạo job bình thường
    ALREADY_DONE = "already_done"   # Đã xử lý thành công, trả về video_id cũ
    ALREADY_PROCESSING = "already_processing"  # Đang xử lý, trả về job_id cũ


def check_duplicate_video(user_id: int, video_id: str) -> tuple[DuplicateCheckResult, Optional[int]]:
    """
    Kiểm tra video đã được xử lý hoặc đang xử lý chưa.

    Returns:
        (DuplicateCheckResult, video_id_or_job_id hoặc None)
    """
    if not REDIS_AVAILABLE or _redis is None:
        return DuplicateCheckResult.NEW, None

    try:
        # 1. Đã xử lý thành công?
        done_key = _key_done(user_id, video_id)
        cached_video_id = _redis.get(done_key)
        if cached_video_id:
            logger.info(f"Cache HIT (done): user={user_id}, video={video_id}")
            return DuplicateCheckResult.ALREADY_DONE, int(cached_video_id)

        # 2. Đang xử lý?
        proc_key = _key_processing(video_id)
        cached_job_id = _redis.get(proc_key)
        if cached_job_id:
            logger.info(f"Cache HIT (processing): video={video_id}, job={cached_job_id}")
            return DuplicateCheckResult.ALREADY_PROCESSING, int(cached_job_id)

        return DuplicateCheckResult.NEW, None

    except Exception as e:
        logger.warning(f"Duplicate check failed: {e}")
        return DuplicateCheckResult.NEW, None


def mark_video_processing(video_id: str, job_id: int) -> bool:
    """Đánh dấu video đang được xử lý."""
    if not REDIS_AVAILABLE or _redis is None:
        return False
    try:
        key = _key_processing(video_id)
        _redis.setex(key, TTL_PROCESSING, str(job_id))
        logger.info(f"Marked processing: video={video_id}, job={job_id}")
        return True
    except Exception as e:
        logger.warning(f"Mark processing failed: {e}")
        return False


def mark_video_done(user_id: int, video_id: str, final_video_id: int) -> bool:
    """
    Đánh dấu video đã xử lý xong.
    Xóa key processing, ghi key done.
    """
    if not REDIS_AVAILABLE or _redis is None:
        return False
    try:
        pipe = _redis.pipeline()
        pipe.delete(_key_processing(video_id))
        pipe.setex(_key_done(user_id, video_id), TTL_RESULT, str(final_video_id))
        pipe.execute()
        logger.info(f"Marked done: user={user_id}, video={video_id} → id={final_video_id}")
        return True
    except Exception as e:
        logger.warning(f"Mark done failed: {e}")
        return False


def mark_video_failed(video_id: str) -> bool:
    """Xóa processing marker khi job fail (cho phép retry)."""
    if not REDIS_AVAILABLE or _redis is None:
        return False
    try:
        _redis.delete(_key_processing(video_id))
        logger.info(f"Cleared processing marker: video={video_id}")
        return True
    except Exception as e:
        logger.warning(f"Clear processing marker failed: {e}")
        return False


def cache_subtitle_result(video_id: str, subtitles: list[dict]) -> bool:
    """Cache kết quả subtitle để GET /videos/{id} nhanh hơn."""
    if not REDIS_AVAILABLE or _redis is None:
        return False
    try:
        key = _key_result(video_id)
        _redis.setex(key, TTL_RESULT, json.dumps(subtitles))
        return True
    except Exception as e:
        logger.warning(f"Cache subtitle failed: {e}")
        return False


def get_cached_subtitles(video_id: str) -> Optional[list[dict]]:
    """Lấy subtitles đã cache (dùng cho GET video detail)."""
    if not REDIS_AVAILABLE or _redis is None:
        return None
    try:
        key = _key_result(video_id)
        data = _redis.get(key)
        if data:
            return json.loads(data)
        return None
    except Exception as e:
        logger.warning(f"Get cached subtitles failed: {e}")
        return None


def invalidate_video_cache(user_id: int, video_id: str) -> bool:
    """Xóa cache khi user xóa video."""
    if not REDIS_AVAILABLE or _redis is None:
        return False
    try:
        pipe = _redis.pipeline()
        pipe.delete(_key_done(user_id, video_id))
        pipe.delete(_key_result(video_id))
        pipe.execute()
        return True
    except Exception:
        return False
