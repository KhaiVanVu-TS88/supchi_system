/**
 * AdminGuard — Wrap các trang admin, chặn non-admin
 */
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [allowed,  setAllowed]  = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) { router.replace('/auth/login'); return }

    // Gọi /api/auth/me để kiểm tra role
    const base = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
    fetch(`${base}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(user => {
        if (user.role === 'admin') {
          setAllowed(true)
        } else {
          router.replace('/')
        }
      })
      .catch(() => router.replace('/auth/login'))
      .finally(() => setChecking(false))
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-ghost text-sm animate-pulse">Đang kiểm tra quyền...</div>
      </div>
    )
  }

  return allowed ? <>{children}</> : null
}
