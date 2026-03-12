# ===== BACKEND DOCKERFILE =====
# Python 3.11 + ffmpeg + FastAPI + Whisper AI

FROM python:3.11-slim

LABEL description="Chinese Learning Backend — FastAPI + Whisper"
LABEL version="2.0"

# Cài system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg git curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# Cài Python packages + luôn upgrade yt-dlp mới nhất
# (YouTube đổi API liên tục → yt-dlp cũ sẽ lỗi 403)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir --upgrade yt-dlp

# Tải sẵn Whisper model "small" khi build image
# Tránh chờ download khi chạy lần đầu
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Chạy FastAPI bằng uvicorn
CMD ["uvicorn", "api_server:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1"]