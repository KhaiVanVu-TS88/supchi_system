# Hướng dẫn tích hợp OCR vào hệ thống hiện tại

## Bước 1 — Thêm dependencies vào requirements.txt

```txt
# OCR
easyocr==1.7.1
Pillow>=10.0.0
```

## Bước 2 — Copy các file mới vào project

```
backend/services/ocr_service.py       ← copy vào
backend/services/handwriting_service.py ← copy vào
backend/routers/ocr.py                ← copy vào

frontend/pages/ocr/index.tsx          ← copy vào
frontend/components/ocr/OcrUploader.tsx ← copy vào
frontend/components/ocr/OcrResult.tsx   ← copy vào
frontend/components/ocr/HandwritingCanvas.tsx ← copy vào
frontend/components/ocr/HandwritingResult.tsx ← copy vào
```

## Bước 3 — Đăng ký router trong main.py

```python
# backend/main.py — thêm 2 dòng

from routers import auth, videos, jobs, dictionary, ocr   # thêm ocr

app.include_router(ocr.router)   # thêm dòng này
```

## Bước 4 — Thêm tab OCR vào Navbar

```tsx
// frontend/components/layout/Navbar.tsx
// Thêm vào mảng navLinks:

{ href: '/ocr', label: '🔍 OCR', match: (p: string) => p.startsWith('/ocr') },
```

## Bước 5 — Rebuild

```bash
docker compose up --build -d
```

## Lưu ý quan trọng

EasyOCR tải model ~500MB lần đầu khởi động backend.
Trong môi trường Trung Quốc, thêm biến môi trường để tải từ mirror:

```yaml
# docker-compose.yml — thêm vào backend environment
- EASYOCR_MODULE_PATH=/root/.EasyOCR
```

Model được cache sau lần đầu — restart container không cần tải lại.
Thêm volume để giữ cache:

```yaml
volumes:
  - easyocr_cache:/root/.EasyOCR
```

Và khai báo volume:

```yaml
volumes:
  easyocr_cache:
  whisper_cache:
  sqlite_data:
```
