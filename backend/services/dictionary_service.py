import sys
sys.path.insert(0, "/app")

"""
services/dictionary_service.py — Chinese Dictionary Service v2

Nguồn: CC-CEDICT (120k+ entries)
Cải tiến:
  - Trả về NHIỀU nghĩa tiếng Việt (List[str]) thay vì 1 string
  - Dịch từng nghĩa tiếng Anh riêng biệt
  - Gộp nhiều entries (ví dụ: 打 có 5+ entry)
  - Ví dụ câu tiếng Trung + dịch tiếng Việt
"""
import os
import re
import logging
import hashlib
import urllib.request
import gzip
from typing import Optional
from pypinyin import lazy_pinyin, Style

logger = logging.getLogger(__name__)

CEDICT_MIRRORS = [
    "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz",
    "https://github.com/gugray/HanziLookupJS/raw/master/data/cedict_ts.u8.gz",
    "https://raw.githubusercontent.com/guo-yong-zhi/WordCloud.jl/master/test/cedict_ts.u8.gz",
]
CEDICT_PATH = "/tmp/cedict.txt"
CEDICT_GZ   = "/tmp/cedict.txt.gz"

# Bản dịch Anh→Việt tĩnh cho các cụm từ phổ biến trong CC-CEDICT
# Giúp tránh gọi Google Translate cho những từ rất phổ biến
QUICK_TRANSLATE: dict[str, str] = {
    "to learn": "học",
    "to study": "học tập",
    "to research": "nghiên cứu",
    "to absorb knowledge": "tiếp thu kiến thức",
    "to hit": "đánh",
    "to beat": "đánh, đập",
    "to call": "gọi điện",
    "to play": "chơi",
    "to open": "mở",
    "to type": "gõ",
    "to build": "xây dựng",
    "meaning": "ý nghĩa",
    "idea": "ý tưởng",
    "interesting": "thú vị",
    "embarrassed": "ngượng ngùng",
    "to express": "thể hiện",
    "friend": "bạn bè",
    "good": "tốt",
    "bad": "xấu, tệ",
    "love": "tình yêu",
    "work": "làm việc",
    "time": "thời gian",
    "person": "người",
    "day": "ngày",
    "year": "năm",
}

_dictionary: dict[str, list[dict]] = {}
_loaded = False


def ensure_loaded():
    global _loaded
    if _loaded:
        return
    _load_cedict()
    _loaded = True


