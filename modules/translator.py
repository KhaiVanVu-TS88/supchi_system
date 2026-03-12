"""
translator.py - Module dịch tiếng Trung sang tiếng Việt

Sử dụng deep-translator với Google Translate API (miễn phí, không cần key)
để dịch văn bản tiếng Trung sang tiếng Việt.
"""

from deep_translator import GoogleTranslator
from typing import List
import time


def translate_to_vietnamese(chinese_text: str) -> str:
    """
    Dịch một câu tiếng Trung sang tiếng Việt.
    
    Args:
        chinese_text: Văn bản tiếng Trung cần dịch
        
    Returns:
        Văn bản tiếng Việt đã dịch
    """
    try:
        # Khởi tạo translator với:
        # source="zh-CN": Tiếng Trung giản thể
        # target="vi": Tiếng Việt
        translator = GoogleTranslator(source="zh-CN", target="vi")
        
        # Thực hiện dịch
        result = translator.translate(chinese_text)
        
        return result if result else chinese_text
        
    except Exception as e:
        # Nếu dịch thất bại, trả về text gốc để không bị crash
        print(f"Lỗi khi dịch '{chinese_text}': {e}")
        return f"[Lỗi dịch] {chinese_text}"


def translate_batch(texts: List[str], delay: float = 0.3) -> List[str]:
    """
    Dịch nhiều câu tiếng Trung sang tiếng Việt.
    
    Có delay giữa các request để tránh bị Google chặn do gọi quá nhiều.
    
    Args:
        texts: Danh sách câu tiếng Trung
        delay: Thời gian chờ giữa các request (giây)
        
    Returns:
        Danh sách bản dịch tiếng Việt
    """
    results = []
    
    for i, text in enumerate(texts):
        translation = translate_to_vietnamese(text)
        results.append(translation)
        
        # Thêm delay để tránh rate limiting từ Google
        # Không cần delay sau request cuối cùng
        if i < len(texts) - 1:
            time.sleep(delay)
    
    return results