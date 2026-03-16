/**
 * components/layout/Navbar.tsx v3.1 — với tab Dictionary
 */
import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../../lib/auth-context'

export default function Navbar() {
  const { user, logout } = useAuth()
  const router = useRouter()

  const navLinks = [
    { href: '/', label: '🎬 Video', match: (p: string) => p === '/' },
    { href: '/dictionary', label: '📖 Từ điển', match: (p: string) => p.startsWith('/dictionary') },
    { href: '/history', label: '🕐 Lịch sử', match: (p: string) => p.startsWith('/history') },
  ]

  return (
    <header className="flex-shrink-0 border-b border-white/6">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group flex-shrink-0">
          <span className="text-2xl select-none">🈶</span>
          <div>
            <h1 className="font-serif text-lg font-bold text-snow leading-none group-hover:text-amber-glow transition-colors">
              學中文
            </h1>
            <p className="text-[10px] text-ghost tracking-widest uppercase mt-0.5">Chinese · Pinyin · Việt</p>
          </div>
        </Link>

        {/* Nav tabs */}
        <nav className="flex items-center gap-1 mx-6">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-xs font-medium px-3 py-2 rounded-lg transition-colors ${link.match(router.pathname)
                  ? 'bg-amber-glow/15 text-amber-glow'
                  : 'text-ghost hover:text-snow hover:bg-white/5'
                }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* User area */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {user ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 glass rounded-lg">
                <div className="w-6 h-6 rounded-full bg-amber-glow/20 flex items-center justify-center text-amber-glow text-xs font-bold">
                  {user.username[0].toUpperCase()}
                </div>
                <span className="text-xs text-snow/80 font-medium">{user.username}</span>
              </div>
              <button
                onClick={logout}
                className="text-xs text-ghost hover:text-red-400 transition-colors p-2"
                title="Đăng xuất"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="text-xs text-ghost hover:text-snow transition-colors px-3 py-2">Đăng nhập</Link>
              <Link href="/auth/register" className="btn-primary text-xs px-4 py-2">Đăng ký</Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}