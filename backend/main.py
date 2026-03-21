import sys
sys.path.insert(0, "/app")

"""
main.py — FastAPI entry point v3.2 (optimized startup)
Pre-warm tất cả models khi startup để request đầu tiên không bị chậm.
"""
import logging
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import get_settings
from core.database import create_tables
from routers import auth, videos, jobs, dictionary, ocr

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
settings = get_settings()


def _prewarm_all():
    """Pre-load tất cả models trong background thread khi startup."""
    # 1. CC-CEDICT dictionary
    try:
        from services.dictionary_service import ensure_loaded
        ensure_loaded()
    except Exception as e:
        logging.getLogger(__name__).error(f"Dictionary preload failed: {e}")

    # 2. EasyOCR model (nếu đã cài)
    try:
        from services.ocr_service import get_reader
        get_reader()
        logging.getLogger(__name__).info("EasyOCR pre-warmed.")
    except ImportError:
        pass  # EasyOCR chưa cài — bỏ qua
    except Exception as e:
        logging.getLogger(__name__).warning(f"EasyOCR prewarm failed: {e}")

    # 3. jieba (load dict lần đầu)
    try:
        import jieba
        jieba.initialize()
        logging.getLogger(__name__).info("jieba pre-warmed.")
    except Exception as e:
        logging.getLogger(__name__).warning(f"jieba prewarm failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    # Pre-warm tất cả trong background (không block startup)
    threading.Thread(target=_prewarm_all, daemon=True, name="prewarm").start()
    yield


app = FastAPI(title=settings.APP_NAME, version="3.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in settings.CORS_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(videos.router)
app.include_router(jobs.router)
app.include_router(dictionary.router)
app.include_router(ocr.router)


@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "version": "3.2.0"}