def _load_cedict():
    global _dictionary

    if not os.path.exists(CEDICT_PATH) or os.path.getsize(CEDICT_PATH) == 0:
        logger.info("Downloading CC-CEDICT...")
        _download_cedict()

    logger.info("Parsing CC-CEDICT...")
    count = 0
    try:
        with open(CEDICT_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                entry = _parse_cedict_line(line)
                if not entry:
                    continue
                simplified = entry["simplified"]
                if simplified not in _dictionary:
                    _dictionary[simplified] = []
                _dictionary[simplified].append(entry)
                count += 1
    except Exception as e:
        logger.error(f"Failed to parse CC-CEDICT: {e}")

    logger.info(f"CC-CEDICT loaded: {count} entries, {len(_dictionary)} unique words")


def _download_cedict():
    for url in CEDICT_MIRRORS:
        try:
            logger.info(f"Trying: {url}")
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as response:
                with open(CEDICT_GZ, 'wb') as f:
                    f.write(response.read())
            with gzip.open(CEDICT_GZ, 'rb') as gz_f:
                with open(CEDICT_PATH, 'wb') as out_f:
                    out_f.write(gz_f.read())
            if os.path.exists(CEDICT_GZ):
                os.remove(CEDICT_GZ)
            size_mb = os.path.getsize(CEDICT_PATH) / 1024 / 1024
            logger.info(f"Downloaded: {size_mb:.1f}MB from {url}")
            return
        except Exception as e:
            logger.warning(f"Mirror failed: {e}")
    logger.error("All CC-CEDICT mirrors failed.")
    open(CEDICT_PATH, 'w').close()


def _parse_cedict_line(line: str) -> Optional[dict]:
    m = re.match(r'^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+/(.+)/$', line)
    if not m:
        return None
    traditional, simplified, pinyin_raw, defs_raw = m.groups()
    pinyin_display = _pinyin_numbers_to_marks(pinyin_raw)
    # Lọc bỏ các nghĩa là reference (bắt đầu bằng "see ", "variant of", "abbr.")
    definitions = [
        d.strip() for d in defs_raw.split("/")
        if d.strip() and not re.match(r'^(see |variant of|abbr\. for|old variant|erhua variant)', d.strip(), re.I)
    ]
    pos = _extract_pos(definitions[0] if definitions else "")
    return {
        "traditional": traditional, "simplified": simplified,
        "pinyin_raw": pinyin_raw, "pinyin": pinyin_display,
        "definitions": definitions, "pos": pos,
    }


def _pinyin_numbers_to_marks(pinyin_num: str) -> str:
    tone_map = {
        'a': ['ā','á','ǎ','à','a'], 'e': ['ē','é','ě','è','e'],
        'i': ['ī','í','ǐ','ì','i'], 'o': ['ō','ó','ǒ','ò','o'],
        'u': ['ū','ú','ǔ','ù','u'], 'ü': ['ǖ','ǘ','ǚ','ǜ','ü'],
        'v': ['ǖ','ǘ','ǚ','ǜ','ü'],
    }
    result = []
    for syllable in pinyin_num.split():
        if syllable and syllable[-1].isdigit():
            tone = int(syllable[-1])
            syllable = syllable[:-1]
        else:
            tone = 5
        if tone in (1, 2, 3, 4):
            placed = False
            for vowel in ['a', 'e', 'ou', 'iu', 'ui']:
                if vowel in syllable:
                    target = vowel[0]
                    if target in tone_map:
                        syllable = syllable.replace(target, tone_map[target][tone - 1], 1)
                        placed = True
                        break
            if not placed:
                for i in range(len(syllable) - 1, -1, -1):
                    if syllable[i] in tone_map:
                        syllable = syllable[:i] + tone_map[syllable[i]][tone - 1] + syllable[i+1:]
                        break
        result.append(syllable)
    return " ".join(result)


def _extract_pos(definition: str) -> str:
    pos_patterns = [
        (r'\b(noun|n\.)\b', "danh từ"), (r'\b(verb|v\.)\b', "động từ"),
        (r'\b(adjective|adj\.)\b', "tính từ"), (r'\b(adverb|adv\.)\b', "trạng từ"),
        (r'\b(pronoun|pron\.)\b', "đại từ"), (r'\b(measure word|MW)\b', "lượng từ"),
        (r'\b(particle)\b', "trợ từ"), (r'\b(conjunction|conj\.)\b', "liên từ"),
        (r'\b(preposition|prep\.)\b', "giới từ"), (r'\b(interjection)\b', "thán từ"),
        (r'\b(numeral|num\.)\b', "số từ"),
    ]
    dl = definition.lower()
    for pattern, pos_vi in pos_patterns:
        if re.search(pattern, dl):
            return pos_vi
    return "từ"


# ─────────────────────────────────────────────
#  MAIN LOOKUP — trả về đa nghĩa
# ─────────────────────────────────────────────

def lookup(word: str) -> Optional[dict]:
    """
    Tra từ điển CC-CEDICT.

    Returns dict với:
      - meanings_vi: List[str]  ← NHIỀU nghĩa tiếng Việt
      - definitions_en: List[str] ← nghĩa tiếng Anh gốc
      - example: {"zh": "...", "vi": "..."}
    """
    ensure_loaded()
    word = word.strip()
    if not word:
        return None

    # Tìm tất cả entries (simplified và traditional)
    entries = _dictionary.get(word, [])
    if not entries:
        for entries_list in _dictionary.values():
            for e in entries_list:
                if e["traditional"] == word:
                    entries = entries_list
                    break
            if entries:
                break

    if not entries:
        return _fallback_lookup(word)

    # ── Thu thập TẤT CẢ nghĩa từ tất cả entries ──
    # Ví dụ: 打 có ~5 entries trong CC-CEDICT với nhiều nghĩa khác nhau
    all_definitions_en: list[str] = []
    seen = set()
    for entry in entries:
        for d in entry["definitions"]:
            if d not in seen:
                all_definitions_en.append(d)
                seen.add(d)

    # Lấy tối đa 8 nghĩa (tránh quá dài)
    all_definitions_en = all_definitions_en[:8]

    # ── Dịch từng nghĩa sang tiếng Việt ──
    meanings_vi = _translate_each_definition(all_definitions_en)

    # ── Lấy pinyin từ entry đầu ──
    pinyin = entries[0]["pinyin"]
    pos    = entries[0]["pos"]

    # ── Tạo ví dụ câu ──
    example = _build_example(word, entries)

    # ── Grammar note ──
    grammar = _build_grammar_note(entries[0], all_definitions_en)

    return {
        "word":           word,
        "pinyin":         pinyin,
        "meanings_vi":    meanings_vi,        # List[str] — ĐA NGHĨA tiếng Việt
        "meaning_vi":     meanings_vi[0] if meanings_vi else word,  # backward compat
        "pos":            pos,
        "grammar":        grammar,
        "example":        example,
        "audio_url":      f"/api/audio/{_word_to_filename(word)}.mp3",
        "definitions_en": all_definitions_en,
    }


def _translate_each_definition(definitions: list[str]) -> list[str]:
    """
    Dịch từng nghĩa tiếng Anh sang tiếng Việt riêng lẻ.
    Ưu tiên QUICK_TRANSLATE dict, sau đó Google Translate theo batch.
    """
    if not definitions:
        return []

    # Bước 1: Dùng quick translate nếu có
    results = []
    to_translate_idx = []   # index cần dịch thật
    to_translate_text = []  # text cần dịch thật

    for i, defn in enumerate(definitions):
        quick = _quick_translate(defn)
        if quick:
            results.append(quick)
        else:
            results.append(None)  # placeholder
            to_translate_idx.append(i)
            to_translate_text.append(defn)

    # Bước 2: Batch translate những cái chưa có
    if to_translate_text:
        translated = _batch_translate(to_translate_text)
        for i, idx in enumerate(to_translate_idx):
            results[idx] = translated[i] if i < len(translated) else definitions[idx]

    # Lọc bỏ None và deduplicate
    seen = set()
    final = []
    for r in results:
        if r and r not in seen and r.lower() != r.upper():  # bỏ nếu không dịch được
            seen.add(r)
            final.append(r)

    return final or [definitions[0]]


def _quick_translate(en_text: str) -> Optional[str]:
    """Tra bảng dịch nhanh cho các cụm phổ biến."""
    en_lower = en_text.lower().strip()
    # Exact match
    if en_lower in QUICK_TRANSLATE:
        return QUICK_TRANSLATE[en_lower]
    # Partial: "to learn sth" → "to learn" → "học"
    for key, val in QUICK_TRANSLATE.items():
        if en_lower.startswith(key):
            return val
    return None


def _batch_translate(texts: list[str]) -> list[str]:
    """
    Dịch batch các định nghĩa tiếng Anh sang tiếng Việt.
    Gửi từng cái riêng (không ghép chuỗi) để giữ đa nghĩa.
    """
    results = []
    try:
        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source="en", target="vi")
        for text in texts:
            try:
                # Làm sạch: bỏ "(sb)" "(sth)" "(coll.)" v.v.
                clean = re.sub(r'\(sb\)|\(sth\)|\(coll\.\)|\(lit\.\)|\(fig\.\)', '', text).strip()
                # Bỏ "to " ở đầu vì tiếng Việt không cần
                clean = re.sub(r'^to ', '', clean)
                translated = translator.translate(clean)
                results.append(translated or text)
            except Exception:
                results.append(text)
    except Exception as e:
        logger.warning(f"Batch translate failed: {e}")
        results = texts

    return results


