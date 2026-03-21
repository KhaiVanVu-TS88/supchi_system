# 🈶 學中文 — Nền Tảng Học Tiếng Trung Toàn Diện

> Hệ thống AI hỗ trợ học tiếng Trung từ nhiều nguồn: video YouTube, hình ảnh, chữ viết tay và tra cứu từ điển — tất cả trong một ứng dụng duy nhất.

---

## 🌟 Giới Thiệu

**學中文** (Học Trung Văn) là nền tảng học tiếng Trung ứng dụng AI, được thiết kế để giúp người học tiếng Việt tiếp cận ngôn ngữ Trung Quốc một cách trực quan và hiệu quả nhất.

Thay vì học qua sách giáo khoa thuần túy, hệ thống cho phép người dùng học từ nội dung thực tế — video YouTube, hình chụp biển hiệu, màn hình điện thoại, hay chữ viết tay — rồi tự động phân tích, tạo phiên âm Pinyin và dịch sang tiếng Việt ngay lập tức.

### Triết Lý Thiết Kế

- **Immersion learning** — học từ nội dung thực, không phải bài tập giả tạo
- **Instant lookup** — click vào bất kỳ từ nào → hiểu ngay nghĩa và cách đọc
- **Multi-input** — hỗ trợ video, ảnh, viết tay, tra từ trực tiếp
- **Progressive** — từ xem video đến đọc sách đến viết chữ

---

## ✨ Tính Năng Chi Tiết

### 🎬 Module 1: Học Qua Video YouTube

Đây là tính năng cốt lõi của hệ thống. Người dùng chỉ cần dán URL YouTube, hệ thống tự động:

1. **Phát hiện subtitle có sẵn** — nếu video đã có phụ đề tiếng Trung (drama, podcast học thuật...), hệ thống dùng trực tiếp, bỏ qua bước AI để tiết kiệm thời gian
2. **Nhận dạng giọng nói** — nếu không có subtitle, Faster-Whisper phân tích âm thanh và tạo transcript
3. **Tạo Pinyin** — pypinyin chuyển mỗi câu thành phiên âm chuẩn có dấu thanh
4. **Dịch tiếng Việt** — Google Translate dịch nghĩa tự nhiên
5. **Hiển thị đồng bộ** — subtitle xuất hiện đúng thời điểm trong video, tự động cuộn theo

**Tương tác thông minh:**
- Click vào bất kỳ từ nào trong subtitle → popup tra từ điển ngay
- Click vào dòng subtitle → video nhảy đến đúng thời điểm đó
- Progress bar realtime theo dõi tiến trình xử lý (hệ thống xử lý nền, không chặn UI)

**Lưu trữ lịch sử:**
- Tất cả video đã xử lý được lưu vào tài khoản người dùng
- Xem lại bất kỳ lúc nào mà không cần xử lý lại
- Quản lý lịch sử: xem, tìm kiếm, xóa

---

### 📖 Module 2: Từ Điển Thông Minh

Tra cứu từ điển chính xác và đầy đủ nhất, được xây dựng trên nền tảng CC-CEDICT — bộ từ điển Trung-Anh mã nguồn mở với hơn 120,000 từ.

**Đặc điểm nổi bật:**
- **Đa nghĩa thực sự** — mỗi từ hiển thị tất cả nghĩa (ví dụ: 打 có 6+ nghĩa: đánh, gọi điện, chơi thể thao, mở đèn, gõ chữ, xây dựng...)
- **Pinyin chuẩn** — dấu thanh đúng vị trí theo quy tắc ngữ âm
- **Phát âm audio** — nghe giọng đọc chuẩn bằng Microsoft Edge TTS, fallback sang Google TTS
- **Word segmentation** — nhập câu dài, hệ thống tự tách thành từng từ bằng jieba
- **Lịch sử tìm kiếm** — 10 từ gần nhất lưu tự động

