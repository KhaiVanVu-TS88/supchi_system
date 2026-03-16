/**
 * components/SubtitleItem.tsx v3.1
 * Subtitle card với clickable words → tra từ điển
 */
import React, { useRef, useEffect, useState, useCallback } from 'react'
import clsx from 'clsx'
import type { Subtitle } from '../types/subtitle'
import dynamic from 'next/dynamic'

// Load WordPopup dynamically (tránh SSR issues)
const WordPopup = dynamic(() => import('./dictionary/WordPopup'), { ssr: false })

interface Props {
    index: number
    subtitle: Subtitle
    isActive: boolean
    onClick: () => void
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
}

const segmentCache = new Map<string, string[]>()

async function segmentChinese(text: string): Promise<string[]> {
    if (segmentCache.has(text)) return segmentCache.get(text)!
    try {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
        const res = await fetch(`${backendUrl}/api/dictionary/segment?text=${encodeURIComponent(text)}`)
        if (res.ok) {
            const data = await res.json()
            segmentCache.set(text, data.words)
            return data.words
        }
    } catch { }
    const chars = Array.from(text)
    segmentCache.set(text, chars)
    return chars
}

export default function SubtitleItem({ subtitle, isActive, onClick }: Props) {
    const ref = useRef<HTMLDivElement>(null)
    const [segmented, setSegmented] = useState<string[] | null>(null)
    const [popup, setPopup] = useState<{ word: string; rect: DOMRect } | null>(null)

    useEffect(() => {
        if (isActive && ref.current) {
            ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [isActive])

    useEffect(() => {
        segmentChinese(subtitle.chinese).then(setSegmented)
    }, [subtitle.chinese])

    const handleWordClick = useCallback((e: React.MouseEvent, word: string) => {
        e.stopPropagation()
        if (!word || !/[\u4e00-\u9fff]/.test(word)) return
        setPopup({ word, rect: (e.target as HTMLElement).getBoundingClientRect() })
    }, [])

    return (
        <>
            <div ref={ref} onClick={onClick} className={clsx('sub-card animate-slide-up', isActive && 'sub-card-active')}>
                {isActive && <span className="absolute right-3 top-3 w-1.5 h-1.5 rounded-full bg-amber-glow animate-pulse" />}
                <p className="text-[10px] font-mono text-ghost mb-2">{formatTime(subtitle.start)}</p>

                {/* Chinese — segmented clickable words */}
                <div className="font-serif text-xl text-snow mb-1 leading-relaxed flex flex-wrap gap-x-0.5">
                    {segmented ? segmented.map((word, i) => (
                        <span
                            key={i}
                            onClick={e => handleWordClick(e, word)}
                            className={clsx(
                                'transition-colors rounded px-0.5',
                                /[\u4e00-\u9fff]/.test(word)
                                    ? 'cursor-pointer hover:bg-amber-glow/20 hover:text-amber-glow'
                                    : 'cursor-default'
                            )}
                        >{word}</span>
                    )) : subtitle.chinese}
                </div>

                <p className="text-xs font-mono text-amber-glow/80 mb-1.5 leading-relaxed">{subtitle.pinyin}</p>
                <p className="text-sm text-mist leading-relaxed">{subtitle.vietnamese}</p>
            </div>

            {popup && (
                <WordPopup word={popup.word} anchorRect={popup.rect} onClose={() => setPopup(null)} />
            )}
        </>
    )
}