"""
backend-adapter/api_server.py

FastAPI wrapper xung quanh pipeline Python đã có sẵn.
Expose một endpoint duy nhất: POST /api/analyze

Cách chạy standalone (không Docker):
    pip install fastapi uvicorn
    uvicorn api_server:app --host 0.0.0.0 --port 8000 --reload

QUAN TRỌNG: File này đặt trong thư mục chinese-learning-app/
(cùng cấp với pipeline.py) khi deploy.
"""

import sys
import os

# Thêm thư mục gốc của backend vào Python path
# Để import được pipeline.py và modules/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl
from typing import List
import logging

# Import pipeline đã có sẵn
from pipeline import process_video

# ===== LOGGING =====
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ===== FASTAPI APP =====
app = FastAPI(
    title="Chinese Learning API",
    description="API xử lý video YouTube → subtitle tiếng Trung + Pinyin + tiếng Việt",
    version="1.0.0"
)

# ===== CORS: cho phép Next.js frontend gọi =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://frontend:3000",
        "*"  # Có thể giới hạn lại khi deploy production
    ],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

# ===== MODELS =====

class AnalyzeRequest(BaseModel):
    """Request body: chứa URL YouTube cần xử lý"""
    url: str

    class Config:
        json_schema_extra = {
            "example": {
                "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            }
        }

class SubtitleItem(BaseModel):
    """Một subtitle segment"""
    start: float
    end: float
    chinese: str
    pinyin: str
    vietnamese: str

class AnalyzeResponse(BaseModel):
    """Response: danh sách subtitles + metadata"""
    subtitles: List[SubtitleItem]
    total_segments: int
    video_id: str

# ===== HELPER: lấy video ID từ URL =====
def extract_video_id(url: str) -> str:
    import re
    patterns = [
        r'[?&]v=([\w-]{11})',
        r'youtu\.be/([\w-]{11})',
        r'embed/([\w-]{11})',
    ]
    for pattern in patterns:
        m = re.search(pattern, url)
        if m:
            return m.group(1)
    return "unknown"

# ===== ENDPOINTS =====

@app.get("/health")
def health_check():
    """Health check endpoint cho Docker"""
    return {"status": "ok", "service": "chinese-learning-api"}

@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_video(request: AnalyzeRequest):
    """
    Phân tích video YouTube và trả về subtitles.

    Pipeline:
    1. Tải audio từ YouTube (yt-dlp)
    2. Nhận dạng giọng nói (Whisper)
    3. Chuyển đổi Pinyin (pypinyin)
    4. Dịch tiếng Việt (Google Translate)
    """
    url = request.url.strip()
    logger.info(f"Analyzing video: {url}")

    if not url:
        raise HTTPException(status_code=400, detail="URL không được để trống.")

    try:
        # Gọi pipeline đã có sẵn
        subtitles = process_video(url)

        if not subtitles:
            raise HTTPException(
                status_code=422,
                detail="Không nhận dạng được giọng nói. Hãy thử video khác."
            )

        video_id = extract_video_id(url)
        logger.info(f"Done: {len(subtitles)} segments for {video_id}")

        return AnalyzeResponse(
            subtitles=[SubtitleItem(**s) for s in subtitles],
            total_segments=len(subtitles),
            video_id=video_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Pipeline error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))