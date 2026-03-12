"""
app.py - Giao diện người dùng Streamlit

Đây là file chính của ứng dụng. Cung cấp giao diện web để:
1. Người dùng nhập URL YouTube
2. Chạy pipeline xử lý AI
3. Hiển thị subtitle học tiếng Trung

Chạy bằng lệnh: streamlit run app.py
"""

import streamlit as st
from modules.youtube import get_video_id
from pipeline import process_video

# ===== CẤU HÌNH TRANG =====
st.set_page_config(
    page_title="Học Tiếng Trung Qua YouTube",
    page_icon="🈶",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# ===== CSS TÙY CHỈNH =====
# Thiết kế giao diện đẹp, lấy cảm hứng từ phong cách Á Đông hiện đại
st.markdown("""
<style>
    /* Import Google Fonts */
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap');
    
    /* Nền tổng thể */
    .stApp {
        background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
        min-height: 100vh;
        font-family: 'Be Vietnam Pro', sans-serif;
    }
    
    /* Ẩn các phần tử mặc định của Streamlit */
    #MainMenu, footer, header {visibility: hidden;}
    
    /* Container chính */
    .main-container {
        max-width: 1100px;
        margin: 0 auto;
        padding: 2rem 1rem;
    }
    
    /* Tiêu đề lớn */
    .hero-title {
        text-align: center;
        padding: 3rem 0 1rem;
    }
    
    .hero-title h1 {
        font-family: 'Noto Serif SC', serif;
        font-size: 4rem;
        font-weight: 700;
        background: linear-gradient(120deg, #f6d365, #fda085, #f093fb);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin: 0;
        letter-spacing: -1px;
        line-height: 1.1;
    }
    
    .hero-subtitle {
        color: rgba(255,255,255,0.55);
        font-size: 1.05rem;
        margin-top: 0.75rem;
        letter-spacing: 0.02em;
    }
    
    /* Ô nhập URL */
    .stTextInput > div > div > input {
        background: rgba(255,255,255,0.07) !important;
        border: 1.5px solid rgba(255,255,255,0.15) !important;
        border-radius: 12px !important;
        color: white !important;
        font-size: 1rem !important;
        padding: 0.75rem 1rem !important;
        transition: border-color 0.2s;
    }
    
    .stTextInput > div > div > input:focus {
        border-color: #f6d365 !important;
        box-shadow: 0 0 0 3px rgba(246,211,101,0.15) !important;
    }
    
    .stTextInput > div > div > input::placeholder {
        color: rgba(255,255,255,0.3) !important;
    }
    
    /* Nút bấm */
    .stButton > button {
        width: 100%;
        background: linear-gradient(135deg, #f6d365, #fda085) !important;
        color: #1a1a2e !important;
        font-weight: 700 !important;
        font-size: 1rem !important;
        border: none !important;
        border-radius: 12px !important;
        padding: 0.75rem 2rem !important;
        cursor: pointer;
        transition: transform 0.15s, box-shadow 0.15s;
        font-family: 'Be Vietnam Pro', sans-serif !important;
        letter-spacing: 0.03em;
    }
    
    .stButton > button:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(246,211,101,0.35) !important;
    }
    
    /* Card subtitle */
    .subtitle-card {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 1.25rem 1.5rem;
        margin-bottom: 0.75rem;
        transition: background 0.2s, border-color 0.2s;
        backdrop-filter: blur(10px);
        position: relative;
        overflow: hidden;
    }
    
    .subtitle-card::before {
        content: '';
        position: absolute;
        left: 0; top: 0; bottom: 0;
        width: 3px;
        background: linear-gradient(180deg, #f6d365, #fda085);
        border-radius: 3px 0 0 3px;
    }
    
    .subtitle-card:hover {
        background: rgba(255,255,255,0.09);
        border-color: rgba(246,211,101,0.3);
    }
    
    /* Timestamp */
    .time-badge {
        display: inline-block;
        background: rgba(246,211,101,0.15);
        color: #f6d365;
        font-size: 0.72rem;
        font-weight: 600;
        padding: 0.2rem 0.65rem;
        border-radius: 20px;
        margin-bottom: 0.75rem;
        letter-spacing: 0.05em;
        font-family: 'Courier New', monospace;
    }
    
    /* Chữ Hán */
    .chinese-text {
        font-family: 'Noto Serif SC', serif;
        font-size: 1.7rem;
        font-weight: 700;
        color: #ffffff;
        line-height: 1.4;
        margin-bottom: 0.25rem;
    }
    
    /* Pinyin */
    .pinyin-text {
        font-size: 0.95rem;
        color: #fda085;
        font-style: italic;
        margin-bottom: 0.4rem;
        letter-spacing: 0.03em;
    }
    
    /* Tiếng Việt */
    .vietnamese-text {
        font-size: 1rem;
        color: rgba(255,255,255,0.7);
        font-weight: 400;
        border-top: 1px solid rgba(255,255,255,0.08);
        padding-top: 0.5rem;
        margin-top: 0.3rem;
    }
    
    .vietnamese-text span {
        color: #a8edea;
    }
    
    /* Label */
    .stTextInput label {
        color: rgba(255,255,255,0.7) !important;
        font-size: 0.9rem !important;
        font-weight: 500 !important;
    }
    
    /* Progress bar */
    .stProgress > div > div > div {
        background: linear-gradient(90deg, #f6d365, #fda085) !important;
        border-radius: 10px;
    }
    
    /* Divider */
    hr {
        border-color: rgba(255,255,255,0.1) !important;
        margin: 1.5rem 0 !important;
    }
    
    /* Alert / info boxes */
    .stAlert {
        background: rgba(255,255,255,0.06) !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        border-radius: 12px !important;
        color: rgba(255,255,255,0.85) !important;
    }
    
    /* Stats */
    .stats-row {
        display: flex;
        gap: 1rem;
        margin: 1rem 0;
    }
    
    .stat-box {
        flex: 1;
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 12px;
        padding: 1rem;
        text-align: center;
    }
    
    .stat-number {
        font-size: 2rem;
        font-weight: 700;
        color: #f6d365;
    }
    
    .stat-label {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.5);
        margin-top: 0.25rem;
    }
    
    /* Video embed */
    .video-wrapper {
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid rgba(255,255,255,0.1);
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        margin-bottom: 1.5rem;
    }
    
    /* Section title */
    .section-title {
        color: rgba(255,255,255,0.9);
        font-size: 1.1rem;
        font-weight: 600;
        margin: 1.5rem 0 1rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    
    /* Scrollable subtitle area */
    .subtitle-scroll {
        max-height: 70vh;
        overflow-y: auto;
        padding-right: 0.5rem;
    }
    
    .subtitle-scroll::-webkit-scrollbar {
        width: 4px;
    }
    
    .subtitle-scroll::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.05);
        border-radius: 10px;
    }
    
    .subtitle-scroll::-webkit-scrollbar-thumb {
        background: rgba(246,211,101,0.4);
        border-radius: 10px;
    }
</style>
""", unsafe_allow_html=True)


# ===== TIÊU ĐỀ CHÍNH =====
st.markdown("""
<div class="hero-title">
    <h1>🈶 學中文</h1>
    <p class="hero-subtitle">Học tiếng Trung qua video YouTube · Pinyin · Dịch tiếng Việt</p>
</div>
""", unsafe_allow_html=True)

st.markdown("---")

# ===== FORM NHẬP URL =====
col_input, col_btn = st.columns([5, 1.5])

with col_input:
    youtube_url = st.text_input(
        "🔗 Dán URL video YouTube tiếng Trung vào đây",
        placeholder="https://www.youtube.com/watch?v=...",
        label_visibility="visible"
    )

with col_btn:
    st.markdown("<div style='margin-top:1.85rem'></div>", unsafe_allow_html=True)
    analyze_btn = st.button("🎬 Phân tích Video", use_container_width=True)


# ===== XỬ LÝ KHI NHẤN NÚT =====
if analyze_btn:
    if not youtube_url or not youtube_url.strip():
        st.warning("⚠️ Vui lòng nhập URL YouTube trước khi nhấn phân tích.")
    else:
        # Container hiển thị tiến trình
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        def update_ui(message: str, percent: int):
            """Callback cập nhật giao diện theo tiến trình."""
            progress_bar.progress(percent / 100)
            status_text.markdown(
                f"<p style='color:rgba(255,255,255,0.7);font-size:0.9rem'>{message}</p>",
                unsafe_allow_html=True
            )
        
        try:
            # Chạy pipeline xử lý AI
            subtitles = process_video(youtube_url, progress_callback=update_ui)
            
            # Lưu kết quả vào session state để không mất khi tương tác
            st.session_state["subtitles"] = subtitles
            st.session_state["video_url"] = youtube_url
            
            # Dọn dẹp progress bar
            progress_bar.empty()
            status_text.empty()
            
            st.success(f"✅ Phân tích thành công! Tìm thấy **{len(subtitles)}** câu thoại.")
            
        except Exception as e:
            progress_bar.empty()
            status_text.empty()
            st.error(f"❌ Có lỗi xảy ra: {str(e)}")
            st.info("💡 Gợi ý: Hãy thử với video ngắn hơn (dưới 5 phút) hoặc video có âm thanh rõ ràng hơn.")


# ===== HIỂN THỊ KẾT QUẢ =====
if "subtitles" in st.session_state and st.session_state["subtitles"]:
    subtitles = st.session_state["subtitles"]
    video_url = st.session_state.get("video_url", "")
    
    st.markdown("---")
    
    # Layout 2 cột: Video bên trái, Subtitle bên phải
    col_video, col_subs = st.columns([1, 1], gap="large")
    
    with col_video:
        # Nhúng video YouTube
        video_id = get_video_id(video_url)
        if video_id:
            st.markdown(f"""
            <div class="video-wrapper">
                <iframe
                    width="100%"
                    height="315"
                    src="https://www.youtube.com/embed/{video_id}"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowfullscreen>
                </iframe>
            </div>
            """, unsafe_allow_html=True)
        
        # Thống kê nhanh
        total_duration = subtitles[-1]["end"] if subtitles else 0
        st.markdown(f"""
        <div class="stats-row">
            <div class="stat-box">
                <div class="stat-number">{len(subtitles)}</div>
                <div class="stat-label">Câu thoại</div>
            </div>
            <div class="stat-box">
                <div class="stat-number">{int(total_duration//60)}:{int(total_duration%60):02d}</div>
                <div class="stat-label">Thời lượng</div>
            </div>
        </div>
        """, unsafe_allow_html=True)
        
        # Hướng dẫn sử dụng
        st.markdown("""
        <div style='background:rgba(255,255,255,0.04);border-radius:12px;padding:1rem 1.2rem;margin-top:0.5rem;'>
            <p style='color:rgba(255,255,255,0.6);font-size:0.85rem;margin:0;line-height:1.8'>
                📌 <b style='color:rgba(255,255,255,0.85)'>Cách đọc Pinyin:</b><br>
                • Dấu <b style='color:#fda085'>¯</b> = thanh bằng (1)<br>
                • Dấu <b style='color:#fda085'>´</b> = thanh sắc lên (2)<br>
                • Dấu <b style='color:#fda085'>ˇ</b> = thanh xuống-lên (3)<br>
                • Dấu <b style='color:#fda085'>`</b> = thanh xuống (4)<br>
                • Không dấu = thanh nhẹ (5)
            </p>
        </div>
        """, unsafe_allow_html=True)
    
    with col_subs:
        st.markdown(f"""
        <p class="section-title">📋 Danh sách {len(subtitles)} câu thoại</p>
        <div class="subtitle-scroll">
        """, unsafe_allow_html=True)
        
        # Hiển thị từng subtitle
        for i, sub in enumerate(subtitles):
            # Format timestamp: MM:SS
            start_min = int(sub["start"] // 60)
            start_sec = int(sub["start"] % 60)
            end_min = int(sub["end"] // 60)
            end_sec = int(sub["end"] % 60)
            time_str = f"{start_min:02d}:{start_sec:02d} → {end_min:02d}:{end_sec:02d}"
            
            st.markdown(f"""
            <div class="subtitle-card">
                <span class="time-badge">⏱ {time_str}</span>
                <div class="chinese-text">{sub["chinese"]}</div>
                <div class="pinyin-text">{sub["pinyin"]}</div>
                <div class="vietnamese-text"><span>🇻🇳</span> {sub["vietnamese"]}</div>
            </div>
            """, unsafe_allow_html=True)
        
        st.markdown("</div>", unsafe_allow_html=True)

# ===== MÀN HÌNH CHÀO KHI CHƯA CÓ KẾT QUẢ =====
elif "subtitles" not in st.session_state:
    st.markdown("""
    <div style='text-align:center;padding:3rem 2rem;'>
        <div style='font-size:4rem;margin-bottom:1rem;'>🎥</div>
        <p style='color:rgba(255,255,255,0.5);font-size:1rem;'>
            Dán URL video YouTube tiếng Trung vào ô trên<br>
            và nhấn <b style='color:#f6d365'>Phân tích Video</b> để bắt đầu
        </p>
        <div style='margin-top:2rem;display:flex;justify-content:center;gap:2rem;flex-wrap:wrap;'>
            <div style='color:rgba(255,255,255,0.4);font-size:0.85rem;'>✦ Nhận dạng giọng nói AI</div>
            <div style='color:rgba(255,255,255,0.4);font-size:0.85rem;'>✦ Phiên âm Pinyin tự động</div>
            <div style='color:rgba(255,255,255,0.4);font-size:0.85rem;'>✦ Dịch tiếng Việt</div>
        </div>
    </div>
    """, unsafe_allow_html=True)