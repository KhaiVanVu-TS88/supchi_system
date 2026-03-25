/**
 * components/dictionary/WordPopup.tsx
 * Mobile: bottom sheet toàn màn hình
 * Desktop: popup nhỏ gần từ được click
 */
import React, { useEffect, useRef, useState } from 'react'
import { dictionaryApi, type DictionaryEntry } from '../lib/api'

interface Props {
    word: string
    onClose: () => void
    anchorRect?: DOMRect
}

function useIsMobile() {
    const [mobile, setMobile] = useState(false)
    useEffect(() => {
        const check = () => setMobile(window.innerWidth < 640)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])
    return mobile
}

export default function WordPopup({ word, onClose, anchorRect }: Props) {
    const [entry, setEntry] = useState<DictionaryEntry | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const popupRef = useRef<HTMLDivElement>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const isMobile = useIsMobile()
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

    // Tính vị trí popup cho desktop
    const desktopStyle = (): React.CSSProperties => {
        if (!anchorRect) return { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }
        const spaceBelow = window.innerHeight - anchorRect.bottom
        const top = spaceBelow > 340 ? anchorRect.bottom + 8 : anchorRect.top - 340 - 8
        const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - 312))
        return { position: 'fixed', top, left }
    }

    useEffect(() => {
        dictionaryApi.lookup(word)
            .then(setEntry)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false))
    }, [word])

    // Đóng khi tap ngoài popup (chỉ desktop)
    useEffect(() => {
        if (isMobile) return
        const id = setTimeout(() => {
            const handler = (e: MouseEvent | TouchEvent) => {
                if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose()
            }
            document.addEventListener('mousedown', handler)
            document.addEventListener('touchstart', handler)
            return () => {
                document.removeEventListener('mousedown', handler)
                document.removeEventListener('touchstart', handler)
            }
        }, 100)
        return () => clearTimeout(id)
    }, [onClose, isMobile])

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

    // ── MOBILE: Bottom Sheet ──
    if (isMobile) {
        return (
            <>
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/60 z-50 animate-fade-in"
                    onClick={onClose}
                    aria-hidden
                />

                {/* Sheet trượt lên từ dưới */}
                <div
                    ref={popupRef}
                    className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/10
                     rounded-t-3xl pb-safe overflow-hidden
                     animate-slide-up"
                    style={{ maxHeight: '75vh' }}
                >
                    {/* Handle bar */}
                    <div className="flex justify-center pt-3 pb-1">
                        <div className="w-10 h-1 rounded-full bg-white/20" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-2 border-b border-white/6">
                        <span className="text-xs text-ghost uppercase tracking-wider">Từ điển</span>
                        <button
                            onClick={onClose}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center
                         text-ghost hover:text-snow active:text-snow transition-colors -mr-2"
                            aria-label="Đóng"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {/* Content — cuộn được */}
                    <div className="overflow-y-auto px-5 py-4" style={{ maxHeight: 'calc(75vh - 80px)' }}>
                        {loading && (
                            <div className="space-y-3 animate-pulse">
                                <div className="skeleton h-14 w-28 rounded" />
                                <div className="skeleton h-4 w-20 rounded" />
                                <div className="skeleton h-4 w-full rounded" />
                                <div className="skeleton h-4 w-3/4 rounded" />
                            </div>
                        )}
                        {error && <p className="text-red-400 text-sm">{error}</p>}
                        {entry && (
                            <div className="space-y-4">
                                {/* Chữ Hán + pinyin + audio */}
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-serif text-5xl text-snow leading-none">{entry.word}</p>
                                        <p className="text-amber-glow font-mono text-lg mt-2">{entry.pinyin}</p>
                                        <span className="text-xs bg-amber-glow/15 text-amber-glow px-2.5 py-1
                                     rounded-full mt-2 inline-block">{entry.pos}</span>
                                    </div>
                                    <button onClick={playAudio}
                                        className="w-12 h-12 rounded-xl bg-amber-glow/10 active:bg-amber-glow/20
                               text-amber-glow flex items-center justify-center flex-shrink-0">
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
                                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Nghĩa */}
                                <div className="border-t border-white/6 pt-4">
                                    <p className="text-[11px] text-ghost uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        Nghĩa tiếng Việt
                                        {meanings.length > 1 && (
                                            <span className="bg-amber-glow/20 text-amber-glow text-[10px] px-1.5 rounded-full">
                                                {meanings.length}
                                            </span>
                                        )}
                                    </p>
                                    <ol className="space-y-2.5">
                                        {meanings.map((m, i) => (
                                            <li key={i} className="flex items-start gap-3">
                                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-glow/15
                                         text-amber-glow text-[11px] font-bold flex items-center
                                         justify-center mt-0.5">{i + 1}</span>
                                                <span className={`text-base leading-relaxed ${i === 0 ? 'text-snow font-medium' : 'text-mist'}`}>
                                                    {m}
                                                </span>
                                            </li>
                                        ))}
                                    </ol>
                                </div>

                                {/* Ví dụ */}
                                {entry.example?.zh && entry.example.zh !== entry.word && (
                                    <div className="border-t border-white/6 pt-4">
                                        <p className="text-[11px] text-ghost uppercase tracking-wider mb-2">Ví dụ</p>
                                        <p className="font-serif text-snow text-xl leading-relaxed">{entry.example.zh}</p>
                                        {entry.example.vi && (
                                            <p className="text-mist text-sm mt-1 italic">{entry.example.vi}</p>
                                        )}
                                    </div>
                                )}

                                {/* Link trang từ điển đầy đủ */}
                                <button
                                    onClick={() => { window.open(`/dictionary?q=${encodeURIComponent(word)}`, '_blank'); onClose() }}
                                    className="w-full py-3 text-sm text-ghost active:text-amber-glow transition-colors
                             border-t border-white/5 flex items-center justify-center gap-1 mt-2">
                                    Xem đầy đủ
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </>
        )
    }

    // ── DESKTOP: Popup nhỏ ──
    return (
        <div
            ref={popupRef}
            className="z-50 w-72 glass rounded-2xl shadow-2xl border border-white/10
                 overflow-hidden animate-fade-in"
            style={desktopStyle()}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6">
                <span className="text-[10px] text-ghost uppercase tracking-wider">Từ điển</span>
                <button onClick={onClose}
                    className="text-ghost hover:text-snow transition-colors p-1.5 -mr-1"
                    aria-label="Đóng">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            <div className="p-4">
                {loading && (
                    <div className="space-y-2 animate-pulse">
                        <div className="skeleton h-8 w-20 rounded" />
                        <div className="skeleton h-3 w-14 rounded" />
                        <div className="skeleton h-3 w-full rounded" />
                        <div className="skeleton h-3 w-3/4 rounded" />
                    </div>
                )}
                {error && <p className="text-red-400 text-sm">{error}</p>}
                {entry && (
                    <div className="space-y-3">
                        <div className="flex items-start justify-between">
                            <div>
                                <span className="font-serif text-3xl text-snow">{entry.word}</span>
                                <p className="text-amber-glow font-mono text-sm mt-0.5">{entry.pinyin}</p>
                                <span className="text-[10px] bg-amber-glow/15 text-amber-glow px-2 py-0.5 rounded-full mt-1 inline-block">
                                    {entry.pos}
                                </span>
                            </div>
                            <button onClick={playAudio}
                                className="p-2 rounded-lg bg-amber-glow/10 hover:bg-amber-glow/20 text-amber-glow transition-colors flex-shrink-0">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                </svg>
                            </button>
                        </div>

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
                            </ol>
                        </div>

                        <button
                            onClick={() => { window.open(`/dictionary?q=${encodeURIComponent(word)}`, '_blank'); onClose() }}
                            className="w-full text-xs text-ghost hover:text-amber-glow transition-colors text-center
                         py-1.5 border-t border-white/5 flex items-center justify-center gap-1">
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