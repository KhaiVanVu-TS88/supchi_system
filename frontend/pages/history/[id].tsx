/**
 * pages/history/[id].tsx — Xem lại video đã lưu với subtitle sync
 */
import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Navbar from '../../components/layout/Navbar'
import VideoPlayer from '../../components/VideoPlayer'
import SubtitlePanel from '../../components/SubtitlePanel'
import { videosApi, type VideoDetail, type SubtitleItem } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'
import type { Subtitle } from '../../types/subtitle'

// Chuyển SubtitleItem từ API sang Subtitle type của SubtitlePanel
function toSubtitle(s: SubtitleItem): Subtitle {
  return { start: s.start_time, end: s.end_time, chinese: s.chinese, pinyin: s.pinyin, vietnamese: s.vietnamese }
}

export default function VideoDetailPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { id }  = router.query

  const [video,       setVideo]       = useState<VideoDetail | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user || !id) return
    videosApi.get(Number(id))
      .then(v => {
        setVideo(v)
        // Cập nhật last_viewed_at khi user mở video (FIFO)
        videosApi.markViewed(Number(id)).catch(() => {})
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [user, id])

  if (authLoading || !user) return null

  const subtitles = video?.subtitles.map(toSubtitle) ?? []

  return (
    <>
      <Head><title>{video?.title ?? 'Video'} — 學中文</title></Head>
      <div className="min-h-screen flex flex-col">
        <Navbar />

        {loading && (
          <div className="flex-1 flex items-center justify-center text-ghost">Đang tải...</div>
        )}

        {error && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {video && (
          /*
           * Dưới 1280px: cột dọc (video trên, phụ đề dưới) — .app-split-video-sub trong globals.css.
           * Từ 1280px (xl): hai cột — video ~52%.
           */
          <div
            className="app-split-video-sub flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row"
            style={{ height: 'calc(100dvh - 3.5rem)' }}
          >
            {/* Video + meta — w-full + xl:w-[52%] song song globals để luôn đúng trên mobile */}
            <div
              className="flex w-full max-w-full shrink-0 flex-col overflow-hidden border-b border-gray-200 bg-ink-800
                         px-3 pb-3 pt-3 sm:px-6 sm:pb-4 sm:pt-5 xl:w-[52%] xl:max-w-[52%] xl:border-b-0 xl:border-r xl:border-gray-200"
            >
              <p className="mb-2 truncate text-xs text-ghost sm:mb-3">
                <span className="mr-2 text-amber-glow">←</span>
                <button
                  type="button"
                  onClick={() => router.push('/history')}
                  className="transition-colors hover:text-snow"
                >
                  Lịch sử
                </button>
                <span className="mx-2 opacity-40">/</span>
                {video.title}
              </p>
              <VideoPlayer videoId={video.video_id} onTimeUpdate={setCurrentTime} compact />
              <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-3">
                <div className="glass rounded-xl px-3 py-2.5 text-center">
                  <p className="font-mono text-base font-bold text-amber-glow">{video.subtitle_count}</p>
                  <p className="mt-0.5 text-[10px] text-ghost">Câu thoại</p>
                </div>
                <div className="glass rounded-xl px-3 py-2.5 text-center">
                  <p className="font-mono text-xs font-bold text-amber-glow">{video.video_id}</p>
                  <p className="mt-0.5 text-[10px] text-ghost">Video ID</p>
                </div>
              </div>
            </div>

            {/* Phụ đề — flex-1 chiếm phần còn lại dưới video (mobile) hoặc cột phải (desktop) */}
            {/* overflow-hidden: chỉ SubtitlePanel cuộn bên trong — tránh 2 lớp scroll làm auto-scroll hỏng trên mobile */}
            <div
              className="min-h-0 flex-1 overflow-hidden bg-sub-panel
                         px-3 pb-2 pt-2 sm:px-5 sm:pb-3 sm:pt-4 xl:px-5 xl:pb-0 xl:pt-6"
            >
              <SubtitlePanel
                key={String(id)}
                subtitles={subtitles}
                currentTime={currentTime}
                onSeek={t =>
                  window.dispatchEvent(new CustomEvent('seek-video', { detail: { time: t } }))
                }
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
