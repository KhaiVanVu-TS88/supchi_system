"""
youtube.py - Module tải audio từ YouTube

Sử dụng yt-dlp để tải audio từ URL YouTube.
Lưu file audio tạm thời để xử lý tiếp theo.

Fix lỗi HTTP 403: YouTube chặn bot → giả lập trình duyệt thật bằng headers
"""

import yt_dlp
import os
import tempfile
import glob


def download_audio(youtube_url: str) -> str:
    """
    Tải audio từ URL YouTube và trả về đường dẫn file audio.
    
    Args:
        youtube_url: URL của video YouTube cần tải
        
    Returns:
        Đường dẫn đến file audio đã tải về (định dạng .wav)
    """
    # Tạo thư mục tạm để lưu audio
    temp_dir = tempfile.mkdtemp()
    output_path = os.path.join(temp_dir, "audio")
    
    # Cấu hình yt-dlp để tải audio
    ydl_opts = {
        # Ưu tiên audio-only, fallback sang video nếu cần
        # bestaudio[ext=m4a]: ưu tiên M4A (YouTube thường có)
        # bestaudio: bất kỳ audio nào tốt nhất
        # best: fallback cuối cùng (tải video rồi extract audio)
        "format": "bestaudio[ext=m4a]/bestaudio/best",

        # Chuyển đổi sang WAV để whisper xử lý tốt hơn
        "postprocessors": [{
            "key": "FFmpegExtractAudio",
            "preferredcodec": "wav",
            "preferredquality": "192",
        }],
        
        # Đường dẫn lưu file
        "outtmpl": output_path,
        
        # ===== QUAN TRỌNG: Giả lập trình duyệt để tránh HTTP 403 =====
        # YouTube phát hiện bot qua User-Agent và chặn bằng mã 403
        # Giải pháp: dùng header y hệt trình duyệt Chrome thật
        "http_headers": {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": "https://www.youtube.com/",
        },

        # Dùng extractor android để bypass một số hạn chế
        # YouTube có API riêng cho app Android, ít bị chặn hơn
        "extractor_args": {
            "youtube": {
                "player_client": ["android", "web"],
            }
        },

        # Tắt thông báo không cần thiết
        "quiet": False,   # Bật để debug nếu cần
        "no_warnings": False,
        
        # Thử lại tối đa 3 lần nếu bị lỗi mạng
        "retries": 3,
        
        # Bỏ qua lỗi của từng fragment (cho video dài)
        "ignoreerrors": False,
    }
    
    # Thực hiện tải audio
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([youtube_url])
    
    # yt-dlp tự động thêm đuôi .wav vào tên file
    audio_file = output_path + ".wav"
    
    # Kiểm tra file tồn tại
    if not os.path.exists(audio_file):
        # Tìm bất kỳ file audio nào trong thư mục tạm (fallback)
        found = glob.glob(os.path.join(temp_dir, "*"))
        if found:
            # Nếu có file khác tên, trả về file đó
            return found[0]
        raise FileNotFoundError(
            f"Không tìm thấy file audio sau khi tải.\n"
            f"Thư mục tạm: {temp_dir}\n"
            f"Có thể YouTube đang chặn tải. Hãy thử video khác."
        )
    
    return audio_file


def get_video_id(youtube_url: str) -> str:
    """
    Lấy video ID từ URL YouTube để nhúng video vào giao diện.
    
    Args:
        youtube_url: URL của video YouTube
        
    Returns:
        Video ID (ví dụ: 'dQw4w9WgXcQ')
    """
    import re
    
    # Các pattern URL YouTube phổ biến
    patterns = [
        r'(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)',
        r'youtube\.com\/embed\/([^&\n?#]+)',
        r'youtube\.com\/v\/([^&\n?#]+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, youtube_url)
        if match:
            return match.group(1)
    
    return None