/**
 * lib/api.ts — HTTP client tập trung
 *
 * Tự động đính kèm JWT token vào mọi request.
 * Tự động redirect về /auth/login khi token hết hạn (401).
 */

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

/** Lấy access token từ localStorage */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}

/** Lưu tokens sau khi đăng nhập */
export function saveTokens(access: string, refresh: string) {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}

/** Xoá tokens khi đăng xuất */
export function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

/** Fetch wrapper tự thêm Authorization header */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  // Token hết hạn → redirect về login
  if (res.status === 401 && typeof window !== 'undefined') {
    clearTokens()
    window.location.href = '/auth/login'
    throw new Error('Phiên đăng nhập hết hạn.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? `Lỗi ${res.status}`)
  }

  // 204 No Content — không có body
  if (res.status === 204) return undefined as T

  return res.json()
}

// ── Auth API ──
export const authApi = {
  register: (username: string, email: string, password: string) =>
    request<{ access_token: string; refresh_token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ access_token: string; refresh_token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ id: number; username: string; email: string; created_at: string }>('/api/auth/me'),
}

// ── Videos API ──
export const videosApi = {
  analyze: (url: string, title?: string) =>
    request<VideoDetail>('/api/videos/analyze', {
      method: 'POST',
      body: JSON.stringify({ url, title }),
    }),

  list: (skip = 0, limit = 20) =>
    request<VideoSummary[]>(`/api/videos?skip=${skip}&limit=${limit}`),

  get: (id: number) =>
    request<VideoDetail>(`/api/videos/${id}`),

  delete: (id: number) =>
    request<void>(`/api/videos/${id}`, { method: 'DELETE' }),
}

// ── Types ──
export interface VideoSummary {
  id: number
  youtube_url: string
  video_id: string
  title: string | null
  thumbnail_url: string | null
  subtitle_count: number
  created_at: string
}

export interface SubtitleItem {
  id: number
  start_time: number
  end_time: number
  chinese: string
  pinyin: string
  vietnamese: string
}

export interface VideoDetail extends VideoSummary {
  subtitles: SubtitleItem[]
}
