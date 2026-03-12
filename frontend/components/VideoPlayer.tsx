/**
 * components/VideoPlayer.tsx
 *
 * YouTube video player dùng react-youtube.
 * Expose currentTime ra ngoài qua callback onTimeUpdate.
 * Sticky trên màn hình khi panel subtitle cuộn.
 */

'use client'

import React, { useRef, useCallback, useEffect } from 'react'
import YouTube, { YouTubeEvent, YouTubePlayer } from 'react-youtube'

interface VideoPlayerProps {
    videoId: string
    onTimeUpdate: (time: number) => void   // Gọi mỗi ~200ms với currentTime
    onReady?: () => void
}

export default function VideoPlayer({ videoId, onTimeUpdate, onReady }: VideoPlayerProps) {
    const playerRef = useRef<YouTubePlayer | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    /**
     * Bắt đầu polling currentTime mỗi 200ms.
     * Dùng setInterval thay vì requestAnimationFrame để tiết kiệm CPU
     * khi tab không được focus.
     */
    const startPolling = useCallback(() => {
        stopPolling()  // Dừng interval cũ nếu có
        intervalRef.current = setInterval(() => {
            if (playerRef.current?.getCurrentTime) {
                const t = playerRef.current.getCurrentTime()
                onTimeUpdate(t)
            }
        }, 200)
    }, [onTimeUpdate])

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
        }
    }, [])

    // Cleanup khi component unmount
    useEffect(() => () => stopPolling(), [stopPolling])

    /**
     * Lắng nghe custom event 'seek-video' từ SubtitlePanel
     * Khi người dùng click một subtitle, index.tsx dispatch event này
     */
    useEffect(() => {
        const handleSeekEvent = (e: Event) => {
            const { time } = (e as CustomEvent<{ time: number }>).detail
            if (playerRef.current?.seekTo) {
                playerRef.current.seekTo(time, true)
                playerRef.current.playVideo()
            }
        }
        window.addEventListener('seek-video', handleSeekEvent)
        return () => window.removeEventListener('seek-video', handleSeekEvent)
    }, [])

    /** YouTube player sẵn sàng */
    const handleReady = (event: YouTubeEvent) => {
        playerRef.current = event.target
        onReady?.()
    }

    /** Trạng thái YouTube thay đổi */
    const handleStateChange = (event: YouTubeEvent) => {
        const state = event.data
        // YT.PlayerState: PLAYING = 1, PAUSED = 2, ENDED = 0, BUFFERING = 3
        if (state === 1 || state === 3) {
            startPolling()   // Đang phát hoặc đang buffer → bắt đầu poll
        } else {
            stopPolling()    // Dừng/kết thúc → ngừng poll
            // Cập nhật một lần cuối khi pause để đồng bộ
            if (playerRef.current?.getCurrentTime) {
                onTimeUpdate(playerRef.current.getCurrentTime())
            }
        }
    }

    /** Seek video đến thời điểm cụ thể (gọi từ ngoài) */
    const seekTo = useCallback((time: number) => {
        if (playerRef.current?.seekTo) {
            playerRef.current.seekTo(time, true)
            playerRef.current.playVideo()
        }
    }, [])

    // Expose seekTo ra ngoài qua ref nếu cần
    // (Trong app này, seek được handle qua onSeek prop truyền xuống SubtitleItem)

    return (
        <div className="w-full">
            {/* Wrapper giữ tỉ lệ 16:9 */}
            <div className="relative w-full rounded-2xl overflow-hidden border border-white/8
                      shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
                style={{ paddingTop: '56.25%' }}
            >
                <div className="absolute inset-0">
                    <YouTube
                        videoId={videoId}
                        onReady={handleReady}
                        onStateChange={handleStateChange}
                        opts={{
                            width: '100%',
                            height: '100%',
                            playerVars: {
                                autoplay: 0,
                                rel: 0,    // Không hiện video liên quan
                                modestbranding: 1,    // Ẩn logo YouTube
                                iv_load_policy: 3,    // Ẩn annotations
                                cc_load_policy: 0,    // Ẩn closed captions của YouTube
                            },
                        }}
                        className="w-full h-full"
                        style={{ width: '100%', height: '100%' }}
                    />
                </div>
            </div>

            {/* ===== INFO PANEL dưới video ===== */}
            <div className="mt-4 glass rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    {/* Icon YouTube */}
                    <span className="text-red-500/80">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                    </span>
                    <span className="text-xs text-ghost font-mono tracking-wide">{videoId}</span>
                </div>

                {/* Hint */}
                <span className="text-[11px] text-ghost/60 flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    Click subtitle để seek
                </span>
            </div>
        </div>
    )
}