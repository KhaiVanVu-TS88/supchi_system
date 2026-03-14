"""
pipeline/adapters.py — Adapter functions

Wrap các function cũ thành interface thống nhất cho orchestrator.
Tách ra file riêng để không sửa code cũ đã hoạt động.
"""
from typing import List
from pipeline.pinyin_converter import convert_batch
from pipeline.translator import translate_batch


def add_pinyin(subtitles: List[dict]) -> List[dict]:
    """
    Thêm field 'pinyin' vào mỗi subtitle segment.

    Input:  [{"start", "end", "chinese"}]
    Output: [{"start", "end", "chinese", "pinyin"}]
    """
    texts = [s["chinese"] for s in subtitles]
    pinyins = convert_batch(texts)
    return [
        {**s, "pinyin": pinyins[i]}
        for i, s in enumerate(subtitles)
    ]


def translate_subtitles(subtitles: List[dict]) -> List[dict]:
    """
    Thêm field 'vietnamese' vào mỗi subtitle segment.

    Input:  [{"start", "end", "chinese", "pinyin"}]
    Output: [{"start", "end", "chinese", "pinyin", "vietnamese"}]
    """
    texts = [s["chinese"] for s in subtitles]
    translations = translate_batch(texts)
    return [
        {**s, "vietnamese": translations[i]}
        for i, s in enumerate(subtitles)
    ]
