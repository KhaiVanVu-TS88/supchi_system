"""
Chung cho mọi chỗ gọi yt-dlp: cookie YouTube (bot challenge), proxy, header.

-export cookie từ trình duyệt (vd. extension "Get cookies.txt LOCALLY"),
 đặt đường dẫn vào YTDLP_COOKIES_FILE trong container.

-YTDLP_DISABLE_PROXY=1: không gửi HTTP(S)_PROXY vào yt-dlp (thử khi proxy làm YouTube chặn bot).

-YouTube PO token (2025+): nếu vẫn Sign in… dù có cookie, xem wiki yt-dlp PO Token Guide.
  YTDLP_YOUTUBE_PO_TOKEN + YTDLP_YOUTUBE_PO_CLIENT (mặc định mweb), hoặc token dạng đầy đủ mweb+xxxx.
  Tuỳ chọn YTDLP_YOUTUBE_PLAYER_CLIENT=mweb,web (danh sách client, phân tách dấu phẩy).
"""
from __future__ import annotations

import logging
import os
import shutil
from copy import deepcopy
from typing import Any, Dict, Iterator, Optional, Tuple

logger = logging.getLogger(__name__)
_missing_cookie_warned = False
_cookie_ok_logged = False
# yt-dlp ghi lại cookie → bind mount từ host (đặc biệt Docker Desktop + Windows) hay Errno 30; dùng bản sao trong /tmp.
_COOKIE_WORK_COPY = "/tmp/ytdlp_youtube_cookies.txt"
_cookie_copy_src_mtime: Optional[float] = None
_po_token_logged = False

DEFAULT_HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://www.youtube.com/",
}

# web_embedded/tv thường ít dính PO token & bot hơn android/ios (wiki yt-dlp).
DEFAULT_EXTRACTOR_ARGS = {
    "youtube": {"player_client": ["web_embedded", "tv", "android", "web", "ios"]}
}

# Khi không set YTDLP_YOUTUBE_PLAYER_CLIENT: thử lần lượt (wiki yt-dlp — một số client ít cần PO).
_YOUTUBE_CLIENT_FALLBACKS: Tuple[Tuple[str, Optional[list[str]]], ...] = (
    ("default", None),
    ("web_embedded_tv", ["web_embedded", "tv"]),
    ("tv_only", ["tv"]),
    ("android_vr", ["android_vr"]),
    ("tv_android", ["tv", "android"]),
    ("web_safari", ["web_safari"]),
    ("android_web_ios", ["android", "web", "ios"]),
    ("mweb_web", ["mweb", "web"]),
    ("web_creator", ["web_creator"]),
)


def log_youtube_extractor_exhausted(last_err: BaseException) -> None:
    """Sau khi thử hết player_client vẫn bot/sign-in."""
    src = os.getenv("YTDLP_COOKIES_FILE") or os.getenv("YOUTUBE_COOKIES_FILE")
    cookie_ok = bool(src and os.path.isfile(src))
    logger.error(
        "yt-dlp: đã thử hết các player_client, YouTube vẫn chặn (%s). "
        "Cookie trong container: %s. "
        "Thử: export lại cookie (ẩn danh + robots.txt theo wiki yt-dlp); "
        "thêm PO token (README); đổi node VPN; hoặc chạy worker trên VPS ngoài TQ.",
        last_err.__class__.__name__,
        "có file" if cookie_ok else "KHÔNG thấy file — kiểm tra mount",
    )


def _youtube_extractor_args_from_env() -> Dict[str, Any]:
    """PO token / player_client từ env — https://github.com/yt-dlp/yt-dlp/wiki/Extractors#po-token-guide"""
    global _po_token_logged
    d: Dict[str, Any] = {}
    pc = os.getenv("YTDLP_YOUTUBE_PLAYER_CLIENT", "").strip()
    if pc:
        d["player_client"] = [x.strip() for x in pc.split(",") if x.strip()]
    pot = os.getenv("YTDLP_YOUTUBE_PO_TOKEN", "").strip()
    if pot:
        if "+" in pot:
            d["po_token"] = pot
        else:
            client = os.getenv("YTDLP_YOUTUBE_PO_CLIENT", "mweb").strip() or "mweb"
            d["po_token"] = f"{client}+{pot}"
        if not _po_token_logged:
            logger.info(
                "yt-dlp: đã bật PO token (không log nội dung). "
                "Nếu vẫn lỗi, kiểm tra token còn hạn và khớp client (mweb/web)."
            )
            _po_token_logged = True
    return d


