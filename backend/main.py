import sys
sys.path.insert(0, "/app")

"""
main.py — FastAPI entry point v3.2
"""
import logging
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import get_settings
from core.database import create_tables
from routers import auth, videos, jobs, dictionary, ocr, admin, monitoring, pronunciation_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
settings = get_settings()


def _prewarm_all():
    try:
        from services.dictionary_service import ensure_loaded
        ensure_loaded()
    except Exception as e:
        logging.getLogger(__name__).error(f"Dictionary preload failed: {e}")
    try:
        from services.ocr_service import get_reader
        get_reader()
    except ImportError:
        pass
    except Exception as e:
        logging.getLogger(__name__).warning(f"EasyOCR prewarm failed: {e}")
    try:
        import jieba
        jieba.initialize()
    except Exception as e:
        logging.getLogger(__name__).warning(f"jieba prewarm failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
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
app.include_router(admin.router)
app.include_router(monitoring.router)
app.include_router(pronunciation_router.router)


@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "version": "3.2.0"}