# 🈶 學中文 — Nền Tảng Học Tiếng Trung Toàn Diện

> Hệ thống AI hỗ trợ học tiếng Trung từ nhiều nguồn: video YouTube, hình ảnh, chữ viết tay và tra cứu từ điển — tất cả trong một ứng dụng duy nhất.

---

## 1. Giới Thiệu

### Mục Tiêu Dự Án

**學中文** (Học Trung Văn) là nền tảng học tiếng Trung ứng dụng AI, giúp người học tiếng Việt tiếp cận tiếng Trung Quốc một cách trực quan và hiệu quả.

Thay vì học qua sách giáo khoa thuần túy, hệ thống cho phép học từ nội dung thực tế — video YouTube, ảnh chụp biển hiệu, chữ viết tay — rồi tự động phân tích, tạo phiên âm Pinyin và dịch sang tiếng Việt ngay lập tức.

### Phạm Vi Dự Án

| Module | Mô tả |
|--------|--------|
| **Video Learning** | Phân tích video YouTube → tạo subtitle đồng bộ (Trung / Pinyin / Việt) |
| **Smart Dictionary** | Tra cứu 120.000+ từ vựng với âm thanh phát âm |
| **OCR từ ảnh** | Nhận dạng chữ Hán từ ảnh chụp (biển hiệu, tài liệu, ảnh chụp màn hình) |
| **Nhận dạng chữ viết tay** | Vẽ chữ Hán trên canvas → hệ thống đoán và trả về top-5 kết quả |
| **Tài khoản & Admin** | JWT authentication, phân quyền user/admin, dashboard quản trị |

### Triết Lý Thiết Kế

- **Immersion learning** — học từ nội dung thực, không phải bài tập giả tạo
- **Instant lookup** — click vào bất kỳ từ nào → hiểu ngay nghĩa và cách đọc
- **Multi-input** — hỗ trợ video, ảnh, viết tay, tra từ trực tiếp
- **Progressive** — từ xem video đến đọc sách đến viết chữ

---

## 2. Kiến Trúc Phần Mềm

### 2.1. Tổng Quan Kiến Trúc

```
┌──────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                            │
│                                                                  │
│  ┌─────────┐  ┌────────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Video   │  │ Subtitle   │  │ Dictionary │ │  OCR   │        │
│  │ Player  │  │ Panel      │  │    /    │  │ Hand-  │        │
│  │         │  │            │  │ TTS Audio│  │ writing│        │
│  └────┬────┘  └─────┬──────┘  └─────────┘  └─────────┘        │
│       │            │                                            │
│       └────────────┼────────────────────────────────────────►  │
│                    │              NEXT.JS 14 (Frontend)           │
│                    │     ┌─────────────────────────────┐         │
│                    └────►│     pages/index.tsx         │         │
│                          │  onTimeUpdate → activeIndex │         │
│                          └──────────────┬──────────────┘         │
└─────────────────────────────────────────┼───────────────────────┘
                                          │ HTTP / REST
                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASTAPI (Backend)                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  │ /auth    │ │ /videos  │ │ /dict    │ │ /ocr     │        │
│  │          │ │ /jobs    │ │ /audio   │ │ /handwriting│      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘        │
│       │            │             │             │                │
│  ┌────┴────────────┴─────────────┴─────────────┴─────┐         │
│  │              CORE SERVICES                          │         │
│  │  • Rate Limiter (Redis sliding window)            │         │
│  │  • JWT Auth (HS256, 60min access / 30d refresh)   │         │
│  │  • Video Cache (Redis deduplication)              │         │
│  └────────────────────────┬────────────────────────────┘         │
│                           │                                      │
│  ┌────────────────────────┴────────────────────────────┐         │
│  │              PIPELINE (Video AI)                     │         │
│  │  ① yt-dlp (download audio / extract captions)      │         │
│  │  ② faster-whisper (speech → text, CPU int8)         │         │
│  │  ③ Claude Haiku (optional, post-processing)          │         │
│  │  ④ pypinyin (text → Pinyin with tone marks)          │         │
│  │  ⑤ Google Translate (zh-CN → vi)                     │         │
│  └─────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
           │                              │
           │                              │
           ▼                              ▼
┌───────────────────────┐    ┌───────────────────────────────────┐
│    REDIS (Cache)      │    │    CELERY (Background Workers)    │
│                       │    │                                   │
│  DB 0: Celery broker  │    │  ┌─────────────┐ ┌────────────┐ │
│  DB 1: Video cache     │    │  │worker-video │ │ worker-ocr │ │
│  DB 2: Dictionary      │    │  │ (video_queue)│ │ (ocr_queue)│ │
│                       │    │  └─────────────┘ └────────────┘ │
│  Rate limiting keys    │    │  ┌──────────────────────────┐   │
│  Video dedup keys      │    │  │ celery-beat (scheduler)  │   │
│                       │    │  └──────────────────────────┘   │
└───────────────────────┘    └───────────────────────────────────┘
           │
           ▼
┌───────────────────────┐
│   SQLITE (dev)        │
│   PostgreSQL (prod)   │
│                       │
│  users, videos,       │
│  subtitles,           │
│  processing_jobs       │
└───────────────────────┘
```