def cookiefile_path_for_ytdlp() -> Optional[str]:
    """
    Trả về đường dẫn file cookie mà yt-dlp được phép ghi (bản sao trong /tmp).
    Đọc từ YTDLP_COOKIES_FILE / YOUTUBE_COOKIES_FILE (file mount từ host).
    """
    global _missing_cookie_warned, _cookie_ok_logged, _cookie_copy_src_mtime
    src = os.getenv("YTDLP_COOKIES_FILE") or os.getenv("YOUTUBE_COOKIES_FILE")
    if not src:
        return None
    if not os.path.isfile(src):
        if not _missing_cookie_warned:
            logger.warning(
                "YTDLP_COOKIES_FILE=%s nhưng không thấy file trong container — "
                "kiểm tra volume mount và đường dẫn. yt-dlp sẽ không dùng cookie.",
                src,
            )
            _missing_cookie_warned = True
        return None
    try:
        mtime = os.path.getmtime(src)
    except OSError as e:
        logger.warning("Không đọc cookie nguồn %s: %s", src, e)
        return None

    if _cookie_copy_src_mtime != mtime:
        try:
            shutil.copy2(src, _COOKIE_WORK_COPY)
            _cookie_copy_src_mtime = mtime
        except OSError as e:
            logger.warning("Không copy cookie vào %s: %s", _COOKIE_WORK_COPY, e)
            return None

    if not _cookie_ok_logged:
        logger.info(
            "yt-dlp: cookie nguồn %s → dùng file ghi được %s",
            src,
            _COOKIE_WORK_COPY,
        )
        _cookie_ok_logged = True
    return _COOKIE_WORK_COPY


def _env_int(name: str, default: int) -> int:
    v = os.getenv(name)
    if v is None or not str(v).strip():
        return default
    try:
        return int(v)
    except ValueError:
        return default


def _env_float(name: str, default: float) -> float:
    v = os.getenv(name)
    if v is None or not str(v).strip():
        return default
    try:
        return float(v)
    except ValueError:
        return default


def _apply_download_resilience(out: Dict[str, Any]) -> None:
    """
    Giảm lỗi SSL EOF / proxy cắt giữa chừng: retry fragment, timeout dài, ít kết nối song song.
    Tuỳ chỉnh: YTDLP_RETRIES, YTDLP_FRAGMENT_RETRIES, YTDLP_SOCKET_TIMEOUT,
    YTDLP_CONCURRENT_FRAGMENTS, YTDLP_SLEEP_INTERVAL_REQUESTS, YTDLP_LEGACY_SERVER_CONNECT.
    """
    retries = _env_int("YTDLP_RETRIES", 10)
    frag_retries = _env_int("YTDLP_FRAGMENT_RETRIES", 10)
    try:
        prev_r = int(out["retries"]) if out.get("retries") is not None else retries
    except (TypeError, ValueError):
        prev_r = retries
    out["retries"] = max(prev_r, retries)

    try:
        prev_fr = int(out["fragment_retries"]) if out.get("fragment_retries") is not None else frag_retries
    except (TypeError, ValueError):
        prev_fr = frag_retries
    out["fragment_retries"] = max(prev_fr, frag_retries)

    out.setdefault("socket_timeout", _env_float("YTDLP_SOCKET_TIMEOUT", 120.0))

    if "concurrent_fragment_downloads" not in out:
        out["concurrent_fragment_downloads"] = max(1, _env_int("YTDLP_CONCURRENT_FRAGMENTS", 1))

    sleep_req = os.getenv("YTDLP_SLEEP_INTERVAL_REQUESTS", "").strip()
    if sleep_req:
        try:
            out["sleep_interval_requests"] = float(sleep_req)
        except ValueError:
            pass

    if os.getenv("YTDLP_LEGACY_SERVER_CONNECT", "").strip().lower() in ("1", "true", "yes", "on"):
        out["legacy_server_connect"] = True


