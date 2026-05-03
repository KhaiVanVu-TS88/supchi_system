# 學中文 — Website hỗ trợ học tiếng Trung từ video YouTube

Web phân tích video YouTube → phụ đề đồng bộ (chữ Hán / Pinyin / tiếng Việt), tra từ điển, lịch sử học, tài khoản và admin.  
Stack: **Next.js 14** (frontend), **FastAPI** (API), **Redis**, **Celery** (`worker-video`, `celery-beat`), **SQLite** (dev) / PostgreSQL (prod).

---

## Các module trong project

| Module | Frontend | Backend (REST) | Ghi chú |
|--------|----------|----------------|---------|
| Video + phụ đề | `/` | `/api/videos`, `/api/jobs` | yt-dlp, Whisper khi cần, pypinyin, dịch Việt |
| Lịch sử | `/history`, `/history/[id]` | Cùng API video | Danh sách / xem lại |
| Từ điển | `/dictionary` | `/api/dictionary` | CC-CEDICT + segment + audio |
| Đăng nhập | `/auth/login`, `/auth/register` | `/api/auth` | JWT |
| Admin | `/admin/*` | `/api/admin` | Dashboard |
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
        └── Celery: worker-video (video_queue), celery-beat
```

Pipeline xử lý video: **subtitle/caption YouTube → Whisper (fallback) → pypinyin → dịch zh→vi**.

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

**Whisper:** image Docker **không** tải model khi build (tránh lỗi timeout mạng). Lần đầu xử lý video cần Whisper, `worker-video` sẽ tải model (~ vài trăm MB) vào volume `whisper_cache`; giữ volume để lần sau không tải lại. Nếu mạng kém, đặt `HF_ENDPOINT` trong compose (vd. mirror) như hiện tại.

**yt-dlp / YouTube (2026+):** Dockerfile tải **Deno** (binary từ GitHub Releases) và **`yt-dlp[default]`** (kèm `yt-dlp-ejs`). Sau khi đổi Dockerfile cần **`docker compose build --no-cache backend worker-video`**. Kiểm tra: `docker compose exec worker-video deno --version`. Nếu build không tới được `github.com`, bật VPN khi build hoặc chỉnh `DENO_VER` / mirror trong `backend/Dockerfile`; chi tiết [wiki EJS](https://github.com/yt-dlp/yt-dlp/wiki/EJS).

**Frontend build trong Docker:** có `.dockerignore` và Dockerfile tối ưu bộ nhớ; nếu `next build` bị SIGBUS, tăng RAM Docker Desktop (khuyến nghị ≥ 4 GB).

---

## Chạy local (không Docker)

```bash
# Backend
cd backend && python -m venv venv && source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Celery worker (terminal khác)
celery -A worker.celery_app worker --loglevel=info -Q video_queue,celery

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

Proxy / mirror (tuỳ mạng): cấu hình trong `docker-compose.yml` hoặc `.env` nếu cần (`HTTP_PROXY`, `HF_ENDPOINT`, v.v.).

**YouTube / yt-dlp — “Sign in to confirm you’re not a bot”:** YouTube thường chặn IP máy chủ hoặc luồng qua một số proxy. Cách ổn định nhất là đưa **cookie đăng nhập** vào yt-dlp:

1. Trên máy bạn, đăng nhập YouTube trong trình duyệt rồi export cookie định dạng **Netscape** (extension như “Get cookies.txt LOCALLY”, hoặc hướng dẫn trong [wiki yt-dlp](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp)).
2. Lưu file vào `chinese-learning-app/secrets/youtube_cookies.txt` (thư mục `secrets/` đã được `.gitignore`, **không commit** cookie).
3. Trong `docker-compose.yml`, bỏ comment hai dòng bind-mount `./secrets/youtube_cookies.txt:/secrets/youtube_cookies.txt` cho service **backend** và **worker-video**. Code **tự copy** cookie vào `/tmp` trong container rồi mới đưa cho yt-dlp — tránh **`[Errno 30] Read-only file system`** khi mount từ Windows/WSL.
4. Trong `.env`: `YTDLP_COOKIES_FILE=/secrets/youtube_cookies.txt`, rồi `docker compose up -d --build`.

**Tự động trong code:** `worker` và API peek duration **thử lần lượt** nhiều `player_client` yt-dlp (`web_embedded`, `tv`, `android`/`web`, `mweb`…) khi gặp lỗi kiểu bot / sign-in. Log sẽ có các dòng `strategy=…`. Nếu bạn đặt **`YTDLP_YOUTUBE_PLAYER_CLIENT`** trong `.env` thì chỉ dùng đúng danh sách đó (không fallback).

