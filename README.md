# 🈶 SuperChi4 — Học Tiếng Trung Qua YouTube

Ứng dụng học tiếng Trung: dán URL YouTube → AI tạo subtitle với **Chữ Hán + Pinyin + Tiếng Việt**.

---

## 📁 Cấu Trúc Project

```
supchi4/                              ← Thư mục gốc (root)
│
├── docker-compose.yml                ← Khởi động toàn bộ hệ thống
├── .env.example                      ← Template biến môi trường
├── .gitignore
│
├── backend/                          ← Python AI Pipeline
│   ├── Dockerfile
│   ├── requirements.txt
│   │
│   ├── api_server.py                 ← FastAPI — REST API endpoint
│   ├── pipeline.py                   ← Điều phối toàn bộ AI pipeline
│   │
│   └── modules/                      ← Các module xử lý riêng biệt
│       ├── __init__.py
│       ├── youtube.py                ← Tải audio từ YouTube (yt-dlp)
│       ├── whisper_engine.py         ← Nhận dạng giọng nói (Whisper AI)
│       ├── pinyin_converter.py       ← Chuyển Hán → Pinyin (pypinyin)
│       └── translator.py             ← Dịch Trung → Việt (Google Translate)
│
└── frontend/                         ← Next.js Web App
    ├── Dockerfile
    ├── package.json
    ├── next.config.js
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── postcss.config.js
    ├── .env.example
    ├── .eslintrc.json
    │
    ├── pages/                        ← Next.js pages (routing)
    │   ├── _app.tsx                  ← App wrapper, import global CSS
    │   ├── _document.tsx             ← HTML document template
    │   └── index.tsx                 ← Trang chính (layout + state)
    │
    ├── components/                   ← React components tái sử dụng
    │   ├── UrlInput.tsx              ← Input URL + validation
    │   ├── VideoPlayer.tsx           ← YouTube player (react-youtube)
    │   ├── SubtitlePanel.tsx         ← Panel subtitle, tìm activeIndex
    │   └── SubtitleItem.tsx          ← 1 dòng subtitle: Hán/Pinyin/Việt
    │
    ├── types/
    │   └── subtitle.ts               ← TypeScript interfaces
    │
    └── styles/
        └── globals.css               ← TailwindCSS + custom styles
```

---

## 🏗️ Kiến Trúc Hệ Thống

```
BROWSER (http://localhost:3000)
        │
        │  1. Dán URL YouTube
        │  2. Click "Phân tích"
        ▼
┌───────────────────────────────────┐
│        FRONTEND (Next.js)         │
│  ┌─────────────┐ ┌─────────────┐  │
│  │ VideoPlayer │ │SubtitlePanel│  │
│  │  (sticky)   │ │  (scroll)   │  │
│  │             │ │             │  │
│  │ poll 200ms  │ │ highlight + │  │
│  │ currentTime │ │ auto-scroll │  │
│  └──────┬──────┘ └─────────────┘  │
│         │ currentTime             │
│         └────────────────────────►│
└───────────────────────────────────┘
        │
        │  POST /api/analyze
        │  { url: "https://youtube.com/..." }
        ▼
┌───────────────────────────────────┐
│        BACKEND (FastAPI)          │
│        api_server.py              │
│               │                   │
│          pipeline.py              │
│    ┌──────────┼──────────┐        │
│    ▼          ▼          ▼        │
│ youtube.py  whisper  pinyin +     │
│ yt-dlp      AI       translator   │
└───────────────────────────────────┘
        │
        │  Response: [{ start, end, chinese, pinyin, vietnamese }]
        ▼
BROWSER hiển thị subtitle đồng bộ với video
```

---

## 🚀 Hướng Dẫn Chạy

### Yêu Cầu
| Công cụ | Phiên bản | Link |
|---------|-----------|------|
| Docker Desktop | mới nhất | https://docs.docker.com/get-docker/ |
| RAM trống | ≥ 5GB | Whisper cần 3–4GB |
| Internet | bắt buộc | Để tải YouTube và dịch thuật |

---

### Bước 1 — Tải project về máy

```bash
git clone <url-repo> supchi4
cd supchi4
```

Hoặc giải nén file ZIP rồi vào thư mục `supchi4/`.