### 2.2. Thành Phần Chính

#### Frontend (Next.js 14 + TypeScript)

| Thành phần | File | Vai trò |
|------------|------|---------|
| `VideoPlayer` | `components/VideoPlayer.tsx` | Nhúng YouTube player, poll `getCurrentTime()` mỗi ~1ms, dispatch `seek-video` event |
| `SubtitlePanel` | `components/SubtitlePanel.tsx` | Binary search O(log n) tìm active subtitle, auto-scroll, memoized rows |
| `SubtitleItem` | `components/SubtitleItem.tsx` | Card hiển thị 1 subtitle, click word → tra từ điển |
| `WordPopup` | `components/dictionary/WordPopup.tsx` | Popup hiển thị thông tin từ điển đầy đủ |
| `JobStatusBar` | `components/JobStatusBar.tsx` | Poll job status mỗi 3s, animated progress dots |
| `Navbar` | `components/layout/Navbar.tsx` | Điều hướng, hamburger menu trên mobile |
| `OcrUploader` | `components/ocr/OcrUploader.tsx` | Upload ảnh hoặc chụp từ camera |
| `HandwritingCanvas` | `components/ocr/HandwritingCanvas.tsx` | Canvas vẽ chữ Hán, tự động nhận dạng |

#### Backend (FastAPI + Python)

| Thành phần | File | Vai trò |
|------------|------|---------|
| `main.py` | Root | FastAPI app, lifespan startup (prewarm models) |
| `subtitles_router` | `routers/videos.py` | Submit video, get video detail, soft delete |
| `jobs_router` | `routers/jobs.py` | Poll job status |
| `auth_router` | `routers/auth.py` | Register, login, refresh token |
| `dictionary_router` | `routers/dictionary.py` | Tra từ, segment, phát âm TTS |
| `ocr_router` | `routers/ocr.py` | OCR ảnh, nhận dạng chữ viết |
| `admin_router` | `routers/admin.py` | Dashboard, quản lý user/video/job |
| `monitoring_router` | `routers/monitoring.py` | Health check, queue stats |
| `orchestrator` | `pipeline/orchestrator.py` | Điều phối 5 bước pipeline video |
| `subtitle_extractor` | `pipeline/subtitle_extractor.py` | Hybrid: YouTube captions → Whisper fallback |
| `whisper_engine` | `pipeline/whisper_engine.py` | faster-whisper CPU int8 |
| `rate_limiter` | `core/rate_limiter.py` | Redis sliding window rate limiting |

### 2.3. Container Architecture (Docker)

```
┌─────────────────────────────────────────────────────┐
│                 app-network (bridge)                 │
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │  Redis  │  │ Backend   │  │   Frontend      │  │
│  │  7-alpine│  │ FastAPI   │  │   Next.js 14   │  │
│  │ 6379    │  │ :8000     │  │   :3000        │  │
│  └────┬────┘  └─────┬─────┘  └─────────────────┘  │
│       │             │                               │
│       │    ┌────────┴────────┐                      │
│       │    │  Celery Workers │                      │
│       │    │ ┌────────────┐  │                      │
│       │    │ │worker-video│  │                      │
│       │    │ │(video_queue)│  │                      │
│       │    │ └────────────┘  │                      │
│       │    │ ┌────────────┐  │                      │
│       │    │ │worker-ocr  │  │                      │
│       │    │ │(ocr_queue) │  │                      │
│       │    │ └────────────┘  │                      │
│       │    │ ┌────────────┐  │                      │
│       │    │ │celery-beat │  │                      │
│       │    │ │(scheduler) │  │                      │
│       │    │ └────────────┘  │                      │
│       └────┴──────────────────┘                      │
└─────────────────────────────────────────────────────┘
```