**Đại lục / cần VPN để ra YouTube:** để **`HTTP_PROXY`/`HTTPS_PROXY`** trong `docker-compose` trỏ về proxy máy bạn (Clash/V2Ray…); **không** bật `YTDLP_DISABLE_PROXY` (xoá biến hoặc để trống / `0`) — nếu tắt proxy riêng cho yt-dlp thì container có thể không tới được YouTube qua tường lửa.

**Lỗi tải `[SSL: UNEXPECTED_EOF_WHILE_READING]`:** proxy hoặc đường truyền cắt TLS giữa chừng. Trong `.env` tăng `YTDLP_RETRIES`, `YTDLP_FRAGMENT_RETRIES`, `YTDLP_SOCKET_TIMEOUT`, giữ `YTDLP_CONCURRENT_FRAGMENTS=1`; có thể thử `YTDLP_SLEEP_INTERVAL_REQUESTS=1`. Đổi node VPN / rule Clash cho `googlevideo.com`. Biến được truyền qua `docker-compose` vào backend + worker-video.

Nếu vẫn lỗi:

1. **Rebuild image** sau khi nâng `yt-dlp` trong `requirements.txt` (`docker compose build --no-cache worker-video backend`).
2. Trong log worker, nếu thấy cảnh báo *file cookie không tồn tại* → kiểm tra mount `./secrets/youtube_cookies.txt` và chạy `docker compose` đúng thư mục `chinese-learning-app`.
3. **`YTDLP_DISABLE_PROXY=1`** chỉ dùng khi máy/host **đã** ra YouTube được **không** cần proxy (vd. VN/US), mà YouTube vẫn báo bot **do IP proxy** — khi đó mới thử tắt proxy riêng cho yt-dlp.
4. Export lại cookie (ưu tiên cách [wiki — export không bị Google xoay cookie](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies): cửa sổ ẩn danh, đăng nhập, chỉ mở `youtube.com/robots.txt`, export rồi đóng hết tab).
5. **PO Token** — nếu log đã có *“cookie … → /tmp/…”* mà vẫn *Sign in / bot*, YouTube thường còn yêu cầu **PO token** (yt-dlp không tự sinh). Đọc [PO Token Guide](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#po-token-guide), lấy token (ví dụ từ Network → request player, field `serviceIntegrityDimensions.poToken`). Trong `.env` (không commit):  
   `YTDLP_YOUTUBE_PO_TOKEN=…` (chỉ phần token, hoặc cả chuỗi `mweb+…` / `web+…` nếu đã ghép sẵn)  
   và thường kèm `YTDLP_YOUTUBE_PLAYER_CLIENT=mweb,web` (phân tách dấu phẩy). Tuỳ token: `YTDLP_YOUTUBE_PO_CLIENT=mweb` (mặc định trong code khi chỉ paste token thuần).

---

## Cơ sở dữ liệu — migration (SQL)

Trong `backend/migrations/`:

- `add_soft_delete_and_indexes.sql` — soft delete + index.
- `add_last_viewed_at_and_fifo_index.sql` — FIFO lịch sử xem.

Áp dụng thủ công lên DB khi nâng cấp từ bản cũ. Nếu DB cũ từng dùng module đã gỡ (vd. bảng pronunciation), có thể giữ nguyên hoặc xóa bảng thủ công — không ảnh hưởng luồng video/từ điển.

---

## Production ngắn gọn

1. Đổi `SECRET_KEY`, dùng **PostgreSQL** (`DATABASE_URL`), HTTPS và CORS đúng domain.
2. Rebuild: `docker compose build --no-cache && docker compose up -d`.
3. Đảm bảo worker-video có đủ RAM (Whisper CPU).
4. Flower chỉ mở trong mạng quản trị / VPN.

---

## Giới hạn & vận hành (tham khảo)

- Rate limit và số job đồng thời: xem `routers/videos.py` và Redis.
- Whisper: thời gian xử lý phụ thuộc độ dài video và CPU.
- Redis lỗi: kiểm tra `docker compose ps redis`.

---

## Cấu trúc thư mục chính

```
chinese-learning-app/
├── backend/           # FastAPI, models, pipeline, worker/
├── frontend/          # Next.js pages + components
├── docker-compose.yml
└── .env.example
```
