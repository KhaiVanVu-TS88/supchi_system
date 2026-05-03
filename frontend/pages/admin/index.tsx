import React, { useEffect, useState } from 'react'
import Head from 'next/head'
import AdminLayout from '../../components/admin/AdminLayout'
import AdminGuard  from '../../components/admin/AdminGuard'
import StatCard    from '../../components/admin/StatCard'
import { adminApi, type AdminStats } from '../../lib/admin-api'

export default function AdminDashboard() {
  const [stats,   setStats]   = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    adminApi.stats()
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AdminGuard>
      <Head><title>Dashboard — Admin</title></Head>
      <AdminLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-snow">Dashboard</h2>
            <p className="text-ghost text-sm mt-0.5">Tổng quan hệ thống</p>
          </div>

          {loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="glass rounded-2xl p-5 animate-pulse">
                  <div className="skeleton h-8 w-8 rounded-full mb-3"/>
                  <div className="skeleton h-8 w-16 rounded mb-2"/>
                  <div className="skeleton h-3 w-24 rounded"/>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="glass rounded-xl p-4 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {stats && (
            <>
              {/* Users */}
              <div>
                <p className="text-[11px] text-ghost uppercase tracking-wider mb-3">Người dùng</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon="👥" label="Tổng users"    value={stats.total_users}    color="default"/>
                  <StatCard icon="✅" label="Đang hoạt động" value={stats.active_users}   color="jade"/>
                  <StatCard icon="👑" label="Admins"         value={stats.admin_users}    color="amber"/>
                  <StatCard icon="🆕" label="Mới 7 ngày"     value={stats.new_users_7d}   color="default"
                    sub="+7d"/>
                </div>
              </div>

              {/* Videos */}
              <div>
                <p className="text-[11px] text-ghost uppercase tracking-wider mb-3">Nội dung</p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatCard icon="🎬" label="Tổng videos"    value={stats.total_videos}   color="default"/>
                  <StatCard icon="📝" label="Tổng subtitles" value={stats.total_subtitles} color="jade"/>
                  <StatCard icon="🆕" label="Video mới 7 ngày" value={stats.new_videos_7d} color="default" sub="+7d"/>
                </div>
              </div>

              {/* Jobs */}
              <div>
                <p className="text-[11px] text-ghost uppercase tracking-wider mb-3">Jobs xử lý</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard icon="📋" label="Tổng jobs"      value={stats.total_jobs}      color="default"/>
                  <StatCard icon="⏳" label="Đang chờ"       value={stats.jobs_queued}     color="amber"/>
                  <StatCard icon="✅" label="Hoàn thành"     value={stats.jobs_done}       color="jade"/>
                  <StatCard icon="❌" label="Lỗi"            value={stats.jobs_failed}     color="red"/>
                </div>
              </div>

              {/* Job health bar */}
              {stats.total_jobs > 0 && (
                <div className="glass rounded-2xl p-5 border border-gray-100">
                  <p className="text-xs text-ghost mb-3">Tỉ lệ thành công</p>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="h-full bg-jade/70 transition-all"
                      style={{ width: `${(stats.jobs_done / stats.total_jobs) * 100}%` }}/>
                    <div className="h-full bg-amber-glow/70 transition-all"
                      style={{ width: `${((stats.jobs_queued + stats.jobs_processing) / stats.total_jobs) * 100}%` }}/>
                    <div className="h-full bg-red-500/70 transition-all"
                      style={{ width: `${(stats.jobs_failed / stats.total_jobs) * 100}%` }}/>
                  </div>
                  <div className="flex gap-4 mt-2 text-[11px] text-ghost">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-jade/70 inline-block"/>Done</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-glow/70 inline-block"/>Active</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500/70 inline-block"/>Failed</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </AdminLayout>
    </AdminGuard>
  )
}
