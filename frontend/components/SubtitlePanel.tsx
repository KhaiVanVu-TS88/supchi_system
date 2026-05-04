/**
 * components/SubtitlePanel.tsx v17 — Lyric list + centered active (một luồng logic mọi breakpoint)
 *
 * Mobile chỉ khác **kích thước cột** (`.app-split-video-sub` xếp dọc: video trên, panel dưới) — cùng component,
 * cùng điều kiện cuộn / căn giữa / animation như desktop.
 *
 * Cuộn: khi đổi `activeIndex`, resize, padding lyric, resume. `activeIndex` vẫn derive từ `currentTime` ở parent.
 * activeIndex < 0: không highlight, không auto-scroll.
 */
import React, {
  useMemo,
  memo,
  useRef,
  useLayoutEffect,
  useCallback,
  useState,
  useEffect,
} from 'react'
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

/**
 * Đỉnh card trong tọa độ nội dung cuộn của `list` (0 = mép trên nội dung).
 * Ưu tiên chuỗi offsetParent (ổn định với padding wrapper); nếu gãy (body…) thì fallback rect.
 */
function getCardTopInListScrollContent(list: HTMLElement, card: HTMLElement): number | null {
  let y = 0
  let el: HTMLElement | null = card
  while (el && el !== list) {
    y += el.offsetTop
    const parent = el.offsetParent as HTMLElement | null
    if (!parent || !list.contains(parent)) {
      const lr = list.getBoundingClientRect()
      const cr = card.getBoundingClientRect()
      if (lr.height < 12) return null
      return cr.top - lr.top + list.scrollTop
    }
    el = parent
  }
  return Number.isFinite(y) ? y : null
}

/** scrollTop để tâm dọc card trùng tâm vùng nhìn của list (clamp). */
function getScrollTopToCenterCard(list: HTMLElement, card: HTMLElement): number | null {
  const maxTop = Math.max(0, list.scrollHeight - list.clientHeight)
  if (list.clientHeight < 16) return null

  const cardTopInContent = getCardTopInListScrollContent(list, card)
  if (cardTopInContent === null || !Number.isFinite(cardTopInContent)) return null

  const cardH = Math.max(card.getBoundingClientRect().height, card.offsetHeight, 32)
  const cardCenter = cardTopInContent + cardH / 2
  const targetTop = cardCenter - list.clientHeight / 2
  const top = Math.max(0, Math.min(maxTop, Math.round(targetTop)))
  return Number.isFinite(top) ? top : null
}

