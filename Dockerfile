# ===== DOCKERFILE =====
FROM python:3.11-slim

LABEL description="Ứng dụng học tiếng Trung qua YouTube"
LABEL version="1.1"

# Cài ffmpeg và các tool cần thiết
RUN apt-get update && apt-get install -y \
    ffmpeg git curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

# Cài thư viện Python + LUÔN upgrade yt-dlp mới nhất
# YouTube thay đổi API liên tục → yt-dlp cũ bị lỗi 403 Forbidden
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir --upgrade yt-dlp

# Tải sẵn Whisper model khi build (tránh chờ lúc chạy)
RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

COPY . .

EXPOSE 8501

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8501/_stcore/health || exit 1

CMD ["streamlit", "run", "app.py", \
     "--server.address=0.0.0.0", \
     "--server.port=8501", \
     "--server.headless=true", \
     "--browser.gatherUsageStats=false"]