---

### Bước 2 — Cấu hình môi trường

```bash
cp .env.example .env
```

File `.env` mặc định đã hoạt động với localhost. Chỉ cần sửa khi deploy lên VPS.

---

### Bước 3 — Build và khởi động

```bash
docker compose up --build
```

**Lần đầu mất 15–20 phút** vì Docker cần:
- Tải Python 3.11 + Node.js 20 base images
- Cài ~1GB Python dependencies
- Tải Whisper model `small` (~500MB)
- Build Next.js production bundle

**Từ lần 2 trở đi: chỉ mất 20–30 giây** (Docker cache).

Theo dõi tiến trình:
```
supchi4-backend   | INFO: Uvicorn running on http://0.0.0.0:8000
supchi4-frontend  | ✓ Ready on http://0.0.0.0:3000
```

---

### Bước 4 — Sử dụng

| Service | URL |
|---------|-----|
| 🌐 Web App | http://localhost:3000 |
| 📡 API | http://localhost:8000 |
| 📖 API Docs | http://localhost:8000/docs |

1. Mở `http://localhost:3000`
2. Dán URL video YouTube tiếng Trung
3. Nhấn **Phân tích**
4. Chờ 2–5 phút (tùy độ dài video)
5. Xem subtitle đồng bộ với video

---

### Dừng hệ thống

```bash
# Dừng tất cả container
docker compose down

# Dừng và xóa cả volume (xóa luôn Whisper cache)
docker compose down -v
```

---

### Các lệnh hữu ích khác

```bash
# Xem log realtime
docker compose logs -f

# Xem log riêng từng service
docker compose logs -f backend
docker compose logs -f frontend

# Chỉ restart frontend (không rebuild)
docker compose restart frontend

# Rebuild một service cụ thể
docker compose up --build backend
```

---

## 🌐 Deploy Lên VPS

### Chuẩn bị VPS
```bash
# Cài Docker trên Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### Upload code lên VPS
```bash
scp -r supchi4/ user@your-vps-ip:~/supchi4
ssh user@your-vps-ip
cd supchi4
```

### Cập nhật .env cho VPS
```bash
cp .env.example .env

# Sửa NEXT_PUBLIC_BACKEND_URL thành IP/domain thật
nano .env
# NEXT_PUBLIC_BACKEND_URL=http://YOUR_VPS_IP:8000
```

### Chạy
```bash
docker compose up --build -d   # -d: chạy nền
```

---

## ⚡ Chi Tiết Kỹ Thuật

### Backend API

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/health` | Health check |
| POST | `/api/analyze` | Phân tích video YouTube |
| GET | `/docs` | Swagger UI |

**Request body:**
```json
{ "url": "https://www.youtube.com/watch?v=VIDEO_ID" }
```

**Response:**
```json
{
  "subtitles": [
    {
      "start": 1.0,
      "end": 3.5,
      "chinese": "大家好",
      "pinyin": "dà jiā hǎo",
      "vietnamese": "Xin chào mọi người"
    }
  ],
  "total_segments": 42,
  "video_id": "VIDEO_ID"
}
```

### Frontend Subtitle Sync

```
VideoPlayer (react-youtube)
    └── setInterval 200ms
            └── ytPlayer.getCurrentTime() → currentTime
                        │
SubtitlePanel
    └── useMemo: findIndex(s => t >= s.start && t < s.end) → activeIndex
                        │
SubtitleItem[activeIndex]
    └── useEffect: scrollIntoView({ behavior: 'smooth', block: 'center' })
    └── CSS class: sub-card-active (highlight vàng + pulse dot)
```

---

## ❓ Xử Lý Lỗi Thường Gặp

| Lỗi | Nguyên nhân | Cách sửa |
|-----|-------------|----------|
| `HTTP 403` khi tải YouTube | YouTube chặn bot | yt-dlp đã có bypass — thử lại |
| `Out of memory` | Video quá dài | Dùng video < 10 phút |
| Frontend không gọi được backend | Sai BACKEND_URL | Kiểm tra `.env` |
| Subtitle không sync | Video ID sai | Kiểm tra URL có đúng format không |
| Port đã bị dùng | App khác chiếm cổng | Đổi port trong `docker-compose.yml` |