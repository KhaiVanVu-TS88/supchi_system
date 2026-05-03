/**
 * components/dictionary/DictionaryCard.tsx
 *
 * Hiển thị kết quả từ điển CC-CEDICT: chữ Hán, pinyin, đa nghĩa, ví dụ, phát âm.
 */
import React, { useRef, useState } from 'react'
import type { DictionaryEntry } from '../../lib/api'

interface Props {
    entry: DictionaryEntry
    backendUrl?: string
}

export default function DictionaryCard({ entry, backendUrl = '' }: Props) {
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

            <div className="glass rounded-2xl p-5 sm:p-6 space-y-5 animate-slide-up">

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

                    <button
                        onClick={playAudio}
                        disabled={audioErr}
                        title={audioErr ? 'Audio không khả dụng' : 'Nghe phát âm'}
                        className={`flex-shrink-0 flex items-center justify-center rounded-xl
                          transition-all ${audioErr
                                ? 'opacity-30 cursor-not-allowed bg-gray-50'
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

                <div className="border-t border-gray-100 pt-4">
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

                {entry.grammar && (
                    <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                        <p className="text-[11px] text-ghost uppercase tracking-wider mb-1">Ghi chú</p>
                        <p className="text-mist text-sm">{entry.grammar}</p>
                    </div>
                )}

                {entry.example?.zh && entry.example.zh !== entry.word && (
                    <div className="border-t border-gray-100 pt-4">
                        <p className="text-[11px] text-ghost uppercase tracking-wider mb-2">Ví dụ</p>
                        <p className="font-serif text-snow text-lg leading-relaxed">{entry.example.zh}</p>
                        {entry.example.vi && (
                            <p className="text-mist text-sm mt-1 italic">{entry.example.vi}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
