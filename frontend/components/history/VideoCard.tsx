/**
 * components/history/VideoCard.tsx
 */
import React from 'react'
import Link from 'next/link'
import type { VideoSummary } from '../../lib/api'

interface Props {
  video: VideoSummary
  onDelete: (id: number) => void
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function VideoCard({ video, onDelete }: Props) {
  return (
    <div className="sub-card flex gap-3 sm:gap-4 items-start">

      {/* Thumbnail — nhỏ hơn trên mobile */}
      <Link href={`/history/${video.id}`} className="flex-shrink-0">
        <div className="w-24 h-16 sm:w-32 sm:h-20 rounded-lg overflow-hidden bg-ink-700 relative">
          {video.thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={video.thumbnail_url}
              alt={video.title ?? 'thumbnail'}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ghost text-2xl">🎬</div>
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 active:opacity-100 transition-opacity">
            <svg className="text-white" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <Link href={`/history/${video.id}`}>
          <h3 className="text-sm font-semibold text-snow hover:text-amber-glow
                         transition-colors line-clamp-2 leading-snug">
            {video.title ?? `Video ${video.video_id}`}
          </h3>
        </Link>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          <span className="text-[10px] sm:text-[11px] font-mono text-ghost bg-white/5 px-1.5 py-0.5 rounded">
            {video.video_id}
          </span>
          <span className="text-[10px] sm:text-[11px] text-ghost flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {video.subtitle_count} câu
          </span>
          <span className="text-[10px] text-ghost/70 hidden sm:flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            {formatDate(video.created_at)}
          </span>
        </div>

        {/* Ngày — chỉ mobile, đặt riêng dòng cho dễ đọc */}
        <p className="text-[10px] text-ghost/60 mt-1 sm:hidden">
          {formatDate(video.created_at)}
        </p>
      </div>

      {/* Delete — luôn hiển thị trên mobile (không dùng hover) */}
      <button
        onClick={() => onDelete(video.id)}
        className="flex-shrink-0 text-ghost hover:text-red-400 active:text-red-400
                   transition-colors p-2 -mr-1 rounded-lg hover:bg-red-500/10
                   min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Xoá khỏi lịch sử"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6" /><path d="M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
      </button>
    </div>
  )
}