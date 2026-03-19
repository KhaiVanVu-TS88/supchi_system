# 🈶 學中文 — Học Tiếng Trung Qua YouTube

Hệ thống học tiếng Trung toàn diện: dán URL YouTube → AI tạo subtitle đồng bộ + từ điển tra từ tức thì.

**Phiên bản:** v3.1 · **Stack:** Next.js · FastAPI · Celery · SQLite · Whisper AI

---

## ✨ Tính Năng

### 🎬 Học Qua Video
- Dán URL YouTube → AI phân tích trong nền, không chặn UI
- Subtitle hiển thị đồng bộ với video: **Chữ Hán · Pinyin · Tiếng Việt**
- Click vào bất kỳ từ nào trong subtitle → popup tra từ điển ngay lập tức
- Theo dõi tiến trình xử lý realtime (progress bar)

### 📖 Từ Điển Thông Minh
- **120,000+ từ** từ CC-CEDICT (open source, cập nhật liên tục)
- **Đa nghĩa**: mỗi từ hiển thị đầy đủ các nghĩa (ví dụ: 打 có 6+ nghĩa)
- **Pinyin** chuẩn với dấu thanh
- **Phát âm** qua edge-tts (giọng chuẩn) hoặc gTTS (fallback)
- **Word segmentation**: tách câu thành từ bằng jieba
- Lịch sử tìm kiếm gần đây

### 👤 Tài Khoản & Lịch Sử
- Đăng ký / Đăng nhập với JWT authentication
- Lưu toàn bộ video đã xử lý
- Xem lại bất kỳ video cũ nào với subtitle đầy đủ
- Xoá video khỏi lịch sử

### 🤖 AI Pipeline Nâng Cao
- **Hybrid subtitle**: ưu tiên subtitle gốc YouTube nếu có, tiết kiệm thời gian xử lý
- **Faster-Whisper**: nhận dạng giọng nói nhanh 4–5x so với Whisper gốc
- **LLM post-processing** (optional): Claude AI sửa dấu câu, cải thiện độ chính xác
- **Background jobs**: Celery + Redis, xử lý video không chặn giao diện

---

## 🏗️ Kiến Trúc

```
Browser
  │
  ├── GET  /                  → Trang học video
  ├── GET  /dictionary        → Trang từ điển
  ├── GET  /history           → Lịch sử video
  │
  ▼
Frontend (Next.js :3000)
  │
  ├── POST /api/videos/analyze  → Tạo job, trả job_id ngay (202)
  ├── GET  /api/jobs/{id}       → Poll tiến trình mỗi 3s
  ├── GET  /api/dictionary      → Tra từ CC-CEDICT
  ├── GET  /api/dictionary/segment → Tách từ (jieba)
  ├── GET  /api/audio/{file}    → Phát âm MP3
  │
  ▼
Backend API (FastAPI :8000)
  │
  ├── SQLite (/data/supchi4.db)   ← Users, Videos, Subtitles, Jobs
  │
  └── Redis (:6379)  ← Task queue (chạy trong cùng container backend)
        │
        ▼
  Celery Worker (container riêng)
        │
        ▼
  AI Pipeline:
    1. HybridSubtitleExtractor  → YouTube captions hoặc Whisper
    2. LLMPostProcessor         → Sửa dấu câu (optional, cần API key)
    3. PinyinConverter          → pypinyin
    4. Translator               → Google Translate (deep-translator)
    5. Lưu DB + cập nhật job
```

---

## 📁 Cấu Trúc Project