| Container | Image | RAM | Queue |
|-----------|-------|-----|-------|
| `redis` | `redis:7-alpine` | — | DB 0=broker, DB 1=cache |
| `backend` | `python:3.11-slim` | 2GB | REST API |
| `worker-video` | `python:3.11-slim` | 4GB | `video_queue` |
| `worker-ocr` | `python:3.11-slim` | 2GB | `ocr_queue` |
| `celery-beat` | `python:3.11-slim` | 256MB | Scheduler |
| `frontend` | `node:20` | — | Next.js |
| `flower` *(profile)* | `python:3.11-slim` | 256MB | Celery monitor (:5555) |

---

## 3. Nguyên Lý Hoạt Động Của Các Chức Năng

### 3.1. Video Learning — Phân Tích Video YouTube

#### Bước 1: Người dùng gửi URL

Người dùng paste URL YouTube vào ô nhập → `POST /api/videos/analyze`

Backend thực hiện 3 kiểm tra trước khi xử lý:

```
1. Rate limit    → Redis sliding window: 5 request/phút/user
2. Duplicate     → Redis: đã xử lý chưa? → trả cached kết quả ngay
3. Pending jobs  → Đang có ≥3 job đang chờ? → từ chối
```

#### Bước 2: Hybrid Subtitle Extractor (Progress 10%)

```
yt-dlp extract_info(URL)
    │
    ├──▶ Có subtitle thủ công (zh-Hans / zh / zh-CN)?
    │         │
    │         └──▶ Parse JSON3/VTT → subtitles[]
    │              (source = "manual", nhanh ~10-30s)
    │
    └──▶ Không có subtitle thủ công?
              │
              └──▶ yt-dlp download audio (WAV via FFmpeg)
                   (qua proxy nếu cần, cho thị trường Trung Quốc)
```

#### Bước 3: Faster-Whisper — Speech to Text (Progress 30%)

```
WhisperModel("small", device="cpu", compute_type="int8")
    │
    └──▶ [{start: 0.0, end: 3.5, text: "你好世界"}, ...]
```

Model "small" đủ chính xác cho tiếng Trung, chạy trên CPU int8 (không cần GPU).

#### Bước 4: LLM Post-Processing — Tùy chọn (Progress 55%)

```
IF ANTHROPIC_API_KEY có giá trị:
    Claude Haiku batch-8 subtitles
        → Thêm dấu câu
        → Sửa lỗi đọc nhầm
ELSE:
    → Skip, giữ nguyên kết quả Whisper
```

#### Bước 5: Pinyin Converter (Progress 65%)

```
pypinyin(subtitle.text, style=Style.TONE)
    │
    └──▶ "nǐ hǎo shì jiè"  (số thanh: ni3 hao3 shi4 jie4)
```

#### Bước 6: Google Translate (Progress 80%)

```
Google Translate zh-CN → vi, mỗi subtitle cách nhau 0.3s
    │
    └──▶ "Bạn tốt thế giới"  (fake, chỉ minh họa)
```

#### Bước 7: Lưu vào Database

```sql
INSERT INTO videos (...)
INSERT INTO subtitles ... (bulk)
UPDATE processing_jobs SET status='done', video_id=...
```

### 3.2. Subtitle Panel — Đồng Bộ Phụ Đề Với Video

#### Tìm Active Subtitle — Binary Search O(log n)

Thay vì duyệt O(n) toàn bộ list, dùng binary search:

```javascript
function findActiveIndex(subtitles, currentTime) {
  // Tìm subtitle mà: start <= currentTime < end
  // 2000 subtitles → chỉ cần 11 bước thay vì 1000 bước
}
```

#### Auto-Scroll — Smart Scroll

Khi active subtitle thay đổi:

```
┌──────────────────────────────────────────────────┐
│  SubtitlePanel                                    │
│                                                  │
│  ┌─ Header (flex-shrink-0) ──────────────────┐  │
│  │  Câu thoại · 1 / 200  [200 câu] [03:45]   │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Scroll Container (flex-1, overflow-y-auto) ┐  │
│  │                                             │  │
│  │   [subtitle 1]                             │  │
│  │   [subtitle 2]                             │  │
│  │   [subtitle 3 - ACTIVE ⭐] ◄── CENTER     │  │
│  │   [subtitle 4]                             │  │
│  │   [subtitle 5]                             │  │
│  │   ...                                      │  │
│  │                                             │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

**4 điều kiện trước khi scroll:**

1. `activeIndex < 0` → không làm gì
2. `activeIndex === prevIndex` → index không đổi, skip
3. `isPaused === true` → video đang pause, skip
4. `isCardCentered()` → card đã ở giữa rồi, skip

**Công thức căn giữa:**

```
scrollTop = cardTop - (containerHeight / 2) + (cardHeight / 2)
```

→ Card active luôn nằm **chính giữa** viewport.

### 3.3. Smart Dictionary — Tra Từ Điển

#### Nguồn dữ liệu

```
1. CC-CEDICT (~120.000 entries)
   └── Tải từ internet, parse, lưu vào memory
   └── Lazy load: chỉ load khi cần

