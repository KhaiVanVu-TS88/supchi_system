"""
pronunciation/pronunciation_service.py

Business logic kiểm tra phát âm tiếng Trung — phiên bản nâng cấp:
1) Load audio (wav/mp3/webm/...) + ffmpeg fallback
2) STT bằng faster-whisper
3) Pitch contour bằng parselmouth (Praat)
4) Tone sandhi (không / 一)
5) Per-syllable scoring: tone + initial + final → overall
6) Detailed feedback: summary tiếng Việt + recommendations
"""
from __future__ import annotations

import io
import re
import subprocess
import tempfile
import os
import logging
from difflib import SequenceMatcher
from typing import List, Optional, Tuple

import numpy as np
import librosa
from faster_whisper import WhisperModel
from pypinyin import lazy_pinyin, Style

logger = logging.getLogger(__name__)

# ── Whisper singleton ────────────────────────────────────────────────────

_whisper_model: Optional[WhisperModel] = None


def _get_whisper_model() -> WhisperModel:
    global _whisper_model
    if _whisper_model is None:
        _whisper_model = WhisperModel("small", device="cpu", compute_type="int8")
    return _whisper_model


# ── Audio loading ────────────────────────────────────────────────────────

def load_audio_bytes(audio_bytes: bytes, target_sr: int = 16000) -> Tuple[np.ndarray, int, float]:
    """
    Decode audio bytes (wav/mp3/webm/...) bằng librosa.
    Tự động convert WebM/Opus qua ffmpeg nếu librosa không nhận diện được format.
    """
    buf = io.BytesIO(audio_bytes)

    try:
        y, sr = librosa.load(buf, sr=target_sr, mono=True)
        duration = float(len(y) / sr) if sr > 0 else 0.0
        return y, sr, duration
    except Exception:
        pass

    # librosa fail → convert qua ffmpeg
    try:
        proc = subprocess.run(
            [
                "ffmpeg", "-y",
                "-hide_banner",
                "-i", "pipe:0",
                "-f", "wav",
                "-acodec", "pcm_s16le",
                "-ar", str(target_sr),
                "-ac", "1",
                "pipe:1",
            ],
            input=audio_bytes,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
        )
        if proc.returncode == 0 and proc.stdout:
            wav_buf = io.BytesIO(proc.stdout)
            y, sr = librosa.load(wav_buf, sr=target_sr, mono=True)
            duration = float(len(y) / sr) if sr > 0 else 0.0
            return y, sr, duration
    except Exception:
        pass

    raise ValueError("Audio format not supported.")


def load_audio_file(audio_path: str, target_sr: int = 16000) -> Tuple[np.ndarray, int, float]:
    """
    Load audio từ file path (dùng cho parselmouth).
    """
    try:
        import soundfile as sf
        audio, sr = sf.read(audio_path)
        if sr != target_sr:
            audio = librosa.resample(audio, orig_sr=sr, target_sr=target_sr)
    except Exception:
        audio, sr = librosa.load(audio_path, sr=target_sr, res_type="kaiser_fast")

    if len(audio.shape) > 1:
        audio = np.mean(audio, axis=1)

    audio = librosa.util.normalize(audio)
    audio, _ = librosa.effects.trim(audio, top_db=20)
    duration = float(len(audio) / sr) if sr > 0 else 0.0
    return audio, sr, duration


# ── STT ──────────────────────────────────────────────────────────────────

def transcribe_audio(y: np.ndarray, sr: int) -> str:
    """
    STT bằng faster-whisper (Chinese).
    """
    model = _get_whisper_model()
    segments, _ = model.transcribe(
        y.astype(np.float32),
        language="zh",
        beam_size=3,
        vad_filter=True,
    )
    return "".join(seg.text for seg in segments).strip()


# ── Text / Pinyin processing ────────────────────────────────────────────

_TONE_MARK_MAP = {
    "ā": "1", "ē": "1", "ī": "1", "ō": "1", "ū": "1", "ǖ": "1",
    "á": "2", "é": "2", "í": "2", "ó": "2", "ú": "2", "ǘ": "2",
    "ǎ": "3", "ě": "3", "ǐ": "3", "ǒ": "3", "ǔ": "3", "ǚ": "3",
    "à": "4", "è": "4", "ì": "4", "ò": "4", "ù": "4", "ǜ": "4",
}


