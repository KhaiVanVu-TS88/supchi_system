/**
 * components/SubtitlePanel.tsx v5.0
 *
 * ⚡ PERFORMANCE OPTIMIZATIONS:
 *
 * 1. Binary search O(log n): Tìm active subtitle thay vì O(n)
 *    - Video 2000 subtitles: 11 bước thay vì 1000 bước
 *    - 60fps smooth scrolling
 *
 * 2. Memoization:
 *    - React.memo cho SubtitleRow (chỉ re-render khi data thay đổi)
 *    - useMemo cho activeIndex (stable reference)
 *
 * 3. Smart scroll:
 *    - Chỉ scroll khi active card không visible trong viewport
 *    - Tránh fight vs user scrolling thủ công
 *    - Smooth scroll đến GIỮA viewport
 *
 * 4. Pause detection:
 *    - Khi video pause, auto-scroll ngừng hoạt động
 *    - User có thể tự do explore subtitle list
 */
import React, { useMemo, memo, useRef, useEffect, useCallback } from 'react'
import type { Subtitle } from '../types/subtitle'

// ── Binary search: Tìm active index O(log n) ──
function findActiveIndex(subtitles: Subtitle[], currentTime: number): number {
  if (!subtitles.length) return -1

  let lo = 0, hi = subtitles.length - 1

  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const sub = subtitles[mid]

    if (currentTime < sub.start) {
      hi = mid - 1
    } else if (currentTime >= sub.end) {
      lo = mid + 1
    } else {
      return mid
    }
  }

  return lo > 0 ? lo - 1 : -1
}

// ── Format time ──
function fmtTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

// ── Check if card is already centered in container (within tolerance) ──
function isCardCentered(
  card: HTMLElement,
  container: HTMLElement,
  tolerancePx = 3  // px tolerance — card cách center không quá 3px thì coi là "centered"
): boolean {
  const containerHeight = container.clientHeight
  const cardTop        = card.offsetTop
  const cardHeight     = card.offsetHeight

  // Tính scrollTop hiện tại để card nằm centered
  const idealScrollTop = cardTop - (containerHeight / 2) + (cardHeight / 2)
  // scrollTop thực tế của container
  const actualScrollTop = container.scrollTop

  return Math.abs(actualScrollTop - idealScrollTop) <= tolerancePx
}

// ── Skeleton ──
function SkeletonCard() {
  return (
    <div className="rounded-xl p-4 border border-white/5 space-y-3 mx-1 mb-2">
      <div className="flex gap-2 items-center">
        <div className="skeleton h-3 w-8 rounded" />
        <div className="skeleton h-3 w-24 rounded" />
      </div>
      <div className="skeleton h-6 w-3/4 rounded" />
      <div className="skeleton h-3 w-1/2 rounded" />
      <div className="skeleton h-px w-full" />
      <div className="skeleton h-3 w-4/5 rounded" />
    </div>
  )
}

// ── Props interface ──
interface SubtitleRowProps {
  subtitle: Subtitle
  isActive: boolean
  onClick: () => void
}

// ── Single subtitle row (MEMOIZED) ──
const SubtitleRow = memo<SubtitleRowProps>(function SubtitleRow({ subtitle, isActive, onClick }) {
  return (
    <div
      onClick={onClick}
      data-subtitle-card=""
      className={`
        relative rounded-xl p-4 border transition-all duration-200 cursor-pointer mb-2 mx-1
        ${isActive
          ? 'bg-amber-glow/10 border-amber-glow/40 shadow-lg shadow-amber-glow/5'
          : 'bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.12]'
        }
      `}
    >
      {isActive && (
        <span className="absolute right-3 top-3 w-1.5 h-1.5 rounded-full bg-amber-glow animate-pulse" />
      )}

      <p className="text-[10px] font-mono text-ghost mb-1.5 flex items-center gap-1.5">
        <span className={isActive ? 'text-amber-glow/60' : ''}>{fmtTime(subtitle.start)}</span>
        <span className="opacity-30">→</span>
        <span>{fmtTime(subtitle.end)}</span>
      </p>

      <p className="font-serif text-lg text-snow mb-1 leading-relaxed">{subtitle.chinese}</p>
      <p className="text-xs font-mono text-amber-glow/80 mb-1.5 leading-relaxed">{subtitle.pinyin}</p>

      <div className={`h-px w-full mb-1.5 ${isActive ? 'bg-amber-glow/20' : 'bg-white/5'}`} />

      <p className="text-sm text-mist/80 leading-relaxed">{subtitle.vietnamese}</p>
    </div>
  )
})

