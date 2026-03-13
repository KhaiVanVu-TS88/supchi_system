# 🈶 SuperChi4 v2 — Học Tiếng Trung Qua YouTube

Hệ thống học tiếng Trung qua YouTube với **tài khoản người dùng** và **lưu lịch sử** học tập.

---

## 📐 Kiến Trúc Hệ Thống

```
BROWSER
   │
   │  JWT Token (Authorization: Bearer ...)
   ▼
┌─────────────────────────────────────────────┐
│           FRONTEND (Next.js :3000)          │
│                                             │
│  /                → Trang phân tích video   │
│  /auth/login      → Đăng nhập               │
│  /auth/register   → Đăng ký                 │
│  /history         → Danh sách video đã lưu  │
│  /history/[id]    → Xem lại video + subtitle│
└──────────────────┬──────────────────────────┘
                   │  HTTP (Docker network)
                   ▼
┌─────────────────────────────────────────────┐
│           BACKEND (FastAPI :8000)           │
│                                             │
│  POST /api/auth/register  → Đăng ký         │
│  POST /api/auth/login     → Đăng nhập       │
│  GET  /api/auth/me        → Thông tin user  │
│  POST /api/videos/analyze → Phân tích video │
│  GET  /api/videos         → Lịch sử         │
│  GET  /api/videos/{id}    → Chi tiết        │
│  DELETE /api/videos/{id}  → Xoá             │
│                                             │
│  ┌────────────────────────────────────────┐ │
│  │          AI Pipeline (giữ nguyên)      │ │
│  │  youtube.py → whisper → pinyin → dịch  │ │
│  └────────────────────────────────────────┘ │
└──────────────────┬──────────────────────────┘
                   │  SQLAlchemy ORM
                   ▼
┌─────────────────────────────────────────────┐
│        DATABASE (PostgreSQL :5432)          │
│                                             │
│  users      → tài khoản người dùng          │
│  videos     → video đã xử lý                │
│  subtitles  → subtitle của mỗi video        │
└─────────────────────────────────────────────┘
```

---

## 📁 Cấu Trúc Project

```
supchi4v2/
│
├── docker-compose.yml          ← Khởi động toàn bộ (frontend + backend + db)
├── .env.example                ← Template biến môi trường
├── .gitignore
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 ← FastAPI entry point
│   │
│   ├── core/                   ← Infrastructure
│   │   ├── config.py           ← Settings từ env vars
│   │   ├── database.py         ← SQLAlchemy engine + session
│   │   ├── security.py         ← JWT + bcrypt password hashing
│   │   └── deps.py             ← FastAPI dependencies (get_current_user)
│   │
│   ├── models/                 ← Database models (SQLAlchemy)
│   │   ├── user.py             ← Bảng users
│   │   └── video.py            ← Bảng videos + subtitles
│   │
│   ├── routers/                ← API endpoints
│   │   ├── auth.py             ← /api/auth/* (register, login, me)
│   │   └── videos.py           ← /api/videos/* (analyze, list, get, delete)
│   │
│   ├── pipeline.py             ← AI pipeline (KHÔNG ĐỔI)
│   └── modules/                ← AI modules (KHÔNG ĐỔI)
│       ├── youtube.py
│       ├── whisper_engine.py
│       ├── pinyin_converter.py
│       └── translator.py
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.js
    ├── tsconfig.json
    │
    ├── lib/
    │   ├── api.ts              ← HTTP client (tự thêm JWT header)
    │   └── auth-context.tsx    ← React Context cho auth state
    │
    ├── pages/
    │   ├── _app.tsx            ← Wrap AuthProvider
    │   ├── index.tsx           ← Trang chính (phân tích + auth gate)
    │   ├── auth/
    │   │   ├── login.tsx
    │   │   └── register.tsx
    │   └── history/
    │       ├── index.tsx       ← Danh sách video đã lưu
    │       └── [id].tsx        ← Xem lại video + subtitle
    │
    ├── components/
    │   ├── auth/AuthForm.tsx   ← Form đăng nhập/đăng ký
    │   ├── layout/Navbar.tsx   ← Header với user info
    │   ├── history/VideoCard.tsx
    │   ├── VideoPlayer.tsx     ← YouTube player (giữ nguyên)
    │   ├── SubtitlePanel.tsx   ← Subtitle list (giữ nguyên)
    │   ├── SubtitleItem.tsx    ← Subtitle card (giữ nguyên)
    │   └── UrlInput.tsx        ← URL input (giữ nguyên)
    │
    └── types/subtitle.ts
```

---

## 🗄️ Database Schema

```sql
-- Bảng người dùng
CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,         -- bcrypt hash
    is_active     BOOLEAN      DEFAULT TRUE,
    created_at    TIMESTAMP    DEFAULT NOW()
);

-- Bảng video đã xử lý
CREATE TABLE videos (
    id            INTEGER PRIMARY KEY,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    youtube_url   VARCHAR(500) NOT NULL,
    video_id      VARCHAR(20)  NOT NULL,         -- YouTube video ID (11 ký tự)
    title         VARCHAR(500),
    thumbnail_url VARCHAR(500),
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Bảng subtitle
CREATE TABLE subtitles (
    id          INTEGER PRIMARY KEY,
    video_id    INTEGER REFERENCES videos(id) ON DELETE CASCADE,
    start_time  FLOAT NOT NULL,
    end_time    FLOAT NOT NULL,
    chinese     TEXT  NOT NULL,
    pinyin      TEXT  NOT NULL,
    vietnamese  TEXT  NOT NULL
);

-- Indexes
CREATE INDEX idx_videos_user_id  ON videos(user_id);
CREATE INDEX idx_subtitles_video ON subtitles(video_id);
```

---

## 🔐 Cơ Chế Authentication

