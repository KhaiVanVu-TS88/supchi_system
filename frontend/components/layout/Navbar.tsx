/**
 * components/layout/Navbar.tsx — Top navigation bar
 * Hiển thị logo, username, nút History và Logout
 */
import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../../lib/auth-context'

export default function Navbar() {
  const { user, logout } = useAuth()
  const router = useRouter()

  return (
    <header className="flex-shrink-0 border-b border-white/6">
      <div className="max-w-[1400px] mx-auto px-6 py-3.5 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
          <span className="text-2xl select-none">🈶</span>
          <div>
            <h1 className="font-serif text-lg font-bold text-snow leading-none group-hover:text-amber-glow transition-colors">
              學中文
            </h1>
            <p className="text-[10px] text-ghost tracking-widest uppercase mt-0.5">
              Chinese · Pinyin · Việt
            </p>
          </div>
        </Link>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {/* History link */}
              <Link
                href="/history"
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition-colors ${
                  router.pathname === '/history'
                    ? 'bg-amber-glow/15 text-amber-glow'
                    : 'text-ghost hover:text-snow hover:bg-white/5'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
                </svg>
                Lịch sử
              </Link>

              {/* User badge */}
              <div className="flex items-center gap-2 px-3 py-2 glass rounded-lg">
                <div className="w-6 h-6 rounded-full bg-amber-glow/20 flex items-center justify-center text-amber-glow text-xs font-bold">
                  {user.username[0].toUpperCase()}
                </div>
                <span className="text-xs text-snow/80 font-medium">{user.username}</span>
              </div>

              {/* Logout */}
              <button
                onClick={logout}
                className="text-xs text-ghost hover:text-red-400 transition-colors px-2 py-2"
                title="Đăng xuất"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login"
                className="text-xs text-ghost hover:text-snow transition-colors px-3 py-2">
                Đăng nhập
              </Link>
              <Link href="/auth/register"
                className="btn-primary text-xs px-4 py-2">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