**Cơ chế dịch thông minh:**
- 500+ định nghĩa phổ biến nhất được dịch sẵn trong bảng tĩnh → trả về ngay, không cần network
- Các từ còn lại dịch qua Google Translate theo batch (1 request thay vì N request riêng lẻ)
- Cache 2000 từ gần nhất trong bộ nhớ → lần tra thứ 2 trở đi gần như tức thì

---

### 🔍 Module 3: Nhận Dạng Chữ Từ Ảnh (OCR)

Chụp ảnh hoặc upload ảnh có chứa chữ Hán → hệ thống nhận dạng và phân tích.

**Ứng dụng thực tế:**
- Chụp ảnh menu nhà hàng, biển hiệu, sách giáo khoa, màn hình điện thoại
- Scan tài liệu tiếng Trung để hiểu nghĩa
- Nhận dạng nhiều dòng chữ cùng lúc

**Công nghệ:**
- EasyOCR với model tiếng Trung giản thể (ch_sim) + tiếng Anh
- Chạy hoàn toàn trên CPU, không cần GPU
- Kết quả được pipe qua NLP pipeline: jieba phân từ → pypinyin → Google Translate

**Đầu ra:**
- Văn bản nhận dạng theo từng dòng
- Pinyin toàn đoạn
- Bản dịch tiếng Việt
- Chi tiết từng từ — click để tra từ điển đầy đủ

---

### ✍️ Module 4: Nhận Dạng Chữ Viết Tay

Canvas vẽ trực tiếp trên trình duyệt → AI nhận dạng ký tự Hán.

**Cách hoạt động:**
1. Người dùng vẽ chữ lên canvas (màu trắng trên nền tối)
2. Sau 1.5 giây ngừng vẽ, hệ thống tự động nhận dạng
3. Ảnh canvas được tiền xử lý: auto-invert màu, tăng contrast, threshold nhị phân, lọc nhiễu
4. EasyOCR phân tích ảnh đã xử lý
5. Hiển thị top 5 ký tự gợi ý + pinyin + nghĩa

**UX:**
- Nét bút mượt mà sử dụng Bezier curve
- Nút Xóa và Nhận dạng thủ công
- Hỗ trợ cảm ứng (touch) trên mobile/tablet
- Kết quả có thể click để tra từ điển đầy đủ

---

### 👤 Module 5: Tài Khoản & Bảo Mật

- Đăng ký và đăng nhập với email + mật khẩu
- Mật khẩu được hash bằng bcrypt (không thể reverse)
- Xác thực stateless bằng JWT (access token 60 phút + refresh token 30 ngày)
- Mỗi người dùng chỉ thấy dữ liệu của chính mình

---

## 🏗️ Kiến Trúc Hệ Thống

