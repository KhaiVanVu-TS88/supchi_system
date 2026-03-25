import React, { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminGuard  from '../../components/admin/AdminGuard'
import Badge       from '../../components/admin/Badge'
import Pagination  from '../../components/admin/Pagination'
import { adminApi, type AdminJob, type Paginated } from '../../lib/admin-api'

export default function AdminJobs() {
  const [data,    setData]    = useState<Paginated<AdminJob> | null>(null)
  const [loading, setLoading] = useState(true)
  const [status,  setStatus]  = useState('')
  const [page,    setPage]    = useState(1)
  const [expanded,setExpanded]= useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    adminApi.jobs({ page, status: status || undefined })
      .then(setData).catch(console.error).finally(() => setLoading(false))
  }, [page, status])

  useEffect(() => { load() }, [load])

  const handleRetry = async (job: AdminJob) => {
    if (!confirm(`Retry job #${job.id}?`)) return
    try {
      await adminApi.retryJob(job.id)
      load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Lỗi')
    }
  }

  return (
    <AdminGuard>
      <Head><title>Jobs — Admin</title></Head>
      <AdminLayout>
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold text-snow">Jobs</h2>
              <p className="text-ghost text-sm mt-0.5">{data ? `${data.total} jobs` : ''}</p>
            </div>
            <button onClick={load}
              className="text-xs glass px-3 py-2 rounded-xl border border-white/8
                         text-ghost hover:text-snow transition-colors flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Refresh
            </button>
          </div>

          {/* Status filter tabs */}
          <div className="flex gap-1.5 flex-wrap">
            {['', 'queued', 'processing', 'done', 'failed'].map(s => (
              <button key={s}
                onClick={() => { setStatus(s); setPage(1) }}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors
                            ${status === s
                              ? 'bg-amber-glow/15 text-amber-glow border-amber-glow/30'
                              : 'glass border-white/8 text-ghost hover:text-snow'
                            }`}>
                {s === '' ? 'Tất cả' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="glass rounded-2xl border border-white/6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/6">
                    {['ID','User','Title / URL','Status','Progress','Source','Ngày tạo',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-medium
                                             text-ghost uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-ghost text-sm">Đang tải...</td></tr>
                  )}
                  {!loading && data?.items.map(job => (
                    <React.Fragment key={job.id}>
                      <tr className="border-b border-white/4 hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-ghost">#{job.id}</td>
                        <td className="px-4 py-3 text-xs text-ghost">{job.username}</td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="text-snow text-xs truncate">
                            {job.title || job.youtube_url}
                          </p>
                        </td>
                        <td className="px-4 py-3"><Badge status={job.status}/></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden w-16">
                              <div className="h-full bg-amber-glow/70 rounded-full"
                                style={{ width: `${job.progress}%` }}/>
                            </div>
                            <span className="text-[10px] font-mono text-ghost w-8">
                              {Math.round(job.progress)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-ghost">
                          {job.subtitle_source === 'whisper' ? '🎙️' : job.subtitle_source === 'manual' ? '📋' : '—'}
                        </td>
                        <td className="px-4 py-3 text-ghost text-xs whitespace-nowrap">
                          {new Date(job.created_at).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            {job.status === 'failed' && (
                              <button onClick={() => handleRetry(job)}
                                className="px-2 py-1 text-[11px] glass rounded border border-amber-glow/20
                                           text-amber-glow hover:bg-amber-glow/10 transition-colors">
                                Retry
                              </button>
                            )}
                            {job.error_message && (
                              <button onClick={() => setExpanded(expanded === job.id ? null : job.id)}
                                className="px-2 py-1 text-[11px] glass rounded border border-white/8
                                           text-ghost hover:text-red-400 transition-colors">
                                Log
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Error log expandable row */}
                      {expanded === job.id && job.error_message && (
                        <tr className="border-b border-white/4 bg-red-500/5">
                          <td colSpan={8} className="px-4 py-3">
                            <p className="text-[11px] text-ghost mb-1 uppercase tracking-wider">Error log</p>
                            <pre className="text-xs text-red-400 whitespace-pre-wrap break-all
                                            bg-red-500/10 rounded-lg p-3 max-h-32 overflow-y-auto">
                              {job.error_message}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
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
