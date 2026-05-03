# FROM python:3.11-slim

# LABEL description="SuperChi4 Backend v3 — FastAPI + Celery + Whisper"

# RUN apt-get update && apt-get install -y ffmpeg git curl \
#     && apt-get clean && rm -rf /var/lib/apt/lists/*

# WORKDIR /app

# COPY requirements.txt .
# RUN pip install --no-cache-dir --upgrade pip \
#     && pip install --no-cache-dir -r requirements.txt \
#     && pip install --no-cache-dir --upgrade yt-dlp

# # Tải sẵn Whisper model khi build
# RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', device='cpu', compute_type='int8')"

# COPY . .

# EXPOSE 8000

# HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
#     CMD curl -f http://localhost:8000/health || exit 1

# # Default: chạy API server
# # Worker dùng command override trong docker-compose
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
FROM python:3.11-slim

LABEL description="SuperChi4 Backend v3"

# Deno cho yt-dlp EJS — zip GitHub (ổn định hơn curl deno.land/install.sh, build fail nếu thiếu file).
# Đổi DENO_VER khi cần: https://github.com/denoland/deno/releases (≥ 2.0 cho yt-dlp).
ARG DENO_VER=v2.7.14
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        ffmpeg git curl unzip ca-certificates redis-server; \
    ARCH=$(dpkg --print-architecture); \
    case "$ARCH" in \
        amd64) DENO_ARCH=x86_64-unknown-linux-gnu ;; \
        arm64) DENO_ARCH=aarch64-unknown-linux-gnu ;; \
        *) echo "unsupported arch: $ARCH"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/denoland/deno/releases/download/${DENO_VER}/deno-${DENO_ARCH}.zip" -o /tmp/deno.zip; \
    unzip -o /tmp/deno.zip -d /usr/local/bin; \
    chmod +x /usr/local/bin/deno; \
    rm -f /tmp/deno.zip; \
    deno --version; \
    apt-get clean; rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    -i https://pypi.tuna.tsinghua.edu.cn/simple && \
    pip install --no-cache-dir -r requirements.txt \
    -i https://pypi.tuna.tsinghua.edu.cn/simple

# Không tải Whisper trong build (tránh timeout HuggingFace khi build).
# Model "small" được tải lần đầu khi worker chạy transcribe; cache trong volume whisper_cache.
# docker-compose đặt HF_ENDPOINT (vd. hf-mirror.com) cho runtime.

COPY . .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["/app/start.sh"]