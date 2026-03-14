/**
 * lib/api.ts v3 — HTTP client với Jobs API
 */

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
}
export function saveTokens(access: string, refresh: string) {
  localStorage.setItem('access_token', access)
  localStorage.setItem('refresh_token', refresh)
}
export function clearTokens() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401 && typeof window !== 'undefined') {
    clearTokens()
    window.location.href = '/auth/login'
    throw new Error('Phiên đăng nhập hết hạn.')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? `Lỗi ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Auth API ──
export const authApi = {
  register: (username: string, email: string, password: string) =>
    request<TokenResponse>('/api/auth/register', {
      method: 'POST', body: JSON.stringify({ username, email, password }),
    }),
  login: (email: string, password: string) =>
    request<TokenResponse>('/api/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    }),
  me: () => request<UserInfo>('/api/auth/me'),
}

// ── Videos API ──
export const videosApi = {
  // v3: trả về job ngay lập tức
  analyze: (url: string, title?: string) =>
    request<AnalyzeJobResponse>('/api/videos/analyze', {
      method: 'POST', body: JSON.stringify({ url, title }),
    }),
  list: (skip = 0, limit = 20) =>
    request<VideoSummary[]>(`/api/videos?skip=${skip}&limit=${limit}`),
  get: (id: number) =>
    request<VideoDetail>(`/api/videos/${id}`),
  delete: (id: number) =>
    request<void>(`/api/videos/${id}`, { method: 'DELETE' }),
}

// ── Jobs API ──
export const jobsApi = {
  get: (jobId: number) => request<JobStatus>(`/api/jobs/${jobId}`),
}

// ── Types ──
export interface TokenResponse { access_token: string; refresh_token: string }
export interface UserInfo { id: number; username: string; email: string; created_at: string }

export interface AnalyzeJobResponse {
  job_id: number
  status: string
  message: string
}

export interface JobStatus {
  id: number
  status: 'queued' | 'processing' | 'done' | 'failed'
  progress: number      // 0–100
  youtube_url: string
  title: string | null
  subtitle_source: string | null   // "manual" | "whisper"
  llm_used: string | null
  error_message: string | null
  video_id: number | null          // set khi done
  created_at: string
  finished_at: string | null
}

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