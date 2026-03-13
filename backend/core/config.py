"""
core/config.py — Cấu hình toàn bộ ứng dụng

Đọc từ biến môi trường, có giá trị mặc định cho development.
"""
import os
from functools import lru_cache


class Settings:
    # ── App ──
    APP_NAME: str = "SuperChi4 API"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = os.getenv("DEBUG", "false").lower() == "true"

    # ── JWT ──
    # QUAN TRỌNG: đổi SECRET_KEY thành chuỗi ngẫu nhiên dài khi deploy production
    SECRET_KEY: str = os.getenv("SECRET_KEY", "supchi4-secret-change-in-production-please")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
    REFRESH_TOKEN_EXPIRE_DAYS: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))

    # ── Database ──
    # Mặc định SQLite cho development, đổi sang PostgreSQL cho production
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite:///./supchi4.db"  # File DB nằm trong thư mục /app khi chạy Docker
    )

    # ── CORS ──
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://frontend:3000",
        os.getenv("FRONTEND_URL", ""),
    ]


@lru_cache()
def get_settings() -> Settings:
    """Singleton settings — chỉ tạo một lần, cache lại."""
    return Settings()
