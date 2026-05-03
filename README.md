# 學中文 — Học tiếng Trung (YouTube + công cụ phụ trợ)

Web học tiếng Trung: phân tích video YouTube → phụ đề (chữ Hán / Pinyin / tiếng Việt), tra từ điển, OCR/viết tay, luyện phát âm, tài khoản và admin.  
Stack: **Next.js 14** (frontend), **FastAPI** (API), **Redis**, **Celery** (worker video + OCR), **SQLite** (dev) / PostgreSQL (prod).

---

## Các module trong project

| Module | Frontend | Backend (REST) | Ghi chú |
|--------|----------|----------------|---------|
| Video + phụ đề | `/` | `/api/videos`, `/api/jobs` | yt-dlp, Whisper khi cần, pypinyin, dịch Việt |
| Lịch sử | `/history`, `/history/[id]` | Cùng API video | Danh sách / xem lại |
| Từ điển | `/dictionary` | `/api/dictionary` | CC-CEDICT + segment + audio |
| OCR & viết tay | `/ocr` | `/api/ocr` | EasyOCR + handwriting |
| Phát âm | `/pronunciation` | `/api/pronunciation` | Kiểm tra phát âm |
| Đăng nhập | `/auth/login`, `/auth/register` | `/api/auth` | JWT |
| Admin | `/admin/*` | `/api/admin` | Dashboard (tuỳ triển khai menu) |
| Giám sát Celery | — | Flower (profile) | `docker compose --profile monitoring` → `:5555` |

---

## Kiến trúc tóm tắt

```
Browser (Next.js :3000)
        │ HTTP
        ▼
FastAPI (:8000) ──► SQLite/PostgreSQL
        │
        ├── Redis (broker + cache + rate limit)
        └── Celery: worker-video (video_queue), worker-ocr (ocr_queue), celery-beat
```

Pipeline xử lý video (không có bước LLM tích hợp trong orchestrator hiện tại): **subtitle/caption YouTube → Whisper (fallback) → pypinyin → dịch zh→vi**.

---

## Chạy nhanh (Docker)

```bash
cd chinese-learning-app
cp .env.example .env   # chỉnh SECRET_KEY và các biến cần thiết
docker compose up --build
```

| URL | Mô tả |
|-----|--------|
| http://localhost:3000 | Frontend |
| http://localhost:8000 | API |
| http://localhost:8000/docs | Swagger |

Flower (tuỳ chọn): `docker compose --profile monitoring up --build` → http://localhost:5555  

**Frontend build trong Docker:** đã có `.dockerignore` và Dockerfile tối ưu bộ nhớ; nếu `next build` bị SIGBUS, tăng RAM cho Docker Desktop (khuyến nghị ≥ 4 GB).

---

## Chạy local (không Docker)

```bash
# Backend
cd backend && python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Celery worker (terminal khác)
celery -A worker.celery_app worker --loglevel=info -Q video_queue,ocr_queue,celery

# Celery Beat (terminal khác)
celery -A worker.celery_app beat --loglevel=info

# Frontend
cd frontend && npm install && npm run dev
```

---

## Biến môi trường

Xem **`/.env.example`**. Các mục thường dùng:

- `SECRET_KEY` — bắt buộc đổi khi deploy.
- `NEXT_PUBLIC_BACKEND_URL` — URL API mà trình duyệt gọi (vd. `http://localhost:8000`).
- `VIDEO_DURATION_WARNING_MINUTES` — video dài hơn ngưỡng → API yêu cầu xác nhận trước khi tạo job (mặc định thường 20; có thể set trong `docker-compose` cho service backend).

Proxy / mirror (tuỳ mạng): cấu hình trong `docker-compose.yml` hoặc `.env` nếu cần (HTTP_PROXY, `HF_ENDPOINT`, v.v.).

---

## Cơ sở dữ liệu — migration (SQL)

Trong `backend/migrations/`:

- `add_soft_delete_and_indexes.sql` — soft delete + index.
- `add_last_viewed_at_and_fifo_index.sql` — FIFO lịch sử xem.

Áp dụng thủ công lên DB tương ứng (SQLite/PostgreSQL) khi nâng cấp từ bản cũ.

---

## Production ngắn gọn

1. Đổi `SECRET_KEY`, dùng **PostgreSQL** (`DATABASE_URL`), bật HTTPS và CORS đúng domain.
2. Rebuild: `docker compose build --no-cache && docker compose up -d`.
3. Đảm bảo worker-video có đủ RAM (Whisper CPU; tham khảo giới hạn trong compose).
4. Flower chỉ mở trong mạng quản trị / VPN.

Tính năng vận hành chính: rate limit (Redis), cache video (Redis), multi-queue Celery, soft delete video, Celery Beat (dọn dẹp/lịch — theo cấu hình worker).

---

## OCR (EasyOCR)

- Lần đầu có thể tải model (~ vài trăm MB); nên gắn **volume** cache (trong compose đã có hướng tích hợp `easyocr_cache` / đường model).
- Môi trường hạn chế tải ngoài: cấu hình mirror / `EASYOCR_MODULE_PATH` theo `docker-compose`.

---

## Giới hạn & vận hành (tham khảo)

- Rate limit và số job đồng thời: xem `routers/videos.py` và cấu hình Redis.
- Whisper: thời gian xử lý phụ thuộc độ dài video và CPU.
- Redis lỗi: cache/rate limit có thể giảm chức năng; kiểm tra `docker compose ps redis`.

---

## Cấu trúc thư mục chính

```
chinese-learning-app/
├── backend/           # FastAPI, models, pipeline, worker/
├── frontend/          # Next.js pages + components
├── docker-compose.yml
└── .env.example
```

---

*Tài liệu được gộp từ README cũ, PRODUCTION_READY.md và INTEGRATION.md; nội dung đã rút gọn và căn chỉnh với trạng thái code hiện tại.*
