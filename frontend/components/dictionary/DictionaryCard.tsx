/**
 * components/dictionary/DictionaryCard.tsx v3
 *
 * Hiển thị đầy đủ kết quả từ điển:
 * - Dữ liệu CC-CEDICT: chữ Hán, pinyin, đa nghĩa, ví dụ
 * - AI Analysis: bộ thủ, Hán Việt, cấu tạo chữ, mẹo ghi nhớ, lỗi thường gặp
 *
 * Props:
 * - entry: dữ liệu từ CC-CEDICT
 * - aiFull: dữ liệu AI phân tích sâu (optional)
 * - aiLoading: đang loading AI
 */
import React, { useRef, useState } from 'react'
import type { DictionaryEntry, DictionaryAiFull } from '../../lib/api'

interface Props {
    entry: DictionaryEntry
    aiFull?: DictionaryAiFull | null
    aiLoading?: boolean
    backendUrl?: string
}

export default function DictionaryCard({ entry, aiFull, aiLoading, backendUrl = '' }: Props) {
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const [playing, setPlaying] = useState(false)
    const [audioErr, setAudioErr] = useState(false)

    const fullAudioUrl = entry.audio_url.startsWith('http')
        ? entry.audio_url
        : `${backendUrl}${entry.audio_url}`

    const playAudio = () => {
        if (audioErr) return
        if (!audioRef.current) {
            audioRef.current = new Audio(fullAudioUrl)
            audioRef.current.onended = () => setPlaying(false)
            audioRef.current.onerror = () => { setAudioErr(true); setPlaying(false) }
        }
        if (playing) {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
            setPlaying(false)
        } else {
            setPlaying(true)
            audioRef.current.play().catch(() => setAudioErr(true))
        }
    }

    const meanings = entry.meanings_vi?.length > 0
        ? entry.meanings_vi
        : entry.meaning_vi ? [entry.meaning_vi] : []

    return (
        <div className="space-y-4">

            {/* ═══════════════════════════════════════════════════════════
                CARD 1: Dữ liệu CC-CEDICT — thông tin cơ bản
            ═══════════════════════════════════════════════════════════ */}
            <div className="glass rounded-2xl p-5 sm:p-6 space-y-5 animate-slide-up">

                {/* Header: Chữ Hán + Pinyin + Audio */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                        <div className="flex items-baseline gap-3 flex-wrap">
                            <span className="font-serif text-5xl text-snow leading-none tracking-wide">
                                {entry.word}
                            </span>
                            <span className="text-amber-glow font-mono text-xl">{entry.pinyin}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2.5">
                            <span className="text-xs bg-amber-glow/15 text-amber-glow px-2.5 py-0.5 rounded-full font-medium border border-amber-glow/20">
                                {entry.pos}
                            </span>
                            <span className="text-[10px] text-ghost">
                                CC-CEDICT · {meanings.length} nghĩa
                            </span>
                        </div>
                    </div>

                    {/* Nút phát âm */}
                    <button
                        onClick={playAudio}
                        disabled={audioErr}
                        title={audioErr ? 'Audio không khả dụng' : 'Nghe phát âm'}
                        className={`flex-shrink-0 flex items-center justify-center rounded-xl
                          transition-all ${audioErr
                                ? 'opacity-30 cursor-not-allowed bg-white/5'
                                : 'bg-amber-glow/10 hover:bg-amber-glow/20 text-amber-glow hover:scale-105 active:scale-95'
                            }`}
                        style={{ width: 52, height: 52 }}
                    >
                        {playing ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                            </svg>
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* ĐA NGHĨA TIẾNG VIỆT */}
                <div className="border-t border-white/6 pt-4">
                    <p className="text-[11px] text-ghost uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <span>Nghĩa tiếng Việt</span>
                        {meanings.length > 1 && (
                            <span className="bg-amber-glow/20 text-amber-glow text-[10px] px-1.5 py-0.5 rounded-full">
                                {meanings.length} nghĩa
                            </span>
                        )}
                    </p>

                    {meanings.length > 0 ? (
                        <ol className="space-y-1.5">
                            {meanings.map((m, i) => (
                                <li key={i} className="flex items-start gap-3">
                                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-glow/15 text-amber-glow
                                     text-[11px] font-bold flex items-center justify-center mt-0.5">
                                        {i + 1}
                                    </span>
                                    <span className={`text-base ${i === 0 ? 'text-snow font-medium' : 'text-mist'}`}>
                                        {m}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="text-ghost text-sm italic">Không tìm thấy nghĩa.</p>
                    )}
                </div>

                {/* Ghi chú ngữ pháp */}
                {entry.grammar && (
                    <div className="bg-white/3 rounded-xl px-4 py-3 border border-white/5">
                        <p className="text-[11px] text-ghost uppercase tracking-wider mb-1">Ghi chú</p>
                        <p className="text-mist text-sm">{entry.grammar}</p>
                    </div>
                )}

                {/* Ví dụ */}
                {entry.example?.zh && entry.example.zh !== entry.word && (
                    <div className="border-t border-white/6 pt-4">
                        <p className="text-[11px] text-ghost uppercase tracking-wider mb-2">Ví dụ</p>
                        <p className="font-serif text-snow text-lg leading-relaxed">{entry.example.zh}</p>
                        {entry.example.vi && (
                            <p className="text-mist text-sm mt-1 italic">{entry.example.vi}</p>
                        )}
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════
                CARD 2: AI Analysis — phân tích sâu
            ═══════════════════════════════════════════════════════════ */}

            {/* AI loading skeleton */}
            {aiLoading && (
                <div className="glass rounded-2xl p-5 sm:p-6 space-y-4 animate-pulse">
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-ghost uppercase tracking-wider">AI phân tích</span>
                        <span className="bg-amber-glow/20 text-amber-glow text-[9px] px-1.5 py-0.5 rounded-full">Claude</span>
                    </div>
                    {[1, 2, 3].map(i => (
                        <div key={i} className="space-y-2">
                            <div className="skeleton h-3 w-20 rounded" />
                            <div className="skeleton h-4 w-full rounded" />
                            <div className="skeleton h-4 w-3/4 rounded" />
                        </div>
                    ))}
                </div>
            )}

            {/* AI Analysis Result */}
            {aiFull && !aiLoading && (
                <div className="glass rounded-2xl p-5 sm:p-6 space-y-5 animate-slide-up">

                    {/* Header */}
                    <div className="flex items-center gap-2">
                        <span className="text-[11px] text-ghost uppercase tracking-wider">AI phân tích sâu</span>
                        <span className="bg-amber-glow/20 text-amber-glow text-[9px] px-1.5 py-0.5 rounded-full">Claude</span>
                    </div>

                    {/* ── Cấu tạo chữ + Bộ thủ ── */}
                    <div className="grid grid-cols-2 gap-3">
                        {/* Cấu tạo */}
                        <div className="bg-white/4 rounded-xl px-4 py-3">
                            <p className="text-[10px] text-ghost uppercase tracking-wider mb-1.5">Cấu tạo</p>
                            <p className="text-snow text-sm font-mono">{aiFull.decomposition}</p>
                        </div>
                        {/* Bộ thủ */}
                        <div className="bg-white/4 rounded-xl px-4 py-3">
                            <p className="text-[10px] text-ghost uppercase tracking-wider mb-1.5">Bộ thủ</p>
                            <div className="flex items-center gap-2">
                                <span className="font-serif text-2xl text-amber-glow">{aiFull.radical}</span>
                                <div>
                                    <p className="text-snow text-sm">{aiFull.radical_info.name}</p>
                                    <p className="text-ghost text-xs">{aiFull.radical_info.meaning}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Nghĩa Hán Việt gốc ── */}
                    {aiFull.meanings.han_viet_goc && (
                        <div className="bg-amber-glow/5 border border-amber-glow/10 rounded-xl px-4 py-3">
                            <p className="text-[10px] text-amber-glow/80 uppercase tracking-wider mb-1.5">
                                Nghĩa Hán Việt gốc
                            </p>
                            <p className="text-snow text-sm leading-relaxed">{aiFull.meanings.han_viet_goc}</p>
                        </div>
                    )}

                    {/* ── Phân tích từng chữ Hán ── */}
                    {aiFull.character_analysis.length > 0 && (
                        <div>
                            <p className="text-[11px] text-ghost uppercase tracking-wider mb-2.5">
                                Phân tích chữ Hán
                            </p>
                            <div className="space-y-3">
                                {aiFull.character_analysis.map((char, i) => (
                                    <div key={i} className="bg-white/4 rounded-xl px-4 py-3">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="font-serif text-3xl text-snow">{char.char}</span>
                                            <div>
                                                <p className="text-amber-glow font-mono text-sm">{char.pinyin}</p>
                                                <p className="text-ghost text-xs">{char.radical} · {char.strokes} nét</p>
                                            </div>
                                        </div>
                                        {char.meaning_origin && (
                                            <p className="text-mist text-sm leading-relaxed">
                                                {char.meaning_origin}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Mẹo ghi nhớ ── */}
                    {aiFull.memorization && (
                        <div>
                            <p className="text-[11px] text-ghost uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                <span>💡 Mẹo ghi nhớ</span>
                            </p>
                            <div className="space-y-3">
                                {aiFull.memorization.mnemonic && (
                                    <div className="flex items-start gap-2">
                                        <span className="text-amber-glow flex-shrink-0 mt-0.5">•</span>
                                        <p className="text-snow text-sm leading-relaxed">{aiFull.memorization.mnemonic}</p>
                                    </div>
                                )}
                                {aiFull.memorization.story && (
                                    <div className="flex items-start gap-2">
                                        <span className="text-amber-glow flex-shrink-0 mt-0.5">•</span>
                                        <p className="text-mist text-sm leading-relaxed italic">{aiFull.memorization.story}</p>
                                    </div>
                                )}
                                {aiFull.memorization.compare_vi && (
                                    <div className="flex items-start gap-2">
                                        <span className="text-amber-glow flex-shrink-0 mt-0.5">•</span>
                                        <p className="text-mist text-sm leading-relaxed">{aiFull.memorization.compare_vi}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Ví dụ ── */}
                    {aiFull.examples.length > 0 && (
                        <div>
                            <p className="text-[11px] text-ghost uppercase tracking-wider mb-2.5">Ví dụ thực tế</p>
                            <div className="space-y-2.5">
                                {aiFull.examples.map((ex, i) => (
                                    <div key={i} className="bg-white/4 rounded-xl px-4 py-3">
                                        <p className="font-serif text-snow text-lg leading-relaxed">{ex.zh}</p>
                                        <p className="text-amber-glow/80 font-mono text-xs mt-0.5">{ex.pinyin}</p>
                                        <p className="text-mist text-sm mt-1">{ex.vi}</p>
                                        {ex.context && (
                                            <p className="text-ghost text-xs mt-1 italic">↳ {ex.context}</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Ngữ pháp ── */}
                    {aiFull.grammar_pattern && (
                        <div className="bg-amber-glow/5 border border-amber-ghot/10 rounded-xl px-4 py-3">
                            <p className="text-[10px] text-amber-glow/80 uppercase tracking-wider mb-1.5">Cấu trúc ngữ pháp</p>
                            <p className="text-snow text-sm font-mono">{aiFull.grammar_pattern}</p>
                        </div>
                    )}

                    {/* ── Sử dụng: formal/informal ── */}
                    {(aiFull.usage.formal || aiFull.usage.informal || aiFull.usage.written || aiFull.usage.spoken) && (
                        <div>
                            <p className="text-[11px] text-ghost uppercase tracking-wider mb-2">Ngữ cảnh sử dụng</p>
                            <div className="grid grid-cols-2 gap-2">
                                {aiFull.usage.formal && (
                                    <div className="bg-white/4 rounded-lg px-3 py-2">
                                        <p className="text-[10px] text-ghost mb-1">📋 Trang trọng</p>
                                        <p className="text-mist text-xs">{aiFull.usage.formal}</p>
                                    </div>
                                )}
                                {aiFull.usage.informal && (
                                    <div className="bg-white/4 rounded-lg px-3 py-2">
                                        <p className="text-[10px] text-ghost mb-1">💬 Thân mật</p>
                                        <p className="text-mist text-xs">{aiFull.usage.informal}</p>
                                    </div>
                                )}
                                {aiFull.usage.written && (
                                    <div className="bg-white/4 rounded-lg px-3 py-2">
                                        <p className="text-[10px] text-ghost mb-1">📝 Văn viết</p>
                                        <p className="text-mist text-xs">{aiFull.usage.written}</p>
                                    </div>
                                )}
                                {aiFull.usage.spoken && (
                                    <div className="bg-white/4 rounded-lg px-3 py-2">
                                        <p className="text-[10px] text-ghost mb-1">🗣️ Thoại</p>
                                        <p className="text-mist text-xs">{aiFull.usage.spoken}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Từ liên quan ── */}
                    {(aiFull.related.same_radical?.length > 0 || aiFull.related.same_topic?.length > 0 || aiFull.related.opposite?.length > 0) && (
                        <div>
                            <p className="text-[11px] text-ghost uppercase tracking-wider mb-2">Từ liên quan</p>
                            <div className="space-y-2">
                                {aiFull.related.same_radical?.length > 0 && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] text-ghost flex-shrink-0">Cùng bộ thủ:</span>
                                        {aiFull.related.same_radical.map(w => (
                                            <a key={w} href={`/dictionary?q=${encodeURIComponent(w)}`}
                                                className="font-serif text-sm text-snow bg-white/8 px-2 py-1 rounded-lg
                                                   hover:bg-amber-glow/10 hover:text-amber-glow transition-colors">
                                                {w}
                                            </a>
                                        ))}
                                    </div>
                                )}
                                {aiFull.related.same_topic?.length > 0 && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] text-ghost flex-shrink-0">Cùng chủ đề:</span>
                                        {aiFull.related.same_topic.map(w => (
                                            <a key={w} href={`/dictionary?q=${encodeURIComponent(w)}`}
                                                className="font-serif text-sm text-snow bg-white/8 px-2 py-1 rounded-lg
                                                   hover:bg-amber-glow/10 hover:text-amber-glow transition-colors">
                                                {w}
                                            </a>
                                        ))}
                                    </div>
                                )}
                                {aiFull.related.opposite?.length > 0 && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-[10px] text-ghost flex-shrink-0">Trái nghĩa:</span>
                                        {aiFull.related.opposite.map(w => (
                                            <a key={w} href={`/dictionary?q=${encodeURIComponent(w)}`}
                                                className="font-serif text-sm text-snow bg-white/8 px-2 py-1 rounded-lg
                                                   hover:bg-amber-glow/10 hover:text-amber-glow transition-colors">
                                                {w}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── Lỗi thường gặp ── */}
                    {aiFull.mistakes.length > 0 && (
                        <div className="bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3">
                            <p className="text-[10px] text-red-400/80 uppercase tracking-wider mb-2">⚠️ Lỗi thường gặp</p>
                            <ul className="space-y-1.5">
                                {aiFull.mistakes.map((m, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm text-mist">
                                        <span className="text-red-400/60 flex-shrink-0">•</span>
                                        {m}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* ── Tips ── */}
                    {aiFull.tips && (
                        <div className="bg-green-500/5 border border-green-500/10 rounded-xl px-4 py-3">
                            <p className="text-[10px] text-green-400/80 uppercase tracking-wider mb-2">💡 Tips</p>
                            <p className="text-mist text-sm leading-relaxed">{aiFull.tips}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