```
╔══════════════════════════════════════════════════════════════════╗
║                        NGƯỜI DÙNG (Browser)                      ║
║                                                                    ║
║  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐  ║
║  │  Video  │ │Từ điển   │ │  OCR    │ │Viết tay │ │ Lịch sử  │  ║
║  │Learning │ │  Popup   │ │  Ảnh   │ │ Canvas  │ │ Video    │  ║
║  └────┬────┘ └────┬─────┘ └────┬────┘ └────┬────┘ └────┬─────┘  ║
╚═══════╪═══════════╪════════════╪════════════╪════════════╪════════╝
        │           │            │            │            │
        ▼           ▼            ▼            ▼            ▼
╔══════════════════════════════════════════════════════════════════╗
║                   FRONTEND — Next.js 14 (:3000)                   ║
║                                                                    ║
║  pages/         components/              lib/                      ║
║  ├─ index.tsx   ├─ VideoPlayer.tsx       ├─ api.ts (JWT client)   ║
║  ├─ dictionary/ ├─ SubtitlePanel.tsx     └─ auth-context.tsx      ║
║  ├─ history/    ├─ SubtitleItem.tsx                               ║
║  ├─ ocr/        ├─ JobStatusBar.tsx                               ║
║  └─ auth/       ├─ dictionary/                                    ║
║                 │  ├─ DictionaryCard.tsx                          ║
║                 │  └─ WordPopup.tsx                               ║
║                 └─ ocr/                                            ║
║                    ├─ OcrUploader.tsx                             ║
║                    ├─ OcrResult.tsx                               ║
║                    ├─ HandwritingCanvas.tsx                       ║
║                    └─ HandwritingResult.tsx                       ║
╚══════════════════════════╤═══════════════════════════════════════╝
                           │  HTTP/REST (JWT Bearer Token)
                           ▼
╔══════════════════════════════════════════════════════════════════╗
║              BACKEND API — FastAPI (:8000)                        ║
║                                                                    ║
║  routers/             services/              models/              ║
║  ├─ auth.py           ├─ dictionary_service  ├─ user.py           ║
║  ├─ videos.py         │  └─ CC-CEDICT        ├─ video.py          ║
║  ├─ jobs.py           ├─ translation_cache   └─ job.py            ║
║  ├─ dictionary.py     ├─ tts_service                              ║
║  └─ ocr.py            └─ ocr_service                              ║
║                             └─ EasyOCR                            ║
║                                                                    ║
║  ┌─────────────────────────────────────────┐                      ║
║  │  Redis (:6379)  ← chạy trong container │                      ║
║  │  Task broker cho Celery                 │                      ║
║  └─────────────────────────────────────────┘                      ║
╚════════════╤═════════════════════════════════════════════════════╝
             │  Task Queue (Celery)
             ▼
╔══════════════════════════════════════════════════════════════════╗
║              CELERY WORKER (container riêng)                      ║
║                                                                    ║
║  pipeline/orchestrator.py                                         ║
║  │                                                                 ║
║  ├── Bước 1: HybridSubtitleExtractor                             ║
║  │           ├─ Có manual subtitle? → dùng luôn (0s AI)         ║
║  │           └─ Không có → WhisperEngine (faster-whisper)       ║
║  │                                                                 ║
║  ├── Bước 2: LLMPostProcessor (optional)                         ║
║  │           └─ Có ANTHROPIC_API_KEY → Claude sửa dấu câu       ║
║  │                                                                 ║
║  ├── Bước 3: PinyinConverter                                     ║
║  │           └─ pypinyin → pinyin có dấu thanh                  ║
║  │                                                                 ║
║  └── Bước 4: Translator                                          ║
║              └─ Google Translate → tiếng Việt                   ║
╚════════════╤═════════════════════════════════════════════════════╝
             │  SQLAlchemy ORM
             ▼
╔══════════════════════════════════════════════════════════════════╗
║              DATABASE — SQLite (/data/supchi4.db)                 ║
║                                                                    ║
║  users          videos           subtitles      processing_jobs   ║
║  ─────          ──────           ──────────     ───────────────   ║
║  id             id               id             id                ║
║  username       user_id          video_id       user_id           ║
║  email          youtube_url      start_time     status            ║
║  password_hash  video_id         end_time       progress          ║
║  is_active      title            chinese        subtitle_source   ║
║  created_at     thumbnail_url    pinyin         llm_used          ║
║                 created_at       vietnamese     celery_task_id    ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 🔄 Luồng Xử Lý Video (Chi Tiết)

```
Người dùng dán URL YouTube
          │
          ▼
POST /api/videos/analyze
          │
          ├─ Tạo ProcessingJob (status: queued)
          ├─ Push task vào Redis queue
          └─ Trả về { job_id } ngay lập tức (202 Accepted)

Frontend poll GET /api/jobs/{id} mỗi 3 giây
          │
          ▼
Celery Worker nhận task
          │
          ├─ [10%] Kiểm tra YouTube captions
          │         ├─ Có manual subtitle? → [40%] dùng luôn
          │         └─ Không có → [15%] Tải audio (yt-dlp)
          │                       [30%] Faster-Whisper nhận dạng
          │
          ├─ [55%] LLM sửa dấu câu (nếu có ANTHROPIC_API_KEY)
          ├─ [65%] Tạo Pinyin (pypinyin)
          ├─ [80%] Dịch tiếng Việt (Google Translate)
          └─ [100%] Lưu DB, cập nhật job status: done

