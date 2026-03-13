/**
 * pages/index.tsx — Trang chính (đã tích hợp Auth + Save to history)
 */
import React, { useState, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Navbar from '../components/layout/Navbar'
import UrlInput from '../components/UrlInput'
import VideoPlayer from '../components/VideoPlayer'
import SubtitlePanel from '../components/SubtitlePanel'
import { videosApi, type VideoDetail, type SubtitleItem } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import type { Subtitle } from '../types/subtitle'

function toSubtitle(s: SubtitleItem): Subtitle {
    return { start: s.start_time, end: s.end_time, chinese: s.chinese, pinyin: s.pinyin, vietnamese: s.vietnamese }
}

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function HomePage() {
    const { user } = useAuth()
    const [result, setResult] = useState<VideoDetail | null>(null)
    const [currentTime, setCurrentTime] = useState(0)
    const [status, setStatus] = useState<Status>('idle')
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [progress, setProgress] = useState(0)
    const [savedMsg, setSavedMsg] = useState(false)

    const handleAnalyze = useCallback(async (url: string) => {
        if (!user) { window.location.href = '/auth/login'; return }
        setStatus('loading'); setErrorMsg(null); setResult(null); setProgress(15); setSavedMsg(false)

        try {
            setProgress(30)
            // Gọi API — backend tự lưu vào DB vì user đã đăng nhập (JWT trong header)
            const data = await videosApi.analyze(url)
            setProgress(100)
            setResult(data)
            setStatus('success')
            setSavedMsg(true)
            setTimeout(() => setSavedMsg(false), 4000)
        } catch (e) {
            setErrorMsg(e instanceof Error ? e.message : 'Có lỗi xảy ra.')
            setStatus('error')
            setProgress(0)
        }
    }, [user])

    const subtitles: Subtitle[] = result?.subtitles.map(toSubtitle) ?? []
    const isLoading = status === 'loading'
    const hasResult = status === 'success' && result

    return (
        <>
            <Head>
                <title>學中文 · Học Tiếng Trung Qua YouTube</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            </Head>

            <div className="min-h-screen flex flex-col">
                <Navbar />

                <main className="flex-1 flex flex-col">

                    {/* ── HERO khi chưa có video ── */}
                    {!hasResult && (
                        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
                            <div className="relative mb-8 select-none" aria-hidden>
                                <div className="font-serif text-[7rem] font-bold leading-none bg-gradient-to-b from-snow/20 to-snow/0 bg-clip-text text-transparent">學</div>
                            </div>
                            <h2 className="font-serif text-3xl md:text-4xl text-snow text-center mb-3 leading-tight">
                                Học tiếng Trung qua YouTube
                            </h2>
                            <p className="text-mist text-center text-base mb-10 max-w-md">
                                AI tự động tạo subtitle Chữ Hán · Pinyin · Tiếng Việt
                            </p>

                            {/* Auth gate */}
                            {!user ? (
                                <div className="w-full max-w-xl glass rounded-2xl p-8 text-center">
                                    <div className="text-4xl mb-3">🔐</div>
                                    <p className="text-snow font-medium mb-1">Cần đăng nhập để sử dụng</p>
                                    <p className="text-ghost text-sm mb-6">Tạo tài khoản miễn phí để phân tích video và lưu lịch sử học.</p>
                                    <div className="flex gap-3 justify-center">
                                        <Link href="/auth/register" className="btn-primary px-6 py-2.5">Đăng ký miễn phí</Link>
                                        <Link href="/auth/login" className="text-sm text-ghost hover:text-snow transition-colors px-4 py-2.5">Đăng nhập</Link>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full max-w-xl space-y-4">
                                    <UrlInput onAnalyze={handleAnalyze} isLoading={isLoading} />

                                    {isLoading && (
                                        <div className="animate-fade-in">
                                            <div className="h-1 bg-white/6 rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-amber-glow to-amber-soft rounded-full transition-all duration-500"
                                                    style={{ width: `${progress}%` }} />
                                            </div>
                                            <p className="text-xs text-ghost text-center mt-3 animate-pulse">
                                                Đang tải audio · nhận dạng · tạo Pinyin · dịch · lưu lịch sử...
                                            </p>
                                        </div>
                                    )}

                                    {status === 'error' && errorMsg && (
                                        <div className="glass rounded-xl px-4 py-3.5 flex items-start gap-3 border border-red-500/20 animate-slide-up">
                                            <svg className="text-red-400 flex-shrink-0 mt-0.5" width="16" height="16"
                                                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                            <p className="text-red-400 text-sm">{errorMsg}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── MAIN VIEW 2 cột ── */}
                    {hasResult && result && (
                        <div className="flex-1 flex overflow-hidden animate-fade-in" style={{ height: 'calc(100vh - 57px)' }}>

                            {/* Input bar ở header — đã có trong Navbar khi hasResult */}

                            {/* Left: Video */}
                            <div className="w-[52%] flex-shrink-0 flex flex-col overflow-hidden border-r border-white/6 px-6 pt-5 pb-4">

                                {/* Saved toast */}
                                {savedMsg && (
                                    <div className="mb-3 flex items-center gap-2 bg-jade/10 border border-jade/25 rounded-xl px-3 py-2 text-jade text-xs animate-fade-in">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        Đã lưu vào lịch sử ·{' '}
                                        <Link href="/history" className="underline hover:no-underline">Xem lịch sử</Link>
                                    </div>
                                )}

                                {/* Input để phân tích video khác */}
                                <div className="mb-4">
                                    <UrlInput onAnalyze={handleAnalyze} isLoading={isLoading} />
                                </div>

                                <VideoPlayer videoId={result.video_id} onTimeUpdate={setCurrentTime} />

                                <div className="mt-4 grid grid-cols-3 gap-3">
                                    {[
                                        { label: 'Câu thoại', value: result.subtitle_count },
                                        { label: 'Đã lưu', value: '✓' },
                                        { label: 'Video ID', value: result.video_id.slice(0, 8) + '…' },
                                    ].map(s => (
                                        <div key={s.label} className="glass rounded-xl px-3 py-2.5 text-center">
                                            <p className="text-base font-bold text-amber-glow font-mono">{s.value}</p>
                                            <p className="text-[10px] text-ghost mt-0.5">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Subtitle panel */}
                            <div className="flex-1 h-[75vh] overflow-hidden px-5 pt-5 pb-0">
                                <SubtitlePanel
                                    subtitles={subtitles}
                                    currentTime={currentTime}
                                    onSeek={t => window.dispatchEvent(new CustomEvent('seek-video', { detail: { time: t } }))}
                                />
                            </div>
                        </div>
                    )}
                </main>

                {!hasResult && (
                    <footer className="border-t border-white/6 py-3 flex-shrink-0">
                        <div className="max-w-[1400px] mx-auto px-6 flex justify-between">
                            <p className="text-[11px] text-ghost/50">Powered by Whisper · pypinyin · Google Translate</p>
                            <p className="text-[11px] text-ghost/40 font-mono">Next.js · FastAPI · SQLite</p>
                        </div>
                    </footer>
                )}
            </div>
        </>
    )
}