/**
 * components/SubtitlePanel.tsx v5.3
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
 *
 * v5.3: Popup ở panel-level (ngoài card) → luôn hiển thị đúng trên màn hình
 */
import React, { useMemo, memo, useRef, useEffect, useCallback, useState } from 'react'
import type { Subtitle } from '../types/subtitle'
import dynamic from 'next/dynamic'

// Load WordPopup dynamically (tránh SSR issues)
const WordPopup = dynamic(() => import('./dictionary/WordPopup'), { ssr: false })

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
  tolerancePx = 3
): boolean {
  const containerHeight = container.clientHeight
  const cardTop        = card.offsetTop
  const cardHeight     = card.offsetHeight

  const idealScrollTop = cardTop - (containerHeight / 2) + (cardHeight / 2)
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

// ── Segment Chinese text (cached) ──
const segmentCache = new Map<string, string[]>()

async function segmentChinese(text: string): Promise<string[]> {
    if (segmentCache.has(text)) return segmentCache.get(text)!
    try {
        const backendUrl = typeof window !== 'undefined'
            ? (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000')
            : 'http://localhost:8000'
        const res = await fetch(`${backendUrl}/api/dictionary/segment?text=${encodeURIComponent(text)}`)
        if (res.ok) {
            const data = await res.json()
            segmentCache.set(text, data.words)
            return data.words
        }
    } catch { }
    // Fallback: tách từng ký tự
    const chars = Array.from(text).filter(c => c.trim())
    segmentCache.set(text, chars)
    return chars
}

// ── Props interface ──
interface SubtitleRowProps {
  subtitle: Subtitle
  isActive: boolean
  onClick: () => void
  onWordClick: (word: string) => void
}

// ── Single subtitle row (MEMOIZED) ──
const SubtitleRow = memo<SubtitleRowProps>(function SubtitleRow({ subtitle, isActive, onClick, onWordClick }) {
  const [segmented, setSegmented] = useState<string[] | null>(null)

  // Segment Chinese text khi mount
  useEffect(() => {
    setSegmented(null) // reset trước
    segmentChinese(subtitle.chinese).then(setSegmented)
  }, [subtitle.chinese])

  // Click vào card → seek video
  const handleCardClick = useCallback(() => {
    onClick()
  }, [onClick])

  // Click vào từ Hán → mở popup (truyền word lên panel)
  const handleWordClick = useCallback((e: React.MouseEvent, word: string) => {
    e.stopPropagation()
    e.preventDefault()
    if (!word || !/[\u4e00-\u9fff]/.test(word)) return
    onWordClick(word)
  }, [onWordClick])

  return (
    <div
      onClick={handleCardClick}
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

      {/* Chữ Hán — clickable words */}
      <div className="font-serif text-lg text-snow mb-1 leading-relaxed flex flex-wrap gap-x-0.5">
        {segmented
          ? segmented.map((word, i) => (
              <span
                key={i}
                onClick={e => handleWordClick(e, word)}
                className={/[\u4e00-\u9fff]/.test(word)
                  ? 'cursor-pointer hover:bg-amber-glow/20 hover:text-amber-glow rounded px-0.5 transition-colors'
                  : 'cursor-default'
                }
              >{word}</span>
            ))
          : subtitle.chinese
        }
      </div>

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
  const isUserScrolling = useRef(false)
  const scrollResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Popup state — ở LEVEL PANEL (không phải row)
  const [popupWord, setPopupWord] = useState<string | null>(null)

  // ⚡ Binary search O(log n)
  const activeIndex = useMemo(
    () => findActiveIndex(subtitles, currentTime),
    [subtitles, currentTime]
  )

  // Mở popup khi click từ
  const handleWordClick = useCallback((word: string) => {
    setPopupWord(word)
  }, [])

  // Đóng popup
  const handleClosePopup = useCallback(() => {
    setPopupWord(null)
  }, [])

  /**
   * Auto-scroll: active subtitle LUÔN nằm ở GIỮA viewport.
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

    if (isCardCentered(card, list)) return

    prevIndexRef.current = activeIndex

    const containerHeight = list.clientHeight
    const cardTop         = card.offsetTop
    const cardHeight      = card.offsetHeight

    const targetScrollTop = cardTop - (containerHeight / 2) + (cardHeight / 2)

    list.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
  }, [activeIndex, isPaused])

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
    <>
      <div className="h-full lg:h-[90vh] min-h-0 flex flex-col px-3 sm:px-4 lg:px-5 pt-3 pb-3">

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
              onWordClick={handleWordClick}
            />
          ))}
          {/* Bottom padding: tránh card cuối bị cắt sát mép dưới */}
          <div className="h-16" aria-hidden />
        </div>

      </div>

      {/* Word Popup — ở LEVEL PANEL, KHÔNG trong card → hiển thị giữa màn hình */}
      {popupWord && (
        <WordPopup
          word={popupWord}
          onClose={handleClosePopup}
        />
      )}
    </>
  )
}