```
ĐĂNG KÝ / ĐĂNG NHẬP
─────────────────────────────────────────────────
Client          Frontend              Backend
  │                │                     │
  │─── submit ────►│                     │
  │                │── POST /api/auth/login ──►│
  │                │                     │ verify bcrypt
  │                │                     │ tạo JWT tokens
  │                │◄── {access_token,   │
  │                │     refresh_token} ─│
  │                │ localStorage.set()  │
  │                │                     │

MỖI REQUEST SAU ĐÓ
─────────────────────────────────────────────────
  │                │ Authorization: Bearer <token>
  │                │─────────────────────────────►│
  │                │                              │ decode JWT
  │                │                              │ lấy user_id
  │                │                              │ query DB
  │                │◄─────── response ────────────│

TOKEN HẾT HẠN (401)
─────────────────────────────────────────────────
  │                │◄── 401 Unauthorized ─────────│
  │                │ clearTokens()               │
  │                │ redirect → /auth/login      │
```

---

## 🚀 Hướng Dẫn Triển Khai

### Yêu Cầu Hệ Thống

| Thành phần | Phiên bản tối thiểu |
|------------|---------------------|
| Docker Desktop | 24.x trở lên |
| RAM trống | ≥ 5GB (Whisper AI cần ~3GB) |
| Disk trống | ≥ 3GB (models + images) |
| Internet | Bắt buộc (YouTube + Google Translate) |

---

### Chạy Trên Máy Local (Development)

**Bước 1 — Chuẩn bị**
```bash
# Clone hoặc giải nén project
cd supchi4v2

# Tạo file .env từ template
cp .env.example .env
```

**Bước 2 — Chạy toàn bộ hệ thống**
```bash
docker compose up --build
```

Lần đầu chạy mất **15–20 phút** vì cần tải:
- Python 3.11 + Node.js 20 base images
- ~1GB Python packages (Whisper, FastAPI...)
- Whisper model `small` (~500MB)
- Next.js production build

Từ lần 2 trở đi chỉ mất **~30 giây** (Docker cache).

**Bước 3 — Kiểm tra**

Chờ đến khi thấy log:
```
supchi4-backend   | INFO: Uvicorn running on http://0.0.0.0:8000
supchi4-frontend  | ✓ Ready on http://0.0.0.0:3000
```

Truy cập:

| Service | URL |
|---------|-----|
| 🌐 Web App | http://localhost:3000 |
| 📡 API | http://localhost:8000 |
| 📖 API Docs (Swagger) | http://localhost:8000/docs |

**Bước 4 — Tạo tài khoản và sử dụng**
1. Mở http://localhost:3000
2. Click **Đăng ký** → tạo tài khoản
3. Dán URL YouTube tiếng Trung → **Phân tích**
4. Xem lịch sử tại http://localhost:3000/history

---

### Deploy Lên VPS (Production)

**Bước 1 — Cài Docker trên VPS (Ubuntu/Debian)**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

**Bước 2 — Upload code lên VPS**
```bash
# Từ máy local
scp -r supchi4v2/ user@YOUR_VPS_IP:~/supchi4v2
ssh user@YOUR_VPS_IP
cd supchi4v2
```

**Bước 3 — Cấu hình môi trường production**
```bash
cp .env.example .env
nano .env
```

Chỉnh sửa các giá trị quan trọng:
```bash
# QUAN TRỌNG: đổi thành chuỗi ngẫu nhiên dài
SECRET_KEY=abc123xyz-thay-bang-chuoi-ngau-nhien-rat-dai-va-phuc-tap

# Mật khẩu database
DB_PASSWORD=mat-khau-database-kho-doan

# URL backend công khai (IP hoặc domain của VPS)
NEXT_PUBLIC_BACKEND_URL=http://YOUR_VPS_IP:8000
```

**Bước 4 — Build và chạy nền**
```bash
docker compose up --build -d
```

Flag `-d` (detach): chạy ngầm, không chiếm terminal.

**Bước 5 — Kiểm tra hoạt động**
```bash
# Xem trạng thái containers
docker compose ps

# Xem log realtime
docker compose logs -f

# Kiểm tra health
curl http://localhost:8000/health
```

---

### Các Lệnh Quản Lý

```bash
# Dừng tất cả
docker compose down

# Dừng + xoá database (mất toàn bộ data!)
docker compose down -v

# Restart một service
docker compose restart backend
docker compose restart frontend

# Xem log riêng
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db

# Cập nhật code → rebuild
docker compose up --build -d

# Vào trong container để debug
docker exec -it supchi4-backend bash
docker exec -it supchi4-db psql -U supchi4
```

---

### Backup Database

```bash
# Backup PostgreSQL
docker exec supchi4-db pg_dump -U supchi4 supchi4 > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i supchi4-db psql -U supchi4 supchi4 < backup_20260101.sql
```

---

## ❓ Xử Lý Lỗi Thường Gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `connection refused` khi login | Backend chưa healthy | Chờ thêm 1–2 phút rồi thử lại |
| `HTTP 403` YouTube | YouTube rate limit | Thử lại sau vài giây |
| Frontend trắng/không có CSS | Build cache cũ | `docker compose build --no-cache frontend` |
| `out of memory` | Video quá dài | Dùng video < 10 phút |
| DB connection error | PostgreSQL chưa ready | Backend sẽ tự retry khi `db` healthy |

---

## 🔄 Nâng Cấp Từ v1 Lên v2

Nếu bạn đang dùng `supchi4` (v1), v2 là project hoàn toàn mới — chạy song song không ảnh hưởng:

```bash
# Dừng v1
cd supchi4 && docker compose down

# Chạy v2
cd supchi4v2 && docker compose up --build
```

Data v1 không migrate được (v1 không có database).