def _parse_pinyin(pinyin_str: str) -> Tuple[str, str, int]:
    """
    Phân tích pinyin thành thanh mẫu, vận mẫu, tone.
    Ví dụ: "ni3" → ("n", "i", 3)
    """
    tone = 5  # neutral tone mặc định
    for i in range(1, 5):
        if str(i) in pinyin_str:
            tone = i
            pinyin_str = pinyin_str.replace(str(i), "", 1)
            break

    initials = [
        "b", "p", "m", "f", "d", "t", "n", "l",
        "g", "k", "h", "j", "q", "x",
        "zh", "ch", "sh", "r", "z", "c", "s", "y", "w",
    ]
    initial = ""
    for init in sorted(initials, key=len, reverse=True):
        if pinyin_str.startswith(init):
            initial = init
            pinyin_str = pinyin_str[len(init):]
            break

    final = pinyin_str
    return initial, final, tone


def _apply_tone_sandhi(characters: List[str], tones: List[int]) -> List[int]:
    """
    Áp dụng quy tắc biến điệu thanh:

    1) Thanh 3 + Thanh 3 → Thanh 2 + Thanh 3
    2) 一 thay đổi:
         - trước thanh 4 → thanh 2
         - trước thanh 1/2/3 → thanh 4
    3) 不 trước thanh 4 → thanh 2
    """
    if not characters:
        return tones

    result = list(tones)
    for i in range(len(result) - 1):
        current_char = characters[i]
        next_tone = result[i + 1]

        # Quy tắc 1: biến điệu 3+3 → 2+3
        if result[i] == 3 and next_tone == 3:
            result[i] = 2

        # Quy tắc 2: 一
        if current_char == "一":
            if next_tone == 4:
                result[i] = 2
            elif next_tone in (1, 2, 3):
                result[i] = 4

        # Quy tắc 3: 不
        if current_char == "不" and next_tone == 4:
            result[i] = 2

    return result


class ParsedSyllable:
    """Một âm tiết đã phân tích."""
    __slots__ = ("character", "pinyin", "initial", "final", "tone", "expected_tone",
                 "start_time", "end_time")

    def __init__(
        self,
        character: str,
        pinyin: str,
        initial: str,
        final: str,
        tone: int,
        expected_tone: int,
        start_time: float = 0.0,
        end_time: float = 0.0,
    ):
        self.character = character
        self.pinyin = pinyin
        self.initial = initial
        self.final = final
        self.tone = tone
        self.expected_tone = expected_tone
        self.start_time = start_time
        self.end_time = end_time


def parse_reference_text(text: str, pinyin_hint: Optional[str] = None) -> List[ParsedSyllable]:
    """
    Parse câu tiếng Trung thành danh sách ParsedSyllable.
    Ưu tiên dùng pinyin_hint (từ user hoặc từ subtitle DB),
    fallback dùng pypinyin.
    """
    characters = [c for c in text if c.strip() and "\u4e00" <= c <= "\u9fff"]

    # Tách pinyin theo dấu cách nếu có hint
    if pinyin_hint:
        tokens = [t.strip() for t in re.split(r"\s+", pinyin_hint.strip()) if t.strip()]
    else:
        tokens = []

    base_tones: List[int] = []
    pinyins: List[str] = []

    for i, char in enumerate(characters):
        if pinyin_hint and i < len(tokens):
            _, _, t = _parse_pinyin(tokens[i])
            pinyins.append(tokens[i])
            base_tones.append(t)
        else:
            # pypinyin fallback
            py_list = lazy_pinyin(char, style=Style.TONE3)
            py = py_list[0] if py_list else char
            _, _, t = _parse_pinyin(py)
            pinyins.append(py)
            base_tones.append(t)

    # Apply tone sandhi
    expected_tones = _apply_tone_sandhi(characters, base_tones)

    syllables: List[ParsedSyllable] = []
    for i, char in enumerate(characters):
        initial, final, tone = _parse_pinyin(pinyins[i])
        syllables.append(ParsedSyllable(
            character=char,
            pinyin=pinyins[i],
            initial=initial,
            final=final,
            tone=tone,
            expected_tone=expected_tones[i],
        ))
    return syllables