2. Static translation cache
   └── 500+ pattern đã biết, O(1) lookup, 0ms

3. Google Translate (fallback)
   └── Nếu không có trong CC-CEDICT
```

#### Luồng tra từ

```
User click vào chữ Hán trong subtitle
    │
    ├── /api/dictionary/segment?text=你好
    │         └── jieba segmentation: ["你", "好"]
    │
    └── /api/dictionary?word=你
              │
              ├── Cache hit? → trả ngay (0ms)
              ├── CC-CEDICT lookup
              ├── Google Translate fallback
              └── Trả về: {pinyin, meanings_vi[], audio_url}
```

#### Text-to-Speech (TTS)

```
edge-tts (zh-CN-XiaoxiaoNeural) → gTTS fallback
    │
    └──▶ Cache MD5 → /tmp/audio_cache/{md5}.mp3
         └── /api/audio/{md5}.mp3
```

### 3.4. OCR từ Ảnh — Nhận Dạng Chữ Hán

```
User upload ảnh (upload / camera capture)
    │
    ▼
POST /api/ocr (multipart/form-data)
    │
    ├── MD5 check → cache hit? → trả ngay
    │
    └── EasyOCR (ch_sim + en, CPU)
              │
              └──▶ OCRResult:
                    {
                      raw_text: "...",
                      lines: [...],
                      pinyin: [...],
                      vietnamese: [...],
                      words: [
                        {
                          char: "中",
                          pinyin: "zhōng",
                          meaning_vi: "trung, trung đẳng, trung học",
                          audio_url: "/api/audio/{md5}.mp3"
                        }
                      ]
                    }
```

### 3.5. Nhận Dạng Chữ Viết Tay

```
User vẽ chữ Hán trên HTML5 Canvas
    │
    ├── Auto-preprocessing ảnh:
    │     grayscale → auto-invert → contrast×3 → binary threshold → denoise
    │
    └── POST /api/handwriting
              │
              └──▶ Top-5 candidates:
                    [
                      { char: "中", confidence: 0.92, pinyin: "zhōng", meanings: [...] },
                      { char: "申", confidence: 0.71, pinyin: "shēn",  meanings: [...] },
                      ...
                    ]