```
supchi4v3_dict/
│
├── docker-compose.yml          ← 3 services: backend + worker + frontend
├── .env.example
├── .gitignore
├── README.md
│
├── backend/
│   ├── Dockerfile              ← Python 3.11 + ffmpeg + redis-server
│   ├── start.sh                ← Khởi động Redis + uvicorn
│   ├── requirements.txt
│   ├── main.py                 ← FastAPI entry point
│   │
│   ├── core/
│   │   ├── config.py           ← Settings từ env vars
│   │   ├── database.py         ← SQLAlchemy (SQLite/PostgreSQL)
│   │   ├── security.py         ← bcrypt + JWT
│   │   └── deps.py             ← get_current_user dependency
│   │
│   ├── models/
│   │   ├── user.py             ← Bảng users
│   │   ├── video.py            ← Bảng videos + subtitles
│   │   └── job.py              ← Bảng processing_jobs
│   │
│   ├── routers/
│   │   ├── auth.py             ← /api/auth/*
│   │   ├── videos.py           ← /api/videos/*
│   │   ├── jobs.py             ← /api/jobs/*
│   │   └── dictionary.py       ← /api/dictionary/* + /api/audio/*
│   │
│   ├── services/
│   │   ├── dictionary_service.py ← CC-CEDICT parser, đa nghĩa, jieba
│   │   └── tts_service.py        ← edge-tts + gTTS fallback
│   │
│   ├── worker/
│   │   ├── celery_app.py       ← Celery config (Redis broker)
│   │   └── tasks.py            ← process_video_task
│   │
│   └── pipeline/
│       ├── orchestrator.py     ← Điều phối 4 bước pipeline
│       ├── subtitle_extractor.py ← Hybrid: YouTube captions / Whisper
│       ├── whisper_engine.py   ← faster-whisper (CPU, int8)
│       ├── llm_processor.py    ← Claude AI (optional)
│       ├── adapters.py         ← Wrapper functions
│       ├── pinyin_converter.py ← pypinyin
│       ├── translator.py       ← Google Translate
│       └── youtube.py          ← yt-dlp + proxy support
│
└── frontend/
    ├── Dockerfile
    ├── pages/
    │   ├── index.tsx           ← Trang chính (video + subtitle)
    │   ├── dictionary/         ← Trang từ điển
    │   ├── history/            ← Lịch sử + xem lại video
    │   └── auth/               ← Đăng nhập / Đăng ký
    │
    ├── components/
    │   ├── SubtitleItem.tsx    ← Subtitle card có clickable words
    │   ├── SubtitlePanel.tsx   ← Danh sách subtitle, auto-scroll
    │   ├── VideoPlayer.tsx     ← YouTube player (react-youtube)
    │   ├── JobStatusBar.tsx    ← Progress bar realtime
    │   ├── dictionary/
    │   │   ├── DictionaryCard.tsx ← Hiển thị đa nghĩa, audio
    │   │   └── WordPopup.tsx      ← Popup tra từ khi click subtitle
    │   ├── layout/Navbar.tsx   ← Header với tab Video / Từ điển / Lịch sử
    │   └── auth/AuthForm.tsx   ← Form đăng nhập / đăng ký
    │
    └── lib/
        ├── api.ts              ← HTTP client tự đính JWT header
        └── auth-context.tsx    ← React Context cho auth state
```

---

## 🚀 Hướng Dẫn Triển Khai

### Yêu Cầu

| Thành phần | Phiên bản | Ghi chú |
|------------|-----------|---------|
| Docker | 24.x+ | Bắt buộc |
| RAM | ≥ 5GB | Whisper worker cần ~3–4GB |
| Disk | ≥ 4GB | Model + images |
| Internet | Bắt buộc | YouTube + Google Translate |

---

### Bước 1 — Chuẩn Bị

```bash
cd supchi4v3_dict
cp .env.example .env
```

---

### Bước 2 — Cấu Hình Docker Mirror (nếu ở Trung Quốc)

Docker Hub bị GFW chặn. Cần cấu hình mirror trước khi build.

**Tìm file daemon.json của Docker và thêm mirrors:**

```json
{
  "registry-mirrors": [
    "https://dockerproxy.com",
    "https://docker.m.daocloud.io",
    "https://mirror.ccs.tencentyun.com"
  ]
}
```

