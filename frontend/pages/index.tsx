/**
 * pages/index.tsx
 *
 * Trang chính của ứng dụng.
 *
 * Flow:
 *  1. Người dùng nhập URL → UrlInput
 *  2. Gọi API backend /api/analyze
 *  3. Nhận subtitles → render VideoPlayer + SubtitlePanel
 *  4. VideoPlayer poll currentTime → SubtitlePanel highlight + scroll
 *
 * Layout:
 *  - Header nhỏ ở trên
 *  - Input URL ở giữa khi chưa có video
 *  - Khi có video: 2 cột [VideoPlayer (sticky) | SubtitlePanel (scroll)]
 */

import React, { useState, useCallback, useRef } from 'react'
import Head from 'next/head'
import UrlInput from '../components/UrlInput'
import VideoPlayer from '../components/VideoPlayer'
import SubtitlePanel from '../components/SubtitlePanel'
import type { Subtitle, ProcessingStatus } from '../types/subtitle'

/** Lấy video ID từ URL YouTube */
function extractVideoId(url: string): string | null {
    const patterns = [
        /[?&]v=([\w-]{11})/,
        /youtu\.be\/([\w-]{11})/,
        /embed\/([\w-]{11})/,
    ]
    for (const p of patterns) {
        const m = url.match(p)
        if (m) return m[1]
    }
    return null
}

