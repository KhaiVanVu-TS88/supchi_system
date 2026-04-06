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
          <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>
            {/* Left: Video player */}
            <div className="w-[52%] flex-shrink-0 flex flex-col overflow-hidden border-r border-white/6 px-6 pt-6 pb-4">
              <p className="text-xs text-ghost mb-3 truncate">
                <span className="text-amber-glow mr-2">←</span>
                <button onClick={() => router.push('/history')} className="hover:text-snow transition-colors">
                  Lịch sử
                </button>
                <span className="mx-2 opacity-40">/</span>
                {video.title}
              </p>
              <VideoPlayer videoId={video.video_id} onTimeUpdate={setCurrentTime} />
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="glass rounded-xl px-3 py-2.5 text-center">
                  <p className="text-base font-bold text-amber-glow font-mono">{video.subtitle_count}</p>
                  <p className="text-[10px] text-ghost mt-0.5">Câu thoại</p>
                </div>
                <div className="glass rounded-xl px-3 py-2.5 text-center">
                  <p className="text-base font-bold text-amber-glow font-mono text-xs">{video.video_id}</p>
                  <p className="text-[10px] text-ghost mt-0.5">Video ID</p>
                </div>
              </div>
            </div>

            {/* Right: Subtitle panel */}
            <div className="flex-1 overflow-hidden px-5 pt-6 pb-0">
              <SubtitlePanel
                subtitles={subtitles}
                currentTime={currentTime}
                onSeek={t => window.dispatchEvent(new CustomEvent('seek-video', { detail: { time: t } }))}
              />
            </div>
          </div>
        )}
      </div>
    </>
  )
}