```

---

## 4. Luồng Hoạt Động (Flow)

### 4.1. Luồng Video Learning — End-to-End

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  pages/index.tsx                                         │   │
│  │                                                           │   │
│  │  State: currentTime, isPaused, result (video + subs)    │   │
│  │                                                           │   │
│  │  ┌────────────────────────────────────────────────────┐ │   │
│  │  │  VideoPlayer (react-youtube)                       │ │   │
│  │  │  • Polling getCurrentTime() mỗi ~1ms               │ │   │
│  │  │  • Lắng nghe 'seek-video' CustomEvent             │ │   │
│  │  │  • onTimeUpdate(time) → setCurrentTime(time)       │ │   │
│  │  │  • onPausedChange(isPaused) → VideoPlayer→Parent   │ │   │
│  │  └─────────────────────────┬────────────────────────────┘ │   │
│  │                            │                                │   │
│  │  ┌─────────────────────────┴────────────────────────────┐ │   │
│  │  │  SubtitlePanel                                        │ │   │
│  │  │  • activeIndex = binarySearch(subtitles, currentTime)│ │   │
│  │  │  • SubtitleRow isActive={idx === activeIndex}        │ │   │
│  │  │  • useEffect(activeIndex) ──► scrollTo CENTER       │ │   │
│  │  │  • Click card ──► dispatch 'seek-video' event       │ │   │
│  │  │  • Click word ──► /api/dictionary?word=...          │ │   │
│  │  └───────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
           │ POST /api/videos/analyze
           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                   │
│                                                                  │
│  1. Rate limit check (Redis sliding window)                    │
│  2. Duplicate check (Redis: done:{uid}:{vid} key)               │
│  3. Pending jobs check (≤3/user)                                │
│  4. Create ProcessingJob (status=queued)                         │
│  5. Redis: SET video:processing:{vid} = job_id                 │
│  6. Publish task to video_queue                                 │
│  7. Return 202 {job_id, ...}                                   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  WORKER (Celery, worker-video)                           │   │
│  │                                                           │   │
│  │  Step 1: HybridSubtitleExtractor (10%)                  │   │
│  │    → YouTube captions (nhanh) HOẶC yt-dlp + Whisper      │   │
│  │                                                           │   │
│  │  Step 2: faster-whisper (30%)                           │   │
│  │    → speech → text (CPU int8, ~2-10 phút tùy độ dài)   │   │
│  │                                                           │   │
│  │  Step 3: Claude Haiku (55%, tùy chọn)                   │   │
│  │    → punctuation, fix homophones                        │   │
│  │                                                           │   │
│  │  Step 4: pypinyin (65%)                                 │   │
│  │    → text → pinyin với thanh                             │   │
│  │                                                           │   │
│  │  Step 5: Google Translate (80%)                          │   │
│  │    → zh-CN → vi                                           │   │
│  │                                                           │   │
│  │  Step 6: Save to DB (100%)                               │   │
│  │    → Update job status=done                              │   │
│  └───────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Frontend polls GET /api/jobs/{id} mỗi 3 giây                   │
│    → status=done? → GET /api/videos/{id} → hiển thị           │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2. Luồng Seek (Phát ngược)

```
User click vào subtitle thứ N
         │
         ▼
SubtitleItem.onClick()
         │
         ▼
onSeek(subtitle.start)
         │
         ▼
window.dispatchEvent(
  new CustomEvent('seek-video', { detail: { time: sub.start } })
)
         │
         ▼
VideoPlayer lắng nghe 'seek-video'
         │
         ▼
player.seekTo(time, true)   ← true = allow seek ahead
player.playVideo()            ← tự động phát
```

### 4.3. Luồng OCR / Handwriting

```
┌─────────────┐     POST /ocr      ┌──────────────┐
│ OcrUploader │ ────────────────► │ FastAPI      │
│ (upload/    │                     │ /api/ocr      │
│  camera)   │ ◄────────────────  │              │
└─────────────┘     OCRResult      │ OCR Service  │
                                   │ (EasyOCR)    │
                                   └──────┬───────┘
                                          │
                                          ▼
                                   ┌──────────────┐
                                   │ Redis Cache  │
                                   │ (MD5 keyed)  │
                                   └──────────────┘
```

---

## 5. Hướng Dẫn Sử Dụng

### 5.1. Cài Đặt Môi Trường Phát Triển

#### Yêu cầu

- **Docker** & **Docker Compose** (v2+)
- **Node.js 20+** (nếu chạy frontend riêng)
- **Python 3.11+** (nếu chạy backend riêng)

#### Cách 1: Docker (Khuyến nghị)

```bash
# Clone repository
git clone <repo-url>
cd chinese-learning-app

# Copy và chỉnh sửa environment
cp .env.example .env
# Mở .env và điền các giá trị cần thiết

# Build và chạy tất cả containers
docker compose up --build

# Hoặc chạy với monitoring (Flower)
docker compose --profile monitoring up --build
```

Sau khi khởi động thành công:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Flower (monitoring) | http://localhost:5555 |

#### Cách 2: Chạy Local (Backend + Frontend riêng)

```bash
# Terminal 1: Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Terminal 2: Worker
celery -A worker.celery_app worker --loglevel=info -Q video_queue,ocr_queue,celery

# Terminal 3: Celery Beat (scheduler)
celery -A worker.celery_app beat --loglevel=info

# Terminal 4: Frontend
cd frontend
npm install
npm run dev
```

### 5.2. Cấu Hình Environment

```bash
# .env

# === REQUIRED ===
SECRET_KEY=your-super-secret-key-change-this-in-production
DATABASE_URL=sqlite:////data/supchi.db

# Redis (Docker: tên service)
REDIS_URL=redis://redis:6379/0

# === OPTIONAL ===
# Bật LLM post-processing (Claude Haiku)
ANTHROPIC_API_KEY=sk-ant-...

# Proxy cho thị trường Trung Quốc (nếu cần)
HTTP_PROXY=http://172.25.80.1:7897
HTTPS_PROXY=http://172.25.80.1:7897

