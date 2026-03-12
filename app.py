"""
app.py - Giao diện người dùng Streamlit

Tính năng mới:
- Layout 2 cột: video cố định bên trái, subtitle cuộn bên phải
- YouTube IFrame API để lấy currentTime theo thời gian thực
- Subtitle tự động highlight + scroll đến câu đang phát
"""

import json
import streamlit as st
import streamlit.components.v1 as components
from modules.youtube import get_video_id
from pipeline import process_video

# ===== CẤU HÌNH TRANG =====
st.set_page_config(
    page_title="學中文 · Học Tiếng Trung",
    page_icon="🈶",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# ===== GLOBAL CSS (chỉ cho phần Streamlit bên ngoài component) =====
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap');

    .stApp {
        background: #0d0d1a;
        font-family: 'Be Vietnam Pro', sans-serif;
    }
    #MainMenu, footer, header { visibility: hidden; }

    /* Input URL */
    .stTextInput > div > div > input {
        background: rgba(255,255,255,0.06) !important;
        border: 1.5px solid rgba(255,255,255,0.12) !important;
        border-radius: 10px !important;
        color: white !important;
        font-size: 1rem !important;
        padding: 0.7rem 1rem !important;
    }
    .stTextInput > div > div > input:focus {
        border-color: #f6d365 !important;
        box-shadow: 0 0 0 3px rgba(246,211,101,0.12) !important;
    }
    .stTextInput > div > div > input::placeholder { color: rgba(255,255,255,0.28) !important; }
    .stTextInput label { color: rgba(255,255,255,0.65) !important; font-size: 0.88rem !important; }

    /* Nút bấm */
    .stButton > button {
        width: 100%;
        background: linear-gradient(135deg, #f6d365, #fda085) !important;
        color: #1a1a2e !important;
        font-weight: 700 !important;
        font-size: 0.95rem !important;
        border: none !important;
        border-radius: 10px !important;
        padding: 0.7rem 1.5rem !important;
        font-family: 'Be Vietnam Pro', sans-serif !important;
        transition: opacity 0.15s, transform 0.15s;
    }
    .stButton > button:hover { opacity: 0.88; transform: translateY(-1px); }

    /* Progress */
    .stProgress > div > div > div {
        background: linear-gradient(90deg, #f6d365, #fda085) !important;
    }
    .stAlert {
        background: rgba(255,255,255,0.05) !important;
        border: 1px solid rgba(255,255,255,0.1) !important;
        border-radius: 10px !important;
        color: rgba(255,255,255,0.8) !important;
    }
    hr { border-color: rgba(255,255,255,0.08) !important; margin: 1.2rem 0 !important; }

    /* Ẩn padding mặc định của columns để component full-width */
    [data-testid="stHorizontalBlock"] { gap: 0 !important; }
    [data-testid="column"] { padding: 0 !important; }
</style>
""", unsafe_allow_html=True)


# ===== HÀM TẠO COMPONENT HTML PLAYER + SUBTITLE SYNC =====
def render_player_with_sync(video_id: str, subtitles: list):
    """
    Tạo một HTML component duy nhất gồm:
    - Cột trái: YouTube player (sticky, cố định khi cuộn)
    - Cột phải: Danh sách subtitle có highlight + auto-scroll

    Dùng YouTube IFrame API để đọc currentTime mỗi 200ms,
    tìm subtitle đang active và cuộn danh sách đến đúng vị trí.
    """
    # Chuyển subtitles thành JSON để nhúng vào JS
    subs_json = json.dumps(subtitles, ensure_ascii=False)

    html = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700&family=Be+Vietnam+Pro:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}

  body {{
    background: transparent;
    font-family: 'Be Vietnam Pro', sans-serif;
    color: #fff;
    overflow: hidden;   /* Không cuộn toàn trang */
  }}

  /* ===== LAYOUT 2 CỘT ===== */
  .layout {{
    display: flex;
    gap: 20px;
    height: 100vh;
    padding: 0 4px;
    align-items: flex-start;
  }}

  /* ===== CỘT TRÁI: VIDEO CỐ ĐỊNH ===== */
  .col-video {{
    width: 48%;
    flex-shrink: 0;
    position: sticky;   /* Cố định khi cột phải cuộn */
    top: 0;
  }}

  .video-wrap {{
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid rgba(255,255,255,0.1);
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    background: #000;
    aspect-ratio: 16/9;
    width: 100%;
  }}

  .video-wrap iframe {{
    width: 100%;
    height: 100%;
    display: block;
    border: none;
  }}

  /* Stats dưới video */
  .stats {{
    display: flex;
    gap: 10px;
    margin-top: 12px;
  }}
  .stat-box {{
    flex: 1;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 10px;
    text-align: center;
  }}
  .stat-num {{ font-size: 1.6rem; font-weight: 700; color: #f6d365; line-height: 1; }}
  .stat-lbl {{ font-size: 0.72rem; color: rgba(255,255,255,0.45); margin-top: 4px; }}

  /* Hướng dẫn pinyin */
  .pinyin-guide {{
    background: rgba(255,255,255,0.04);
    border-radius: 10px;
    padding: 10px 14px;
    margin-top: 10px;
    font-size: 0.78rem;
    color: rgba(255,255,255,0.5);
    line-height: 1.9;
  }}
  .pinyin-guide b {{ color: rgba(255,255,255,0.8); }}
  .pinyin-guide span {{ color: #fda085; font-weight: 600; }}

  /* ===== CỘT PHẢI: SUBTITLE LIST ===== */
  .col-subs {{
    flex: 1;
    height: 60vh;
    overflow-y: auto;   /* Chỉ cột này cuộn */
    padding-right: 6px;
    padding-bottom: 40px;
  }}

  /* Scrollbar đẹp */
  .col-subs::-webkit-scrollbar {{ width: 3px; }}
  .col-subs::-webkit-scrollbar-track {{ background: rgba(255,255,255,0.03); border-radius: 10px; }}
  .col-subs::-webkit-scrollbar-thumb {{ background: rgba(246,211,101,0.35); border-radius: 10px; }}

  .subs-header {{
    font-size: 0.82rem;
    font-weight: 600;
    color: rgba(255,255,255,0.45);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin-bottom: 10px;
    padding-left: 4px;
  }}

  /* ===== CARD SUBTITLE ===== */
  .sub-card {{
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 13px;
    padding: 12px 16px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: background 0.18s, border-color 0.18s, transform 0.15s;
    position: relative;
    overflow: hidden;
  }}

  /* Thanh màu bên trái */
  .sub-card::before {{
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: rgba(255,255,255,0.1);
    border-radius: 3px 0 0 3px;
    transition: background 0.18s;
  }}

  .sub-card:hover {{
    background: rgba(255,255,255,0.07);
    border-color: rgba(255,255,255,0.13);
    transform: translateX(2px);
  }}

  /* ===== ACTIVE CARD (đang phát) ===== */
  .sub-card.active {{
    background: rgba(246,211,101,0.1) !important;
    border-color: rgba(246,211,101,0.35) !important;
    transform: translateX(4px);
    box-shadow: 0 4px 20px rgba(246,211,101,0.12);
  }}

  .sub-card.active::before {{
    background: linear-gradient(180deg, #f6d365, #fda085) !important;
  }}

  /* Timestamp badge */
  .time-badge {{
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.45);
    font-size: 0.68rem;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 20px;
    margin-bottom: 7px;
    font-family: 'Courier New', monospace;
    letter-spacing: 0.04em;
    transition: background 0.18s, color 0.18s;
  }}

  .sub-card.active .time-badge {{
    background: rgba(246,211,101,0.18);
    color: #f6d365;
  }}

  /* Chữ Hán */
  .zh {{
    font-family: 'Noto Serif SC', serif;
    font-size: 1.45rem;
    font-weight: 700;
    color: #ffffff;
    line-height: 1.4;
    margin-bottom: 3px;
    transition: color 0.18s;
  }}
  .sub-card.active .zh {{ color: #fff8e0; }}

  /* Pinyin */
  .py {{
    font-size: 0.85rem;
    color: #fda085;
    font-style: italic;
    letter-spacing: 0.03em;
    margin-bottom: 6px;
    transition: color 0.18s;
  }}
  .sub-card.active .py {{ color: #ffbb94; }}

  /* Tiếng Việt */
  .vi {{
    font-size: 0.9rem;
    color: rgba(255,255,255,0.6);
    border-top: 1px solid rgba(255,255,255,0.07);
    padding-top: 6px;
    transition: color 0.18s;
  }}
  .sub-card.active .vi {{ color: rgba(255,255,255,0.85); }}

  /* Indicator đang phát (pulse) */
  .playing-dot {{
    display: none;
    width: 7px; height: 7px;
    background: #f6d365;
    border-radius: 50%;
    animation: pulse 1s ease-in-out infinite;
    margin-left: 5px;
    vertical-align: middle;
  }}
  .sub-card.active .playing-dot {{ display: inline-block; }}

  @keyframes pulse {{
    0%, 100% {{ opacity: 1; transform: scale(1); }}
    50% {{ opacity: 0.5; transform: scale(0.7); }}
  }}
</style>
</head>
<body>

<div class="layout">

  <!-- ===== CỘT TRÁI: VIDEO ===== -->
  <div class="col-video">
    <div class="video-wrap">
      <!-- YouTube IFrame API cần div với id, không phải iframe trực tiếp -->
      <div id="yt-player"></div>
    </div>

    <div class="stats">
      <div class="stat-box">
        <div class="stat-num" id="stat-count">{len(subtitles)}</div>
        <div class="stat-lbl">Câu thoại</div>
      </div>
      <div class="stat-box">
        <div class="stat-num" id="stat-active">—</div>
        <div class="stat-lbl">Đang phát</div>
      </div>
    </div>

    <div class="pinyin-guide">
      <b>📌 Thanh điệu Pinyin:</b><br>
      <span>ā á ǎ à</span> = bằng · sắc · hỏi · huyền &nbsp;·&nbsp; Không dấu = nhẹ
    </div>
  </div>

  <!-- ===== CỘT PHẢI: SUBTITLE ===== -->
  <div class="col-subs" id="sub-list">
    <div class="subs-header">📋 Danh sách câu thoại</div>
    <!-- Cards được tạo bằng JS bên dưới -->
  </div>

</div>

<!-- ===== YOUTUBE IFRAME API ===== -->
<script>
  // Dữ liệu subtitle từ Python (inject qua JSON)
  const SUBS = {subs_json};
  const VIDEO_ID = "{video_id}";

  // ===== 1. TẠO SUBTITLE CARDS =====
  const listEl = document.getElementById('sub-list');

  // Giữ lại header
  const header = listEl.querySelector('.subs-header');
  listEl.innerHTML = '';
  listEl.appendChild(header);

  SUBS.forEach((sub, idx) => {{
    const startM = String(Math.floor(sub.start / 60)).padStart(2, '0');
    const startS = String(Math.floor(sub.start % 60)).padStart(2, '0');
    const endM   = String(Math.floor(sub.end   / 60)).padStart(2, '0');
    const endS   = String(Math.floor(sub.end   % 60)).padStart(2, '0');

    const card = document.createElement('div');
    card.className = 'sub-card';
    card.id = `sub-${{idx}}`;
    card.dataset.start = sub.start;
    card.dataset.end   = sub.end;

    card.innerHTML = `
      <span class="time-badge">
        ⏱ ${{startM}}:${{startS}} → ${{endM}}:${{endS}}
        <span class="playing-dot"></span>
      </span>
      <div class="zh">${{sub.chinese}}</div>
      <div class="py">${{sub.pinyin}}</div>
      <div class="vi">🇻🇳 ${{sub.vietnamese}}</div>
    `;

    // Click vào card → seek video đến thời điểm đó
    card.addEventListener('click', () => {{
      if (window.ytPlayer && window.ytPlayer.seekTo) {{
        window.ytPlayer.seekTo(sub.start, true);
        window.ytPlayer.playVideo();
      }}
    }});

    listEl.appendChild(card);
  }});

  // ===== 2. LOAD YOUTUBE IFRAME API =====
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);

  let activeIdx = -1;   // Index subtitle đang active
  let pollTimer = null; // Timer poll currentTime

  // Callback khi YouTube API sẵn sàng
  window.onYouTubeIframeAPIReady = function() {{
    window.ytPlayer = new YT.Player('yt-player', {{
      videoId: VIDEO_ID,
      playerVars: {{
        autoplay: 0,
        rel: 0,           // Không hiện video liên quan
        modestbranding: 1,
      }},
      events: {{
        onReady: onPlayerReady,
        onStateChange: onStateChange,
      }}
    }});
  }};

  function onPlayerReady(event) {{
    // Bắt đầu poll ngay khi player sẵn sàng
    startPolling();
  }}

  function onStateChange(event) {{
    // YT.PlayerState.PLAYING = 1
    if (event.data === 1) {{
      startPolling();
    }} else {{
      stopPolling();
    }}
  }}

  // ===== 3. POLLING CURRENT TIME (mỗi 200ms) =====
  function startPolling() {{
    if (pollTimer) return; // Tránh tạo nhiều timer
    pollTimer = setInterval(syncSubtitles, 200);
  }}

  function stopPolling() {{
    if (pollTimer) {{
      clearInterval(pollTimer);
      pollTimer = null;
    }}
  }}

  // ===== 4. SYNC SUBTITLE THEO THỜI GIAN =====
  function syncSubtitles() {{
    if (!window.ytPlayer || !window.ytPlayer.getCurrentTime) return;

    const t = window.ytPlayer.getCurrentTime();

    // Tìm subtitle active: start <= t < end
    let newIdx = -1;
    for (let i = 0; i < SUBS.length; i++) {{
      if (t >= SUBS[i].start && t < SUBS[i].end) {{
        newIdx = i;
        break;
      }}
    }}

    // Chỉ cập nhật DOM khi có thay đổi (tối ưu performance)
    if (newIdx === activeIdx) return;

    // Bỏ highlight cũ
    if (activeIdx >= 0) {{
      const old = document.getElementById(`sub-${{activeIdx}}`);
      if (old) old.classList.remove('active');
    }}

    // Highlight mới
    if (newIdx >= 0) {{
      const cur = document.getElementById(`sub-${{newIdx}}`);
      if (cur) {{
        cur.classList.add('active');

        // ===== 5. AUTO-SCROLL: GIỮ CARD TRONG VÙNG HIỂN THỊ =====
        // scrollIntoView với behavior: smooth + block: center
        cur.scrollIntoView({{
          behavior: 'smooth',
          block: 'center',    // Giữ card ở giữa vùng nhìn thấy
        }});

        // Cập nhật stat
        document.getElementById('stat-active').textContent = newIdx + 1;
      }}
    }} else {{
      document.getElementById('stat-active').textContent = '—';
    }}

    activeIdx = newIdx;
  }}
</script>

</body>
</html>
"""
    return html


# ===== TIÊU ĐỀ =====
st.markdown("""
<div style='text-align:center;padding:2rem 0 0.5rem;'>
  <h1 style='font-family:"Noto Serif SC",serif;font-size:3rem;font-weight:700;
             background:linear-gradient(120deg,#f6d365,#fda085,#f093fb);
             -webkit-background-clip:text;-webkit-text-fill-color:transparent;
             background-clip:text;margin:0;line-height:1.1;'>
    🈶 學中文
  </h1>
  <p style='color:rgba(255,255,255,0.45);font-size:0.95rem;margin-top:0.5rem;'>
    Học tiếng Trung qua YouTube · Pinyin · Dịch tiếng Việt
  </p>
</div>
""", unsafe_allow_html=True)

st.markdown("---")

# ===== FORM NHẬP URL =====
col_input, col_btn = st.columns([5, 1.5])

with col_input:
    youtube_url = st.text_input(
        "🔗 Dán URL video YouTube tiếng Trung",
        placeholder="https://www.youtube.com/watch?v=...",
    )

with col_btn:
    st.markdown("<div style='margin-top:1.8rem'></div>", unsafe_allow_html=True)
    analyze_btn = st.button("🎬 Phân tích Video", use_container_width=True)


# ===== XỬ LÝ KHI NHẤN NÚT =====
if analyze_btn:
    if not youtube_url or not youtube_url.strip():
        st.warning("⚠️ Vui lòng nhập URL YouTube.")
    else:
        progress_bar = st.progress(0)
        status_text  = st.empty()

        def update_ui(message: str, percent: int):
            progress_bar.progress(percent / 100)
            status_text.markdown(
                f"<p style='color:rgba(255,255,255,0.65);font-size:0.88rem'>{message}</p>",
                unsafe_allow_html=True
            )

        try:
            subtitles = process_video(youtube_url, progress_callback=update_ui)
            st.session_state["subtitles"] = subtitles
            st.session_state["video_url"] = youtube_url
            progress_bar.empty()
            status_text.empty()
            st.success(f"✅ Phân tích xong! Tìm thấy **{len(subtitles)}** câu thoại.")
        except Exception as e:
            progress_bar.empty()
            status_text.empty()
            st.error(f"❌ Lỗi: {str(e)}")
            st.info("💡 Thử video ngắn hơn (< 5 phút) hoặc video có âm thanh rõ ràng.")


# ===== HIỂN THỊ PLAYER + SUBTITLE SYNC =====
if "subtitles" in st.session_state and st.session_state["subtitles"]:
    subtitles = st.session_state["subtitles"]
    video_url  = st.session_state.get("video_url", "")
    video_id   = get_video_id(video_url)

    st.markdown("---")

    if video_id:
        # Render toàn bộ player + subtitle trong 1 HTML component
        # height: chiều cao đủ lớn để hiển thị cả 2 cột
        html_content = render_player_with_sync(video_id, subtitles)
        components.html(html_content, height=720, scrolling=False)
    else:
        st.error("❌ Không thể lấy video ID từ URL này.")

# ===== MÀN HÌNH CHÀO =====
elif "subtitles" not in st.session_state:
    st.markdown("""
    <div style='text-align:center;padding:3.5rem 2rem;'>
      <div style='font-size:3.5rem;margin-bottom:1rem;'>🎥</div>
      <p style='color:rgba(255,255,255,0.42);font-size:0.95rem;line-height:1.9;'>
        Dán URL video YouTube tiếng Trung vào ô trên<br>
        và nhấn <b style='color:#f6d365'>Phân tích Video</b> để bắt đầu
      </p>
      <div style='margin-top:2rem;display:flex;justify-content:center;gap:2rem;flex-wrap:wrap;'>
        <span style='color:rgba(255,255,255,0.3);font-size:0.82rem;'>✦ Nhận dạng giọng nói AI</span>
        <span style='color:rgba(255,255,255,0.3);font-size:0.82rem;'>✦ Phiên âm Pinyin tự động</span>
        <span style='color:rgba(255,255,255,0.3);font-size:0.82rem;'>✦ Dịch tiếng Việt · Click để seek</span>
      </div>
    </div>
    """, unsafe_allow_html=True)