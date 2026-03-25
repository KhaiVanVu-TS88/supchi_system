import React, { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminGuard  from '../../components/admin/AdminGuard'
import Pagination  from '../../components/admin/Pagination'
import { adminApi, type AdminVideo, type Paginated } from '../../lib/admin-api'

export default function AdminVideos() {
  const [data,    setData]    = useState<Paginated<AdminVideo> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [page,    setPage]    = useState(1)

  const load = useCallback(() => {
    setLoading(true)
    adminApi.videos({ page, search: search || undefined })
      .then(setData).catch(console.error).finally(() => setLoading(false))
  }, [page, search])

  useEffect(() => { load() }, [load])

  const handleDelete = async (v: AdminVideo) => {
    if (!confirm(`Xoá video "${v.title ?? v.video_id}"? Toàn bộ subtitle sẽ bị xoá!`)) return
    await adminApi.deleteVideo(v.id)
    load()
  }

  return (
    <AdminGuard>
      <Head><title>Videos — Admin</title></Head>
      <AdminLayout>
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-snow">Videos</h2>
            <p className="text-ghost text-sm mt-0.5">{data ? `${data.total} videos` : ''}</p>
          </div>

          <input
            type="search" placeholder="Tìm theo tiêu đề..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="url-input max-w-sm"
          />

          <div className="glass rounded-2xl border border-white/6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/6">
                    {['ID','User','Title','YouTube ID','Subtitles','Ngày tạo',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-medium
                                             text-ghost uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-ghost">Đang tải...</td></tr>
                  )}
                  {!loading && data?.items.map(v => (
                    <tr key={v.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-ghost">#{v.id}</td>
                      <td className="px-4 py-3 text-xs text-ghost">{v.username}</td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="text-snow text-xs truncate">{v.title ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <a href={`https://youtube.com/watch?v=${v.video_id}`}
                          target="_blank" rel="noopener noreferrer"
                          className="text-xs font-mono text-amber-glow/70 hover:text-amber-glow
                                     transition-colors">
                          {v.video_id}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-ghost">
                        {v.subtitle_count}
                      </td>
                      <td className="px-4 py-3 text-ghost text-xs whitespace-nowrap">
                        {new Date(v.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDelete(v)}
                          className="px-2 py-1 text-[11px] glass rounded border border-red-500/20
                                     text-ghost hover:text-red-400 transition-colors">
                          Xoá
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {data && <Pagination page={page} total_pages={data.total_pages} onChange={setPage}/>}
        </div>
      </AdminLayout>
    </AdminGuard>
  )
}
