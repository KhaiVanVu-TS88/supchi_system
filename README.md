# 🈶 SuperChi4 v3 — AI-Enhanced Chinese Learning

Hệ thống học tiếng Trung nâng cao với:
- ⚡ **Hybrid Subtitle** — dùng subtitle gốc YouTube nếu có, không cần chạy AI
- 🎙️ **Faster-Whisper** — nhận dạng giọng nói nhanh 4–5x
- ✨ **LLM Post-processing** — Claude AI sửa dấu câu, cải thiện độ chính xác (optional)
- 🔄 **Background Jobs** — xử lý nền, không chặn UI, theo dõi tiến trình realtime

---

## 🏗️ Kiến Trúc

```
Browser → Frontend (Next.js :3000)
              │
              │ POST /api/videos/analyze → { job_id }  (trả về ngay)
              │ GET  /api/jobs/{id}      → poll mỗi 3s
              ▼
         Backend API (FastAPI :8000)
              │
              ├── push task → Redis (:6379)
              │                   │
              │              Celery Worker
              │              ┌────────────────────────────┐
              │              │ 1. Check YouTube captions  │
              │              │    ├─ manual? → dùng ngay  │
              │              │    └─ none?  → Whisper     │
              │              │ 2. LLM sửa lỗi (optional) │
              │              │ 3. Pinyin                  │
              │              │ 4. Dịch tiếng Việt         │
              │              │ 5. Lưu DB                  │
              │              └────────────────────────────┘
              │
              └── query → PostgreSQL (:5432)
```

---

## 📁 Cấu Trúc Project

```
supchi4v3/
├── docker-compose.yml       ← 5 services: db + redis + backend + worker + frontend
├── .env.example
│
├── backend/
│   ├── main.py              ← FastAPI entry point
│   ├── requirements.txt
│   ├── Dockerfile           ← Dùng chung cho backend + worker
│   │
│   ├── core/                ← Infrastructure (giữ nguyên từ v2)
│   │   ├── config.py
│   │   ├── database.py      ← + job model
│   │   ├── security.py
│   │   └── deps.py
│   │
│   ├── models/
│   │   ├── user.py          ← giữ nguyên
│   │   ├── video.py         ← giữ nguyên
│   │   └── job.py           ← MỚI: bảng processing_jobs
│   │
│   ├── routers/
│   │   ├── auth.py          ← giữ nguyên
│   │   ├── videos.py        ← sửa: analyze() → tạo job
│   │   └── jobs.py          ← MỚI: GET /api/jobs/{id}
│   │
│   ├── worker/              ← MỚI: Celery
│   │   ├── celery_app.py    ← config broker/backend
│   │   └── tasks.py         ← process_video_task
│   │
│   └── pipeline/            ← tái cấu trúc từ modules/
│       ├── orchestrator.py  ← MỚI: điều phối pipeline
│       ├── subtitle_extractor.py  ← MỚI: hybrid strategy
│       ├── llm_processor.py ← MỚI: optional LLM
│       ├── adapters.py      ← MỚI: wrapper functions
│       ├── whisper_engine.py   ← giữ nguyên
│       ├── pinyin_converter.py ← giữ nguyên
│       ├── translator.py       ← giữ nguyên
│       └── youtube.py          ← giữ nguyên
│
└── frontend/
    ├── pages/
    │   ├── index.tsx        ← sửa: polling job status
    │   ├── auth/            ← giữ nguyên
    │   └── history/         ← giữ nguyên
    ├── components/
    │   └── JobStatusBar.tsx ← MỚI: progress bar realtime
    └── lib/
        └── api.ts           ← thêm jobsApi
```

---

## 🗄️ Database — Bảng Mới

```sql
CREATE TABLE processing_jobs (
    id               SERIAL PRIMARY KEY,
    user_id          INTEGER REFERENCES users(id) ON DELETE CASCADE,
    video_id         INTEGER REFERENCES videos(id) ON DELETE SET NULL,
    status           VARCHAR(20) DEFAULT 'queued',  -- queued|processing|done|failed
    progress         FLOAT DEFAULT 0,
    youtube_url      VARCHAR(500) NOT NULL,
    title            VARCHAR(500),
    subtitle_source  VARCHAR(50),   -- manual | whisper
    llm_used         VARCHAR(10),   -- yes | no
    error_message    TEXT,
    celery_task_id   VARCHAR(200),
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW(),
    finished_at      TIMESTAMP
);
```

---

## 🚀 Hướng Dẫn Triển Khai

### Yêu Cầu

| Thành phần | Phiên bản |
|------------|-----------|
| Docker Desktop | 24.x+ |
| RAM | ≥ 6GB (Whisper worker cần 3–4GB) |
| Disk | ≥ 4GB |

---

### Chạy Local

**Bước 1 — Chuẩn bị**
```bash
cd supchi4v3
cp .env.example .env
```

**Bước 2 — (Tuỳ chọn) Bật LLM Post-processing**
```bash
# Sửa .env, bỏ comment dòng này:
ANTHROPIC_API_KEY=sk-ant-your-key-here
```
Nếu không có key → pipeline vẫn chạy bình thường, chỉ bỏ qua bước LLM.

**Bước 3 — Build và chạy**
```bash
docker compose up --build
```

Lần đầu mất **20–25 phút**. Từ lần 2: **~1 phút** (Docker cache).

**Bước 4 — Kiểm tra**

Chờ thấy log:
```
supchi4-backend  | INFO: Uvicorn running on http://0.0.0.0:8000
supchi4-worker   | celery@... ready.
supchi4-frontend | ✓ Ready on http://0.0.0.0:3000
```

| Service | URL |
|---------|-----|
| 🌐 Web App | http://localhost:3000 |
| 📡 API | http://localhost:8000 |
| 📖 Swagger | http://localhost:8000/docs |

---

### Deploy VPS (Production)

**Bước 1 — Cài Docker**
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
```

**Bước 2 — Upload và cấu hình**
```bash
scp -r supchi4v3/ user@VPS_IP:~/supchi4v3
ssh user@VPS_IP
cd supchi4v3
cp .env.example .env
nano .env  # Sửa SECRET_KEY, DB_PASSWORD, NEXT_PUBLIC_BACKEND_URL
```

**Bước 3 — Chạy nền**
```bash
docker compose up --build -d
docker compose logs -f   # Theo dõi
```

---

### Lệnh Quản Lý

```bash
# Xem trạng thái tất cả services
docker compose ps

# Xem log worker (nơi pipeline chạy)
docker compose logs -f worker

# Scale thêm worker khi cần
docker compose up --scale worker=2 -d

# Restart riêng một service
docker compose restart worker

# Backup database
docker exec supchi4-db pg_dump -U supchi4 supchi4 > backup.sql

# Dừng + giữ data
docker compose down

# Dừng + xoá data
docker compose down -v
```

---

## ❓ Xử Lý Lỗi

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| Job mãi ở trạng thái `queued` | Worker chưa chạy / Redis lỗi | `docker compose logs worker` |
| Job `failed`: pipeline error | YouTube block / video quá dài | Thử video khác, < 15 phút |
| `LLM batch failed` trong log | ANTHROPIC_API_KEY sai/hết quota | Kiểm tra key hoặc để trống để disable |
| Frontend không poll được | CORS / BACKEND_URL sai | Kiểm tra `.env` |

---

## 🔄 Nâng Cấp Từ v2

```bash
# Dừng v2
cd supchi4v2 && docker compose down

# Chạy v3 (data cũ không migrate, bắt đầu fresh)
cd supchi4v3 && docker compose up --build
```