def proxy_from_env() -> Optional[str]:
    if os.getenv("YTDLP_DISABLE_PROXY", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    ):
        return None
    return (
        os.getenv("HTTPS_PROXY")
        or os.getenv("HTTP_PROXY")
        or os.getenv("https_proxy")
        or os.getenv("http_proxy")
        or None
    )


def enrich_ytdlp_opts(opts: Dict[str, Any]) -> Dict[str, Any]:
    """Copy opts; thêm cookiefile, proxy, header/extractor mặc định nếu thiếu."""
    out = dict(opts)

    cf = cookiefile_path_for_ytdlp()
    if cf:
        out["cookiefile"] = cf

    px = proxy_from_env()
    if px:
        out.setdefault("proxy", px)

    if "http_headers" not in out:
        out["http_headers"] = dict(DEFAULT_HTTP_HEADERS)
    else:
        merged = dict(DEFAULT_HTTP_HEADERS)
        merged.update(out["http_headers"])
        out["http_headers"] = merged

    ea = dict(out.get("extractor_args") or {})
    yt_def = dict(DEFAULT_EXTRACTOR_ARGS["youtube"])
    yt_opts = dict(ea.get("youtube") or {})
    merged_yt = {**yt_def, **yt_opts}
    for k, v in _youtube_extractor_args_from_env().items():
        merged_yt[k] = v
    ea["youtube"] = merged_yt
    out["extractor_args"] = ea

    _apply_download_resilience(out)

    return out


def youtube_error_is_retryable(err: BaseException) -> bool:
    msg = str(err).lower()
    needles = (
        "sign in",
        "not a bot",
        "login_required",
        "po token",
        "pot ",
        "please log in",
        "authentication",
        "requested format is not available",
        "format is not available",
    )
    return any(n in msg for n in needles)


def iter_enriched_youtube_opts(base_opts: Dict[str, Any]) -> Iterator[Tuple[str, Dict[str, Any]]]:
    """
    Sinh (nhãn, opts đã enrich) cho từng chiến lược player_client.
    Nếu user đặt YTDLP_YOUTUBE_PLAYER_CLIENT → chỉ một lần (enrich đọc env).
    """
    user_pc = os.getenv("YTDLP_YOUTUBE_PLAYER_CLIENT", "").strip()
    if user_pc:
        yield ("env_player_client", enrich_ytdlp_opts(deepcopy(base_opts)))
        return

    for label, clients in _YOUTUBE_CLIENT_FALLBACKS:
        opts = deepcopy(base_opts)
        ea = dict(opts.get("extractor_args") or {})
        yt = dict(ea.get("youtube") or {})
        if clients is not None:
            yt["player_client"] = clients
        else:
            yt.pop("player_client", None)
        ea["youtube"] = yt
        opts["extractor_args"] = ea
        yield (label, enrich_ytdlp_opts(opts))


def extract_info_with_youtube_fallbacks(
    url: str,
    base_opts: Dict[str, Any],
    *,
    download: bool = False,
):
    """extract_info với retry đổi player_client khi YouTube trả bot/login."""
    import yt_dlp

    last_err: Optional[BaseException] = None
    for label, ydl_opts in iter_enriched_youtube_opts(base_opts):
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(url, download=download)
        except Exception as e:
            last_err = e
            if youtube_error_is_retryable(e):
                logger.warning(
                    "yt-dlp extract_info strategy=%s lỗi, thử tiếp: %s",
                    label,
                    e,
                )
                continue
            raise
    if last_err is not None:
        log_youtube_extractor_exhausted(last_err)
        raise last_err
    raise RuntimeError("iter_enriched_youtube_opts rỗng")
