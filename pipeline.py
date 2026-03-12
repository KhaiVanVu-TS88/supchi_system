"""
pipeline.py - Pipeline xử lý AI chính

Kết hợp tất cả các module để tạo ra quy trình xử lý hoàn chỉnh:
1. Tải audio từ YouTube
2. Nhận dạng giọng nói (Speech-to-Text)
3. Chuyển đổi Pinyin
4. Dịch sang tiếng Việt
5. Trả về danh sách subtitle

Đây là "bộ não" của ứng dụng, điều phối luồng dữ liệu giữa các module.
"""

import os
from typing import List, Dict, Callable, Optional

from modules.youtube import download_audio
from modules.whisper_engine import transcribe_audio
from modules.pinyin_converter import convert_to_pinyin
from modules.translator import translate_to_vietnamese


def process_video(
    youtube_url: str,
    progress_callback: Optional[Callable[[str, int], None]] = None
) -> List[Dict]:
    """
    Pipeline chính: xử lý video YouTube và tạo subtitle học tiếng Trung.
    
    Args:
        youtube_url: URL video YouTube
        progress_callback: Hàm callback để cập nhật tiến trình (message, percent)
        
    Returns:
        Danh sách subtitle, mỗi subtitle có format:
        {
            "start": 1.0,        # Thời gian bắt đầu (giây)
            "end": 3.0,          # Thời gian kết thúc (giây)
            "chinese": "你好",    # Văn bản tiếng Trung
            "pinyin": "nǐ hǎo",  # Phiên âm Pinyin
            "vietnamese": "Xin chào"  # Bản dịch tiếng Việt
        }
    """
    
    def update_progress(message: str, percent: int):
        """Gửi cập nhật tiến trình nếu có callback."""
        if progress_callback:
            progress_callback(message, percent)
        print(f"[{percent}%] {message}")
    
    audio_path = None
    
    try:
        # ===== BƯỚC 1: TẢI AUDIO =====
        update_progress("⬇️ Đang tải audio từ YouTube...", 10)
        audio_path = download_audio(youtube_url)
        update_progress("✅ Đã tải audio thành công", 25)
        
        # ===== BƯỚC 2: NHẬN DẠNG GIỌNG NÓI =====
        update_progress("🎙️ Đang nhận dạng giọng nói (có thể mất vài phút)...", 30)
        segments = transcribe_audio(audio_path)
        
        if not segments:
            raise ValueError("Không nhận dạng được giọng nói từ video này. "
                           "Hãy thử video khác có tiếng Trung rõ ràng hơn.")
        
        update_progress(f"✅ Đã nhận dạng {len(segments)} câu", 60)
        
        # ===== BƯỚC 3 & 4: TẠO SUBTITLE =====
        update_progress("📝 Đang tạo Pinyin và dịch sang tiếng Việt...", 65)
        
        subtitles = []
        total = len(segments)
        
        for i, segment in enumerate(segments):
            chinese_text = segment["text"]
            
            # Chuyển đổi sang Pinyin
            pinyin_text = convert_to_pinyin(chinese_text)
            
            # Dịch sang tiếng Việt
            vietnamese_text = translate_to_vietnamese(chinese_text)
            
            # Tạo subtitle object
            subtitle = {
                "start": segment["start"],
                "end": segment["end"],
                "chinese": chinese_text,
                "pinyin": pinyin_text,
                "vietnamese": vietnamese_text
            }
            subtitles.append(subtitle)
            
            # Cập nhật tiến trình xử lý từng câu
            progress = 65 + int((i + 1) / total * 30)
            update_progress(
                f"📝 Đang xử lý câu {i+1}/{total}...",
                progress
            )
        
        update_progress("🎉 Hoàn thành! Đang hiển thị kết quả...", 100)
        
        return subtitles
        
    finally:
        # Dọn dẹp file audio tạm sau khi xử lý xong
        # Dù có lỗi hay không, vẫn phải xóa file tạm
        if audio_path and os.path.exists(audio_path):
            os.remove(audio_path)
            # Xóa thư mục tạm nếu rỗng
            temp_dir = os.path.dirname(audio_path)
            if os.path.exists(temp_dir) and not os.listdir(temp_dir):
                os.rmdir(temp_dir)