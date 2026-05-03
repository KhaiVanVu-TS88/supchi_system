import { getPublicApiBase } from './api'

function getToken() {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('access_token')
}

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getToken()
    const res = await fetch(`${getPublicApiBase()}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token ?? ''}`,
            ...(options.headers as Record<string, string>),
        },
    })
    if (res.status === 401) { window.location.href = '/auth/login'; throw new Error('Unauthorized') }
    if (res.status === 403) throw new Error('Không có quyền admin')
    if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail ?? `Lỗi ${res.status}`)
    }
    if (res.status === 204) return undefined as T
    return res.json()
}

export interface AdminStats {
    total_users: number; active_users: number; admin_users: number
    total_videos: number; total_subtitles: number
    total_jobs: number; jobs_queued: number; jobs_processing: number
    jobs_done: number; jobs_failed: number
    new_users_7d: number; new_videos_7d: number
}
export interface AdminUser {
    id: number; username: string; email: string
    role: string; is_active: boolean; created_at: string
    video_count: number; job_count: number
}
export interface AdminJob {
    id: number; user_id: number; username: string
    status: string; progress: number; youtube_url: string
    title: string | null; subtitle_source: string | null
    llm_used: string | null; error_message: string | null
    created_at: string; finished_at: string | null
}
export interface AdminVideo {
    id: number; user_id: number; username: string
    video_id: string; title: string | null
    subtitle_count: number; created_at: string
}
export interface Paginated<T> {
    items: T[]; total: number; page: number
    page_size: number; total_pages: number
}

export const adminApi = {
    stats: () => adminRequest<AdminStats>('/api/admin/stats'),

    users: (p: { page?: number; search?: string; role?: string }) => {
        const q = new URLSearchParams()
        if (p.page) q.set('page', String(p.page))
        if (p.search) q.set('search', p.search)
        if (p.role) q.set('role', p.role)
        return adminRequest<Paginated<AdminUser>>(`/api/admin/users?${q}`)
    },
    updateUser: (id: number, body: { role?: string; is_active?: boolean }) =>
        adminRequest<{ ok: boolean }>(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    deleteUser: (id: number) =>
        adminRequest<void>(`/api/admin/users/${id}`, { method: 'DELETE' }),

    jobs: (p: { page?: number; status?: string }) => {
        const q = new URLSearchParams()
        if (p.page) q.set('page', String(p.page))
        if (p.status) q.set('status', p.status)
        return adminRequest<Paginated<AdminJob>>(`/api/admin/jobs?${q}`)
    },
    retryJob: (id: number) =>
        adminRequest<{ ok: boolean }>(`/api/admin/jobs/${id}/retry`, { method: 'POST' }),

    videos: (p: { page?: number; search?: string }) => {
        const q = new URLSearchParams()
        if (p.page) q.set('page', String(p.page))
        if (p.search) q.set('search', p.search)
        return adminRequest<Paginated<AdminVideo>>(`/api/admin/videos?${q}`)
    },
    deleteVideo: (id: number) =>
        adminRequest<void>(`/api/admin/videos/${id}`, { method: 'DELETE' }),
}