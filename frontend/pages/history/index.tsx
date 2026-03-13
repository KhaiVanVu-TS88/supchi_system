/**
 * pages/history/index.tsx — Trang lịch sử video đã xử lý
 */
import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import Navbar from '../../components/layout/Navbar'
import VideoCard from '../../components/history/VideoCard'
import { videosApi, type VideoSummary } from '../../lib/api'
import { useAuth } from '../../lib/auth-context'

export default function HistoryPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router  = useRouter()
  const [videos,   setVideos]   = useState<VideoSummary[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  // Redirect nếu chưa đăng nhập
  useEffect(() => {
    if (!authLoading && !user) router.push('/auth/login')
  }, [user, authLoading, router])

  // Fetch danh sách video
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
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-serif text-2xl font-bold text-snow">Lịch sử học</h1>
              <p className="text-ghost text-sm mt-1">
                {videos.length > 0 ? `${videos.length} video đã xử lý` : 'Chưa có video nào'}
              </p>
            </div>
            <Link href="/" className="btn-primary text-sm px-4 py-2.5 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Thêm video
            </Link>
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="rounded-xl p-4 border border-white/5 flex gap-4">
                  <div className="skeleton w-32 h-20 rounded-lg flex-shrink-0"/>
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-4 w-2/3"/>
                    <div className="skeleton h-3 w-1/3"/>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="glass rounded-xl px-4 py-3 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && videos.length === 0 && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">📭</div>
              <p className="text-ghost">Bạn chưa xử lý video nào.</p>
              <Link href="/" className="inline-block mt-4 text-amber-glow text-sm hover:underline">
                Phân tích video đầu tiên →
              </Link>
            </div>
          )}

          {/* Video list */}
          {!loading && videos.length > 0 && (
            <div className="space-y-3">
              {videos.map(v => (
                <VideoCard key={v.id} video={v} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  )
}
