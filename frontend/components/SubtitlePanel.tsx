/**
 * components/SubtitlePanel.tsx v7 — Danh sách đơn + center focus có điều kiện
 *
 * - activeIndex < 0: một list phụ đề bình thường, không highlight, không auto-scroll.
 * - activeIndex >= 0: highlight câu active; khi index đổi, nếu nằm trong “vùng giữa” thì scroll để căn card vào giữa panel.
 * - Ngoại lệ: 2 câu đầu (0,1) và 2 câu cuối — không ép căn giữa (tránh khoảng trống).
 * - Pause: không auto-scroll (user đọc list).
 *
 * Căn giữa dùng getBoundingClientRect (ổn định trên mobile).
 */
import React, { useMemo, memo, useRef, useEffect, useLayoutEffect, useCallback, useState } from 'react'
import type { Subtitle } from '../types/subtitle'
import dynamic from 'next/dynamic'

const WordPopup = dynamic(() => import('./dictionary/WordPopup'), { ssr: false })

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

function fmtTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}

/** Căn giữa chỉ khi có đủ câu (≥5) và index không thuộc 2 đầu / 2 cuối */
function shouldCenterActive(activeIndex: number, n: number): boolean {
  if (activeIndex < 0 || n < 5) return false
  if (activeIndex <= 1) return false
  if (activeIndex >= n - 2) return false
  return true
}

function scrollCardToListCenter(list: HTMLElement, card: HTMLElement, behavior: ScrollBehavior = 'smooth') {
  const lr = list.getBoundingClientRect()
  const cr = card.getBoundingClientRect()
  const delta = cr.top + cr.height / 2 - (lr.top + lr.height / 2)
  const nextTop = list.scrollTop + delta
  const maxTop = list.scrollHeight - list.clientHeight
  list.scrollTo({ top: Math.max(0, Math.min(maxTop, nextTop)), behavior })
}

