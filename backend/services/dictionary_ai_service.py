import os
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ── PROMPTS ────────────────────────────────────────────────────────────────

QUICK_LOOKUP_PROMPT = """Bạn là một thầy giáo tiếng Trung cho người Việt. Trả lời NGẮN GỌN.

TỪ CẦN TRA: "{word}"
NGHĨA TIẾNG ANH GỐC (từ từ điển): {definitions_en}
NGHĨA VIỆT ĐÃ DỊCH: {meanings_vi}

TASK: Trả về JSON object duy nhất, không giải thích gì thêm:

{{
  "word": "{word}",
  "pinyin": "...",
  "han_viet": "...",
  "meaning_vi": "...",
  "quick_example": {{
    "zh": "...",
    "vi": "...",
    "context": "..."
  }}
}}

RULES:
- pinyin: phiên âm Latin đầy đủ với dấu thanh (VD: nǐ hǎo)
- han_viet: dịch nghĩa Hán Việt từng chữ (VD: 你=ngươi/bạn, 好=tốt)
- meaning_vi: nghĩa tiếng Việt NGẮN NHẤT (dưới 20 từ), phù hợp ngữ cảnh
- quick_example: 1 câu ví dụ thực tế, có dịch tiếng Việt, ghi rõ ngữ cảnh dùng
- Nếu từ có nhiều nghĩa, CHỈ trả về nghĩa phù hợp nhất
- Trả về JSON thuần, không markdown, không giải thích
"""


FULL_ANALYSIS_PROMPT = """Bạn là chuyên gia ngôn ngữ Trung-Việt hàng đầu. Phân tích TOÀN DIỆN từ tiếng Trung.

TỪ CẦN TRA: "{word}"
PINYIN: "{pinyin}"
DANH SÁCH NGHĨA TIẾNG ANH (từ từ điển gốc):
{definitions_en}

TASK: Phân tích đầy đủ, trả về JSON object duy nhất:

{{
  "word": "{word}",
  "pinyin": "...",
  "strokes": ...,
  "radical": "...",
  "radical_info": {{
    "name": "...",
    "meaning": "...",
    "stroke_count": ...
  }},
  "decomposition": "...",
  "character_analysis": [
    {{
      "char": "...",
      "pinyin": "...",
      "meaning": "...",
      "radical": "...",
      "strokes": ...,
      "meaning_origin": "..."
    }}
  ],
  "meanings": {{
    "han_viet_goc": "...",
    "tieng_viet": "...",
    "tieng_anh": "..."
  }},
  "usage": {{
    "formal": "...",
    "informal": "...",
    "written": "...",
    "spoken": "..."
  }},
  "grammar_pattern": "...",
  "examples": [
    {{ "zh": "...", "pinyin": "...", "vi": "...", "context": "..." }},
    {{ "zh": "...", "pinyin": "...", "vi": "...", "context": "..." }},
    {{ "zh": "...", "pinyin": "...", "vi": "...", "context": "..." }}
  ],
  "memorization": {{
    "mnemonic": "...",
    "story": "...",
    "compare_vi": "..."
  }},
  "related": {{
    "same_radical": ["..."],
    "same_topic": ["..."],
    "opposite": ["..."]
  }},
  "mistakes": ["..."],
  "tips": "..."
}}

RULES:
- strokes: tổng số nét của chữ Hán
- decomposition: cấu tạo chữ (VD: "你 = 亻 + 尔")
- radical: bộ thủ chính (VD: 亻 cho chữ 你)
- radical_info: thông tin bộ thủ đầy đủ
- character_analysis: phân tích từng chữ Hán trong từ (nếu cụm từ thì phân tích từng chữ)
- meaning_origin: nguồn gốc ý nghĩa — GIẢI THÍCH TẠI SAO chữ có nghĩa này (2-3 câu)
  VD: "好 = 女 + 子 → 'người phụ nữ + con' → mang con đến cho thấy tốt đẹp → tốt"
- meanings.han_viet_goc: dịch từng chữ Hán ra Hán Việt (nghĩa gốc theo từ điển cổ)
- meanings.tieng_viet: nghĩa tiếng Việt phổ thông nhất (dưới 30 từ)
- meanings.tieng_anh: nghĩa tiếng Anh ngắn nhất từ dictionary gốc
- usage: 4 ngữ cảnh sử dụng (1-2 câu mỗi cái)
- grammar_pattern: cấu trúc ngữ pháp thường dùng với từ này (VD: "很+[tính từ]+吗？")
- memorization.mnemonic: mẹo ghi nhớ SÁNG TẠO, dễ nhớ cho người Việt, có thể dùng hình ảnh hoặc Hán Việt (tối đa 50 từ)
- memorization.story: câu chuyện ngắn gắn kết các nghĩa lại (tối đa 80 từ)
- memorization.compare_vi: SO SÁNH với từ tiếng Việt/tiếng Anh cùng nghĩa, giúp người học liên tưởng
- examples: 3 ví dụ thực tế, có dịch tiếng Việt và ghi rõ ngữ cảnh dùng
- related: 3-5 từ cùng bộ thủ, cùng chủ đề, và từ trái nghĩa
- mistakes: 2-3 lỗi phát âm / dùng từ người Việt hay mắc
- tips: lời khuyên thực tế cho người Việt học tiếng Trung (tối đa 60 từ)
- Trả về JSON thuần, không markdown code block, không giải thích
"""