Sau đó restart Docker và test:
```bash
docker pull hello-world
```

---

### Bước 3 — Cấu Hình Proxy (nếu ở Trung Quốc)

YouTube bị GFW chặn. Cần proxy để tải video.

**Tìm IP host và port proxy đang chạy trên Windows:**
```bash
# Trong WSL2 — tìm IP host
ip route | grep default
# Ví dụ: 172.25.80.1

# Trên Windows PowerShell — tìm port proxy
netstat -an | findstr "LISTENING"
# Tìm port lạ đang listen (thường là 7890, 7897, 1080, 10808...)
```

**Test port nào hoạt động:**
```bash
curl --proxy http://172.25.80.1:7897 https://www.youtube.com --max-time 10
```

**Cập nhật `docker-compose.yml`** với IP và port tìm được:
```yaml
environment:
  - HTTP_PROXY=http://172.25.80.1:7897    # ← đổi thành IP:port của bạn
  - HTTPS_PROXY=http://172.25.80.1:7897
```

Đồng thời bật **"Allow LAN"** trong VPN client (Clash/V2Ray/...) để container kết nối được qua proxy.

---

### Bước 4 — Build và Chạy

```bash
docker compose up --build -d
```

**Lần đầu mất 15–30 phút** vì cần tải:
- Python + Node base images
- ~1GB Python packages (Tsinghua PyPI mirror)
- ~1GB npm packages (npmmirror)
- Whisper model `small` (~500MB từ hf-mirror.com)

**Từ lần 2 trở đi: ~1 phút** (Docker cache).

---

### Bước 5 — Kiểm Tra

```bash
docker compose ps
```

Chờ thấy:
```
supchi4-backend   Up (healthy)
supchi4-worker    Up
supchi4-frontend  Up
```

```bash
curl http://localhost:8000/health
# → {"status":"ok","version":"3.1.0"}
```

| Service | URL |
|---------|-----|
| 🌐 Web App | http://localhost:3000 |
| 📖 Từ điển | http://localhost:3000/dictionary |
| 📡 API | http://localhost:8000 |
| 📋 Swagger | http://localhost:8000/docs |

---

### Bước 6 — Tạo Tài Khoản & Sử Dụng

1. Mở http://localhost:3000/auth/register
2. Tạo tài khoản
3. Dán URL YouTube tiếng Trung → **Phân tích**
4. Chờ progress bar hoàn thành (2–10 phút tùy độ dài video)
5. Xem subtitle đồng bộ, click từng từ để tra từ điển
6. Vào http://localhost:3000/dictionary để tra từ bất kỳ

---

## ⚙️ Cấu Hình Nâng Cao

### Bật LLM Post-processing (Claude AI)

Cải thiện chất lượng subtitle bằng cách sửa dấu câu và lỗi nhận dạng.

```bash
# Thêm vào .env
ANTHROPIC_API_KEY=sk-ant-...
```

Nếu không có key → pipeline vẫn chạy bình thường, chỉ bỏ qua bước này.

### Đổi sang PostgreSQL (production)

```yaml
# docker-compose.yml
environment:
  - DATABASE_URL=postgresql://user:pass@db:5432/supchi4
```

### Các Lệnh Quản Lý

```bash
# Xem log realtime
docker compose logs -f

# Xem log riêng worker (nơi pipeline chạy)
docker compose logs -f worker

# Restart một service
docker compose restart backend

# Dừng + giữ data
docker compose down

# Dừng + xoá toàn bộ data
docker compose down -v

# Backup SQLite
docker cp supchi4-backend:/data/supchi4.db ./backup.db
```

---

## 🗄️ Database Schema

