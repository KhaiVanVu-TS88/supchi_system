/**
 * Main app navigation tabs — monochrome stroke icons + shared tab chrome.
 */
import React from 'react'
import Link from 'next/link'
import clsx from 'clsx'
import { useRouter } from 'next/router'

export type MainNavIconId = 'video' | 'dictionary' | 'history'

export const MAIN_NAV = [
  { href: '/', label: 'Video', icon: 'video' as const, match: (p: string) => p === '/' },
  {
    href: '/dictionary',
    label: 'Từ điển',
    icon: 'dictionary' as const,
    match: (p: string) => p.startsWith('/dictionary'),
  },
  {
    href: '/history',
    label: 'Lịch sử',
    icon: 'history' as const,
    match: (p: string) => p.startsWith('/history'),
  },
] as const

/** Single-color stroke icons only (currentColor). */
export function NavGlyph({
  id,
  className,
}: {
  id: MainNavIconId
  className?: string
}) {
  const c = clsx('shrink-0', className)
  switch (id) {
    case 'video':
      return (
        <svg
          className={c}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="2" y="5" width="15" height="14" rx="2" />
          <polygon points="23 7 16 12 23 17 23 7" />
        </svg>
      )
    case 'dictionary':
      return (
        <svg
          className={c}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      )
    case 'history':
      return (
        <svg
          className={c}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    default:
      return null
  }
}

function desktopTabClasses(active: boolean) {
  return clsx(
    'flex items-center gap-2 text-[13px] font-medium px-3 py-2 rounded-xl whitespace-nowrap min-h-[40px] transition-colors',
    active
      ? 'bg-navtab-activeBg text-navtab-activeText'
      : 'text-navtab-text hover:bg-black/[0.035] hover:text-[#555555]',
  )
}

function desktopIconWrap(active: boolean) {
  return clsx(active ? 'text-navtab-activeIcon' : 'text-navtab-icon')
}

/** Desktop horizontal tab rail (md+). */
export function DesktopMainNavTabs() {
  const router = useRouter()
  return (
    <nav
      className="hidden md:flex flex-1 justify-center px-2"
      aria-label="Điều hướng chính"
    >
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-navtab-bar">
        {MAIN_NAV.map((link) => {
          const active = link.match(router.pathname)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={desktopTabClasses(active)}
              aria-current={active ? 'page' : undefined}
            >
              <span className={desktopIconWrap(active)}>
                <NavGlyph id={link.icon} className="h-[18px] w-[18px]" />
              </span>
              {link.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/** Mobile fixed bottom tab bar (< md). */
export function MobileBottomTabBar() {
  const router = useRouter()
  return (
    <nav className="bottom-nav md:hidden" aria-label="Điều hướng chính">
      <div className="max-w-lg mx-auto px-3 pt-2 pb-1">
        <div className="flex items-stretch justify-stretch gap-1 p-1 rounded-xl bg-navtab-bar">
          {MAIN_NAV.map((link) => {
            const active = link.match(router.pathname)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[48px] rounded-xl px-1 py-1.5 transition-colors',
                  active
                    ? 'bg-navtab-activeBg text-navtab-activeText'
                    : 'text-navtab-text hover:bg-black/[0.035]',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <span className={desktopIconWrap(active)}>
                  <NavGlyph id={link.icon} className="h-5 w-5" />
                </span>
                <span className="text-[11px] font-medium leading-none">{link.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