def _build_example(word: str, entries: list[dict]) -> dict:
    """Tạo ví dụ câu: {"zh": "...", "vi": "..."}"""
    # Tìm ví dụ có chứa chữ Hán trong definitions
    for entry in entries:
        for d in entry.get("definitions", []):
            if len(d) > 5 and any('\u4e00' <= c <= '\u9fff' for c in d):
                try:
                    from deep_translator import GoogleTranslator
                    vi = GoogleTranslator(source="zh-CN", target="vi").translate(d)
                    return {"zh": d, "vi": vi or ""}
                except Exception:
                    return {"zh": d, "vi": ""}

    # Ví dụ mặc định đơn giản
    defaults = {
        "你": {"zh": "你好！", "vi": "Xin chào!"},
        "我": {"zh": "我是学生。", "vi": "Tôi là học sinh."},
        "学": {"zh": "我喜欢学习。", "vi": "Tôi thích học tập."},
        "好": {"zh": "今天天气很好。", "vi": "Hôm nay thời tiết rất đẹp."},
    }
    for char, ex in defaults.items():
        if char in word:
            return ex

    return {"zh": word, "vi": ""}


def _build_grammar_note(entry: dict, all_defs: list[str]) -> str:
    pos = entry.get("pos", "từ")
    notes = [f"Từ loại: {pos}"]
    if len(all_defs) > 1:
        notes.append(f"Có {len(all_defs)} nghĩa trong từ điển CC-CEDICT")
    return ". ".join(notes)


def _fallback_lookup(word: str) -> Optional[dict]:
    """Fallback khi không tìm thấy trong CC-CEDICT."""
    try:
        pinyin = " ".join(lazy_pinyin(word, style=Style.TONE))
        from deep_translator import GoogleTranslator
        meaning = GoogleTranslator(source="zh-CN", target="vi").translate(word)
        meanings_vi = [meaning] if meaning else [word]
        return {
            "word":           word,
            "pinyin":         pinyin,
            "meanings_vi":    meanings_vi,
            "meaning_vi":     meanings_vi[0],
            "pos":            "từ",
            "grammar":        "Không tìm thấy trong CC-CEDICT. Dùng Google Translate.",
            "example":        {"zh": word, "vi": meaning or ""},
            "audio_url":      f"/api/audio/{_word_to_filename(word)}.mp3",
            "definitions_en": [],
        }
    except Exception as e:
        logger.warning(f"Fallback failed for '{word}': {e}")
        return None


def _word_to_filename(word: str) -> str:
    return hashlib.md5(word.encode()).hexdigest()[:12]


def segment_text(text: str) -> list:
    try:
        import jieba
        words = list(jieba.cut(text, cut_all=False))
        return [w.strip() for w in words if w.strip()]
    except Exception as e:
        logger.warning(f"Segmentation failed: {e}")
        return [text]