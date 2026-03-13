/**
 * pages/auth/login.tsx — Trang đăng nhập
 */
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import AuthForm from '../../components/auth/AuthForm'
import { useAuth } from '../../lib/auth-context'

export default function LoginPage() {
  const { login, user } = useAuth()
  const router = useRouter()
  const [error, setError]       = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)

  // Đã đăng nhập rồi → về trang chủ
  useEffect(() => { if (user) router.push('/') }, [user, router])

  const handleSubmit = async (data: Record<string, string>) => {
    setError(null)
    setLoading(true)
    try {
      await login(data.email, data.password)
      router.push('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đăng nhập thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>Đăng nhập — 學中文</title></Head>
      <AuthForm mode="login" onSubmit={handleSubmit} error={error} isLoading={isLoading} />
    </>
  )
}
