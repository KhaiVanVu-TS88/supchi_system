FROM python:3.11-slim

LABEL description="SuperChi4 Backend v3 — FastAPI + Celery + Whisper"

RUN apt-get update && apt-get install -y ffmpeg git curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir --upgrade yt-dlp

# Tải sẵn Whisper model khi build
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default: chạy API server
# Worker dùng command override trong docker-compose
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]