# HuggingFace mirror (thị trường Trung Quốc)
HF_ENDPOINT=https://hf-mirror.com

ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
```

### 5.3. Cách Sử Dụng

#### Đăng ký / Đăng nhập

1. Mở http://localhost:3000
2. Đăng ký tài khoản mới (miễn phí)
3. Đăng nhập → được chuyển đến trang chính

#### Học từ Video YouTube

1. Paste URL video YouTube (VD: `https://www.youtube.com/watch?v=...`)
2. Nhấn **Phân tích** → hệ thống tạo job xử lý
3. Đợi 10-30 giây (có subtitle thủ công) hoặc 2-10 phút (Whisper)
4. Khi hoàn thành → video hiển thị cùng subtitle đồng bộ
5. **Click vào subtitle** → video nhảy đến thời điểm đó
6. **Click vào chữ Hán** → popup tra từ điển với âm thanh phát âm

#### Tra Từ Điển

1. Vào **Từ điển** từ navbar
2. Nhập từ cần tra (VD: `你好`)
3. Xem pinyin, nghĩa tiếng Việt, âm thanh phát âm
4. Click **Phát âm** để nghe cách đọc

#### OCR từ Ảnh

1. Vào **OCR** từ navbar
2. Upload ảnh chứa chữ Hán HOẶC chụp từ camera
3. Hệ thống nhận dạng → hiển thị kết quả với pinyin + nghĩa

#### Nhận Dạng Chữ Viết Tay

1. Vào **OCR** → tab **Viết tay**
2. Vẽ chữ Hán trên canvas (hỗ trợ cả chuột và touch)
3. Hệ thống tự động nhận dạng sau 1.5s không vẽ
4. Xem top-5 kết quả với độ chính xác

---

## 6. Các Lưu Ý Quan Trọng

### Giới hạn hệ thống

| Hạn chế | Chi tiết |
|---------|----------|
| **Số job chờ** | Tối đa **3 job đang xử lý** trên mỗi tài khoản cùng lúc |
| **Rate limit video** | **5 request/phút** cho `/api/videos/analyze` |
| **Rate limit OCR** | **10 request/phút** cho `/api/ocr` |
| **Cache video** | Kết quả video được cache **24 giờ** trong Redis (cùng user) |
| **Cache OCR** | Kết quả OCR theo **MD5 ảnh**, không có expiry |
| **Thời gian xử lý Whisper** | ~2-10 phút tùy độ dài video (không cần GPU) |

### Yêu cầu kỹ thuật

| Thành phần | Yêu cầu |
|------------|----------|
| **RAM (worker-video)** | ≥4GB (Whisper chạy trên CPU) |
| **RAM (worker-ocr)** | ≥2GB (EasyOCR) |
| **Dung lượng ổ đĩa** | ~2GB cho Whisper model + EasyOCR cache |
| **Database** | SQLite (dev), PostgreSQL (prod khuyến nghị) |

### Các vấn đề thường gặp

**Video không xử lý được?**
- Kiểm tra video có public không (YouTube unlisted/private có thể lỗi)
- Kiểm tra video có subtitle hoặc audio không
- Kiểm tra `worker-video` container có đang chạy không

**Subtitle không đồng bộ?**
- Video có thể có nhiều audio track → chọn track tiếng Trung
- Whisper có thể bị drift ở video rất dài (>30 phút)

**Redis lỗi?**
- Hệ thống vẫn hoạt động nhưng không có rate limit hay cache
- Kiểm tra container `redis` đang chạy: `docker compose ps redis`

**Worker không nhận job?**
- Kiểm tra queue: `docker compose --profile monitoring up`
- Truy cập Flower http://localhost:5555 để xem trạng thái workers

### Chính sách dữ liệu

- **Soft delete**: Video và subtitle bị xóa sẽ được đánh dấu `is_deleted=true`, không xóa vĩnh viễn khỏi DB ngay
- **JWT tokens**: Access token hết hạn sau 60 phút, refresh token sau 30 ngày
- **Không lưu** mật khẩu dạng plain text — chỉ lưu bcrypt hash

### Môi trường Production

Khi triển khai production:

```bash
# Đổi DATABASE_URL sang PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/supchi

# Bật LLM post-processing
ANTHROPIC_API_KEY=sk-ant-...

# Tăng SECRET_KEY (dùng random string dài)
SECRET_KEY=$(openssl rand -hex 32)
```

---

*Last updated: 2026-03-26*
