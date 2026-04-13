// /**
//  * components/layout/Navbar.tsx
//  *
//  * Mobile  (< md):
//  *   - Logo bên trái
//  *   - Hamburger icon bên phải → mở dropdown menu
//  *   - KHÔNG có bottom nav (để video page dùng full height)
//  *
//  * Desktop (md+):
//  *   - Logo + Nav tabs ngang + User badge
//  */
// import React, { useState, useEffect, useRef } from 'react'
// import Link from 'next/link'
// import { useRouter } from 'next/router'
// import { useAuth } from '../../lib/auth-context'

// export const NAV_LINKS = [
//   { href: '/', label: 'Video', icon: '🎬', match: (p: string) => p === '/' },
//   { href: '/dictionary', label: 'Từ điển', icon: '📖', match: (p: string) => p.startsWith('/dictionary') },
//   { href: '/ocr', label: 'OCR', icon: '🔍', match: (p: string) => p.startsWith('/ocr') },
//   { href: '/history', label: 'Lịch sử', icon: '🕐', match: (p: string) => p.startsWith('/history') },
// ]

// export default function Navbar() {
//   const { user, logout } = useAuth()
//   const router = useRouter()
//   const [menuOpen, setMenuOpen] = useState(false)
//   const menuRef = useRef<HTMLDivElement>(null)

//   // Đóng menu khi click ngoài
//   useEffect(() => {
//     if (!menuOpen) return
//     const handler = (e: MouseEvent | TouchEvent) => {
//       if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
//         setMenuOpen(false)
//       }
//     }
//     document.addEventListener('mousedown', handler)
//     document.addEventListener('touchstart', handler)
//     return () => {
//       document.removeEventListener('mousedown', handler)
//       document.removeEventListener('touchstart', handler)
//     }
//   }, [menuOpen])

//   // Đóng menu khi navigate
//   useEffect(() => { setMenuOpen(false) }, [router.pathname])

//   // Khoá scroll body khi menu mở
//   useEffect(() => {
//     document.body.style.overflow = menuOpen ? 'hidden' : ''
//     return () => { document.body.style.overflow = '' }
//   }, [menuOpen])

//   return (
//     <>
//       <header className="flex-shrink-0 sticky top-0 z-40
//                          bg-ink-900/90 backdrop-blur-xl border-b border-white/6">
//         <div className="pt-safe" />

//         <div className="h-14 px-3 sm:px-5 flex items-center justify-between gap-3
//                         max-w-[1400px] mx-auto">

//           {/* ── Logo ── */}
//           <Link href="/"
//             className="flex items-center gap-2 group flex-shrink-0 min-h-[44px]"
//             onClick={() => setMenuOpen(false)}>
//             <span className="text-xl select-none" aria-hidden>🈶</span>
//             <div className="flex flex-col leading-none">
//               <span className="font-serif text-base sm:text-lg font-bold text-snow
//                                group-hover:text-amber-glow transition-colors">
//                 學中文
//               </span>
//               <span className="hidden sm:block text-[9px] text-ghost tracking-widest uppercase mt-0.5">
//                 Chinese · Pinyin · Việt
//               </span>
//             </div>
//           </Link>

//           {/* ── Nav tabs — desktop only (md+) ── */}
//           <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center"
//             aria-label="Điều hướng chính">
//             {NAV_LINKS.map(link => {
//               const active = link.match(router.pathname)
//               return (
//                 <Link key={link.href} href={link.href}
//                   className={`flex items-center gap-1.5 text-[13px] font-medium px-3 py-2
//                               rounded-lg transition-colors whitespace-nowrap min-h-[40px] ${active
//                       ? 'bg-amber-glow/15 text-amber-glow'
//                       : 'text-ghost hover:text-snow hover:bg-white/5'
//                     }`}
//                   aria-current={active ? 'page' : undefined}>
//                   <span aria-hidden>{link.icon}</span>
//                   {link.label}
//                 </Link>
//               )
//             })}
//           </nav>

//           {/* ── Right area ── */}
//           <div className="flex items-center gap-1.5 flex-shrink-0">

//             {/* User badge — desktop */}
//             {user && (
//               <>
//                 <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 glass rounded-lg">
//                   <div className="w-6 h-6 rounded-full bg-amber-glow/20 flex items-center
//                                   justify-center text-amber-glow text-[11px] font-bold">
//                     {user.username[0].toUpperCase()}
//                   </div>
//                   <span className="text-xs text-snow/80 font-medium max-w-[80px] truncate">
//                     {user.username}
//                   </span>
//                 </div>
//                 <button
//                   onClick={logout}
//                   className="hidden sm:flex p-2 rounded-lg text-ghost hover:text-red-400
//                              hover:bg-white/5 transition-colors min-w-[40px] min-h-[40px]
//                              items-center justify-center"
//                   aria-label="Đăng xuất">
//                   <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
//                     stroke="currentColor" strokeWidth="2">
//                     <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
//                     <polyline points="16 17 21 12 16 7" />
//                     <line x1="21" y1="12" x2="9" y2="12" />
//                   </svg>
//                 </button>
//               </>
//             )}

