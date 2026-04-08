/**
 * components/dictionary/WordPopup.tsx v4
 *
 * Popup giải nghĩa nhanh — dùng khi click từ trong subtitle video.
 *
 * Chỉ dùng CC-CEDICT (không gọi AI để tránh lỗi khi không có API key).
 * AI analysis là tính năng nâng cao — chỉ dùng ở trang Dictionary.
 */
import React, { useEffect, useRef, useState } from 'react'
import { dictionaryApi, type DictionaryEntry } from '../../lib/api'

interface Props {
    word: string
    onClose: () => void
    anchorRect?: DOMRect
}

export default function WordPopup({ word, onClose, anchorRect }: Props) {
    const [dictEntry, setDictEntry] = useState<DictionaryEntry | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const popupRef = useRef<HTMLDivElement>(null)
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

    // ── Position: LUÔN ở giữa màn hình ──────────────────────────────────

    const style: React.CSSProperties = {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
    }

    // ── Fetch dictionary data ────────────────────────────────────────────────

    useEffect(() => {
        let cancelled = false
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        // Safety timeout: nếu API không trả lời sau 5s → hiển thị fallback
        timeoutId = setTimeout(() => {
            if (!cancelled && loading) {
                setLoading(false)
                if (!dictEntry) {
                    setError('Không tải được dữ liệu từ điển.')
                }
            }
        }, 5000)

        async function fetchEntry() {
            try {
                const entry = await dictionaryApi.lookup(word)
                if (cancelled) return
                setDictEntry(entry)
            } catch (e) {
                if (!cancelled) {
                    setError(e instanceof Error ? e.message : 'Không tìm thấy từ này.')
                }
            } finally {
                if (!cancelled) setLoading(false)
                if (timeoutId) clearTimeout(timeoutId)
            }
        }

        fetchEntry()
        return () => {
            cancelled = true
            if (timeoutId) clearTimeout(timeoutId)
        }
    }, [word])

    // ── Close on outside click ───────────────────────────────────────────────

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        // Delay để tránh đóng ngay khi vừa mở
        const id = setTimeout(() => document.addEventListener('mousedown', handler), 150)
        return () => {
            clearTimeout(id)
            document.removeEventListener('mousedown', handler)
        }
    }, [onClose])

    // ── Audio ─────────────────────────────────────────────────────────────────

    const playAudio = () => {
        if (!dictEntry) return
        const url = dictEntry.audio_url.startsWith('http')
            ? dictEntry.audio_url
            : `${backendUrl}${dictEntry.audio_url}`
        if (!audioRef.current) audioRef.current = new Audio(url)
        audioRef.current.currentTime = 0
        audioRef.current.play().catch(() => { })
    }

    // ── Derived state ─────────────────────────────────────────────────────────

    const meanings = dictEntry?.meanings_vi?.length
        ? dictEntry.meanings_vi
        : dictEntry?.meaning_vi ? [dictEntry.meaning_vi] : []

    const showFallback = !loading && !dictEntry

    return (
        <div
            ref={popupRef}
            className="z-[9999] w-80 rounded-2xl shadow-2xl border border-white/15 overflow-hidden animate-fade-in"
            style={{
                ...style,
                background: 'rgba(15, 15, 20, 0.95)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8">
                <span className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">
                    Tra nhanh
                </span>
                <button
                    onClick={onClose}
                    className="text-gray-500 hover:text-white transition-colors p-0.5 rounded"
                    aria-label="Đóng"
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            </div>

            <div className="p-4 space-y-3">

                {/* Loading skeleton */}
                {loading && (
                    <div className="space-y-3 animate-pulse">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-2">
                                <div className="h-10 w-16 bg-white/10 rounded-lg" />
                                <div className="h-4 w-24 bg-white/10 rounded" />
                                <div className="h-5 w-14 bg-white/10 rounded-full" />
                            </div>
                            <div className="w-11 h-11 bg-white/10 rounded-xl flex-shrink-0" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="h-4 w-full bg-white/8 rounded" />
                            <div className="h-4 w-3/4 bg-white/8 rounded" />
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && !loading && (
                    <div className="text-center py-4">
                        <p className="text-red-400 text-sm mb-3">{error}</p>
                        <button
                            onClick={() => window.open(`/dictionary?q=${encodeURIComponent(word)}`, '_blank')}
                            className="text-xs text-amber-400 hover:text-amber-300 underline"
                        >
                            Mở trong từ điển
                        </button>
                    </div>
                )}

                {/* Fallback khi không có entry */}
                {showFallback && !error && (
                    <div className="text-center py-4">
                        <p className="font-serif text-2xl text-white mb-1">{word}</p>
                        <p className="text-gray-500 text-xs mb-3">Không có trong từ điển</p>
                        <button
                            onClick={() => window.open(`/dictionary?q=${encodeURIComponent(word)}`, '_blank')}
                            className="text-xs text-amber-400 hover:text-amber-300 underline"
                        >
                            Mở trong từ điển
                        </button>
                    </div>
                )}

                {/* ── Main content: dict entry ── */}
                {dictEntry && !loading && (
                    <div className="space-y-3">

                        {/* Word + Pinyin + Audio */}
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <span className="font-serif text-3xl text-white leading-none">{dictEntry.word}</span>
                                <p className="text-amber-400 font-mono text-sm mt-1">{dictEntry.pinyin}</p>
                                <span className="text-[10px] bg-amber-400/15 text-amber-400 px-2 py-0.5 rounded-full mt-1 inline-block font-medium">
                                    {dictEntry.pos}
                                </span>
                            </div>
                            <button
                                onClick={playAudio}
                                className="p-2 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-400 transition-colors flex-shrink-0"
                                title="Phát âm"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                </svg>
                            </button>
                        </div>

                        {/* ĐA NGHĨA */}
                        {meanings.length > 0 && (
                            <div className="border-t border-white/8 pt-2.5">
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    Nghĩa
                                    {meanings.length > 1 && (
                                        <span className="bg-amber-400/20 text-amber-400 text-[9px] px-1.5 rounded-full">
                                            {meanings.length}
                                        </span>
                                    )}
                                </p>
                                <ol className="space-y-1.5">
                                    {meanings.slice(0, 5).map((m, i) => (
                                        <li key={i} className="flex items-start gap-2 text-sm">
                                            <span className="flex-shrink-0 text-amber-400/50 font-mono text-xs mt-0.5 w-3">{i + 1}.</span>
                                            <span className={i === 0 ? 'text-white font-medium' : 'text-gray-300'}>{m}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {/* Câu ví dụ */}
                        {dictEntry.example?.zh && dictEntry.example.vi && (
                            <div className="bg-amber-400/5 border border-amber-400/10 rounded-xl px-3 py-2.5">
                                <p className="text-[10px] text-amber-400/80 uppercase tracking-wider mb-1.5">Ví dụ</p>
                                <p className="font-serif text-base text-white leading-relaxed">{dictEntry.example.zh}</p>
                                <p className="text-gray-400 text-xs mt-0.5 leading-relaxed">{dictEntry.example.vi}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Link to full dictionary ── */}
                {dictEntry && !loading && (
                    <button
                        onClick={() => window.open(`/dictionary?q=${encodeURIComponent(word)}`, '_blank')}
                        className="w-full text-xs text-gray-500 hover:text-amber-400 transition-colors py-2
                         border-t border-white/5 flex items-center justify-center gap-1.5"
                    >
                        Xem chi tiết trong từ điển
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </button>
                )}
            </div>
        </div>
    )
}
