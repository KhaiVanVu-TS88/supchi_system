/**
 * pages/auth/register.tsx — Trang đăng ký
 */
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import AuthForm from '../../components/auth/AuthForm'
import { useAuth } from '../../lib/auth-context'

export default function RegisterPage() {
  const { register, user } = useAuth()
  const router = useRouter()
  const [error, setError]       = useState<string | null>(null)
  const [isLoading, setLoading] = useState(false)

  useEffect(() => { if (user) router.push('/') }, [user, router])

  const handleSubmit = async (data: Record<string, string>) => {
    setError(null)
    setLoading(true)
    try {
      await register(data.username, data.email, data.password)
      router.push('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đăng ký thất bại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head><title>Đăng ký — 學中文</title></Head>
      <AuthForm mode="register" onSubmit={handleSubmit} error={error} isLoading={isLoading} />
    </>
  )
}