//             {/* Login/register — desktop */}
//             {!user && (
//               <div className="hidden sm:flex items-center gap-1.5">
//                 <Link href="/auth/login"
//                   className="text-xs text-ghost hover:text-snow transition-colors px-3 py-2
//                              min-h-[44px] flex items-center">
//                   Đăng nhập
//                 </Link>
//                 <Link href="/auth/register" className="btn-primary text-xs px-3 sm:px-4 py-2 min-h-[40px]">
//                   Đăng ký
//                 </Link>
//               </div>
//             )}

//             {/* ── Hamburger — mobile only (< md) ── */}
//             <div className="md:hidden relative" ref={menuRef}>
//               <button
//                 onClick={() => setMenuOpen(o => !o)}
//                 className="w-10 h-10 flex flex-col items-center justify-center gap-[5px]
//                            rounded-xl glass border border-white/8 active:bg-white/10
//                            transition-colors"
//                 aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
//                 aria-expanded={menuOpen}
//               >
//                 {/* 3 thanh ngang → X khi mở */}
//                 <span className={`block w-[18px] h-[1.5px] bg-snow rounded-full transition-all
//                                   duration-200 origin-center
//                                   ${menuOpen ? 'rotate-45 translate-y-[6.5px]' : ''}`} />
//                 <span className={`block w-[18px] h-[1.5px] bg-snow rounded-full transition-all
//                                   duration-200 ${menuOpen ? 'opacity-0 scale-x-0' : ''}`} />
//                 <span className={`block w-[18px] h-[1.5px] bg-snow rounded-full transition-all
//                                   duration-200 origin-center
//                                   ${menuOpen ? '-rotate-45 -translate-y-[6.5px]' : ''}`} />
//               </button>

//               {/* ── Dropdown Menu ── */}
//               {menuOpen && (
//                 <div className="absolute right-0 top-[calc(100%+8px)] w-56
//                                 glass border border-white/10 rounded-2xl shadow-2xl
//                                 overflow-hidden animate-fade-in z-50">

//                   {/* User info — top của menu nếu đã đăng nhập */}
//                   {user && (
//                     <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2.5">
//                       <div className="w-8 h-8 rounded-full bg-amber-glow/20 flex items-center
//                                       justify-center text-amber-glow text-sm font-bold flex-shrink-0">
//                         {user.username[0].toUpperCase()}
//                       </div>
//                       <div className="min-w-0">
//                         <p className="text-sm font-medium text-snow truncate">{user.username}</p>
//                         <p className="text-[10px] text-ghost truncate">{user.email ?? ''}</p>
//                       </div>
//                     </div>
//                   )}

//                   {/* Nav links */}
//                   <div className="py-1">
//                     {NAV_LINKS.map(link => {
//                       const active = link.match(router.pathname)
//                       return (
//                         <Link key={link.href} href={link.href}
//                           className={`flex items-center gap-3 px-4 py-3.5 text-sm
//                                       transition-colors min-h-[52px] ${active
//                               ? 'bg-amber-glow/10 text-amber-glow'
//                               : 'text-mist active:bg-white/5'
//                             }`}>
//                           <span className="text-lg w-6 text-center" aria-hidden>{link.icon}</span>
//                           <span className="font-medium">{link.label}</span>
//                           {active && (
//                             <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-glow" aria-hidden />
//                           )}
//                         </Link>
//                       )
//                     })}
//                   </div>

//                   {/* Auth actions */}
//                   <div className="border-t border-white/6 py-1">
//                     {user ? (
//                       <button
//                         onClick={() => { logout(); setMenuOpen(false) }}
//                         className="w-full flex items-center gap-3 px-4 py-3.5 text-sm
//                                    text-ghost active:bg-white/5 transition-colors min-h-[52px]">
//                         <svg className="w-6 text-center flex-shrink-0" width="16" height="16"
//                           viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                           <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
//                           <polyline points="16 17 21 12 16 7" />
//                           <line x1="21" y1="12" x2="9" y2="12" />
//                         </svg>
//                         <span>Đăng xuất</span>
//                       </button>
//                     ) : (
//                       <>
//                         <Link href="/auth/login"
//                           className="flex items-center gap-3 px-4 py-3.5 text-sm text-mist
//                                      active:bg-white/5 min-h-[52px]">
//                           <svg className="w-6 flex-shrink-0" width="16" height="16"
//                             viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                             <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
//                             <polyline points="10 17 15 12 10 7" />
//                             <line x1="15" y1="12" x2="3" y2="12" />
//                           </svg>
//                           <span>Đăng nhập</span>
//                         </Link>
//                         <Link href="/auth/register"
//                           className="flex items-center gap-3 px-4 py-3.5 text-sm text-amber-glow
//                                      active:bg-amber-glow/10 min-h-[52px] font-medium">
//                           <svg className="w-6 flex-shrink-0" width="16" height="16"
//                             viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//                             <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
//                             <circle cx="12" cy="7" r="4" />
//                           </svg>
//                           <span>Đăng ký miễn phí</span>
//                         </Link>
//                       </>
//                     )}
//                   </div>
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
//       </header>
//     </>
//   )
// }

