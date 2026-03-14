"""
pipeline/llm_processor.py — LLM Post-processing (Optional)

Dùng Claude API để:
1. Thêm dấu câu vào raw Whisper output
2. Sửa lỗi nhận dạng rõ ràng
3. Chuẩn hoá text trước khi dịch

CHỈ KÍCH HOẠT khi có ANTHROPIC_API_KEY trong environment.
Nếu không có key → bỏ qua silently, pipeline vẫn chạy bình thường.

Thiết kế theo pattern Strategy — có thể thay thế bằng OpenAI/Gemini sau này.
"""
import os
import logging
import json
from typing import List, Optional

logger = logging.getLogger(__name__)

# Kích thước mỗi batch gửi lên LLM (số câu)
BATCH_SIZE = 8


def is_llm_available() -> bool:
    """Kiểm tra xem LLM có thể dùng không."""
    return bool(os.getenv("ANTHROPIC_API_KEY"))


def post_process_subtitles(subtitles: List[dict]) -> List[dict]:
    """
    Main entry point. Nếu không có API key → trả về nguyên bản.

    Args:
        subtitles: List[{"start", "end", "chinese"}]

    Returns:
        List[{"start", "end", "chinese"}] — chinese đã được cải thiện
    """
    if not is_llm_available():
        logger.info("LLM post-processing skipped (no ANTHROPIC_API_KEY)")
        return subtitles

    if not subtitles:
        return subtitles

    logger.info(f"LLM post-processing {len(subtitles)} segments in batches of {BATCH_SIZE}")

    result = []
    for i in range(0, len(subtitles), BATCH_SIZE):
        batch = subtitles[i:i + BATCH_SIZE]
        try:
            processed = _process_batch(batch)
            result.extend(processed)
        except Exception as e:
            logger.warning(f"LLM batch {i//BATCH_SIZE + 1} failed: {e}. Using original.")
            result.extend(batch)

    logger.info("LLM post-processing complete")
    return result


def _process_batch(batch: List[dict]) -> List[dict]:
    """
    Gửi một batch subtitle lên Claude để cải thiện văn bản.

    Prompt được thiết kế để:
    - Chỉ sửa dấu câu và lỗi rõ ràng
    - Không thêm/bớt nội dung
    - Không dịch
    - Trả về JSON đúng cấu trúc
    """
    import anthropic

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    # Chuẩn bị input: chỉ gửi text, giữ lại timing riêng
    texts = [s["chinese"] for s in batch]
    input_json = json.dumps(texts, ensure_ascii=False)

    prompt = f"""You are a Chinese text editor. Fix the following subtitle segments from automatic speech recognition.

Rules:
- Add punctuation (，。！？…) where appropriate
- Fix obvious recognition errors (e.g., wrong homophones in context)
- Do NOT add or remove content
- Do NOT translate
- Keep each segment as a single string
- Return ONLY a JSON array of strings, same length as input

Input segments:
{input_json}

Return only the JSON array, no other text."""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",   # Haiku: nhanh và rẻ cho task này
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = message.content[0].text.strip()

    # Parse JSON response
    # Xử lý trường hợp Claude wrap trong code block
    if "```" in response_text:
        response_text = response_text.split("```")[1]
        if response_text.startswith("json"):
            response_text = response_text[4:]

    improved_texts = json.loads(response_text.strip())

    # Validate: đảm bảo số lượng khớp
    if len(improved_texts) != len(batch):
        logger.warning(
            f"LLM returned {len(improved_texts)} items but expected {len(batch)}. Using original."
        )
        return batch

    # Ghép lại với timing gốc
    return [
        {**s, "chinese": improved_texts[i]}
        for i, s in enumerate(batch)
    ]
