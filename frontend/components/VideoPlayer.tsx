'use client'

import React, { useRef, useCallback, useEffect } from 'react'
import YouTube, { YouTubeEvent, YouTubePlayer } from 'react-youtube'

interface VideoPlayerProps {
    videoId: string
    onTimeUpdate: (time: number) => void
    onReady?: () => void
    /** Called when video starts playing (true) or pauses/stops (false) */
    onPausedChange?: (isPaused: boolean) => void
    compact?: boolean
}

export default function VideoPlayer({
    videoId, onTimeUpdate, onReady, onPausedChange, compact = false,
}: VideoPlayerProps) {
    const playerRef = useRef<YouTubePlayer | null>(null)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const stopPolling = useCallback(() => {
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    }, [])

    const startPolling = useCallback(() => {
        stopPolling()
        intervalRef.current = setInterval(() => {
            if (playerRef.current?.getCurrentTime) onTimeUpdate(playerRef.current.getCurrentTime())
        }, 0)
    }, [onTimeUpdate, stopPolling])

    useEffect(() => () => stopPolling(), [stopPolling])

    useEffect(() => {
        const handler = (e: Event) => {
            const { time } = (e as CustomEvent<{ time: number }>).detail
            if (playerRef.current?.seekTo) {
                playerRef.current.seekTo(time, true)
                playerRef.current.playVideo()
            }
        }
        window.addEventListener('seek-video', handler)
        return () => window.removeEventListener('seek-video', handler)
    }, [])

    const handleReady = (e: YouTubeEvent) => { playerRef.current = e.target; onReady?.() }
    const handleStateChange = (e: YouTubeEvent) => {
        // YouTube player state: 1 = playing, 3 = buffering/loading
        if (e.data === 1 || e.data === 3) {
            startPolling()
            onPausedChange?.(false)
        } else {
            stopPolling()
            onPausedChange?.(true)
            if (playerRef.current?.getCurrentTime) onTimeUpdate(playerRef.current.getCurrentTime())
        }
    }

    return (
        /*
         * QUAN TRỌNG: flex-shrink-0
         * Khi VideoPlayer nằm trong flex container (flex-col trên mobile),
         * flex mặc định SẼ co component này lại để nhường chỗ cho subtitle.
         * flex-shrink-0 = "tôi không co lại, giữ nguyên kích thước tự nhiên"
         *
         * Kích thước tự nhiên = aspect-video (16:9) × w-full
         * → video luôn hiển thị đúng tỉ lệ, không bị đè bởi subtitle
         */
        <div className="w-full flex-shrink-0">

            {/* aspect-video = padding-top: 56.25% trick → luôn giữ tỉ lệ 16:9 */}
            <div className="relative w-full aspect-video bg-black
                      xl:rounded-2xl xl:overflow-hidden
                      xl:border xl:border-gray-100
                      xl:shadow-[0_12px_40px_rgba(31,41,55,0.12),0_4px_12px_rgba(76,175,136,0.08)]">
                <YouTube
                    videoId={videoId}
                    onReady={handleReady}
                    onStateChange={handleStateChange}
                    opts={{
                        width: '100%', height: '100%',
                        playerVars: {
                            autoplay: 0, rel: 0, modestbranding: 1,
                            iv_load_policy: 3, cc_load_policy: 0
                        },
                    }}
                    className="absolute inset-0 w-full h-full"
                    style={{ width: '100%', height: '100%' }}
                />
            </div>

            {!compact && (
                <div className="mt-2 sm:mt-3 glass rounded-lg sm:rounded-xl px-3 sm:px-4
                        py-2 sm:py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-red-500/80">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                            </svg>
                        </span>
                        <span className="text-[11px] text-ghost font-mono truncate max-w-[120px] sm:max-w-none">
                            {videoId}
                        </span>
                    </div>
                    <span className="text-[11px] text-ghost/60 hidden sm:flex items-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        Tap subtitle để seek
                    </span>
                </div>
            )}
        </div>
    )
}