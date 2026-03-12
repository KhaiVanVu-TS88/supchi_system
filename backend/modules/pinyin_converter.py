"""
pinyin_converter.py - Module chuyển đổi chữ Hán sang Pinyin

Sử dụng thư viện pypinyin để chuyển đổi chữ Hán thành ký hiệu phiên âm Pinyin.
Pinyin giúp người học biết cách phát âm tiếng Trung chính xác.
"""

from pypinyin import pinyin, Style
from typing import List


def convert_to_pinyin(chinese_text: str) -> str:
    """
    Chuyển đổi văn bản chữ Hán thành Pinyin có dấu thanh điệu.
    
    Ví dụ:
        Input:  "你好"
        Output: "nǐ hǎo"
    
    Args:
        chinese_text: Chuỗi văn bản tiếng Trung
        
    Returns:
        Chuỗi Pinyin với dấu thanh điệu (tone marks)
    """
    # Style.TONE: Pinyin với dấu thanh điệu đầy đủ (nǐ hǎo)
    # heteronym=False: Chọn cách đọc phổ biến nhất cho đa âm tự
    pinyin_list = pinyin(chinese_text, style=Style.TONE, heteronym=False)
    
    # pinyin() trả về list of lists, ví dụ: [['nǐ'], ['hǎo']]
    # Ghép lại thành chuỗi có khoảng cách giữa các âm tiết
    result = " ".join([item[0] for item in pinyin_list])
    
    return result


def convert_batch(texts: List[str]) -> List[str]:
    """
    Chuyển đổi nhiều câu tiếng Trung sang Pinyin cùng lúc.
    
    Args:
        texts: Danh sách các câu tiếng Trung
        
    Returns:
        Danh sách Pinyin tương ứng
    """
    return [convert_to_pinyin(text) for text in texts]