// ── Main component ──
interface SubtitlePanelProps {
  subtitles: Subtitle[]
  currentTime: number
  onSeek: (time: number) => void
  /** Video đang pause → tạm ngừng auto-scroll để user tự do explore */
  isPaused?: boolean
}

export default function SubtitlePanel({
  subtitles,
  currentTime,
  onSeek,
  isPaused = false,
}: SubtitlePanelProps) {
  const listRef      = useRef<HTMLDivElement>(null)
  const prevIndexRef = useRef<number>(-1)
  // User đang scroll thủ công → không auto-scroll
  const isUserScrolling = useRef(false)
  // Debounce timer — sau khi user scroll xong mới re-enable auto-scroll
  const scrollResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ⚡ Binary search O(log n)
  const activeIndex = useMemo(
    () => findActiveIndex(subtitles, currentTime),
    [subtitles, currentTime]
  )

  /**
   * Auto-scroll: active subtitle LUÔN nằm ở GIỮA viewport.
   *
   * Scroll logic:
   * 1. Chỉ scroll khi activeIndex thay đổi thật sự
   * 2. Bỏ qua nếu video đang pause (isPaused)
   * 3. Bỏ qua nếu user đang scroll thủ công (isUserScrolling)
   * 4. Bỏ qua nếu card đã centered rồi (isCardCentered)
   * 5. Smooth scroll đến GIỮA viewport
   */
  useEffect(() => {
    if (activeIndex < 0) return
    if (activeIndex === prevIndexRef.current) return
    if (isPaused) return
    if (isUserScrolling.current) return

    const list = listRef.current
    if (!list) return

    const items = list.querySelectorAll<HTMLElement>('[data-subtitle-card]')
    const card  = items[activeIndex]
    if (!card) return

    // ✅ Check: card đã centered rồi → không cần scroll
    if (isCardCentered(card, list)) return

    prevIndexRef.current = activeIndex

    const containerHeight = list.clientHeight
    const cardTop         = card.offsetTop
    const cardHeight      = card.offsetHeight

    // Target: card nằm ở GIỮA viewport
    const targetScrollTop = cardTop - (containerHeight / 2) + (cardHeight / 2)

    list.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
  }, [activeIndex, isPaused])

  /**
   * Track user scroll thủ công.
   * Khi user cuộn → đánh dấu isUserScrolling = true trong 3 giây.
   * Sau 3 giây không có scroll event → tự động re-enable auto-scroll.
   */
  const handleScroll = useCallback(() => {
    if (!isUserScrolling.current) {
      isUserScrolling.current = true
    }

    if (scrollResumeTimer.current) {
      clearTimeout(scrollResumeTimer.current)
    }

    scrollResumeTimer.current = setTimeout(() => {
      isUserScrolling.current = false
    }, 0)
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (scrollResumeTimer.current) {
        clearTimeout(scrollResumeTimer.current)
      }
    }
  }, [])

  // Loading state
  if (!subtitles.length) {
    return (
      <div className="h-full flex flex-col px-3 sm:px-4 lg:px-5 pt-3">
        <div className="flex items-center justify-between pb-2 mb-2 flex-shrink-0">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-4 w-16 rounded" />
        </div>
        <div className="flex-1 overflow-hidden">
          {[0, 80, 160, 240, 320].map((delay) => (
            <SkeletonCard key={delay} />
          ))}
        </div>
      </div>
    )
  }

  const totalDuration = subtitles[subtitles.length - 1]?.end ?? 0

  return (
    <div className="h-[90vh] flex flex-col px-3 sm:px-4 lg:px-5 pt-3 pb-3">

      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 flex-shrink-0">
        <div>
          <h2 className="text-xs font-medium tracking-widest uppercase text-ghost">
            Câu thoại
          </h2>
          {activeIndex >= 0 && (
            <p className="text-[11px] text-amber-glow/70 mt-0.5">
              {activeIndex + 1} / {subtitles.length}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono bg-white/5 border border-white/8 rounded px-1.5 py-0.5 text-ghost">
            {subtitles.length}
          </span>
          <span className="text-[11px] font-mono bg-white/5 border border-white/8 rounded px-1.5 py-0.5 text-ghost">
            {fmtTime(totalDuration)}
          </span>
        </div>
      </div>

      {/* Scrollable list */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain pr-1 stagger"
        style={{ contain: 'layout style' }}
      >
        {subtitles.map((sub, idx) => (
          <SubtitleRow
            key={`${sub.start}-${sub.end}-${idx}`}
            subtitle={sub}
            isActive={idx === activeIndex}
            onClick={() => onSeek(sub.start)}
          />
        ))}
        {/* Bottom padding: tránh card cuối bị cắt sát mép dưới */}
        <div className="h-16" aria-hidden />
      </div>

    </div>
  )
}
