"""
whisper_engine.py - Module nhận dạng giọng nói

Sử dụng faster-whisper để chuyển đổi audio tiếng Trung thành văn bản.
faster-whisper nhanh hơn whisper gốc nhờ tối ưu hóa CTranslate2.
"""

from faster_whisper import WhisperModel
from typing import List, Dict


# Khởi tạo model một lần duy nhất để tránh tải lại nhiều lần
# Model "small" cân bằng tốt giữa tốc độ và độ chính xác
_model = None


def get_model() -> WhisperModel:
    """
    Lazy loading: chỉ tải model khi cần thiết.
    Tái sử dụng model đã tải để tiết kiệm bộ nhớ và thời gian.
    """
    global _model
    if _model is None:
        # Sử dụng model "small" với CPU
        # Có thể đổi thành "medium" hoặc "large-v2" để tăng độ chính xác
        # device="cpu" phù hợp với môi trường Docker không có GPU
        _model = WhisperModel("small", device="cpu", compute_type="int8")
    return _model


def transcribe_audio(audio_path: str) -> List[Dict]:
    """
    Nhận dạng giọng nói từ file audio tiếng Trung.
    
    Args:
        audio_path: Đường dẫn đến file audio WAV
        
    Returns:
        Danh sách các segment, mỗi segment có:
        - start: thời gian bắt đầu (giây)
        - end: thời gian kết thúc (giây)  
        - text: văn bản tiếng Trung đã nhận dạng
    """
    model = get_model()
    
    # Chạy nhận dạng giọng nói
    # language="zh" = tiếng Trung
    # beam_size=5 = cân bằng tốc độ và độ chính xác
    segments, info = model.transcribe(
        audio_path,
        language="zh",        # Tiếng Trung (Mandarin)
        beam_size=5,           # Số beam search
        vad_filter=True,       # Lọc khoảng lặng (Voice Activity Detection)
        vad_parameters=dict(
            min_silence_duration_ms=500  # Khoảng lặng tối thiểu 500ms
        )
    )
    
    # Chuyển đổi generator thành list các dict
    result = []
    for segment in segments:
        # Làm sạch text: xóa khoảng trắng thừa
        text = segment.text.strip()
        
        # Bỏ qua segment rỗng
        if not text:
            continue
            
        result.append({
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "chinese": text
        })
    
    return result