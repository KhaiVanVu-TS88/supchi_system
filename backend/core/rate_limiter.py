"""
core/rate_limiter.py — Redis-based Rate Limiting

Sử dụng sliding window algorithm:
  - Sliding window tránh burst traffic ở boundary
  - Redis MULTI/EXEC đảm bảo atomicity
  - Tự động cleanup key hết hạn

Giới hạn mặc định:
  - Video: 5 requests / phút / user
  - Dict:  30 requests / phút / user
"""
import time
import logging
from functools import wraps
from fastapi import HTTPException, Request
from core.deps import get_current_user
from core.database import SessionLocal
from models.user import User

try:
    import redis
    REDIS_URL = "redis://redis:6379/1"  # DB 1 cho cache, tránh conflict với Celery
    _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    REDIS_AVAILABLE = True
except Exception:
    _redis_client = None
    REDIS_AVAILABLE = False

logger = logging.getLogger(__name__)


# ── Cấu hình giới hạn ──
class RateLimitConfig:
    # (max_requests, window_seconds)
    VIDEO    = (5,  60)   # 5 video/phút/user
    DICT     = (30, 60)   # 30 tra từ/phút/user
    AUTH     = (10, 60)   # 10 login/phút/IP


def _get_user_key(user_id: int, action: str) -> str:
    return f"ratelimit:{action}:user:{user_id}"


def _get_ip_key(request: Request, action: str) -> str:
    ip = request.client.host if request.client else "unknown"
    return f"ratelimit:{action}:ip:{ip}"


def _check_rate_limit(key: str, max_requests: int, window_seconds: int) -> tuple[bool, int, int]:
    """
    Sliding window rate limit với Redis.

    Returns: (allowed, remaining, retry_after_seconds)
    """
    if not REDIS_AVAILABLE or _redis_client is None:
        # Fallback: cho phép nếu Redis không khả dụng
        return True, max_requests, 0

    now = time.time()
    window_start = now - window_seconds

    pipe = _redis_client.pipeline()

    try:
        # 1. Xóa entries cũ ngoài window
        pipe.zremrangebyscore(key, 0, window_start)

        # 2. Đếm requests trong window
        pipe.zcard(key)

        # 3. Thêm request hiện tại
        pipe.zadd(key, {str(now): now})

        # 4. Set TTL cho key (cleanup tự động)
        pipe.expire(key, window_seconds + 1)

        results = pipe.execute()
        current_count = results[1]  # zcard result

        remaining = max(0, max_requests - current_count - 1)
        retry_after = 0

        if current_count >= max_requests:
            # Tính thời gian chờ đến request cũ nhất hết hạn
            oldest = _redis_client.zrange(key, 0, 0, withscores=True)
            if oldest:
                oldest_time = oldest[0][1]
                retry_after = int(oldest_time + window_seconds - now) + 1
            return False, 0, max(retry_after, 1)

        return True, remaining, 0

    except Exception as e:
        logger.warning(f"Rate limit Redis error: {e}")
        return True, max_requests, 0


def rate_limit(action: str, config: tuple[int, int]):
    """
    Decorator áp dụng rate limit cho endpoint.

    Usage:
        @router.post("/analyze")
        @rate_limit("VIDEO", RateLimitConfig.VIDEO)
        def analyze_video(...):
            ...
    """
    max_requests, window = config

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Tìm Request và User trong args/kwargs
            request = None
            user: User | None = None

            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break

            if request is None:
                request = kwargs.get("request")

            # Lấy user từ dependency
            try:
                db = SessionLocal()
                try:
                    user = await get_current_user.__call__(request=request, db=db)
                finally:
                    db.close()
            except Exception:
                pass

            if not request:
                return await func(*args, **kwargs)

            # Build key
            if user:
                key = _get_user_key(user.id, action)
            else:
                key = _get_ip_key(request, action)

            allowed, remaining, retry_after = _check_rate_limit(key, max_requests, window)

            if not allowed:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "error": "Too Many Requests",
                        "message": f"Bạn đã vượt giới hạn {max_requests} requests/{window}s cho thao tác này.",
                        "retry_after": retry_after,
                    },
                    headers={
                        "Retry-After": str(retry_after),
                        "X-RateLimit-Limit": str(max_requests),
                        "X-RateLimit-Remaining": "0",
                    }
                )

            # Gắn headers vào response
            result = await func(*args, **kwargs)

            # FastAPI response object có .headers
            if hasattr(result, "headers"):
                result.headers["X-RateLimit-Limit"] = str(max_requests)
                result.headers["X-RateLimit-Remaining"] = str(remaining)

            return result

        return wrapper
    return decorator


def get_rate_limit_headers(action: str, config: tuple[int, int]) -> dict:
    """Trả về dict headers rate limit (dùng cho middleware)."""
    max_requests, window = config
    return {
        "X-RateLimit-Limit": str(max_requests),
        "X-RateLimit-Window": f"{window}s",
    }