function SkeletonCard() {
  return (
    <div className="rounded-xl p-4 border border-sub-line bg-sub-card/60 space-y-3 mx-1 mb-2 shadow-sub-card">
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

const segmentCache = new Map<string, string[]>()

async function segmentChinese(text: string): Promise<string[]> {
  if (segmentCache.has(text)) return segmentCache.get(text)!
  try {
    const res = await fetch(`/api/dictionary/segment?text=${encodeURIComponent(text)}`)
    if (res.ok) {
      const data = await res.json()
      segmentCache.set(text, data.words)
      return data.words
    }
  } catch { /* empty */ }
  const chars = Array.from(text).filter(c => c.trim())
  segmentCache.set(text, chars)
  return chars
}

interface SubtitleRowProps {
  subtitle: Subtitle
  isActive: boolean
  onClick: () => void
  onWordClick: (word: string) => void
}

const SubtitleRow = memo<SubtitleRowProps>(function SubtitleRow({ subtitle, isActive, onClick, onWordClick }) {
  const [segmented, setSegmented] = useState<string[] | null>(null)

  useEffect(() => {
    setSegmented(null)
    segmentChinese(subtitle.chinese).then(setSegmented)
  }, [subtitle.chinese])

  const handleCardClick = useCallback(() => {
    onClick()
  }, [onClick])

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
          ? 'bg-sub-active border-sub-accent/40 shadow-sub-active ring-1 ring-sub-accent/12'
          : 'bg-sub-card border-sub-line shadow-sub-card hover:border-sub-accent/30 hover:shadow-[0_2px_10px_rgba(0,0,0,0.04)]'
        }
      `}
    >
      {isActive && (
        <span className="absolute right-3 top-3 w-1.5 h-1.5 rounded-full bg-sub-accent animate-pulse" />
      )}

      <p className="text-[10px] font-mono text-sub-time mb-1.5 flex items-center gap-1.5 tabular-nums">
        <span>{fmtTime(subtitle.start)}</span>
        <span className="text-sub-time/45">→</span>
        <span>{fmtTime(subtitle.end)}</span>
      </p>

      <div className="font-serif text-lg text-sub-ink mb-1 leading-relaxed flex flex-wrap gap-x-0.5">
        {segmented
          ? segmented.map((word, i) => (
              <span
                key={i}
                onClick={e => handleWordClick(e, word)}
                className={/[\u4e00-\u9fff]/.test(word)
                  ? 'cursor-pointer rounded px-0.5 transition-colors hover:bg-sub-accent/12 hover:text-sub-accent'
                  : 'cursor-default'
                }
              >{word}</span>
            ))
          : subtitle.chinese
        }
      </div>

      <p className="text-sm font-medium text-sub-pinyin mb-1.5 leading-relaxed tracking-wide">{subtitle.pinyin}</p>

      <div className="h-px w-full mb-1.5 bg-sub-line" />

      <p className="text-sm text-sub-muted leading-relaxed">{subtitle.vietnamese}</p>
    </div>
  )
})

interface SubtitlePanelProps {
  subtitles: Subtitle[]
  currentTime: number
  onSeek: (time: number) => void
  isPaused?: boolean
}

export default function SubtitlePanel({
  subtitles,
  currentTime,
  onSeek,
  isPaused = false,
}: SubtitlePanelProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const prevActiveRef = useRef<number>(-2)
  const prevPausedRef = useRef(isPaused)

  const [popupWord, setPopupWord] = useState<string | null>(null)

  const activeIndex = useMemo(
    () => findActiveIndex(subtitles, currentTime),
    [subtitles, currentTime],
  )

  const subsKey = useMemo(
    () =>
      subtitles.length
        ? `${subtitles[0].start}-${subtitles[subtitles.length - 1].end}-${subtitles.length}`
        : '',
    [subtitles],
  )

  const handleWordClick = useCallback((word: string) => {
    setPopupWord(word)
  }, [])

  const handleClosePopup = useCallback(() => {
    setPopupWord(null)
  }, [])

  const prevSubsKeyRef = useRef('')

  useLayoutEffect(() => {
    if (subsKey !== prevSubsKeyRef.current) {
      prevSubsKeyRef.current = subsKey
      prevActiveRef.current = -2
    }

    if (activeIndex < 0) {
      prevActiveRef.current = activeIndex
      prevPausedRef.current = isPaused
      return
    }

    const resumed = prevPausedRef.current && !isPaused
    prevPausedRef.current = isPaused

    if (isPaused && !resumed) {
      prevActiveRef.current = activeIndex
      return
    }

    const n = subtitles.length
    if (!shouldCenterActive(activeIndex, n)) {
      prevActiveRef.current = activeIndex
      return
    }

    const indexChanged = activeIndex !== prevActiveRef.current
    if (!indexChanged && !resumed) return

    prevActiveRef.current = activeIndex

    const list = listRef.current
    if (!list) return

    const items = list.querySelectorAll<HTMLElement>('[data-subtitle-card]')
    const card = items[activeIndex]
    if (!card) return

    scrollCardToListCenter(list, card, 'smooth')
  }, [activeIndex, isPaused, subsKey])

  if (!subtitles.length) {
    return (
      <div className="flex h-full flex-col bg-sub-panel px-3 pt-3 sm:px-4 xl:px-5">
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
      <div className="h-full min-h-0 flex flex-col bg-sub-panel px-3 pt-3 pb-3 sm:px-4 xl:h-[90vh] xl:px-5">

        <div className="flex items-center justify-between pb-2 mb-2 flex-shrink-0">
          <div>
            <h2 className="text-[11px] font-medium tracking-[0.12em] uppercase text-sub-muted">
              Câu thoại
            </h2>
            {activeIndex >= 0 && (
              <p className="text-[11px] text-sub-accent mt-0.5 tabular-nums">
                {activeIndex + 1} / {subtitles.length}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono bg-sub-card border border-sub-line rounded-lg px-2 py-0.5 text-sub-time tabular-nums shadow-sub-card">
              {subtitles.length}
            </span>
            <span className="text-[11px] font-mono bg-sub-card border border-sub-line rounded-lg px-2 py-0.5 text-sub-time tabular-nums shadow-sub-card">
              {fmtTime(totalDuration)}
            </span>
          </div>
        </div>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] pr-1 stagger"
          style={{ contain: 'layout style' }}
        >
          {subtitles.map((sub, idx) => (
            <SubtitleRow
              key={`${sub.start}-${sub.end}-${idx}`}
              subtitle={sub}
              isActive={activeIndex >= 0 && idx === activeIndex}
              onClick={() => onSeek(sub.start)}
              onWordClick={handleWordClick}
            />
          ))}
          <div className="h-16 shrink-0" aria-hidden />
        </div>

      </div>

      {popupWord && (
        <WordPopup
          word={popupWord}
          onClose={handleClosePopup}
        />
      )}
    </>
  )
}
