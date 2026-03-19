#!/bin/bash
# Khởi động Redis bind tất cả interfaces (để worker container kết nối được)
redis-server --daemonize yes \
    --bind 0.0.0.0 \
    --maxmemory 256mb \
    --maxmemory-policy allkeys-lru \
    --protected-mode no
echo "Redis started on 0.0.0.0:6379"

# Chạy FastAPI
exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1