export default function HomePage() {
    // ===== STATE =====
    const [subtitles, setSubtitles] = useState<Subtitle[]>([])
    const [videoId, setVideoId] = useState<string | null>(null)
    const [currentTime, setCurrentTime] = useState(0)
    const [status, setStatus] = useState<ProcessingStatus>('idle')
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [progress, setProgress] = useState(0)   // 0-100

    // Ref tới VideoPlayer để gọi seekTo
    const playerSeekRef = useRef<((t: number) => void) | null>(null)

    /**
     * Gọi backend API để phân tích video.
     * Backend endpoint: POST /api/analyze
     * Body: { url: string }
     * Response: { subtitles: Subtitle[], video_id: string }
     */
    const handleAnalyze = useCallback(async (url: string) => {
        const id = extractVideoId(url)
        if (!id) {
            setErrorMessage('Không thể lấy video ID từ URL này.')
            return
        }

        // Reset state
        setStatus('loading')
        setErrorMessage(null)
        setSubtitles([])
        setCurrentTime(0)
        setProgress(10)

        try {
            // =======================
            // GỌI BACKEND API
            // =======================
            // Backend URL: lấy từ environment variable hoặc mặc định localhost:8000
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

            setProgress(20)

            const response = await fetch(`${backendUrl}/api/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            })

            setProgress(80)

            if (!response.ok) {
                const err = await response.json().catch(() => ({}))
                throw new Error(err.detail ?? `Lỗi server: ${response.status}`)
            }

            const data = await response.json()

            // Validate response
            if (!Array.isArray(data.subtitles) || data.subtitles.length === 0) {
                throw new Error('Backend không trả về subtitle. Hãy thử video khác.')
            }

            setProgress(100)
            setSubtitles(data.subtitles)
            setVideoId(id)
            setStatus('success')

        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Lỗi không xác định.'
            setErrorMessage(msg)
            setStatus('error')
            setProgress(0)
        }
    }, [])

    /** Seek video khi click subtitle */
    const handleSeek = useCallback((time: number) => {
        playerSeekRef.current?.(time)
    }, [])

    const isLoading = status === 'loading'
    const hasResult = status === 'success' && videoId && subtitles.length > 0

    return (
        <>
            <Head>
                <title>學中文 · Học Tiếng Trung Qua YouTube</title>
                <meta name="description" content="Học tiếng Trung qua video YouTube với Pinyin và dịch tiếng Việt tự động" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🈶</text></svg>" />
            </Head>

            {/* ===== MAIN LAYOUT ===== */}
            <div className="min-h-screen flex flex-col">

                {/* ===== HEADER ===== */}
                <header className="flex-shrink-0 border-b border-white/6">
                    <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">

                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <span className="text-2xl select-none" aria-hidden>🈶</span>
                            <div>
                                <h1 className="font-serif text-lg font-bold text-snow leading-none">學中文</h1>
                                <p className="text-[10px] text-ghost tracking-widest uppercase mt-0.5">
                                    Chinese · Pinyin · Việt
                                </p>
                            </div>
                        </div>

                        {/* URL Input (hiển thị ở header khi đã có video) */}
                        {hasResult && (
                            <div className="w-[480px] animate-fade-in">
                                <UrlInput onAnalyze={handleAnalyze} isLoading={isLoading} />
                            </div>
                        )}

                        {/* Badge công nghệ */}
                        <div className="hidden md:flex items-center gap-2">
                            {['Whisper AI', 'Pinyin', 'Dịch Việt'].map(tag => (
                                <span key={tag}
                                    className="text-[10px] font-medium tracking-wide px-2.5 py-1 rounded-full
                             border border-white/8 text-ghost bg-white/3">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </header>

                {/* ===== CONTENT ===== */}
                <main className="flex-1 flex flex-col">

                    {/* ===== HERO: Chưa có video ===== */}
                    {!hasResult && (
                        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">

                            {/* Decorative Chinese characters */}
                            <div className="relative mb-10 select-none" aria-hidden>
                                <div className="font-serif text-[7rem] font-bold leading-none
                               bg-gradient-to-b from-snow/20 to-snow/0
                               bg-clip-text text-transparent">
                                    學
                                </div>
                                <div className="absolute inset-0 font-serif text-[7rem] font-bold leading-none
                               text-amber-glow/5 blur-2xl">
                                    學
                                </div>
                            </div>

                            {/* Headline */}
                            <h2 className="font-serif text-3xl md:text-4xl text-snow text-center mb-3 leading-tight">
                                Học tiếng Trung qua YouTube
                            </h2>
                            <p className="text-mist text-center text-base mb-10 max-w-md">
                                Dán link video bất kỳ · AI tự động tạo subtitle với Pinyin và bản dịch tiếng Việt
                            </p>

                            {/* URL Input form */}
                            <div className="w-full max-w-xl">
                                <UrlInput onAnalyze={handleAnalyze} isLoading={isLoading} />
                            </div>

                            {/* Progress bar khi loading */}
                            {isLoading && (
                                <div className="w-full max-w-xl mt-6 animate-fade-in">
                                    <div className="h-1 bg-white/6 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-amber-glow to-amber-soft rounded-full transition-all duration-500"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-ghost text-center mt-3 animate-pulse">
                                        Đang tải audio · nhận dạng giọng nói · tạo Pinyin · dịch tiếng Việt...
                                    </p>
                                </div>
                            )}

                            {/* Error */}
                            {status === 'error' && errorMessage && (
                                <div className="w-full max-w-xl mt-5 animate-slide-up">
                                    <div className="glass rounded-xl px-4 py-3.5 flex items-start gap-3 border border-red-500/20">
                                        <svg className="text-red-400 flex-shrink-0 mt-0.5" width="16" height="16"
                                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="12" y1="8" x2="12" y2="12" />
                                            <line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        <div>
                                            <p className="text-red-400 text-sm font-medium">Có lỗi xảy ra</p>
                                            <p className="text-ghost text-xs mt-1">{errorMessage}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Feature pills */}
                            {status === 'idle' && (
                                <div className="mt-14 flex flex-wrap justify-center gap-3 animate-fade-in"
                                    style={{ animationDelay: '0.3s' }}>
                                    {[
                                        { icon: '🎙️', text: 'Whisper speech recognition' },
                                        { icon: '汉', text: 'Chữ Hán chuẩn xác' },
                                        { icon: '🔤', text: 'Pinyin tự động' },
                                        { icon: '🇻🇳', text: 'Dịch tiếng Việt' },
                                        { icon: '⚡', text: 'Sync real-time' },
                                    ].map(f => (
                                        <div key={f.text}
                                            className="flex items-center gap-2 px-3.5 py-2 glass rounded-full
                                    text-xs text-mist border-0">
                                            <span>{f.icon}</span>
                                            <span>{f.text}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===== MAIN VIEW: 2 cột khi có video ===== */}
                    {hasResult && (
                        <div className="flex-1 flex overflow-hidden animate-fade-in" style={{ height: `calc(100vh - 65px)` }}>

                            {/* ===== CỘT TRÁI: VIDEO (cố định, không cuộn) ===== */}
                            <div className="w-[52%] flex-shrink-0 flex flex-col overflow-hidden
                              border-r border-white/6 px-6 pt-6 pb-4">

                                {/* Video Player */}
                                <VideoPlayer
                                    videoId={videoId!}
                                    onTimeUpdate={setCurrentTime}
                                    onReady={() => { }}
                                />

                                {/* Stats dưới video */}
                                <div className="mt-4 grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Câu thoại', value: subtitles.length },
                                        {
                                            label: 'Thời lượng', value: (() => {
                                                const s = subtitles[subtitles.length - 1]?.end ?? 0
                                                return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
                                            })()
                                        },
                                        { label: 'Video ID', value: videoId!.slice(0, 8) + '…' },
                                    ].map(stat => (
                                        <div key={stat.label}
                                            className="glass rounded-xl px-3 py-2.5 text-center">
                                            <p className="text-base font-bold text-amber-glow font-mono">{stat.value}</p>
                                            <p className="text-[10px] text-ghost mt-0.5 tracking-wide">{stat.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* ===== CỘT PHẢI: SUBTITLE PANEL (cuộn độc lập) ===== */}
                            {/* <div className="flex-1 overflow-hidden px-5 pt-6 pb-0"> */}
                            <div className="flex-none h-[80vh] overflow-hidden px-5 pt-6 pb-0">
                                <SubtitlePanel
                                    subtitles={subtitles}
                                    currentTime={currentTime}
                                    onSeek={(time) => {
                                        // Seek video thông qua YouTube player
                                        // Dùng custom event để VideoPlayer nhận
                                        window.dispatchEvent(new CustomEvent('seek-video', { detail: { time } }))
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </main>

                {/* ===== FOOTER ===== */}
                <footer className="border-t border-white/6 py-3 flex-shrink-0">
                    <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between">
                        <p className="text-[11px] text-ghost/50">
                            Powered by Whisper · pypinyin · Google Translate
                        </p>
                        <p className="text-[11px] text-ghost/40 font-mono">
                            Next.js · TypeScript · TailwindCSS
                        </p>
                    </div>
                </footer>
            </div>
        </>
    )
}