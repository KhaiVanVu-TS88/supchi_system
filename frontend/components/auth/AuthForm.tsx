/**
 * components/auth/AuthForm.tsx
 */
import React, { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'

interface Field { name: string; label: string; type: string; placeholder: string }
interface AuthFormProps {
  mode: 'login' | 'register'
  onSubmit: (data: Record<string, string>) => Promise<void>
  error: string | null
  isLoading: boolean
}

const LOGIN_FIELDS: Field[] = [
  { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
  { name: 'password', label: 'Mật khẩu', type: 'password', placeholder: '••••••••' },
]
const REGISTER_FIELDS: Field[] = [
  { name: 'username', label: 'Tên đăng nhập', type: 'text', placeholder: 'nguyenvana' },
  { name: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
  { name: 'password', label: 'Mật khẩu', type: 'password', placeholder: 'Ít nhất 6 ký tự' },
]

export default function AuthForm({ mode, onSubmit, error, isLoading }: AuthFormProps) {
  const fields = mode === 'login' ? LOGIN_FIELDS : REGISTER_FIELDS
  const [values, setValues] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSubmit(values)
  }

  return (
    /* Căn giữa, full height, safe area */
    <div className="min-h-screen min-h-dvh flex items-center justify-center
                    px-4 py-10 pt-safe pb-safe">
      <div className="w-full max-w-sm sm:max-w-md">

        {/* Logo */}
        <div className="text-center mb-8 sm:mb-10">
          <span className="text-5xl sm:text-6xl select-none">🈶</span>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-snow mt-3">學中文</h1>
          <p className="text-ghost text-sm mt-1">
            {mode === 'login' ? 'Đăng nhập để tiếp tục học' : 'Tạo tài khoản miễn phí'}
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-6 sm:p-8 border border-white/8">
          <h2 className="text-lg font-semibold text-snow mb-5 sm:mb-6">
            {mode === 'login' ? 'Đăng nhập' : 'Đăng ký tài khoản'}
          </h2>

          {error && (
            <div className="mb-5 flex items-start gap-2.5 bg-red-500/10 border
                            border-red-500/25 rounded-xl px-4 py-3">
              <svg className="text-red-400 flex-shrink-0 mt-0.5" width="15" height="15"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(f => (
              <div key={f.name}>
                <label className="block text-xs font-medium text-ghost mb-1.5 tracking-wide">
                  {f.label}
                </label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={values[f.name] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                  required
                  disabled={isLoading}
                  autoComplete={f.name === 'password' ? 'current-password' : f.name}
                  className={clsx(
                    'url-input',
                    isLoading && 'opacity-60 cursor-not-allowed'
                  )}
                />
              </div>
            ))}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full mt-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin mr-2" width="16" height="16" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                  </svg>
                  Đang xử lý...
                </>
              ) : (
                mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'
              )}
            </button>
          </form>
        </div>

        {/* Switch mode */}
        <p className="text-center text-sm text-ghost mt-5">
          {mode === 'login' ? (
            <>Chưa có tài khoản?{' '}
              <Link href="/auth/register" className="text-amber-glow hover:underline">
                Đăng ký miễn phí
              </Link>
            </>
          ) : (
            <>Đã có tài khoản?{' '}
              <Link href="/auth/login" className="text-amber-glow hover:underline">
                Đăng nhập
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  )
}