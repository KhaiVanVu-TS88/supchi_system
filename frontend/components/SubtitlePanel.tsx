/**
 * components/SubtitlePanel.tsx
 *
 * Panel subtitle bên phải: cuộn độc lập, hiển thị danh sách SubtitleItem.
 * Chứa logic tìm subtitle đang active dựa trên currentTime.
 */

import React, { useMemo } from 'react'
import SubtitleItem from './SubtitleItem'
import type { Subtitle } from '../types/subtitle'

interface SubtitlePanelProps {
  subtitles: Subtitle[]
  currentTime: number          // Thời gian hiện tại của video (giây)
  onSeek: (time: number) => void
}

/** Skeleton loading placeholder */
function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div
      className="rounded-xl p-5 border border-white/5 space-y-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex gap-2 items-center">
        <div className="skeleton h-3 w-8 rounded"/>
        <div className="skeleton h-3 w-24 rounded"/>
      </div>
      <div className="skeleton h-7 w-3/4 rounded"/>
      <div className="skeleton h-4 w-1/2 rounded"/>
      <div className="skeleton h-px w-full"/>
      <div className="skeleton h-4 w-4/5 rounded"/>
    </div>
  )
}

export default function SubtitlePanel({ subtitles, currentTime, onSeek }: SubtitlePanelProps) {

  /**
   * Tìm index của subtitle đang active.
   * Dùng useMemo để không tính lại mỗi render nếu inputs không đổi.
   * Logic: tìm subtitle có start <= currentTime < end
   */
  const activeIndex = useMemo(() => {
    if (!subtitles.length) return -1
    return subtitles.findIndex(
      sub => currentTime >= sub.start && currentTime < sub.end
    )
  }, [subtitles, currentTime])

  // ===== LOADING STATE =====
  if (!subtitles.length) {
    return (
      <div className="h-full flex flex-col space-y-3 overflow-hidden">
        {/* Header skeleton */}
        <div className="flex items-center justify-between pb-3 border-b border-white/6 flex-shrink-0">
          <div className="skeleton h-4 w-32 rounded"/>
          <div className="skeleton h-4 w-16 rounded"/>
        </div>
        {/* Card skeletons */}
        <div className="flex-1 space-y-3 overflow-hidden">
          {[0, 80, 160, 240, 320].map(d => (
            <SkeletonCard key={d} delay={d} />
          ))}
        </div>
      </div>
    )
  }

  // Tổng thời lượng video (lấy từ subtitle cuối)
  const totalDuration = subtitles[subtitles.length - 1]?.end ?? 0
  const formatDur = (s: number) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`

  return (
    <div className="h-full flex flex-col">

      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between pb-4 border-b border-white/6 flex-shrink-0">
        <div>
          <h2 className="text-xs font-medium tracking-widest uppercase text-ghost">
            Danh sách câu thoại
          </h2>
          {activeIndex >= 0 && (
            <p className="text-[11px] text-amber-glow/70 mt-0.5 animate-fade-in">
              Câu {activeIndex + 1} / {subtitles.length}
            </p>
          )}
        </div>

        {/* Stats badges */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono bg-white/5 border border-white/8 rounded-md px-2 py-1 text-ghost">
            {subtitles.length} câu
          </span>
          <span className="text-[11px] font-mono bg-white/5 border border-white/8 rounded-md px-2 py-1 text-ghost">
            {formatDur(totalDuration)}
          </span>
        </div>
      </div>

      {/* ===== PINYIN GUIDE ===== */}
      <div className="mt-3 mb-4 flex items-start gap-2 text-[11px] text-ghost leading-relaxed flex-shrink-0">
        <span className="text-amber-glow/50 mt-0.5">📌</span>
        <span>
          Thanh điệu:&nbsp;
          <span className="text-amber-soft/80 font-mono">ā á ǎ à</span>
          &nbsp;= bằng · sắc · hỏi · huyền&nbsp;·&nbsp;Không dấu = nhẹ
          &nbsp;·&nbsp;<span className="text-jade/70">Click</span> để seek
        </span>
      </div>

      {/* ===== SUBTITLE LIST (cuộn độc lập) ===== */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 stagger">
        {subtitles.map((sub, idx) => (
          <SubtitleItem
            key={`${sub.start}-${idx}`}
            subtitle={sub}
            index={idx}
            isActive={idx === activeIndex}
            onSeek={onSeek}
          />
        ))}

        {/* Padding cuối để không bị cắt */}
        <div className="h-16" aria-hidden />
      </div>
    </div>
  )
}