TOKENIZE_PROMPT = """Bạn là chuyên gia ngôn ngữ Trung-Việt. Tách câu tiếng Trung thành các từ/cụm từ có NGHĨA ĐỘC LẬP.

CÂU: "{sentence}"
DỊCH TIẾNG VIỆT: "{translation}"

TASK: Trả về JSON array duy nhất:

[
  {{
    "word": "...",
    "start": 0,
    "end": 2,
    "is_clickable": true,
    "note": "..."
  }}
]

RULES:
- Tách THEO NGHĨA, không tách từng chữ Hán riêng lẻ
- Cụm từ thường dùng giữ nguyên (VD: 你好, 不客气, 没有)
- Bỏ qua particle không có nghĩa độc lập: 的, 了, 着, 吗, 吧, 呢, 啊, 嘛, 的
- is_clickable = true: danh từ, động từ, tính từ, phó từ quan trọng
- is_clickable = false: particle, liên từ, giới từ phổ biến
- start/end: vị trí ký tự trong câu gốc (Unicode)
- Trả về 1-8 từ/cụm, chọn NHỮNG từ THỰC SỰ hữu ích cho người học
- Trả về JSON thuần, không markdown, không giải thích
"""

# ── CACHE ──────────────────────────────────────────────────────────────────
# Cache kết quả AI để tránh gọi lại cùng một từ
_ai_cache: dict[str, dict] = {}
MAX_CACHE = 500


def _get_client():
    import anthropic
    return anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def is_ai_available() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def _parse_json_response(response_text: str) -> Optional[dict | list]:
    """Parse JSON từ response của Claude, xử lý code block."""
    text = response_text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        for i, part in enumerate(parts):
            if i % 2 == 1:  # phần trong code block
                part = part.strip()
                if part.startswith("json"):
                    part = part[4:].strip()
                return json.loads(part)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Thử tìm JSON trong text
        import re
        match = re.search(r'\{[\s\S]*\}|\[[\s\S]*\]', text)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return None


def _call_claude_haiku(prompt: str) -> Optional[str]:
    """Gọi Claude Haiku — nhanh, rẻ cho quick lookup."""
    try:
        client = _get_client()
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()
    except Exception as e:
        logger.warning(f"Claude Haiku call failed: {e}")
        return None


def _call_claude_sonnet(prompt: str) -> Optional[str]:
    """Gọi Claude Sonnet — mạnh hơn cho full analysis."""
    try:
        client = _get_client()
        message = client.messages.create(
            model="claude-sonnet-4-5-20251101",
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text.strip()
    except Exception as e:
        logger.warning(f"Claude Sonnet call failed: {e}")
        return None


# ── MAIN FUNCTIONS ─────────────────────────────────────────────────────────

def quick_lookup(word: str, meanings_vi: list[str], definitions_en: list[str]) -> Optional[dict]:
    """
    Tra nghĩa nhanh — dùng cho popup khi click từ trong subtitle video.
    Cache kết quả để lần sau trả về ngay.
    """
    # Cache hit
    cache_key = f"quick:{word}"
    if cache_key in _ai_cache:
        return _ai_cache[cache_key]

    if not is_ai_available():
        return None

    # Join meanings để đưa vào prompt
    meanings_str = "\n".join(f"  - {m}" for m in meanings_vi[:5]) if meanings_vi else "Không có"
    defs_str = "\n".join(f"  - {d}" for d in definitions_en[:5]) if definitions_en else "Không có"

    prompt = QUICK_LOOKUP_PROMPT.format(
        word=word,
        meanings_vi=meanings_str,
        definitions_en=defs_str,
    )

    response = _call_claude_haiku(prompt)
    if not response:
        return None

    result = _parse_json_response(response)
    if result and isinstance(result, dict):
        # Cache
        if len(_ai_cache) >= MAX_CACHE:
            oldest = next(iter(_ai_cache))
            del _ai_cache[oldest]
        _ai_cache[cache_key] = result

    return result


def full_analysis(word: str, pinyin: str, meanings_vi: list[str], definitions_en: list[str]) -> Optional[dict]:
    """
    Phân tích sâu từ điển — dùng cho trang Dictionary chi tiết.
    Cache kết quả để lần sau trả về ngay.
    """
    # Cache hit
    cache_key = f"full:{word}"
    if cache_key in _ai_cache:
        return _ai_cache[cache_key]

    if not is_ai_available():
        return None

    meanings_str = "\n".join(f"  - {m}" for m in meanings_vi[:5]) if meanings_vi else "Không có"
    defs_str = "\n".join(f"  - {d}" for d in definitions_en[:5]) if definitions_en else "Không có"

    prompt = FULL_ANALYSIS_PROMPT.format(
        word=word,
        pinyin=pinyin,
        meanings_vi=meanings_str,
        definitions_en=defs_str,
    )

    response = _call_claude_sonnet(prompt)
    if not response:
        return None

    result = _parse_json_response(response)
    if result and isinstance(result, dict):
        # Cache
        if len(_ai_cache) >= MAX_CACHE:
            oldest = next(iter(_ai_cache))
            del _ai_cache[oldest]
        _ai_cache[cache_key] = result

    return result


def smart_tokenize(sentence: str, translation: str) -> Optional[list[dict]]:
    """
    Tách câu tiếng Trung thành các từ có nghĩa độc lập.
    Dùng khi user click vào cụm từ trong subtitle.
    """
    cache_key = f"tokenize:{sentence}"
    if cache_key in _ai_cache:
        return _ai_cache[cache_key]

    if not is_ai_available():
        return None

    prompt = TOKENIZE_PROMPT.format(
        sentence=sentence,
        translation=translation,
    )

    response = _call_claude_haiku(prompt)
    if not response:
        return None

    result = _parse_json_response(response)
    if result and isinstance(result, list):
        if len(_ai_cache) >= MAX_CACHE:
            oldest = next(iter(_ai_cache))
            del _ai_cache[oldest]
        _ai_cache[cache_key] = result

    return result
