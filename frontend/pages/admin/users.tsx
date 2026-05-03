import React, { useEffect, useState, useCallback } from 'react'
import Head from 'next/head'
import AdminLayout  from '../../components/admin/AdminLayout'
import AdminGuard   from '../../components/admin/AdminGuard'
import Badge        from '../../components/admin/Badge'
import Pagination   from '../../components/admin/Pagination'
import { adminApi, type AdminUser, type Paginated } from '../../lib/admin-api'

export default function AdminUsers() {
  const [data,    setData]    = useState<Paginated<AdminUser> | null>(null)
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [role,    setRole]    = useState('')
  const [page,    setPage]    = useState(1)

  const load = useCallback(() => {
    setLoading(true)
    adminApi.users({ page, search: search || undefined, role: role || undefined })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [page, search, role])

  useEffect(() => { load() }, [load])

  const handleToggleActive = async (user: AdminUser) => {
    if (!confirm(`${user.is_active ? 'Khoá' : 'Mở khoá'} tài khoản ${user.username}?`)) return
    await adminApi.updateUser(user.id, { is_active: !user.is_active })
    load()
  }

  const handleSetAdmin = async (user: AdminUser) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin'
    if (!confirm(`Đổi role ${user.username} thành ${newRole}?`)) return
    await adminApi.updateUser(user.id, { role: newRole })
    load()
  }

  const handleDelete = async (user: AdminUser) => {
    if (!confirm(`Xoá vĩnh viễn tài khoản "${user.username}"? Không thể hoàn tác!`)) return
    await adminApi.deleteUser(user.id)
    load()
  }

  return (
    <AdminGuard>
      <Head><title>Users — Admin</title></Head>
      <AdminLayout>
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-snow">Users</h2>
              <p className="text-ghost text-sm mt-0.5">
                {data ? `${data.total} người dùng` : ''}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="search" placeholder="Tìm username hoặc email..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="url-input flex-1"
            />
            <select
              value={role}
              onChange={e => { setRole(e.target.value); setPage(1) }}
              className="url-input sm:w-32 bg-ink-800"
            >
              <option value="">Tất cả role</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {/* Table */}
          <div className="glass rounded-2xl border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['ID','Username','Email','Role','Trạng thái','Videos','Jobs','Ngày tạo',''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-medium
                                             text-ghost uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-ghost text-sm">
                      Đang tải...
                    </td></tr>
                  )}
                  {!loading && data?.items.map(u => (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-ghost">#{u.id}</td>
                      <td className="px-4 py-3 font-medium text-snow">{u.username}</td>
                      <td className="px-4 py-3 text-ghost text-xs">{u.email}</td>
                      <td className="px-4 py-3"><Badge status={u.role}/></td>
                      <td className="px-4 py-3"><Badge status={u.is_active ? 'active' : 'inactive'}/></td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-ghost">{u.video_count}</td>
                      <td className="px-4 py-3 text-center font-mono text-xs text-ghost">{u.job_count}</td>
                      <td className="px-4 py-3 text-ghost text-xs whitespace-nowrap">
                        {new Date(u.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleToggleActive(u)}
                            className="px-2 py-1 text-[11px] glass rounded border border-gray-100
                                       text-ghost hover:text-snow transition-colors">
                            {u.is_active ? 'Khoá' : 'Mở'}
                          </button>
                          <button onClick={() => handleSetAdmin(u)}
                            className="px-2 py-1 text-[11px] glass rounded border border-gray-100
                                       text-ghost hover:text-amber-glow transition-colors">
                            {u.role === 'admin' ? '→User' : '→Admin'}
                          </button>
                          <button onClick={() => handleDelete(u)}
                            className="px-2 py-1 text-[11px] glass rounded border border-red-500/20
                                       text-ghost hover:text-red-400 transition-colors">
                            Xoá
                          </button>
                        </div>
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
