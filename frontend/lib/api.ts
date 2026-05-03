/**
 * lib/api.ts v3.2 — HTTP client + Dictionary API (multi-meaning)
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
    clearTokens(); window.location.href = '/auth/login'
    throw new Error('Phiên đăng nhập hết hạn.')
  }
  if (!res.ok) {
    // Thử parse JSON, nếu thất bại (500 HTML) → throw generic message
    let errMsg = `Lỗi ${res.status}`
    try {
      const ct = res.headers.get('content-type') ?? ''
      if (ct.includes('json')) {
        const err = await res.json()
        errMsg = err.detail ?? errMsg
      }
    } catch {
      // không parse được → dùng generic message
    }
    throw new Error(errMsg)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const authApi = {
  register: (username: string, email: string, password: string) =>
    request<TokenResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, email, password }) }),
  login: (email: string, password: string) =>
    request<TokenResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<UserInfo>('/api/auth/me'),
}

export const videosApi = {
  analyze: (url: string, title?: string, confirmLongVideo?: boolean) =>
    request<AnalyzeJobResponse>('/api/videos/analyze', {
      method: 'POST',
      body: JSON.stringify({
        url,
        ...(title !== undefined && title !== '' ? { title } : {}),
        confirm_long_video: confirmLongVideo === true,
      }),
    }),
  list: (skip = 0, limit = 20) => request<VideoSummary[]>(`/api/videos?skip=${skip}&limit=${limit}`),
  get: (id: number) => request<VideoDetail>(`/api/videos/${id}`),
  delete: (id: number) => request<void>(`/api/videos/${id}`, { method: 'DELETE' }),
  markViewed: (id: number) =>
    request<{ ok: boolean }>(`/api/videos/${id}/view`, { method: 'PATCH' }),
}

export const jobsApi = {
  get: (jobId: number) => request<JobStatus>(`/api/jobs/${jobId}`),
}

export const dictionaryApi = {
  lookup: (word: string) => request<DictionaryEntry>(`/api/dictionary?word=${encodeURIComponent(word)}`),
  segment: (text: string) => request<{ text: string; words: string[] }>(`/api/dictionary/segment?text=${encodeURIComponent(text)}`),
  audioUrl: (filename: string) => `${BASE_URL}/api/audio/${filename}`,
}

export const pronunciationApi = {
  check: async (payload: {
    userAudio: File
    videoId?: number
    sentenceId?: number
    referenceText?: string
    referencePinyin?: string
    referenceAudio?: File
  }): Promise<PronunciationCheckResponse> => {
    const token = getToken()
    const formData = new FormData()

    formData.append('user_audio', payload.userAudio)
    if (payload.videoId !== undefined) formData.append('video_id', String(payload.videoId))
    if (payload.sentenceId !== undefined) formData.append('sentence_id', String(payload.sentenceId))
    if (payload.referenceText) formData.append('reference_text', payload.referenceText)
    if (payload.referencePinyin) formData.append('reference_pinyin', payload.referencePinyin)
    if (payload.referenceAudio) formData.append('reference_audio', payload.referenceAudio)

    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${BASE_URL}/api/pronunciation/check`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (res.status === 401 && typeof window !== 'undefined') {
      clearTokens(); window.location.href = '/auth/login'
      throw new Error('Phiên đăng nhập hết hạn.')
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail ?? `Lỗi ${res.status}`)
    }

    return res.json()
  }
}

// ── Types ──
export interface TokenResponse { access_token: string; refresh_token: string }
export interface UserInfo { id: number; username: string; email: string; role: string; created_at: string }

/**
 * ⚡ AnalyzeJobResponse v4:
 * - job_id: nếu video mới → dùng để poll
 * - video_id: nếu video đã xử lý → dùng để navigate thẳng
 * - source: "new" | "cached" | "processing"
 */
export interface AnalyzeJobResponse {
  job_id: number | null
  video_id: number | null
  status: 'queued' | 'processing' | 'done' | 'needs_confirmation'
  message: string
  source: 'new' | 'cached' | 'processing' | 'confirmation_required'
  evicted_videos?: string[]
  duration_seconds?: number | null
  duration_minutes?: number | null
  threshold_minutes?: number | null
  subtitle_route?: string | null
}

export interface JobStatus {
  id: number; status: 'queued' | 'processing' | 'done' | 'failed'; progress: number
  youtube_url: string; title: string | null; subtitle_source: string | null
  llm_used: string | null; error_message: string | null; video_id: number | null
  created_at: string; finished_at: string | null
}
export interface VideoSummary { id: number; youtube_url: string; video_id: string; title: string | null; thumbnail_url: string | null; subtitle_count: number; created_at: string; last_viewed_at: string | null }
export interface SubtitleItem { id: number; start_time: number; end_time: number; chinese: string; pinyin: string; vietnamese: string }
export interface VideoDetail extends VideoSummary { subtitles: SubtitleItem[] }

export interface DictionaryEntry {
  word: string
  pinyin: string
  meanings_vi: string[]    // ĐA NGHĨA — dùng cái này để hiển thị
  meaning_vi: string       // Nghĩa đầu tiên (backward compat)
  pos: string
  grammar: string
  example: { zh: string; vi: string }
  audio_url: string
  definitions_en: string[]
}

export interface SyllableScore {
  character: string
  pinyin: string
  expected_tone: number
  user_tone: number
  tone_score: number
  initial_score: number
  final_score: number
  overall_score: number
  errors: string[]
  start_time: number
  end_time: number
}

export interface Recommendation {
  type: string
  focus: string
  message: string
  examples?: string
}

export interface PronunciationCheckResponse {
  overall_score: number
  syllable_results: SyllableScore[]
  summary: string
  recommendations: Recommendation[]
  recognized_text?: string | null
  text_similarity_score: number
  tone_score: number
  acoustic_score: number
  duration_seconds: number
}