Frontend nhận status "done"
          │
          └─ Fetch GET /api/videos/{id}
             Hiển thị VideoPlayer + SubtitlePanel đồng bộ
```

---

## 📦 Cấu Trúc Project

```
supchi4v3_dict/
│
├── docker-compose.yml          ← Khởi động toàn bộ (3 containers)
├── .env.example                ← Template biến môi trường
├── .gitignore
├── README.md
│
├── backend/
│   ├── Dockerfile              ← Python 3.11 + ffmpeg + redis-server
│   ├── start.sh                ← Khởi động Redis nội bộ + uvicorn
│   ├── requirements.txt        ← ~15 Python packages
│   ├── main.py                 ← FastAPI app, đăng ký routers, pre-warm models
│   │
│   ├── core/                   ── Infrastructure
│   │   ├── config.py           ← Settings từ environment variables
│   │   ├── database.py         ← SQLAlchemy engine (SQLite/PostgreSQL)
│   │   ├── security.py         ← bcrypt hash + JWT create/decode
│   │   └── deps.py             ← get_current_user dependency
│   │
│   ├── models/                 ── Database ORM Models
│   │   ├── user.py             ← Bảng users
│   │   ├── video.py            ← Bảng videos + subtitles
│   │   └── job.py              ← Bảng processing_jobs
│   │
│   ├── routers/                ── API Endpoints
│   │   ├── auth.py             ← /api/auth/* (register, login, me)
│   │   ├── videos.py           ← /api/videos/* (analyze, list, get, delete)
│   │   ├── jobs.py             ← /api/jobs/{id} (polling status)
│   │   ├── dictionary.py       ← /api/dictionary/* + /api/audio/*
│   │   └── ocr.py              ← /api/ocr + /api/handwriting
│   │
│   ├── services/               ── Business Logic
│   │   ├── dictionary_service.py ← CC-CEDICT parser, lookup, LRU cache
│   │   ├── translation_cache.py  ← 500+ định nghĩa dịch sẵn (0ms)
│   │   ├── tts_service.py        ← edge-tts + gTTS fallback
│   │   ├── ocr_service.py        ← EasyOCR wrapper + NLP pipeline
│   │   └── handwriting_service.py← Canvas → preprocess → OCR
│   │
│   ├── worker/                 ── Background Processing
│   │   ├── celery_app.py       ← Celery config (Redis broker)
│   │   └── tasks.py            ← process_video_task
│   │
│   └── pipeline/               ── AI Pipeline Modules
│       ├── orchestrator.py     ← Điều phối 4 bước với progress callback
│       ├── subtitle_extractor.py ← Hybrid: YouTube captions hoặc Whisper
│       ├── whisper_engine.py   ← faster-whisper (model small, CPU int8)
│       ├── llm_processor.py    ← Claude AI sửa dấu câu (optional)
│       ├── adapters.py         ← Adapter functions (add_pinyin, translate)
│       ├── pinyin_converter.py ← pypinyin wrapper
│       ├── translator.py       ← Google Translate wrapper
│       └── youtube.py          ← yt-dlp + proxy support
│
└── frontend/
    ├── Dockerfile              ← Node 20 multi-stage build
    ├── package.json
    ├── next.config.js          ← standalone output, rewrites /api/*
    ├── tailwind.config.js      ← Custom colors (ink, amber, jade)
    ├── tsconfig.json
    │
    ├── pages/                  ── Next.js Pages Router
    │   ├── index.tsx           ← Trang học video (main page)
    │   ├── dictionary/
    │   │   └── index.tsx       ← Trang tra từ điển
    │   ├── history/
    │   │   ├── index.tsx       ← Danh sách video đã xử lý
    │   │   └── [id].tsx        ← Xem lại video cụ thể
    │   └── auth/
    │       ├── login.tsx       ← Trang đăng nhập
    │       └── register.tsx    ← Trang đăng ký
    │
    ├── components/             ── React Components
    │   ├── VideoPlayer.tsx     ← YouTube embedded player (react-youtube)
    │   ├── SubtitlePanel.tsx   ← Danh sách subtitle, auto-scroll
    │   ├── SubtitleItem.tsx    ← Một dòng subtitle, clickable words
    │   ├── UrlInput.tsx        ← Input URL + validation
    │   ├── JobStatusBar.tsx    ← Progress bar realtime (poll 3s)
    │   ├── layout/
    │   │   └── Navbar.tsx      ← Header: tabs + user badge + logout
    │   ├── auth/
    │   │   └── AuthForm.tsx    ← Form đăng nhập/đăng ký dùng chung
    │   ├── dictionary/
    │   │   ├── DictionaryCard.tsx ← Card kết quả: đa nghĩa + audio
    │   │   └── WordPopup.tsx      ← Popup khi click từ trong subtitle
    │   ├── history/
    │   │   └── VideoCard.tsx   ← Card lịch sử với thumbnail
    │   └── ocr/
    │       ├── OcrUploader.tsx ← Upload ảnh hoặc chụp camera
    │       ├── OcrResult.tsx   ← Hiển thị kết quả OCR + clickable words
    │       ├── HandwritingCanvas.tsx ← Canvas vẽ chữ (Bezier, touch)
    │       └── HandwritingResult.tsx ← Kết quả + gợi ý candidates
    │
    ├── lib/
    │   ├── api.ts              ← HTTP client tự đính JWT header
    │   └── auth-context.tsx    ← React Context: user, login, logout
    │
    └── types/
        └── subtitle.ts         ← TypeScript interfaces
```

---

## 🛠️ Tech Stack

### Backend
| Thư viện | Phiên bản | Vai trò |
|----------|-----------|---------|
| FastAPI | 0.111.0 | REST API framework, async, tự động Swagger |
| Uvicorn | 0.30.1 | ASGI server |
| SQLAlchemy | 2.0.30 | ORM, hỗ trợ SQLite và PostgreSQL |
| Celery | 5.3.6 | Background job queue |
| Redis | 5.0.4 | Message broker cho Celery |
| faster-whisper | 1.0.3 | Speech-to-text, nhanh 4–5x so với Whisper gốc |
| yt-dlp | 2024.5.27 | Tải audio/subtitle từ YouTube |
| pypinyin | 0.51.0 | Chuyển chữ Hán → Pinyin có dấu thanh |
| jieba | 0.42.1 | Word segmentation tiếng Trung |
| deep-translator | 1.11.4 | Google Translate (miễn phí) |
| edge-tts | ≥6.1.18 | Microsoft Edge TTS (giọng đọc chuẩn) |
| gTTS | 2.5.1 | Google TTS (fallback) |
| EasyOCR | 1.7.1 | OCR nhận dạng chữ Hán từ ảnh |
| Pillow | ≥10.0 | Xử lý ảnh (tiền xử lý handwriting) |
| python-jose | 3.3.0 | JWT encode/decode |
| bcrypt | 4.0.1 | Password hashing |
| anthropic | ≥0.25.0 | Claude AI API (optional) |
| ffmpeg | system | Xử lý audio/video |

### Frontend
| Thư viện | Phiên bản | Vai trò |
|----------|-----------|---------|
| Next.js | 14.2.3 | React framework, Pages Router |
| TypeScript | 5.4.5 | Type safety |
| TailwindCSS | 3.4.3 | Utility-first CSS |
| react-youtube | 10.1.0 | YouTube player component |
| clsx | 2.1.1 | Conditional className |

### Infrastructure
| Thành phần | Công nghệ |
|------------|-----------|
| Containerization | Docker + Docker Compose |
| Database (dev) | SQLite |
| Database (prod) | PostgreSQL (thay DATABASE_URL) |
| Từ điển | CC-CEDICT (120,000+ entries, open source) |
| AI Model (STT) | Whisper small (244M params, int8 quantized) |
| AI Model (OCR) | EasyOCR ch_sim (Chinese Simplified) |

---

## 🗄️ Database Schema

```sql
-- Tài khoản
CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    username      VARCHAR(50)  UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,      -- bcrypt hash
    is_active     BOOLEAN      DEFAULT TRUE,
    created_at    TIMESTAMP    DEFAULT NOW()
);

-- Video đã xử lý
CREATE TABLE videos (
    id            INTEGER PRIMARY KEY,
    user_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
    youtube_url   VARCHAR(500) NOT NULL,
    video_id      VARCHAR(20)  NOT NULL,      -- YouTube video ID (11 chars)
    title         VARCHAR(500),
    thumbnail_url VARCHAR(500),
    created_at    TIMESTAMP DEFAULT NOW()
);

-- Subtitle của video
CREATE TABLE subtitles (
    id          INTEGER PRIMARY KEY,
    video_id    INTEGER REFERENCES videos(id) ON DELETE CASCADE,
    start_time  FLOAT NOT NULL,
    end_time    FLOAT NOT NULL,
    chinese     TEXT NOT NULL,
    pinyin      TEXT NOT NULL,
    vietnamese  TEXT NOT NULL
);

-- Trạng thái xử lý background
CREATE TABLE processing_jobs (
    id               INTEGER PRIMARY KEY,
    user_id          INTEGER REFERENCES users(id),
    video_id         INTEGER REFERENCES videos(id),
    status           VARCHAR(20) DEFAULT 'queued',  -- queued|processing|done|failed
    progress         FLOAT DEFAULT 0,               -- 0–100
    youtube_url      VARCHAR(500) NOT NULL,
    subtitle_source  VARCHAR(50),   -- 'manual' | 'whisper'
    llm_used         VARCHAR(10),   -- 'yes' | 'no'
    error_message    TEXT,
    celery_task_id   VARCHAR(200),
    created_at       TIMESTAMP DEFAULT NOW(),
    finished_at      TIMESTAMP
);
```

---

## 🔌 API Reference

### Authentication
```
POST /api/auth/register   { username, email, password }
                          → { access_token, refresh_token }

POST /api/auth/login      { email, password }
                          → { access_token, refresh_token }

POST /api/auth/refresh    { refresh_token }
                          → { access_token, refresh_token }

GET  /api/auth/me         [Bearer Token]
                          → { id, username, email, created_at }
```

### Videos & Jobs
```
POST /api/videos/analyze  [Bearer] { url, title? }
                          → { job_id, status: "queued" }    (202 Accepted)

GET  /api/jobs/{id}       [Bearer]
                          → { id, status, progress, subtitle_source, ... }

GET  /api/videos          [Bearer] ?skip=0&limit=20
                          → [{ id, video_id, title, subtitle_count, ... }]

GET  /api/videos/{id}     [Bearer]
                          → { ...video, subtitles: [...] }

DELETE /api/videos/{id}   [Bearer] → 204 No Content
```

### Dictionary
```
GET /api/dictionary?word=学习
→ {
    "word": "学习",
    "pinyin": "xuéxí",
    "meanings_vi": ["học", "học tập", "nghiên cứu"],
    "pos": "động từ",
    "grammar": "Từ loại: động từ. Có 2 nghĩa trong CC-CEDICT.",
    "example": { "zh": "...", "vi": "..." },
    "definitions_en": ["to learn", "to study"],
    "audio_url": "/api/audio/abc123.mp3"
  }

GET /api/dictionary/segment?text=我喜欢学习中文
→ { "text": "...", "words": ["我", "喜欢", "学习", "中文"] }

GET /api/audio/{filename}.mp3   → MP3 audio stream
```

### OCR
```
POST /api/ocr             multipart/form-data { file: image }
                          → {
                              "raw_text": "你好世界",
                              "lines": ["你好", "世界"],
                              "pinyin": "nǐ hǎo shì jiè",
                              "vietnamese": "Xin chào thế giới",
                              "words": [{ "word", "pinyin", "meaning" }],
                              "confidence": 0.95
                            }

POST /api/handwriting     { "image_data": "data:image/png;base64,..." }
                          → {
                              "candidates": ["你", "好"],
                              "best": "你好",
                              "pinyin": ["nǐ", "hǎo"],
                              "meanings": ["bạn", "tốt"],
                              "vietnamese": "xin chào",
                              "confidence": 0.87
                            }
```

---

## 🚀 Hướng Dẫn Cài Đặt & Triển Khai

### Yêu Cầu Hệ Thống

| Thành phần | Tối thiểu | Khuyến nghị |
|------------|-----------|-------------|
| RAM | 5GB | 8GB |
| Disk | 5GB | 10GB |
| Docker | 24.x+ | Mới nhất |
| Internet | Bắt buộc | — |

---

### Bước 1 — Lấy Source Code

```bash
git clone <repo-url> supchi4v3_dict
cd supchi4v3_dict
cp .env.example .env
```

---

### Bước 2 — Cấu Hình (`.env`)

```bash
# Bắt buộc đổi khi deploy production
SECRET_KEY=your-very-long-random-secret-key-here

# Database mặc định SQLite (đổi nếu dùng PostgreSQL)
DATABASE_URL=sqlite:////data/supchi4.db

# Bật LLM sửa dấu câu (optional — bỏ trống để disable)
ANTHROPIC_API_KEY=sk-ant-...
```

---

### Bước 3 — Cài Đặt Docker Mirror (Trung Quốc)

Nếu Docker Hub bị chặn, cấu hình mirror trước:

```bash
# Tìm file daemon.json của Docker và thêm:
{
  "registry-mirrors": [
    "https://dockerproxy.com",
    "https://docker.m.daocloud.io"
  ]
}
# Restart Docker
```

---

### Bước 4 — Cấu Hình Proxy YouTube (Trung Quốc)

YouTube bị GFW chặn. Cần proxy để tải video.

```bash
# Tìm IP gateway và port proxy đang chạy trên host
ip route | grep default      # → 172.25.80.1
netstat -an | grep LISTEN    # → tìm port VPN (7897, 7890, 1080...)

# Test
curl --proxy http://172.25.80.1:7897 https://youtube.com --max-time 5
```

Cập nhật `docker-compose.yml`:
```yaml
- HTTP_PROXY=http://172.25.80.1:PORT    # ← thay PORT
- HTTPS_PROXY=http://172.25.80.1:PORT
```

**Lưu ý:** Bật **"Allow LAN"** trong VPN client (Clash/V2Ray/...).

---

### Bước 5 — Build & Chạy

```bash
docker compose up --build -d
```

**Lần đầu tiên** (~20–30 phút):
- Tải Python/Node base images
- Cài ~1GB Python packages (qua Tsinghua PyPI mirror)
- Tải Whisper model ~500MB (qua hf-mirror.com)
- Tải EasyOCR models ~500MB (lần đầu dùng tính năng OCR)
- Build Next.js production bundle

**Từ lần 2 trở đi**: ~1–2 phút (Docker layer cache)

---

### Bước 6 — Kiểm Tra

```bash
docker compose ps
# Chờ tất cả "Up" và backend "healthy"

curl http://localhost:8000/health
# → {"status":"ok","version":"3.2.0"}
```

| Dịch vụ | URL |
|---------|-----|
| 🌐 Web App | http://localhost:3000 |
| 📖 Từ điển | http://localhost:3000/dictionary |
| 🔍 OCR | http://localhost:3000/ocr |
| 📋 Swagger | http://localhost:8000/docs |

---

## ⚙️ Vận Hành

### Lệnh Thường Dùng

```bash
# Xem trạng thái containers
docker compose ps

# Xem log realtime của tất cả
docker compose logs -f

# Xem log worker (nơi AI pipeline chạy)
docker compose logs -f worker

# Restart một service sau khi sửa file Python
docker compose restart backend

# Dừng + giữ data
docker compose down

# Dừng + xoá toàn bộ data (reset hoàn toàn)
docker compose down -v
```

### Backup & Restore

```bash
# Backup SQLite database
docker cp supchi4-backend:/data/supchi4.db ./backup_$(date +%Y%m%d).db

# Restore
docker cp ./backup.db supchi4-backend:/data/supchi4.db
docker compose restart backend
```

### Scale Worker

```bash
# Chạy 2 worker song song (xử lý nhiều video cùng lúc)
docker compose up --scale worker=2 -d
```

---

## 🌍 Tối Ưu Cho Môi Trường Trung Quốc (GFW)

| Dịch vụ | Trạng thái | Giải pháp tích hợp |
|---------|------------|-------------------|
| Docker Hub | ❌ Bị chặn | Mirror qua `daemon.json` |
| PyPI | ⚠️ Chậm | `pypi.tuna.tsinghua.edu.cn` trong Dockerfile |
| npm | ⚠️ Chậm | `registry.npmmirror.com` trong Dockerfile |
| HuggingFace | ❌ Bị chặn | `HF_ENDPOINT=https://hf-mirror.com` |
| YouTube | ❌ Bị chặn | Proxy qua `HTTP_PROXY` + yt-dlp proxy |
| PostgreSQL/Redis images | ❌ Khó pull | Thay bằng SQLite + Redis trong container |
| Google Translate | ✅ Hoạt động | Dùng trực tiếp (không bị chặn) |
| CC-CEDICT | ✅ Hoạt động | Tải từ mdbg.net trực tiếp |

---

## ❓ Xử Lý Lỗi Thường Gặp

| Triệu chứng | Nguyên nhân | Cách sửa |
|-------------|-------------|----------|
| Job mãi ở `queued` | Worker chưa kết nối Redis | `docker compose logs worker` kiểm tra lỗi |
| `Network is unreachable` khi xử lý video | YouTube bị chặn, proxy chưa đúng | Kiểm tra port proxy, bật Allow LAN |
| Tra từ điển rất chậm | Google Translate bị rate limit | Chờ vài giây, từ phổ biến sẽ cache lại |
| OCR không nhận dạng được | Ảnh quá mờ/tối | Chụp ảnh đủ sáng, chữ phải rõ ràng |
| Handwriting không nhận dạng | Chữ quá nhỏ hoặc phức tạp | Viết to hơn, từng chữ riêng biệt |
| `HuggingFace download failed` | huggingface.co bị chặn | Kiểm tra `HF_ENDPOINT=https://hf-mirror.com` |
| Login 401 sau restart | Database bị reset | Đăng ký tài khoản mới |
| Audio không phát được | edge-tts token hết hạn | Tự động fallback sang gTTS |
| Build frontend lỗi TypeScript | Cache cũ | `docker compose build --no-cache frontend` |

---

## 🔮 Roadmap Phát Triển

- [ ] **Flashcard system** — tự động tạo thẻ học từ subtitle video
- [ ] **Spaced repetition** — lịch ôn tập thông minh dựa trên Anki algorithm
- [ ] **Grammar analysis** — phân tích cấu trúc câu, gắn nhãn từ loại
- [ ] **Karaoke mode** — highlight từng từ theo thời gian thực khi video chạy
- [ ] **Mobile app** — React Native wrapper
- [ ] **Offline mode** — tải video về để học không cần internet
- [ ] **Community** — chia sẻ video hay giữa người dùng
- [ ] **Progress tracking** — theo dõi số từ đã học, streak hàng ngày