```sql
-- Tài khoản người dùng
users (id, username, email, password_hash, is_active, created_at)

-- Video đã xử lý
videos (id, user_id, youtube_url, video_id, title, thumbnail_url, created_at)

-- Subtitle của mỗi video
subtitles (id, video_id, start_time, end_time, chinese, pinyin, vietnamese)

-- Trạng thái xử lý background
processing_jobs (id, user_id, video_id, status, progress,
                 subtitle_source, llm_used, error_message,
                 celery_task_id, created_at, finished_at)
```

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/register` | Đăng ký |
| POST | `/api/auth/login` | Đăng nhập → JWT tokens |
| GET | `/api/auth/me` | Thông tin user hiện tại |

### Videos
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/videos/analyze` | Submit video → `{job_id}` ngay |
| GET | `/api/videos` | Danh sách video đã xử lý |
| GET | `/api/videos/{id}` | Chi tiết + subtitles |
| DELETE | `/api/videos/{id}` | Xoá khỏi lịch sử |

### Jobs
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/jobs/{id}` | Trạng thái job (queued/processing/done/failed) |

### Dictionary
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/dictionary?word=学习` | Tra từ → đa nghĩa |
| GET | `/api/dictionary/segment?text=我学中文` | Tách từ |
| GET | `/api/audio/{filename}.mp3` | Phát âm |

### Ví dụ Response Dictionary

```json
{
  "word": "学习",
  "pinyin": "xuéxí",
  "meanings_vi": ["học", "học tập", "nghiên cứu", "tiếp thu kiến thức"],
  "pos": "động từ",
  "grammar": "Từ loại: động từ. Có 2 nghĩa trong CC-CEDICT",
  "example": {
    "zh": "我喜欢学习中文",
    "vi": "Tôi thích học tiếng Trung"
  },
  "definitions_en": ["to learn", "to study"],
  "audio_url": "/api/audio/abc123def456.mp3"
}
```

---

## 🔧 Xử Lý Lỗi Thường Gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| Job mãi `queued` | Worker chưa kết nối Redis | `docker compose logs worker` kiểm tra |
| `Network is unreachable` | YouTube bị chặn | Kiểm tra proxy, bật Allow LAN trong VPN |
| `HuggingFace download failed` | huggingface.co bị chặn | Đảm bảo `HF_ENDPOINT=https://hf-mirror.com` |
| `Docker image not found` | Docker Hub bị chặn | Cấu hình daemon.json mirror |
| Login 401 sau restart | Database bị reset | Đăng ký tài khoản mới |
| Subtitle trống | Video không có tiếng nói | Thử video khác |
| Audio không phát | edge-tts 403 | Tự động fallback sang gTTS |

---

## 📦 Tech Stack

| Thành phần | Công nghệ |
|------------|-----------|
| Frontend | Next.js 14 · TypeScript · TailwindCSS |
| Backend | FastAPI · Python 3.11 |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Queue | Celery 5.3 + Redis |
| AI - STT | faster-whisper (Whisper small, CPU int8) |
| AI - Pinyin | pypinyin |
| AI - Dịch | deep-translator (Google Translate) |
| AI - LLM | Anthropic Claude (optional) |
| Từ điển | CC-CEDICT (120k+ entries) |
| TTS | edge-tts + gTTS fallback |
| Segmentation | jieba |
| Auth | JWT (python-jose) + bcrypt |
| Deploy | Docker Compose |

---

## 🌏 Triển Khai Tại Trung Quốc

Hệ thống đã được tối ưu để chạy trong môi trường GFW:

| Dịch vụ | Bị chặn | Giải pháp |
|---------|---------|-----------|
| Docker Hub | ❌ | Mirror qua daemon.json |
| PyPI | chậm | `pypi.tuna.tsinghua.edu.cn` |
| npm | chậm | `registry.npmmirror.com` |
| HuggingFace | ❌ | `hf-mirror.com` |
| YouTube | ❌ | Proxy (`HTTP_PROXY` trong docker-compose) |
| PostgreSQL/Redis | — | Bỏ luôn → SQLite + Redis trong container |