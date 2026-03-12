/**
 * components/SubtitleItem.tsx
 *
 * Một dòng subtitle gồm 3 tầng:
 *  1. Chữ Hán (to, bold, font Noto Serif SC)
 *  2. Pinyin (italic, màu amber)
 *  3. Tiếng Việt (nhỏ hơn, màu mờ)
 *
 * Khi active: highlight vàng + pulse dot + scroll vào viewport
 */

import React, { useRef, useEffect } from 'react'
import clsx from 'clsx'
import type { Subtitle } from '../types/subtitle'

interface SubtitleItemProps {
    subtitle: Subtitle
    index: number
    isActive: boolean
    onSeek: (time: number) => void   // Click → seek video
}

/** Format giây thành MM:SS */
function formatTime(secs: number): string {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function SubtitleItem({ subtitle, index, isActive, onSeek }: SubtitleItemProps) {
    const cardRef = useRef<HTMLDivElement>(null)

    /**
     * Auto-scroll: khi isActive thay đổi sang true,
     * cuộn card vào giữa vùng nhìn thấy của panel.
     */
    useEffect(() => {
        if (isActive && cardRef.current) {
            cardRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',    // Giữ card ở trung tâm vùng hiển thị
            })
        }
    }, [isActive])

    return (
        <div
            ref={cardRef}
            role="button"
            tabIndex={0}
            aria-label={`Câu ${index + 1}: ${subtitle.chinese}`}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => onSeek(subtitle.start)}
            onKeyDown={e => e.key === 'Enter' && onSeek(subtitle.start)}
            className={clsx(
                'sub-card animate-slide-up',
                isActive && 'sub-card-active'
            )}
        >
            {/* ===== HEADER: timestamp + index ===== */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {/* Số thứ tự */}
                    <span className={clsx(
                        'text-[10px] font-mono font-medium w-5 h-5 rounded flex items-center justify-center transition-colors',
                        isActive
                            ? 'bg-amber-glow/20 text-amber-glow'
                            : 'bg-white/5 text-ghost'
                    )}>
                        {index + 1}
                    </span>

                    {/* Timestamp */}
                    <span className={clsx(
                        'text-[11px] font-mono tracking-wider transition-colors',
                        isActive ? 'text-amber-glow/80' : 'text-ghost'
                    )}>
                        {formatTime(subtitle.start)} → {formatTime(subtitle.end)}
                    </span>
                </div>

                {/* Pulse dot khi đang active */}
                {isActive && (
                    <span className="flex items-center gap-1.5 text-amber-glow animate-fade-in">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-glow opacity-60" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-glow" />
                        </span>
                        <span className="text-[10px] font-medium tracking-wider uppercase">Now</span>
                    </span>
                )}
            </div>

            {/* ===== CHỮ HÁN ===== */}
            <p className={clsx(
                'font-serif text-2xl leading-relaxed mb-1 transition-colors select-text',
                isActive ? 'text-snow' : 'text-snow/90'
            )}>
                {subtitle.chinese}
            </p>

            {/* ===== PINYIN ===== */}
            <p className={clsx(
                'font-sans text-sm italic tracking-wide mb-2.5 transition-colors select-text',
                isActive ? 'text-amber-soft' : 'text-amber-soft/70'
            )}>
                {subtitle.pinyin}
            </p>

            {/* Divider mờ */}
            <div className={clsx(
                'h-px mb-2.5 transition-colors',
                isActive ? 'bg-white/10' : 'bg-white/5'
            )} />

            {/* ===== TIẾNG VIỆT ===== */}
            <p className={clsx(
                'font-sans text-sm leading-relaxed transition-colors select-text',
                isActive ? 'text-snow/80' : 'text-mist/70'
            )}>
                <span className="text-jade/60 mr-1.5 not-italic text-xs">🇻🇳</span>
                {subtitle.vietnamese}
            </p>
        </div>
    )
}