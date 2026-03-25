import React, { useState, useCallback, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Navbar from '../components/layout/Navbar'
import UrlInput from '../components/UrlInput'
import VideoPlayer from '../components/VideoPlayer'
import SubtitlePanel from '../components/SubtitlePanel'
import JobStatusBar from '../components/JobStatusBar'
import { videosApi, type VideoDetail, type SubtitleItem } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import type { Subtitle } from '../types/subtitle'

function toSubtitle(s: SubtitleItem): Subtitle {
    return {
        start: s.start_time, end: s.end_time,
        chinese: s.chinese, pinyin: s.pinyin, vietnamese: s.vietnamese,
    }
}

type Stage = 'idle' | 'queued' | 'transitioning' | 'result' | 'error'

export default function HomePage() {
    const { user } = useAuth()
    const [stage, setStage] = useState<Stage>('idle')
    const [jobId, setJobId] = useState<number | null>(null)
    const [result, setResult] = useState<VideoDetail | null>(null)
    const [currentTime, setCurrentTime] = useState(0)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const subtitleRef = useRef<HTMLDivElement>(null)

    const handleAnalyze = useCallback(async (url: string) => {
        if (!user) { window.location.href = '/auth/login'; return }
        setStage('queued'); setErrorMsg(null); setResult(null); setJobId(null)
        try {
            const { job_id } = await videosApi.analyze(url)
            setJobId(job_id)
        } catch (e) {
            setErrorMsg(e instanceof Error ? e.message : 'Có lỗi xảy ra.')
            setStage('error')
        }
    }, [user])

    const handleJobDone = useCallback(async (videoId: number) => {
        setStage('transitioning')
        try {
            const video = await videosApi.get(videoId)
            await new Promise(r => setTimeout(r, 1200))
            setResult(video); setStage('result')
            setTimeout(() => subtitleRef.current?.scrollTo({ top: 0 }), 100)
        } catch {
            setErrorMsg('Không thể tải kết quả. Vào Lịch sử để xem.')
            setStage('error')
        }
    }, [])

    const handleJobFailed = useCallback((error: string) => {
        setErrorMsg(error); setStage('error')
    }, [])

    const subtitles: Subtitle[] = result?.subtitles.map(toSubtitle) ?? []
    const hasResult = stage === 'result' && result

    return (
        <>
            <Head>
                <title>學中文 · Học Tiếng Trung Qua YouTube</title>
                <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
            </Head>

            {/* ══════════════════════════════════════════════
          IDLE / QUEUED / TRANSITIONING / ERROR
      ══════════════════════════════════════════════ */}
            {!hasResult && (
                <div className="min-h-screen flex flex-col">
                    <Navbar />
                    <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8">

                        {stage === 'idle' && (
                            <div className="w-full max-w-xl flex flex-col items-center animate-fade-in">
                                <div className="font-serif text-[5rem] sm:text-[8rem] font-bold leading-none
                                bg-gradient-to-b from-snow/20 to-snow/0 bg-clip-text
                                text-transparent select-none mb-3 sm:mb-5" aria-hidden>
                                    學
                                </div>
                                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-snow text-center mb-2">
                                    Học tiếng Trung qua YouTube
                                </h1>
                                <p className="text-mist text-center text-sm sm:text-base mb-8 max-w-xs sm:max-w-md">
                                    AI tự động tạo subtitle · Chữ Hán · Pinyin · Tiếng Việt
                                </p>
                                <div className="flex flex-wrap justify-center gap-2 mb-8">
                                    {['🎬 Video YouTube', '📖 Từ điển', '🔍 OCR ảnh', '✍️ Viết tay'].map(f => (
                                        <span key={f} className="text-xs px-3 py-1.5 glass rounded-full
                                             text-ghost border border-white/6">{f}</span>
                                    ))}
                                </div>
                                {!user ? (
                                    <div className="w-full glass rounded-2xl p-6 sm:p-8 text-center border border-white/8">
                                        <div className="text-4xl mb-3">🔐</div>
                                        <p className="text-snow font-semibold mb-1.5">Cần đăng nhập để sử dụng</p>
                                        <p className="text-ghost text-sm mb-6">
                                            Tạo tài khoản miễn phí để phân tích và lưu lịch sử học.
                                        </p>
                                        <div className="flex gap-3 justify-center">
                                            <Link href="/auth/register" className="btn-primary px-5 py-2.5 text-sm">
                                                Đăng ký miễn phí
                                            </Link>
                                            <Link href="/auth/login"
                                                className="text-sm text-ghost hover:text-snow px-4 py-2.5
                                   min-h-[48px] flex items-center transition-colors">
                                                Đăng nhập
                                            </Link>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-full">
                                        <UrlInput onAnalyze={handleAnalyze} isLoading={false} />
                                    </div>
                                )}
                            </div>
                        )}

                        {stage === 'queued' && jobId && (
                            <div className="w-full max-w-md animate-slide-up">
                                <div className="flex items-center justify-center gap-2 mb-6">
                                    <div className="w-8 h-8 rounded-full bg-amber-glow/15 border border-amber-glow/30
                                  flex items-center justify-center">
                                        <svg className="text-amber-glow animate-spin" width="14" height="14"
                                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                                        </svg>
                                    </div>
                                    <span className="text-snow font-medium text-sm">Đang xử lý video</span>
                                </div>
                                <JobStatusBar jobId={jobId} onDone={handleJobDone} onFailed={handleJobFailed} />
                                <p className="text-center text-xs text-ghost mt-4">
                                    Thường mất 2–10 phút tuỳ độ dài video ·{' '}
                                    <Link href="/history" className="text-amber-glow hover:underline">Xem lịch sử</Link>
                                </p>
                            </div>
                        )}

                        {stage === 'transitioning' && (
                            <div className="flex flex-col items-center gap-5 animate-fade-in">
                                <div className="relative">
                                    <div className="absolute inset-0 rounded-full bg-jade/20 animate-ping scale-150" />
                                    <div className="w-20 h-20 rounded-full bg-jade/15 border-2 border-jade/50
                                  flex items-center justify-center relative">
                                        <svg className="text-jade" width="36" height="36" viewBox="0 0 24 24"
                                            fill="none" stroke="currentColor" strokeWidth="2.5"
                                            strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"
                                                style={{
                                                    strokeDasharray: 30, strokeDashoffset: 0,
                                                    animation: 'draw-check 0.4s ease-out 0.2s both'
                                                }} />
                                        </svg>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <p className="text-xl font-semibold text-snow mb-1">Hoàn thành!</p>
                                    <p className="text-ghost text-sm">Đang mở video học...</p>
                                </div>
                                <div className="flex gap-1.5">
                                    {[0, 150, 300].map(delay => (
                                        <div key={delay} className="w-1.5 h-1.5 rounded-full bg-amber-glow/60"
                                            style={{ animation: `bounce-dot 0.8s ease-in-out ${delay}ms infinite` }} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {stage === 'error' && (
                            <div className="w-full max-w-md animate-slide-up">
                                <div className="glass rounded-2xl p-6 border border-red-500/20 text-center mb-4">
                                    <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/25
                                  flex items-center justify-center mx-auto mb-4">
                                        <svg className="text-red-400" width="24" height="24" viewBox="0 0 24 24"
                                            fill="none" stroke="currentColor" strokeWidth="2">
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="12" y1="8" x2="12" y2="12" />
                                            <line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                    </div>
                                    <p className="text-red-400 font-medium mb-1">Xử lý thất bại</p>
                                    <p className="text-ghost text-sm">{errorMsg}</p>
                                </div>
                                <button onClick={() => setStage('idle')} className="btn-primary w-full">
                                    Thử lại
                                </button>
                            </div>
                        )}
                    </main>
                </div>
            )}

            {/* ══════════════════════════════════════════════════════
          RESULT — layout responsive tự động

          NGUYÊN TẮC (giống Bootstrap):
          - Mặc định: flex-col  → tất cả xếp DỌC (mobile first)
          - lg (1024px+): flex-row → 2 cột NGANG

          Không cần JS, không cần media query CSS riêng,
          chỉ cần Tailwind breakpoint prefix: lg:flex-row
      ══════════════════════════════════════════════════════ */}
            {hasResult && result && (
                <div
                    className="flex flex-col"
                    style={{ height: '100dvh', overflow: 'hidden' }}
                >
                    {/* 1. NAVBAR — luôn ở trên cùng */}
                    <Navbar />

                    {/*
           * 2+3. CONTENT WRAPPER
           *
           * KEY: flex-col (mobile) → tự chuyển sang flex-row (desktop)
           * Đây là cơ chế hoạt động giống Bootstrap .row:
           *
           * Mobile (<lg):   flex-col → Video trên, Subtitle dưới
           *                 [Navbar ]
           *                 [Video  ]  ← flex-shrink-0
           *                 [Subtitle] ← flex-1, scroll
           *
           * Desktop (lg+):  flex-row → 2 cột ngang
           *                 [Navbar              ]
           *                 [Video 52% | Sub 48% ]
           */}
                    <div
                        className="flex-1 flex flex-col lg:flex-row overflow-hidden"
                    >

                        {/* ── 2. VIDEO ──
             * flex-shrink-0:  KHÔNG bao giờ bị nén → video luôn hiển thị đầy đủ
             * w-full:         Full width trên mobile
             * lg:w-[52%]:     52% trên desktop
             * KHÔNG có overflow-hidden ở đây → tránh phá layout con bên trong
             */}
                        <div className="flex-shrink-0 w-full lg:w-[52%]
                            flex flex-col
                            border-b border-white/6 lg:border-b-0 lg:border-r">

                            <VideoPlayer
                                videoId={result.video_id}
                                onTimeUpdate={setCurrentTime}
                                compact
                            />

                            {/* Toolbar mini — chỉ mobile */}
                            <div className="lg:hidden flex items-center gap-2 px-3 py-2
                              bg-ink-900 border-b border-white/6">
                                <span className="flex items-center gap-1.5 text-xs text-ghost">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    <span className="text-amber-glow font-bold font-mono">{result.subtitle_count}</span> câu
                                </span>
                                <div className="flex-1" />
                                <button
                                    onClick={() => { setResult(null); setStage('idle') }}
                                    className="text-[11px] text-ghost active:text-amber-glow flex items-center
                             gap-1 px-2.5 py-1.5 glass rounded-lg border border-white/8">
                                    + Video khác
                                </button>
                                <Link href="/history"
                                    className="text-[11px] text-ghost active:text-jade flex items-center
                             gap-1 px-2.5 py-1.5 glass rounded-lg border border-white/8">
                                    Lịch sử
                                </Link>
                            </div>

                            {/* Controls — chỉ desktop */}
                            <div className="hidden lg:flex flex-col gap-3 px-6 py-4 overflow-y-auto flex-1">
                                <div className="flex items-center gap-2 text-jade text-xs bg-jade/10
                                border border-jade/25 rounded-xl px-3 py-2">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Đã lưu ·{' '}
                                    <Link href="/history" className="underline hover:no-underline">Xem lịch sử</Link>
                                </div>
                                <UrlInput onAnalyze={handleAnalyze} isLoading={false} />
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: 'Câu thoại', value: String(result.subtitle_count) },
                                        { label: 'Trạng thái', value: '✓ Lưu' },
                                        { label: 'Video ID', value: result.video_id.slice(0, 7) + '…' },
                                    ].map(s => (
                                        <div key={s.label} className="glass rounded-xl px-2 py-2.5 text-center">
                                            <p className="text-sm font-bold text-amber-glow font-mono">{s.value}</p>
                                            <p className="text-[10px] text-ghost mt-0.5">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ── 3. SUBTITLE ──
             * flex-1:         chiếm toàn bộ không gian còn lại
             * overflow-y-auto: CHỈ vùng này cuộn dọc
             */}
                        <div
                            ref={subtitleRef}
                            className="flex-1 overflow-y-auto
                         [-webkit-overflow-scrolling:touch]
                         overscroll-contain
                         px-3 sm:px-4 lg:px-5
                         pt-3 pb-6"
                        >
                            <SubtitlePanel
                                subtitles={subtitles}
                                currentTime={currentTime}
                                onSeek={t => window.dispatchEvent(
                                    new CustomEvent('seek-video', { detail: { time: t } })
                                )}
                            />
                        </div>

                    </div>
                </div>
            )}
        </>
    )
}