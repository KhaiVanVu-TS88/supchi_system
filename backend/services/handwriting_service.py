import sys
sys.path.insert(0, "/app")

"""
services/handwriting_service.py — Handwriting Recognition Service

Chiến lược: Canvas PNG → Tiền xử lý ảnh → EasyOCR → NLP pipeline

Tại sao không dùng model ML chuyên biệt?
  - Model như CASIA/HanBitNet cần file ~200MB+ và phức tạp khi deploy
  - EasyOCR đã được train trên handwriting dataset
  - Preprocessing (contrast + threshold) cải thiện đáng kể độ chính xác

Hạn chế:
  - Chữ viết phải tương đối rõ ràng
  - Nền tối/chữ sáng cần invert trước
"""
import io
import logging
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps

logger = logging.getLogger(__name__)


def recognize_handwriting(image_bytes: bytes) -> dict:
    """
    Nhận dạng chữ viết tay từ canvas PNG.

    Pipeline:
      1. Tiền xử lý ảnh (contrast, threshold, denoise)
      2. EasyOCR nhận dạng
      3. Trả về candidates + pinyin + nghĩa

    Returns:
        {
          "candidates": ["你", "好"],
          "best": "你好",
          "pinyin": ["nǐ", "hǎo"],
          "meanings": ["bạn/anh/chị", "tốt/khỏe"],
          "pinyin_full": "nǐ hǎo",
          "vietnamese": "xin chào"
        }
    """
    # Tiền xử lý
    processed = _preprocess_handwriting(image_bytes)

    # OCR
    from services.ocr_service import get_reader
    reader = get_reader()
    img_array = np.array(processed)

    results = reader.readtext(
        img_array,
        detail=1,
        paragraph=False,
        # Với handwriting: giảm min_size để nhận ký tự nhỏ
        min_size=10,
        # Tăng text_threshold để tránh nhiễu
        text_threshold=0.5,
        low_text=0.3,
    )

    # Thu thập candidates
    candidates = []
    for (bbox, text, conf) in results:
        text = text.strip()
        # Chỉ lấy ký tự Hán
        chinese_chars = "".join(c for c in text if '\u4e00' <= c <= '\u9fff')
        if chinese_chars and conf > 0.3:
            candidates.append((chinese_chars, conf))

    if not candidates:
        return {"error": "Không nhận dạng được chữ. Hãy viết rõ hơn trên nền trắng."}

    # Sắp xếp theo confidence
    candidates.sort(key=lambda x: x[1], reverse=True)
    best_text = candidates[0][0]
    candidate_chars = [c for c, _ in candidates[:5]]  # Top 5

    # NLP pipeline
    from pipeline.pinyin_converter import convert_to_pinyin
    from pipeline.translator import translate_to_vietnamese
    from services.dictionary_service import lookup

    pinyins = [convert_to_pinyin(c) for c in candidate_chars]
    pinyin_full = convert_to_pinyin(best_text)
    vietnamese = translate_to_vietnamese(best_text)

    # Nghĩa của từng ký tự
    meanings = []
    for c in candidate_chars:
        entry = lookup(c)
        if entry and entry.get("meanings_vi"):
            meanings.append(entry["meanings_vi"][0])
        else:
            m = translate_to_vietnamese(c)
            meanings.append(m or c)

    return {
        "candidates":    candidate_chars,
        "best":          best_text,
        "pinyin":        pinyins,
        "pinyin_full":   pinyin_full,
        "meanings":      meanings,
        "vietnamese":    vietnamese,
        "confidence":    round(candidates[0][1], 3),
    }


def _preprocess_handwriting(image_bytes: bytes) -> Image.Image:
    """
    Tiền xử lý ảnh handwriting để tăng độ chính xác OCR:
      1. Chuyển grayscale
      2. Invert nếu nền tối (canvas thường vẽ trắng trên đen)
      3. Tăng contrast
      4. Threshold (binary)
      5. Denoise nhẹ
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

    # Resize nếu quá nhỏ (OCR cần ít nhất 32px chiều cao ký tự)
    w, h = img.size
    if w < 200 or h < 200:
        scale = max(200 / w, 200 / h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    # Grayscale
    gray = img.convert("L")
    arr = np.array(gray)

    # Auto-detect: nền tối → invert
    # Canvas thường có nền đen (#1a1a1a) và chữ trắng
    mean_brightness = arr.mean()
    if mean_brightness < 128:
        gray = ImageOps.invert(gray)
        arr = np.array(gray)

    # Tăng contrast mạnh
    enhancer = ImageEnhance.Contrast(gray)
    enhanced = enhancer.enhance(3.0)

    # Binary threshold: pixel > 128 → trắng, còn lại → đen
    arr2 = np.array(enhanced)
    binary = (arr2 > 100).astype(np.uint8) * 255
    result = Image.fromarray(binary)

    # Slight denoise
    result = result.filter(ImageFilter.MedianFilter(size=3))

    return result