/** `scrollTop` hiện tại khác mục tiêu căn giữa (kể cả clamp đầu/cuối) — bắt reset scroll / layout mà không đổi `activeIndex`. */
function activeCardScrollDriftFromIdeal(list: HTMLElement | null, lineIndex: number, epsilon = 10): boolean {
  if (!list || lineIndex < 0) return false
  const c =
    list.querySelector(`[data-subtitle-card][data-subtitle-index="${lineIndex}"]`) ??
    list.querySelectorAll('[data-subtitle-card]')[lineIndex]
  if (!(c instanceof HTMLElement)) return false
  const ideal = getScrollTopToCenterCard(list, c)
  if (ideal === null) return false
  return Math.abs(ideal - list.scrollTop) > epsilon
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function easeOutCubic(t: number): number {
  const u = 1 - t
  return 1 - u * u * u
}

/** Cuộn nội suy ease-out (mượt khi đổi câu; không dùng `scrollTo({ behavior:'smooth' })` trên iOS). */
function animateListScrollTo(
  list: HTMLElement,
  targetTop: number,
  durationMs: number,
  rafIdRef: React.MutableRefObject<number | null>,
) {
  if (rafIdRef.current !== null) {
    cancelAnimationFrame(rafIdRef.current)
    rafIdRef.current = null
  }
  const start = list.scrollTop
  if (Math.abs(start - targetTop) < 2) {
    list.scrollTop = targetTop
    return
  }
  const t0 = performance.now()
  const tick = (now: number) => {
    if (!list.isConnected) {
      rafIdRef.current = null
      return
    }
    const t = Math.min(1, (now - t0) / durationMs)
    list.scrollTop = Math.round(start + (targetTop - start) * easeOutCubic(t))
    if (t < 1) {
      rafIdRef.current = requestAnimationFrame(tick)
    } else {
      rafIdRef.current = null
      list.scrollTop = targetTop
    }
  }
  rafIdRef.current = requestAnimationFrame(tick)
}

function SkeletonCard() {
  return (
    <div className="rounded-xl p-4 max-xl:p-3 border border-sub-line bg-sub-card/60 space-y-3 mx-1 mb-2 max-xl:mb-1.5 shadow-sub-card">
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
  lineIndex: number
  isActive: boolean
  onClick: () => void
  onWordClick: (word: string) => void
}

const SubtitleRow = memo<SubtitleRowProps>(function SubtitleRow({ subtitle, lineIndex, isActive, onClick, onWordClick }) {
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
      data-subtitle-index={lineIndex}
      className={`
        relative rounded-xl p-4 max-xl:p-3 border cursor-pointer mb-2 max-xl:mb-1.5 mx-1
        transition-[background-color,box-shadow,border-color] duration-300 ease-out
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

      <div className="font-serif text-lg max-xl:text-base text-sub-ink mb-1 leading-relaxed flex flex-wrap gap-x-0.5">
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

      <p className="text-sm max-xl:text-[13px] font-medium text-sub-pinyin mb-1.5 max-xl:mb-1 leading-relaxed tracking-wide">{subtitle.pinyin}</p>

      <div className="h-px w-full mb-1.5 bg-sub-line" />

      <p className="text-sm max-xl:text-[13px] text-sub-muted leading-relaxed">{subtitle.vietnamese}</p>
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
  const panelRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const scrollAnimRafRef = useRef<number | null>(null)
  const prevActiveRef = useRef<number>(-2)
  const prevPausedRef = useRef(isPaused)

  const cancelScrollAnim = useCallback(() => {
    if (scrollAnimRafRef.current !== null) {
      cancelAnimationFrame(scrollAnimRafRef.current)
      scrollAnimRafRef.current = null
    }
  }, [])

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
  const [resizeKey, setResizeKey] = useState(0)
  const prevResizeKeyRef = useRef(0)
  const prevLyricPadRef = useRef(-1)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const bump = () => setResizeKey((k) => k + 1)
    window.addEventListener('resize', bump)
    window.visualViewport?.addEventListener('resize', bump)
    return () => {
      window.removeEventListener('resize', bump)
      window.visualViewport?.removeEventListener('resize', bump)
    }
  }, [])

  /** Panel height changes (flex, video, rotation): debounce to avoid ResizeObserver ↔ scroll loops */
  useEffect(() => {
    if (!subsKey || typeof ResizeObserver === 'undefined') return
    const el = panelRef.current
    if (!el) return
    let t: ReturnType<typeof setTimeout> | null = null
    const ro = new ResizeObserver(() => {
      if (t) clearTimeout(t)
      t = setTimeout(() => {
        setResizeKey((k) => k + 1)
        t = null
      }, 80)
    })
    ro.observe(el)
    return () => {
      if (t) clearTimeout(t)
      ro.disconnect()
    }
  }, [subsKey])

  /**
   * Padding trên/dưới list để câu đầu/cuối vẫn căn giữa được khi cuộn.
   * Desktop (xl): list cao ~90vh → tỉ lệ 0.38, max 280 giống “karaoke”.
   * Mobile: giảm max + tỉ lệ + clamp theo visualViewport — tránh Safari/flex đo clientHeight phình
   * → pad quá lớn → khoảng trắng khổng lồ, thẻ dồn xuống đáy (không giống hình desktop).
   */
  const [lyricPadPx, setLyricPadPx] = useState(96)
  useEffect(() => {
    if (!subsKey || typeof ResizeObserver === 'undefined') return
    const el = listRef.current
    if (!el) return
    const computePad = () => {
      const narrow =
        typeof window !== 'undefined' &&
        window.matchMedia('(max-width: 1279.98px)').matches
      let h = el.clientHeight
      if (narrow && typeof window !== 'undefined') {
        const vh = Math.floor(window.visualViewport?.height ?? window.innerHeight)
        h = Math.min(h, Math.max(160, Math.floor(vh * 0.48)))
      }
      if (h < 40) return null
      const maxPad = narrow ? 96 : 280
      const ratio = narrow ? 0.2 : 0.38
      return Math.max(40, Math.min(maxPad, Math.floor(h * ratio)))
    }
    const ro = new ResizeObserver(() => {
      const pad = computePad()
      if (pad === null) return
      setLyricPadPx((p) => (p === pad ? p : pad))
    })
    ro.observe(el)
    const pad0 = computePad()
    if (pad0 !== null) setLyricPadPx((p) => (p === pad0 ? p : pad0))
    const onVv = () => {
      const pad = computePad()
      if (pad !== null) setLyricPadPx((p) => (p === pad ? p : pad))
    }
    window.visualViewport?.addEventListener('resize', onVv)
    return () => {
      ro.disconnect()
      window.visualViewport?.removeEventListener('resize', onVv)
    }
  }, [subsKey])

  useLayoutEffect(() => {
    if (subsKey !== prevSubsKeyRef.current) {
      cancelScrollAnim()
      prevSubsKeyRef.current = subsKey
      prevActiveRef.current = -2
      prevLyricPadRef.current = -1
      const L0 = listRef.current
      if (L0) L0.scrollTop = 0
    }

    const wasPaused = prevPausedRef.current
    const resumed = wasPaused && !isPaused
    /** Vừa chuyển play → pause: luôn thử căn lại — nhánh pause idle cũ chặn trước drift, list dừn ở câu 5 mà vẫn hiện câu 1. */
    const justPaused = !wasPaused && isPaused
    prevPausedRef.current = isPaused

    const cleanupAnim = () => {
      cancelScrollAnim()
    }

    if (activeIndex < 0) {
      cancelScrollAnim()
      prevActiveRef.current = activeIndex
      prevResizeKeyRef.current = resizeKey
      return cleanupAnim
    }

    const resized = resizeKey !== prevResizeKeyRef.current

    const prev = prevActiveRef.current
    const indexChanged = activeIndex !== prev
    const lyricPadChanged = prevLyricPadRef.current !== lyricPadPx

    const L0 = listRef.current
    /**
     * Đang play: `scrollTop` lệch so với mục tiêu căn giữa (kể cả khi `activeIndex` không đổi).
     * Khi pause không kiểm tra drift liên tục (tránh giành scroll với người đang lướt tay).
     */
    const scrollDriftWhilePlaying =
      !isPaused &&
      scrollAnimRafRef.current === null &&
      activeCardScrollDriftFromIdeal(L0, activeIndex, 10)

    const shouldScroll =
      indexChanged ||
      resumed ||
      resized ||
      lyricPadChanged ||
      scrollDriftWhilePlaying ||
      justPaused

    if (!shouldScroll) {
      if (isPaused) cancelScrollAnim()
      return cleanupAnim
    }

    const idx = activeIndex

    /** Chỉ nội suy khi đổi dòng thuần (không đổi layout/padding/resume cùng lúc — tránh chồng animation). */
    const wantSmoothScroll =
      indexChanged &&
      !resized &&
      !lyricPadChanged &&
      !resumed &&
      !prefersReducedMotion()

    const durationMs = 280

    const commitScrollRefs = () => {
      prevActiveRef.current = activeIndex
      prevResizeKeyRef.current = resizeKey
      prevLyricPadRef.current = lyricPadPx
    }

    /** Chỉ commit prev* sau khi cuộn thành công — tránh Safari frame đầu rect=0 → bỏ cuộn mà vẫn advance prev → list trắng. */
    const applyScroll = (allowSmooth: boolean): boolean => {
      const L = listRef.current
      if (!L) return false
      const c =
        L.querySelector(`[data-subtitle-card][data-subtitle-index="${idx}"]`) ??
        L.querySelectorAll('[data-subtitle-card]')[idx]
      if (!(c instanceof HTMLElement)) return false
      const target = getScrollTopToCenterCard(L, c)
      if (target === null) return false
      if (allowSmooth && wantSmoothScroll && Math.abs(L.scrollTop - target) > 4) {
        animateListScrollTo(L, target, durationMs, scrollAnimRafRef)
      } else {
        cancelScrollAnim()
        L.scrollTop = target
      }
      return true
    }

    /** Cuối cùng: cùng getScrollTopToCenterCard (một nguồn sự thật). */
    const forceScrollToCard = (): boolean => {
      const L = listRef.current
      if (!L || L.clientHeight < 8) return false
      const c =
        L.querySelector(`[data-subtitle-card][data-subtitle-index="${idx}"]`) ??
        L.querySelectorAll('[data-subtitle-card]')[idx]
      if (!(c instanceof HTMLElement)) return false
      const t = getScrollTopToCenterCard(L, c)
      if (t === null) return false
      cancelScrollAnim()
      L.scrollTop = t
      return true
    }

    const finishScroll = () => {
      if (forceScrollToCard()) commitScrollRefs()
    }

    if (wantSmoothScroll) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (applyScroll(true)) {
            commitScrollRefs()
            return
          }
          if (applyScroll(false)) {
            commitScrollRefs()
            return
          }
          finishScroll()
        })
      })
    } else {
      let ok = applyScroll(false)
      queueMicrotask(() => {
        ok = applyScroll(false) || ok
      })
      requestAnimationFrame(() => {
        ok = applyScroll(false) || ok
        requestAnimationFrame(() => {
          ok = applyScroll(false) || ok
          if (ok) commitScrollRefs()
          else finishScroll()
        })
      })
    }

    return cleanupAnim
  }, [activeIndex, currentTime, isPaused, subsKey, resizeKey, lyricPadPx, cancelScrollAnim])

  if (!subtitles.length) {
    return (
      <div className="flex h-full max-xl:max-h-[min(58dvh,60vh)] w-full min-h-0 flex-col overflow-hidden bg-sub-panel px-3 pt-3 sm:px-4 xl:px-5">
        <div className="flex items-center justify-between pb-2 mb-2 flex-shrink-0">
          <div className="skeleton h-4 w-32 rounded" />
          <div className="skeleton h-4 w-16 rounded" />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
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
      <div
        ref={panelRef}
        className="flex h-full max-xl:max-h-[min(58dvh,60vh)] w-full min-h-0 flex-col overflow-hidden bg-sub-panel px-3 pt-3 pb-3 sm:px-4 xl:h-[90vh] xl:min-h-0 xl:px-5"
      >

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
          className="subtitle-lyric-scroll flex-1 min-h-0 touch-pan-y overscroll-contain [-webkit-overflow-scrolling:touch] pr-2 sm:pr-1"
        >
          <div
            className="subtitle-lyric-inner"
            style={{ ['--lyric-pad' as string]: `${lyricPadPx}px` }}
          >
            {subtitles.map((sub, idx) => (
              <SubtitleRow
                key={`${sub.start}-${sub.end}-${idx}`}
                subtitle={sub}
                lineIndex={idx}
                isActive={activeIndex >= 0 && idx === activeIndex}
                onClick={() => onSeek(sub.start)}
                onWordClick={handleWordClick}
              />
            ))}
          </div>
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
