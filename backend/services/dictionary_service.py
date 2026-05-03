import sys
sys.path.insert(0, "/app")

"""
services/dictionary_service.py — Chinese Dictionary Service v3 (optimized)

Tối ưu tốc độ:
  1. Static cache 500+ definitions → O(1), 0ms
  2. In-memory LRU cache kết quả lookup → lần 2 trả về ngay
  3. Batch translate chỉ khi thực sự cần (fallback cuối)
"""
import os
import re
import logging
import hashlib
import urllib.request
import gzip
from typing import Optional
from functools import lru_cache
from pypinyin import lazy_pinyin, Style

logger = logging.getLogger(__name__)

CEDICT_MIRRORS = [
    "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz",
    "https://github.com/gugray/HanziLookupJS/raw/master/data/cedict_ts.u8.gz",
]
CEDICT_PATH = "/tmp/cedict.txt"
CEDICT_GZ   = "/tmp/cedict.txt.gz"

_dictionary: dict[str, list[dict]] = {}
_loaded = False

# In-memory LRU cache kết quả lookup — tránh re-process cùng từ
_lookup_cache: dict[str, dict] = {}
MAX_LOOKUP_CACHE = 2000


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
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                with open(CEDICT_GZ, 'wb') as f:
                    f.write(r.read())
            with gzip.open(CEDICT_GZ, 'rb') as gz:
                with open(CEDICT_PATH, 'wb') as out:
                    out.write(gz.read())
            if os.path.exists(CEDICT_GZ):
                os.remove(CEDICT_GZ)
            logger.info(f"Downloaded CC-CEDICT from {url}")
            return
        except Exception as e:
            logger.warning(f"Mirror failed: {e}")
    open(CEDICT_PATH, 'w').close()


def _parse_cedict_line(line: str) -> Optional[dict]:
    m = re.match(r'^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+/(.+)/$', line)
    if not m:
        return None
    traditional, simplified, pinyin_raw, defs_raw = m.groups()
    pinyin_display = _pinyin_numbers_to_marks(pinyin_raw)
    definitions = [
        d.strip() for d in defs_raw.split("/")
        if d.strip() and not re.match(r'^(see |variant of|abbr\. for|old variant)', d.strip(), re.I)
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
    ]
    dl = definition.lower()
    for pattern, pos_vi in pos_patterns:
        if re.search(pattern, dl):
            return pos_vi
    return "từ"


# ── MAIN LOOKUP — có LRU cache ──

def lookup(word: str) -> Optional[dict]:
    ensure_loaded()
    word = word.strip()
    if not word:
        return None

    # LRU cache hit
    if word in _lookup_cache:
        return _lookup_cache[word]

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
        result = _fallback_lookup(word)
    else:
        # Thu thập tất cả nghĩa từ mọi entries
        all_defs: list[str] = []
        seen: set[str] = set()
        for entry in entries:
            for d in entry["definitions"]:
                if d not in seen:
                    all_defs.append(d)
                    seen.add(d)
        all_defs = all_defs[:8]

        meanings_vi = _translate_definitions_fast(all_defs)
        example     = _build_example(word, entries)
        grammar     = f"Từ loại: {entries[0]['pos']}. Có {len(all_defs)} nghĩa trong CC-CEDICT."

        result = {
            "word":           word,
            "pinyin":         entries[0]["pinyin"],
            "meanings_vi":    meanings_vi,
            "meaning_vi":     meanings_vi[0] if meanings_vi else word,
            "pos":            entries[0]["pos"],
            "grammar":        grammar,
            "example":        example,
            "audio_url":      f"/api/audio/{_word_to_filename(word)}.mp3",
            "definitions_en": all_defs,
        }

    # Lưu vào cache
    if result:
        if len(_lookup_cache) >= MAX_LOOKUP_CACHE:
            # Xoá entry cũ nhất
            oldest = next(iter(_lookup_cache))
            del _lookup_cache[oldest]
        _lookup_cache[word] = result

    return result


def _translate_definitions_fast(definitions: list[str]) -> list[str]:
    """
    Dịch nhanh: ưu tiên static cache → Google Translate chỉ khi cần.
    Mục tiêu: 0 network request cho 80%+ trường hợp thông thường.
    """
    from services.translation_cache import fast_translate_en_vi

    results = []
    need_translate = []   # (index, text) cần Google Translate
    seen_vi: set[str] = set()

    for i, defn in enumerate(definitions):
        vi = fast_translate_en_vi(defn)
        if vi and vi not in seen_vi:
            results.append(vi)
            seen_vi.add(vi)
        elif vi is None:
            need_translate.append((len(results), defn))
            results.append(None)  # placeholder

    # Chỉ gọi Google Translate cho phần còn lại (thường rất ít)
    if need_translate:
        texts = [t for _, t in need_translate]
        # Gộp thành 1 request duy nhất để giảm latency
        try:
            from deep_translator import GoogleTranslator
            combined = " | ".join(
                re.sub(r'^to ', '', t.lower()).strip()
                for t in texts
            )
            translated_combined = GoogleTranslator(source="en", target="vi").translate(combined)
            parts = [p.strip() for p in translated_combined.split("|")]

            for j, (idx, _) in enumerate(need_translate):
                vi = parts[j] if j < len(parts) else texts[j]
                if vi and vi not in seen_vi:
                    results[idx] = vi
                    seen_vi.add(vi)
                else:
                    results[idx] = None
        except Exception as e:
            logger.warning(f"Google Translate failed: {e}")
            for idx, text in need_translate:
                results[idx] = text  # fallback: tiếng Anh

    return [r for r in results if r]  # bỏ None


def _build_example(word: str, entries: list[dict]) -> dict:
    for entry in entries:
        for d in entry.get("definitions", []):
            if len(d) > 5 and any('\u4e00' <= c <= '\u9fff' for c in d):
                try:
                    from deep_translator import GoogleTranslator
                    vi = GoogleTranslator(source="zh-CN", target="vi").translate(d)
                    return {"zh": d, "vi": vi or ""}
                except Exception:
                    return {"zh": d, "vi": ""}
    return {"zh": word, "vi": ""}


def _fallback_lookup(word: str) -> Optional[dict]:
    try:
        pinyin = " ".join(lazy_pinyin(word, style=Style.TONE))
        from deep_translator import GoogleTranslator
        meaning = GoogleTranslator(source="zh-CN", target="vi").translate(word)
        meanings_vi = [meaning] if meaning else [word]
        return {
            "word": word, "pinyin": pinyin,
            "meanings_vi": meanings_vi, "meaning_vi": meanings_vi[0],
            "pos": "từ",
            "grammar": "Không có trong CC-CEDICT. Dùng Google Translate.",
            "example": {"zh": word, "vi": meaning or ""},
            "audio_url": f"/api/audio/{_word_to_filename(word)}.mp3",
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