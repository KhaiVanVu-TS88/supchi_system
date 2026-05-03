import React, { useState, useCallback, useRef } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import Navbar from '../components/layout/Navbar'
import { MobileBottomTabBar } from '../components/layout/mainNavTabs'
import UrlInput from '../components/UrlInput'
import VideoPlayer from '../components/VideoPlayer'
import SubtitlePanel from '../components/SubtitlePanel'
import JobStatusBar from '../components/JobStatusBar'
import { videosApi, type AnalyzeJobResponse, type VideoDetail, type SubtitleItem } from '../lib/api'
import { useAuth } from '../lib/auth-context'
import type { Subtitle } from '../types/subtitle'

function toSubtitle(s: SubtitleItem): Subtitle {
    return {
        start: s.start_time, end: s.end_time,
        chinese: s.chinese, pinyin: s.pinyin, vietnamese: s.vietnamese,
    }
}

type Stage = 'idle' | 'checking' | 'queued' | 'transitioning' | 'result' | 'error'

export default function HomePage() {
    const { user } = useAuth()
    const [stage, setStage] = useState<Stage>('idle')
    const [jobId, setJobId] = useState<number | null>(null)
    const [result, setResult] = useState<VideoDetail | null>(null)
    const [currentTime, setCurrentTime] = useState(0)
    const [isPaused, setIsPaused] = useState(false)
    const [errorMsg, setErrorMsg] = useState<string | null>(null)
    const [evictedVideos, setEvictedVideos] = useState<string[]>([])
    const [longVideoPrompt, setLongVideoPrompt] = useState<{ url: string; payload: AnalyzeJobResponse } | null>(null)
    const subtitleRef = useRef<HTMLDivElement>(null)

    const handleAnalyze = useCallback(async (url: string, confirmLongVideo = false) => {
        if (!user) { window.location.href = '/auth/login'; return }
        setErrorMsg(null)
        if (!confirmLongVideo) {
            setLongVideoPrompt(null)
            setResult(null)
            setJobId(null)
        }
        setStage('checking')
        try {
            const response = await videosApi.analyze(url, undefined, confirmLongVideo)

            if (response.source === 'confirmation_required') {
                setStage('idle')
                setLongVideoPrompt({ url, payload: response })
                return
            }

            if (response.evicted_videos && response.evicted_videos.length > 0) {
                setEvictedVideos(response.evicted_videos)
            }

            if (response.source === 'cached' && response.video_id) {
                setStage('transitioning')
                try {
                    const video = await videosApi.get(response.video_id)
                    videosApi.markViewed(response.video_id).catch(() => {})
                    await new Promise(r => setTimeout(r, 800))
                    setResult(video); setStage('result')
                    setTimeout(() => subtitleRef.current?.scrollTo({ top: 0 }), 100)
                } catch {
                    setErrorMsg('Không tải được video. Vào Lịch sử để xem.')
                    setStage('error')
                }
                return
            }

            if (response.source === 'processing' && response.job_id) {
                setJobId(response.job_id)
                setStage('queued')
                return
            }

            if (response.job_id) {
                setJobId(response.job_id)
                setStage('queued')
            } else {
                throw new Error('Không nhận được job ID.')
            }
        } catch (e) {
            setErrorMsg(e instanceof Error ? e.message : 'Có lỗi xảy ra.')
            setStage('error')
        }
    }, [user])

    const handleJobDone = useCallback(async (videoId: number) => {
        setStage('transitioning')
        try {
            const video = await videosApi.get(videoId)
            // Cập nhật last_viewed_at (FIFO)
            videosApi.markViewed(videoId).catch(() => {})
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

            {/* ── IDLE / QUEUED / TRANSITIONING / ERROR ── */}
            {!hasResult && (
                <div className="min-h-screen flex flex-col pb-bottom-nav md:pb-0">
                    <Navbar />
                    <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-8">

                        {(stage === 'idle' || stage === 'checking') && (
                            <div className="w-full max-w-xl flex flex-col items-center animate-fade-in">
                                <div className="font-serif text-[5rem] sm:text-[8rem] font-bold leading-none
                                bg-gradient-to-b from-amber-glow/35 via-amber-glow/15 to-transparent bg-clip-text
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
                                    {['🎬 Video YouTube', '📖 Từ điển'].map(f => (
                                        <span key={f} className="text-xs px-3 py-1.5 glass rounded-full
                                             text-ghost border border-gray-100">{f}</span>
                                    ))}
                                </div>
                                {!user ? (
                                    <div className="w-full glass rounded-2xl p-6 sm:p-8 text-center border border-gray-100">
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
                                        <UrlInput onAnalyze={u => { handleAnalyze(u) }} isLoading={stage === 'checking'} />
                                    </div>
                                )}
                            </div>
                        )}

                        {longVideoPrompt && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                                <div
                                    role="dialog"
                                    aria-modal="true"
                                    aria-labelledby="long-video-title"
                                    className="w-full max-w-md glass rounded-2xl border border-amber-glow/25 p-5 sm:p-6 shadow-2xl"
                                >
                                    <h2 id="long-video-title" className="text-snow font-semibold text-lg mb-2">
                                        Video khá dài
                                    </h2>
                                    <p className="text-mist text-sm leading-relaxed mb-3">
                                        {longVideoPrompt.payload.message}
                                    </p>
                                    <ul className="text-xs text-ghost space-y-1.5 mb-5 border border-gray-100 rounded-xl px-3 py-2.5 bg-gray-50">
                                        <li>
                                            Độ dài ước lượng:{' '}
                                            <span className="text-amber-glow font-mono">
                                                {longVideoPrompt.payload.duration_minutes != null
                                                    ? `${longVideoPrompt.payload.duration_minutes} phút`
                                                    : '—'}
                                            </span>
                                        </li>
                                        <li>
                                            Ngưỡng cảnh báo:{' '}
                                            <span className="text-snow">{longVideoPrompt.payload.threshold_minutes ?? '—'} phút</span>
                                        </li>
                                        <li>
                                            Cách xử lý dự kiến:{' '}
                                            {longVideoPrompt.payload.subtitle_route === 'manual'
                                                ? 'Phụ đề có sẵn (YouTube)'
                                                : 'Nhận dạng giọng Whisper (lâu hơn)'}
                                        </li>
                                    </ul>
                                    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                                        <button
                                            type="button"
                                            className="px-4 py-2.5 rounded-xl text-sm text-mist hover:text-snow hover:bg-gray-100 transition-colors min-h-[44px]"
                                            onClick={() => setLongVideoPrompt(null)}
                                        >
                                            Chọn video khác
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-primary px-4 py-2.5 text-sm min-h-[44px]"
                                            onClick={() => {
                                                const u = longVideoPrompt.url
                                                setLongVideoPrompt(null)
                                                handleAnalyze(u, true)
                                            }}
                                        >
                                            Tiếp tục chờ xử lý
                                        </button>
                                    </div>
                                </div>
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
                    <MobileBottomTabBar />
                </div>
            )}

            {/* ── RESULT — FULL SCREEN LAYOUT ── */}
            {hasResult && result && (
                <div
                    className="flex min-h-0 flex-col overflow-hidden"
                    style={{ height: '100dvh' }}
                >
                    {/* NAVBAR */}
                    <Navbar />

                    {/* FIFO eviction notification */}
                    {evictedVideos.length > 0 && (
                        <div className="mx-3 mt-2 px-4 py-2.5 rounded-xl
                            bg-amber-glow/10 border border-amber-glow/25
                            flex items-start gap-2.5 animate-slide-up">
                            <span className="text-amber-glow text-sm mt-0.5">🗑️</span>
                            <div>
                                <p className="text-sm text-snow font-medium">
                                    Đã tự động xóa {evictedVideos.length} video cũ
                                </p>
                                <p className="text-xs text-ghost mt-0.5">
                                    {evictedVideos.join(', ')}
                                </p>
                            </div>
                            <button
                                onClick={() => setEvictedVideos([])}
                                className="ml-auto text-ghost hover:text-snow text-lg leading-none">×</button>
                        </div>
                    )}

                    {/* MAIN CONTENT — .app-split-video-sub: cột dọc dưới 1280px; 2 cột từ xl */}
                    <div className="app-split-video-sub flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">

                        {/* Cột trái / phía trên: video + điều khiển */}
                        <div
                            className="flex w-full max-w-full shrink-0 flex-col border-b-2 border-gray-100
                                       xl:w-[52%] xl:max-w-[52%] xl:border-b-0 xl:border-r-2 xl:border-r-gray-100"
                        >
                            <VideoPlayer
                                videoId={result.video_id}
                                onTimeUpdate={setCurrentTime}
                                onPausedChange={setIsPaused}
                                compact
                            />

                            <div className="flex flex-shrink-0 items-center gap-2 border-b border-gray-100 bg-ink-900 px-3 py-2 xl:hidden">
                                <span className="flex items-center gap-1.5 text-xs text-ghost">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                                    </svg>
                                    <span className="font-mono font-bold text-amber-glow">{result.subtitle_count}</span> câu
                                </span>
                                <div className="flex-1" />
                                <button
                                    type="button"
                                    onClick={() => { setResult(null); setStage('idle') }}
                                    className="flex items-center gap-1 rounded-lg border border-gray-100 px-2.5 py-1.5
                                               text-[11px] text-ghost active:text-amber-glow glass"
                                >
                                    + Video khác
                                </button>
                                <Link
                                    href="/history"
                                    className="flex items-center gap-1 rounded-lg border border-gray-100 px-2.5 py-1.5
                                               text-[11px] text-ghost active:text-jade glass"
                                >
                                    Lịch sử
                                </Link>
                            </div>

                            <div className="hidden flex-shrink-0 flex-col gap-2 px-4 py-3 xl:flex">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-jade text-xs">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                                            stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        Đã lưu
                                        <span className="font-mono font-bold text-amber-glow">{result.subtitle_count}</span> câu
                                    </div>
                                    <Link href="/history" className="text-xs text-jade underline hover:no-underline">
                                        Lịch sử
                                    </Link>
                                </div>
                                <UrlInput onAnalyze={u => { handleAnalyze(u) }} isLoading={false} />
                            </div>
                        </div>

                        {/* Phụ đề — dưới cùng trên mobile, cột phải trên desktop */}
                        <div
                            ref={subtitleRef}
                            className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-sub-panel
                                       [-webkit-overflow-scrolling:touch]"
                        >
                            <SubtitlePanel
                                subtitles={subtitles}
                                currentTime={currentTime}
                                isPaused={isPaused}
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