# ── Pitch / F0 extraction (Parselmouth) ─────────────────────────────────

def extract_pitch_parselmouth(y: np.ndarray, sr: int) -> List[Tuple[float, float]]:
    """
    Trích xuất F0 contour bằng Parselmouth (Praat).
    Trả về list of (time, f0_hz).
    """
    try:
        import parselmouth
        sound = parselmouth.Sound(y, sampling_frequency=sr)
        pitch = sound.to_pitch(
            time_step=0.01,
            pitch_floor=75.0,
            pitch_ceiling=500.0,
        )
        values: List[Tuple[float, float]] = []
        for t in pitch.xs():
            f0 = pitch.get_value_at_time(t)
            if f0 is not None and f0 > 0:
                values.append((float(t), float(f0)))
        return values
    except ImportError:
        logger.warning("parselmouth not installed — falling back to librosa yin")
        return _extract_pitch_librosa(y, sr)
    except Exception as e:
        logger.warning(f"Pitch extraction failed: {e}")
        return []


def _extract_pitch_librosa(y: np.ndarray, sr: int) -> List[Tuple[float, float]]:
    """Fallback pitch extraction bằng librosa.yin khi không có parselmouth."""
    try:
        f0 = librosa.yin(y, fmin=75, fmax=500, sr=sr, frame_length=2048)
        times = librosa.times_like(f0, sr=sr, hop_length=512)
        return [(float(t), float(f)) for t, f in zip(times, f0) if f > 0]
    except Exception:
        return []


# ── Scoring ──────────────────────────────────────────────────────────────

# Đường contour chuẩn 5 tones (start, mid, end) đã normalize về thang 1-5
_TONE_CONTOURS = {
    1: (5.0, 5.0, 5.0),   # Tone 1: cao, ngang
    2: (3.0, 4.0, 5.0),   # Tone 2: đi lên
    3: (2.0, 1.0, 2.0),   # Tone 3: xuống rồi lên
    4: (5.0, 3.0, 1.0),   # Tone 4: xuống nhanh
    5: (3.0, 3.0, 3.0),   # Neutral
}


def _normalize_pitch(pitch_values: List[float]) -> List[float]:
    """Normalize pitch values thành thang 1-5."""
    if not pitch_values or len(pitch_values) < 2:
        return [3.0]
    valid = [p for p in pitch_values if p > 0]
    if not valid:
        return [3.0]
    p5 = np.percentile(valid, 5)
    p95 = np.percentile(valid, 95)
    if p95 == p5:
        return [3.0] * len(valid)
    normalized = []
    for p in valid:
        v = 1.0 + 4.0 * (p - p5) / (p95 - p5)
        normalized.append(max(1.0, min(5.0, v)))
    return normalized


def _rmse(a: Tuple[float, float, float], b: Tuple[float, float, float]) -> float:
    """Root mean square error giữa hai tuple 3 phần tử."""
    return float(np.sqrt(np.mean([(x - y) ** 2 for x, y in zip(a, b)])))


