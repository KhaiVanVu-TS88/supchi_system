/**
 * lib/auth-context.tsx — Global authentication state
 *
 * Cung cấp user info, login/logout/register cho toàn app qua Context.
 */
'use client'
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { authApi, saveTokens, clearTokens, getToken } from './api'

interface User { id: number; username: string; email: string }

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Khôi phục session khi tải trang
  useEffect(() => {
    const token = getToken()
    if (!token) { setIsLoading(false); return }
    authApi.me()
      .then(setUser)
      .catch(clearTokens)
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { access_token, refresh_token } = await authApi.login(email, password)
    saveTokens(access_token, refresh_token)
    const me = await authApi.me()
    setUser(me)
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    const { access_token, refresh_token } = await authApi.register(username, email, password)
    saveTokens(access_token, refresh_token)
    const me = await authApi.me()
    setUser(me)
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
    window.location.href = '/auth/login'
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