/**
 * components/layout/Navbar.tsx
 *
 * Mobile  (< md):
 *   - Logo bên trái
 *   - Hamburger icon bên phải → mở dropdown menu
 *   - KHÔNG có bottom nav (để video page dùng full height)
 *
 * Desktop (md+):
 *   - Logo + Nav tabs ngang + User badge
 */
import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '../../lib/auth-context'

export const NAV_LINKS = [
  { href: '/', label: 'Video', icon: '🎬', match: (p: string) => p === '/' },
  { href: '/dictionary', label: 'Từ điển', icon: '📖', match: (p: string) => p.startsWith('/dictionary') },
  // { href: '/pronunciation', label: 'Phát âm', icon: '🎤', match: (p: string) => p.startsWith('/pronunciation') },
  // { href: '/ocr', label: 'OCR', icon: '🔍', match: (p: string) => p.startsWith('/ocr') },
  { href: '/history', label: 'Lịch sử', icon: '🕐', match: (p: string) => p.startsWith('/history') },
]

export default function Navbar() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Đóng menu khi click ngoài
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [menuOpen])

  // Đóng menu khi navigate
  useEffect(() => { setMenuOpen(false) }, [router.pathname])

  // Khoá scroll body khi menu mở
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  return (
    <>
      <header className="flex-shrink-0 sticky top-0 z-40
                         bg-ink-900/90 backdrop-blur-xl border-b border-white/6">
        <div className="pt-safe" />

        <div className="h-14 px-3 sm:px-5 flex items-center justify-between gap-3
                        max-w-[1400px] mx-auto">

          {/* ── Logo ── */}
          <Link href="/"
            className="flex items-center gap-2 group flex-shrink-0 min-h-[44px]"
            onClick={() => setMenuOpen(false)}>
            <span className="text-xl select-none" aria-hidden>🈶</span>
            <div className="flex flex-col leading-none">
              <span className="font-serif text-base sm:text-lg font-bold text-snow
                               group-hover:text-amber-glow transition-colors">
                學中文
              </span>
              <span className="hidden sm:block text-[9px] text-ghost tracking-widest uppercase mt-0.5">
                Chinese · Pinyin · Việt
              </span>
            </div>
          </Link>

          {/* ── Nav tabs — desktop only (md+) ── */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1 justify-center"
            aria-label="Điều hướng chính">
            {NAV_LINKS.map(link => {
              const active = link.match(router.pathname)
              return (
                <Link key={link.href} href={link.href}
                  className={`flex items-center gap-1.5 text-[13px] font-medium px-3 py-2
                              rounded-lg transition-colors whitespace-nowrap min-h-[40px] ${active
                      ? 'bg-amber-glow/15 text-amber-glow'
                      : 'text-ghost hover:text-snow hover:bg-white/5'
                    }`}
                  aria-current={active ? 'page' : undefined}>
                  <span aria-hidden>{link.icon}</span>
                  {link.label}
                </Link>
              )
            })}
          </nav>

          {/* ── Right area ── */}
          <div className="flex items-center gap-1.5 flex-shrink-0">

            {/* User badge — desktop */}
            {user && (
              <>
                {/* Admin link — // NOTE: /admin page removed, uncomment if re-added
                {user.role === 'admin' && (
                  <Link href="/admin"
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5
                               bg-amber-glow/10 border border-amber-glow/30 rounded-lg
                               text-amber-glow text-xs font-medium hover:bg-amber-glow/20
                               transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2">
                      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                    </svg>
                    Admin
                  </Link>
                ) */}
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 glass rounded-lg">
                  <div className="w-6 h-6 rounded-full bg-amber-glow/20 flex items-center
                                  justify-center text-amber-glow text-[11px] font-bold">
                    {user.username[0].toUpperCase()}
                  </div>
                  <span className="text-xs text-snow/80 font-medium max-w-[80px] truncate">
                    {user.username}
                  </span>
                </div>
                <button
                  onClick={logout}
                  className="hidden sm:flex p-2 rounded-lg text-ghost hover:text-red-400
                             hover:bg-white/5 transition-colors min-w-[40px] min-h-[40px]
                             items-center justify-center"
                  aria-label="Đăng xuất">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </>
            )}

            {/* Login/register — desktop */}
            {!user && (
              <div className="hidden sm:flex items-center gap-1.5">
                <Link href="/auth/login"
                  className="text-xs text-ghost hover:text-snow transition-colors px-3 py-2
                             min-h-[44px] flex items-center">
                  Đăng nhập
                </Link>
                <Link href="/auth/register" className="btn-primary text-xs px-3 sm:px-4 py-2 min-h-[40px]">
                  Đăng ký
                </Link>
              </div>
            )}

            {/* ── Hamburger — mobile only (< md) ── */}
            <div className="md:hidden relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(o => !o)}
                className="w-10 h-10 flex flex-col items-center justify-center gap-[5px]
                           rounded-xl glass border border-white/8 active:bg-white/10
                           transition-colors"
                aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
                aria-expanded={menuOpen}
              >
                {/* 3 thanh ngang → X khi mở */}
                <span className={`block w-[18px] h-[1.5px] bg-snow rounded-full transition-all
                                  duration-200 origin-center
                                  ${menuOpen ? 'rotate-45 translate-y-[6.5px]' : ''}`} />
                <span className={`block w-[18px] h-[1.5px] bg-snow rounded-full transition-all
                                  duration-200 ${menuOpen ? 'opacity-0 scale-x-0' : ''}`} />
                <span className={`block w-[18px] h-[1.5px] bg-snow rounded-full transition-all
                                  duration-200 origin-center
                                  ${menuOpen ? '-rotate-45 -translate-y-[6.5px]' : ''}`} />
              </button>

              {/* ── Dropdown Menu ── */}
              {menuOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-56
                                glass border border-white/10 rounded-2xl shadow-2xl
                                overflow-hidden animate-fade-in z-50">

                  {/* User info — top của menu nếu đã đăng nhập */}
                  {user && (
                    <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-glow/20 flex items-center
                                      justify-center text-amber-glow text-sm font-bold flex-shrink-0">
                        {user.username[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-snow truncate">{user.username}</p>
                        <p className="text-[10px] text-ghost truncate">{user.email ?? ''}</p>
                      </div>
                    </div>
                  )}

                  {/* Nav links */}
                  <div className="py-1">
                    {NAV_LINKS.map(link => {
                      const active = link.match(router.pathname)
                      return (
                        <Link key={link.href} href={link.href}
                          className={`flex items-center gap-3 px-4 py-3.5 text-sm
                                      transition-colors min-h-[52px] ${active
                              ? 'bg-amber-glow/10 text-amber-glow'
                              : 'text-mist active:bg-white/5'
                            }`}>
                          <span className="text-lg w-6 text-center" aria-hidden>{link.icon}</span>
                          <span className="font-medium">{link.label}</span>
                          {active && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-glow" aria-hidden />
                          )}
                        </Link>
                      )
                    })}
                  </div>

                  {/* Auth actions */}
                  <div className="border-t border-white/6 py-1">
                    {user ? (
                      <>
                        {/* Admin link in dropdown — // NOTE: /admin page removed
                        {user.role === 'admin' && (
                          <Link href="/admin"
                            className="flex items-center gap-3 px-4 py-3.5 text-sm
                                       text-amber-glow active:bg-amber-glow/10 min-h-[52px]
                                       font-medium border-b border-white/6">
                            <svg className="w-6 flex-shrink-0" width="16" height="16"
                              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                            </svg>
                            <span>Trang Admin</span>
                          </Link>
                        ) */}
                        <button
                          onClick={() => { logout(); setMenuOpen(false) }}
                          className="w-full flex items-center gap-3 px-4 py-3.5 text-sm
                                     text-ghost active:bg-white/5 transition-colors min-h-[52px]">
                          <svg className="w-6 text-center flex-shrink-0" width="16" height="16"
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                          <span>Đăng xuất</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <Link href="/auth/login"
                          className="flex items-center gap-3 px-4 py-3.5 text-sm text-mist
                                     active:bg-white/5 min-h-[52px]">
                          <svg className="w-6 flex-shrink-0" width="16" height="16"
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                            <polyline points="10 17 15 12 10 7" />
                            <line x1="15" y1="12" x2="3" y2="12" />
                          </svg>
                          <span>Đăng nhập</span>
                        </Link>
                        <Link href="/auth/register"
                          className="flex items-center gap-3 px-4 py-3.5 text-sm text-amber-glow
                                     active:bg-amber-glow/10 min-h-[52px] font-medium">
                          <svg className="w-6 flex-shrink-0" width="16" height="16"
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                          <span>Đăng ký miễn phí</span>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  )
}