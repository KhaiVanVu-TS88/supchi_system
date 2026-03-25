/**
 * Admin Layout — Sidebar + Content
 */
import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

const NAV = [
  { href: '/admin',         icon: '📊', label: 'Dashboard' },
  { href: '/admin/users',   icon: '👥', label: 'Users' },
  { href: '/admin/jobs',    icon: '⚙️', label: 'Jobs' },
  { href: '/admin/videos',  icon: '🎬', label: 'Videos' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="min-h-screen flex bg-ink-950">

      {/* ── Sidebar ── */}
      <aside className={`flex-shrink-0 flex flex-col
                         bg-ink-900 border-r border-white/6
                         transition-all duration-200
                         ${collapsed ? 'w-14' : 'w-52'}`}>

        {/* Logo */}
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-white/6">
          <span className="text-xl flex-shrink-0">🈶</span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-snow truncate">學中文</p>
              <p className="text-[10px] text-ghost">Admin Panel</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="ml-auto text-ghost hover:text-snow transition-colors p-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              {collapsed
                ? <path d="M9 18l6-6-6-6"/>
                : <path d="M15 18l-6-6 6-6"/>
              }
            </svg>
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {NAV.map(item => {
            const active = item.href === '/admin'
              ? router.pathname === '/admin'
              : router.pathname.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl
                            text-sm font-medium transition-colors
                            ${active
                              ? 'bg-amber-glow/15 text-amber-glow'
                              : 'text-ghost hover:text-snow hover:bg-white/5'
                            }`}
                title={collapsed ? item.label : undefined}
              >
                <span className="text-base flex-shrink-0">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Back to app */}
        <div className="p-2 border-t border-white/6">
          <Link href="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                       text-ghost hover:text-snow hover:bg-white/5 transition-colors"
            title={collapsed ? 'Về trang chính' : undefined}
          >
            <svg className="flex-shrink-0" width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            {!collapsed && <span>Về trang chính</span>}
          </Link>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 flex-shrink-0 flex items-center justify-between
                           px-6 border-b border-white/6 bg-ink-900/60 backdrop-blur">
          <h1 className="text-sm font-semibold text-snow">
            {NAV.find(n => n.href === '/admin'
              ? router.pathname === '/admin'
              : router.pathname.startsWith(n.href))?.label ?? 'Admin'}
          </h1>
          <span className="text-xs text-ghost glass px-2.5 py-1 rounded-lg border border-white/8">
            Admin
          </span>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