def score_tone(pitch_segment: List[float], expected_tone: int) -> Tuple[float, List[str]]:
    """
    Chấm điểm thanh điệu dựa trên contour normalize.
    Trả về (score 0..1, list lỗi).
    """
    if len(pitch_segment) < 5:
        return 0.5, ["Âm tiết quá ngắn để đánh giá thanh điệu"]

    normalized = _normalize_pitch(pitch_segment)
    n = len(normalized)
    start_p = float(np.median(normalized[:max(1, n // 4)]))
    mid_p = float(np.median(normalized[n // 2 - n // 8: n // 2 + n // 8]))
    end_p = float(np.median(normalized[-max(1, n // 4):]))
    actual = (start_p, mid_p, end_p)
    expected = _TONE_CONTOURS.get(expected_tone, (3.0, 3.0, 3.0))

    score = max(0.0, 1.0 - (_rmse(expected, actual) / 5.0))
    errors: List[str] = []

    if score < 0.7:
        start_a, mid_a, end_a = actual
        if expected_tone == 1:
            if abs(end_a - start_a) > 1.2:
                errors.append("Thanh bằng cần giữ cao và đều")
        elif expected_tone == 2:
            if (end_a - start_a) < 1.0:
                errors.append("Thanh huyền cần lên rõ ràng từ thấp đến cao")
        elif expected_tone == 3:
            if mid_a >= start_a:
                errors.append("Thanh ngã cần xuống thấp ở giữa rồi lên")
        elif expected_tone == 4:
            if (start_a - end_a) < 1.5:
                errors.append("Thanh sắc cần xuống mạnh và nhanh")

    return score, errors


def score_syllable(
    syllable: ParsedSyllable,
    pitch_contour: List[Tuple[float, float]],
) -> dict:
    """
    Chấm điểm một âm tiết.
    Returns dict compatible with SyllableScore schema.
    """
    # Trích pitch segment
    seg_pitch = [f0 for t, f0 in pitch_contour
                 if syllable.start_time <= t <= syllable.end_time]
    if not seg_pitch:
        seg_pitch = [0]

    tone_s, tone_errors = score_tone(seg_pitch, syllable.expected_tone)

    # Initial / final score (placeholder — baseline)
    initial_score = 0.85
    final_score = 0.85

    # Trọng số: tone 50%, initial 25%, final 25%
    overall = tone_s * 0.5 + initial_score * 0.25 + final_score * 0.25

    return {
        "character": syllable.character,
        "pinyin": syllable.pinyin,
        "expected_tone": syllable.expected_tone,
        "user_tone": int(round(tone_s * 5)) if tone_s < 1.0 else syllable.expected_tone,
        "tone_score": round(tone_s, 3),
        "initial_score": round(initial_score, 3),
        "final_score": round(final_score, 3),
        "overall_score": round(overall, 3),
        "errors": tone_errors,
        "start_time": round(syllable.start_time, 3),
        "end_time": round(syllable.end_time, 3),
    }


def align_syllables(syllables: List[ParsedSyllable], audio_duration: float) -> List[ParsedSyllable]:
    """Chia đều audio cho các âm tiết (simplified forced alignment)."""
    n = len(syllables)
    if n == 0:
        return syllables
    dur = audio_duration / n
    for i, syl in enumerate(syllables):
        syl.start_time = i * dur
        syl.end_time = (i + 1) * dur
    return syllables


# ── Feedback generation ──────────────────────────────────────────────────

def generate_summary(overall: float, syllable_results: List[dict]) -> str:
    """Tạo tóm tắt bằng tiếng Việt."""
    if overall >= 90:
        msg = "Xuất sắc! Phát âm của bạn rất chuẩn xác."
    elif overall >= 75:
        msg = "Tốt! Phát âm khá chuẩn, cần điều chỉnh một chút."
    elif overall >= 60:
        msg = "Khá! Cần tập trung vào thanh điệu và cách phát âm."
    else:
        msg = "Tiếp tục luyện tập! Đặc biệt chú ý đến các thanh điệu."

    tone_issues = sum(1 for s in syllable_results if s["tone_score"] < 0.7)
    if tone_issues > 0:
        msg += f" {tone_issues} âm tiết cần cải thiện thanh điệu."
    return msg


def generate_recommendations(syllable_results: List[dict]) -> List[dict]:
    """Tạo khuyến nghị cụ thể theo tone."""
    tone_counts: dict[int, int] = {}
    for s in syllable_results:
        for err in s["errors"]:
            if "bằng" in err:
                tone_counts[1] = tone_counts.get(1, 0) + 1
            elif "huyền" in err:
                tone_counts[2] = tone_counts.get(2, 0) + 1
            elif "ngã" in err:
                tone_counts[3] = tone_counts.get(3, 0) + 1
            elif "sắc" in err:
                tone_counts[4] = tone_counts.get(4, 0) + 1

    recs: List[dict] = []
    if 3 in tone_counts:
        recs.append({
            "type": "tone",
            "focus": "Thanh 3 (Thanh ngã)",
            "message": "Luyện chuyển động xuống-lên: bắt đầu giữa, xuống thấp, lên nhẹ",
            "examples": "你 (nǐ), 好 (hǎo), 我 (wǒ)",
        })
    if 4 in tone_counts:
        recs.append({
            "type": "tone",
            "focus": "Thanh 4 (Thanh sắc)",
            "message": "Xuống nhanh và mạnh, như nói 'Không!' một cách quyết đoán",
            "examples": "是 (shì), 不 (bù), 大 (dà)",
        })
    if 2 in tone_counts:
        recs.append({
            "type": "tone",
            "focus": "Thanh 2 (Thanh huyền)",
            "message": "Lên rõ ràng từ giữa đến cao, như đặt câu hỏi",
            "examples": "来 (lái), 没 (méi), 人 (rén)",
        })
    if 1 in tone_counts:
        recs.append({
            "type": "tone",
            "focus": "Thanh 1 (Thanh bằng)",
            "message": "Giữ cao đều, không lên không xuống",
            "examples": "妈 (mā), 妈 (mā), 哥 (gē)",
        })
    return recs


# ── Main service function ────────────────────────────────────────────────

def check_pronunciation(
    user_audio_bytes: bytes,
    reference_text: str,
    reference_pinyin: Optional[str] = None,
    reference_audio_bytes: Optional[bytes] = None,
) -> dict:
    """
    Hàm service chính — pipeline hoàn chỉnh:
    1) Load audio → 2) STT → 3) Parse text/pinyin → 4) Pitch extraction
    → 5) Per-syllable scoring → 6) Feedback + recommendations
    """
    # 1) Load audio
    y, sr, duration = load_audio_bytes(user_audio_bytes)

    # Trim silence
    y, _ = librosa.effects.trim(y, top_db=20)
    if len(y) < int(0.1 * sr):
        raise ValueError("Audio quá ngắn (ít hơn 0.1 giây).")

    # 2) STT
    recognized_text = transcribe_audio(y, sr)

    # 3) Parse reference text + pinyin
    syllables = parse_reference_text(reference_text, reference_pinyin)

    # 4) Extract pitch
    pitch_contour = extract_pitch_parselmouth(y, sr)

    # 5) Align syllables to audio duration
    syllables = align_syllables(syllables, duration)

    # 6) Score each syllable
    syllable_results = [score_syllable(syl, pitch_contour) for syl in syllables]

    # 7) Component scores
    text_score = 0.0
    if reference_text:
        ref_norm = re.sub(r"[^\w\u4e00-\u9fff]", "", reference_text.lower())
        rec_norm = re.sub(r"[^\w\u4e00-\u9fff]", "", recognized_text.lower())
        if ref_norm:
            text_score = float(SequenceMatcher(None, ref_norm, rec_norm).ratio() * 100.0)

    tone_scores = [s["tone_score"] for s in syllable_results]
    tone_score = float(np.mean(tone_scores) * 100.0) if tone_scores else 0.0

    acoustic_score = 0.0
    if reference_audio_bytes:
        try:
            ref_y, _, _ = load_audio_bytes(reference_audio_bytes)
            u_mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            r_mfcc = librosa.feature.mfcc(y=ref_y, sr=sr, n_mfcc=13)
            u_vec = np.mean(u_mfcc, axis=1)
            r_vec = np.mean(r_mfcc, axis=1)
            denom = np.linalg.norm(u_vec) * np.linalg.norm(r_vec)
            if denom > 0:
                cos = float(np.dot(u_vec, r_vec) / denom)
                acoustic_score = max(0.0, min(100.0, (cos + 1.0) * 50.0))
        except Exception:
            acoustic_score = 0.0

    # Weighted overall
    if reference_audio_bytes:
        overall = 0.35 * text_score + 0.40 * tone_score + 0.25 * acoustic_score
    else:
        overall = 0.55 * text_score + 0.45 * tone_score

    # Syllable overall
    syll_overall = float(np.mean([s["overall_score"] for s in syllable_results])) * 100.0
    final_overall = (overall + syll_overall) / 2.0

    # 8) Feedback
    summary = generate_summary(final_overall, syllable_results)
    recommendations = generate_recommendations(syllable_results)

    return {
        "overall_score": round(max(0.0, min(100.0, final_overall)), 1),
        "syllable_results": syllable_results,
        "summary": summary,
        "recommendations": recommendations,
        "recognized_text": recognized_text,
        "text_similarity_score": round(text_score, 2),
        "tone_score": round(tone_score, 2),
        "acoustic_score": round(acoustic_score, 2),
        "duration_seconds": round(duration, 3),
    }
