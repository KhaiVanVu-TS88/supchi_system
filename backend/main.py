"""
main.py — FastAPI entry point v3.1 + Dictionary
"""
import sys
import os
sys.path.insert(0, "/app")   # Đảm bảo tất cả submodule đều tìm được

import logging
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import get_settings
from core.database import create_tables
from routers import auth, videos, jobs, dictionary

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    # Pre-load CC-CEDICT ở startup (background thread, không block)
    def load_dict():
        try:
            from services.dictionary_service import ensure_loaded
            ensure_loaded()
        except Exception as e:
            logging.getLogger(__name__).error(f"Dictionary preload failed: {e}")
    threading.Thread(target=load_dict, daemon=True).start()
    yield


app = FastAPI(title=settings.APP_NAME, version="3.1.0", lifespan=lifespan)

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


@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "version": "3.1.0"}