/**
 * components/dictionary/WordPopup.tsx v2
 * Popup tra từ khi click vào chữ trong subtitle — hiển thị đa nghĩa
 */
import React, { useEffect, useRef, useState } from 'react'
import { dictionaryApi, type DictionaryEntry } from '../../lib/api'

interface Props {
    word: string
    onClose: () => void
    anchorRect?: DOMRect
}

export default function WordPopup({ word, onClose, anchorRect }: Props) {
    const [entry, setEntry] = useState<DictionaryEntry | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const popupRef = useRef<HTMLDivElement>(null)
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

    const style: React.CSSProperties = anchorRect
        ? {
            position: 'fixed',
            top: Math.min(anchorRect.bottom + 8, window.innerHeight - 360),
            left: Math.max(8, Math.min(anchorRect.left, window.innerWidth - 300)),
        }
        : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }

    useEffect(() => {
        dictionaryApi.lookup(word)
            .then(setEntry)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [word])

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose()
        }
        const id = setTimeout(() => document.addEventListener('mousedown', handler), 100)
        return () => { clearTimeout(id); document.removeEventListener('mousedown', handler) }
    }, [onClose])

    const playAudio = () => {
        if (!entry) return
        const url = entry.audio_url.startsWith('http') ? entry.audio_url : `${backendUrl}${entry.audio_url}`
        if (!audioRef.current) audioRef.current = new Audio(url)
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => { })
    }

    const meanings = entry?.meanings_vi?.length
        ? entry.meanings_vi
        : entry?.meaning_vi ? [entry.meaning_vi] : []

    return (
        <div
            ref={popupRef}
            className="z-50 w-72 glass rounded-2xl shadow-2xl border border-white/10 overflow-hidden animate-fade-in"
            style={style}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6">
                <span className="text-[10px] text-ghost uppercase tracking-wider">Từ điển</span>
                <button onClick={onClose} className="text-ghost hover:text-snow transition-colors p-0.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            <div className="p-4">
                {/* Loading */}
                {loading && (
                    <div className="space-y-2 animate-pulse">
                        <div className="skeleton h-8 w-20 rounded" />
                        <div className="skeleton h-3 w-14 rounded" />
                        <div className="skeleton h-3 w-full rounded" />
                        <div className="skeleton h-3 w-3/4 rounded" />
                    </div>
                )}

                {/* Error */}
                {error && <p className="text-red-400 text-sm">{error}</p>}

                {/* Result */}
                {entry && (
                    <div className="space-y-3">
                        {/* Word + pinyin + audio */}
                        <div className="flex items-start justify-between">
                            <div>
                                <span className="font-serif text-3xl text-snow">{entry.word}</span>
                                <p className="text-amber-glow font-mono text-sm mt-0.5">{entry.pinyin}</p>
                                <span className="text-[10px] bg-amber-glow/15 text-amber-glow px-2 py-0.5 rounded-full mt-1 inline-block">
                                    {entry.pos}
                                </span>
                            </div>
                            <button
                                onClick={playAudio}
                                className="p-2 rounded-lg bg-amber-glow/10 hover:bg-amber-glow/20 text-amber-glow transition-colors flex-shrink-0"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                </svg>
                            </button>
                        </div>

                        {/* ĐA NGHĨA */}
                        <div className="border-t border-white/6 pt-3">
                            <p className="text-[10px] text-ghost uppercase tracking-wider mb-2 flex items-center gap-1">
                                Nghĩa
                                {meanings.length > 1 && (
                                    <span className="bg-amber-glow/20 text-amber-glow text-[9px] px-1.5 rounded-full">
                                        {meanings.length}
                                    </span>
                                )}
                            </p>
                            <ol className="space-y-1">
                                {meanings.slice(0, 5).map((m, i) => (
                                    <li key={i} className="flex items-start gap-2 text-sm">
                                        <span className="flex-shrink-0 text-amber-glow/60 font-mono text-xs mt-0.5 w-3">{i + 1}.</span>
                                        <span className={i === 0 ? 'text-snow font-medium' : 'text-mist'}>{m}</span>
                                    </li>
                                ))}
                                {meanings.length > 5 && (
                                    <li className="text-ghost text-xs text-center pt-1">+{meanings.length - 5} nghĩa khác</li>
                                )}
                            </ol>
                        </div>

                        {/* Link xem đầy đủ */}
                        <button
                            onClick={() => window.open(`/dictionary?q=${encodeURIComponent(word)}`, '_blank')}
                            className="w-full text-xs text-ghost hover:text-amber-glow transition-colors text-center py-1.5
                         border-t border-white/5 flex items-center justify-center gap-1"
                        >
                            Xem đầy đủ
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}