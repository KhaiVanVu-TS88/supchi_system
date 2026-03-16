import sys
sys.path.insert(0, "/app")

"""
services/tts_service.py — Text-to-Speech

Ưu tiên: edge-tts (Microsoft, chất lượng cao)
Fallback: gTTS (Google, luôn hoạt động)
Cache audio theo MD5 hash để tránh generate lại.
"""
import asyncio
import hashlib
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

AUDIO_DIR = Path("/tmp/audio_cache")
AUDIO_DIR.mkdir(parents=True, exist_ok=True)
EDGE_VOICE = "zh-CN-XiaoxiaoNeural"


def get_audio_path(word: str) -> Path:
    filename = hashlib.md5(word.encode()).hexdigest()[:12]
    return AUDIO_DIR / f"{filename}.mp3"


def generate_audio(word: str) -> Optional[Path]:
    """Tạo audio — thử edge-tts trước, fallback sang gTTS."""
    audio_path = get_audio_path(word)
    if audio_path.exists() and audio_path.stat().st_size > 0:
        return audio_path

    # Thử edge-tts
    result = _try_edge_tts(word, audio_path)
    if result:
        return result

    # Fallback: gTTS
    logger.info(f"Falling back to gTTS for '{word}'")
    return _try_gtts(word, audio_path)


def _try_edge_tts(word: str, audio_path: Path) -> Optional[Path]:
    try:
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(_edge_tts_async(word, audio_path))
        finally:
            loop.close()
        if audio_path.exists() and audio_path.stat().st_size > 0:
            logger.info(f"edge-tts OK: {word}")
            return audio_path
    except Exception as e:
        logger.warning(f"edge-tts failed for '{word}': {e}")
    return None


async def _edge_tts_async(word: str, output_path: Path):
    import edge_tts
    communicate = edge_tts.Communicate(word, EDGE_VOICE)
    await communicate.save(str(output_path))


def _try_gtts(word: str, audio_path: Path) -> Optional[Path]:
    try:
        from gtts import gTTS
        tts = gTTS(text=word, lang="zh-CN", slow=False)
        tts.save(str(audio_path))
        if audio_path.exists() and audio_path.stat().st_size > 0:
            logger.info(f"gTTS OK: {word}")
            return audio_path
    except Exception as e:
        logger.error(f"gTTS failed for '{word}': {e}")
    return None


def get_audio_filename(word: str) -> str:
    return get_audio_path(word).name