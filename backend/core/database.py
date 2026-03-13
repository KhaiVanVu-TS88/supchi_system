"""
core/database.py — Kết nối database với SQLAlchemy

Hỗ trợ cả SQLite (development) và PostgreSQL (production).
Chỉ cần đổi DATABASE_URL trong .env là chạy được cả hai.
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from core.config import get_settings

settings = get_settings()

# ── Tạo engine ──
# SQLite cần check_same_thread=False vì FastAPI dùng nhiều thread
connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG,   # In SQL queries khi DEBUG=true
)

# ── Session factory ──
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ── Base class cho tất cả models ──
Base = declarative_base()


def get_db():
    """
    Dependency injection cho FastAPI.
    Mỗi request nhận một DB session riêng, đóng sau khi xử lý xong.

    Dùng:
        @app.get("/")
        def my_route(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Tạo tất cả bảng trong DB nếu chưa tồn tại."""
    from models import user, video  # noqa: F401 — import để SQLAlchemy biết models
    Base.metadata.create_all(bind=engine)
