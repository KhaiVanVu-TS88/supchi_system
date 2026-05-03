/**
 * pages/history/index.tsx
 */
import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Navbar from '../../components/layout/Navbar'
import { MobileBottomTabBar } from '../../components/layout/mainNavTabs'
import VideoCard from '../../components/history/VideoCard'
import { videosApi, type VideoSummary } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'

export default function HistoryPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [videos, setVideos] = useState<VideoSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login')
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return
    videosApi.list()
      .then(setVideos)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [user])

  const handleDelete = async (id: number) => {
    if (!confirm('Xoá video này khỏi lịch sử?')) return
    try {
      await videosApi.delete(id)
      setVideos(prev => prev.filter(v => v.id !== id))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Không thể xoá.')
    }
  }

  if (authLoading || !user) return null

  return (
    <>
      <Head><title>Lịch sử — 學中文</title></Head>
      <div className="min-h-screen flex flex-col pb-bottom-nav md:pb-0">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-10">

          {/* Header — mobile: stack dọc */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-8">
            <div>
              <h1 className="font-serif text-xl sm:text-2xl font-bold text-snow">Lịch sử học</h1>
              <p className="text-ghost text-xs sm:text-sm mt-0.5">
                {videos.length > 0 ? `${videos.length} video đã xử lý` : 'Chưa có video nào'}
              </p>
            </div>
            <Link href="/"
              className="btn-primary text-sm px-4 py-2.5 flex items-center justify-center gap-2
                         w-full sm:w-auto">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Thêm video
            </Link>
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-xl p-3 sm:p-4 border border-gray-100 flex gap-3">
                  <div className="skeleton w-24 h-16 sm:w-32 sm:h-20 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="skeleton h-3.5 w-2/3 rounded" />
                    <div className="skeleton h-3 w-1/3 rounded" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="glass rounded-xl px-4 py-3 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && videos.length === 0 && (
            <div className="text-center py-16 sm:py-20">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-ghost text-sm sm:text-base">Bạn chưa xử lý video nào.</p>
              <Link href="/" className="inline-block mt-4 text-amber-glow text-sm hover:underline">
                Phân tích video đầu tiên →
              </Link>
            </div>
          )}

          {!loading && videos.length > 0 && (
            <div className="space-y-2.5 sm:space-y-3">
              {videos.map(v => <VideoCard key={v.id} video={v} onDelete={handleDelete} />)}
            </div>
          )}
        </main>
        <MobileBottomTabBar />
      </div>
    </>
  )
}