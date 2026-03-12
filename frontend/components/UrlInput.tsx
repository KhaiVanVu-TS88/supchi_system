/**
 * components/UrlInput.tsx
 *
 * Component nhập URL YouTube.
 * Gồm: input field + nút "Analyze" + validation cơ bản.
 */

import React, { useState, useCallback } from 'react'
import clsx from 'clsx'

interface UrlInputProps {
    onAnalyze: (url: string) => void  // Callback khi người dùng submit URL
    isLoading: boolean                // Trạng thái đang xử lý
}

/** Kiểm tra URL có phải YouTube hợp lệ không */
function isValidYouTubeUrl(url: string): boolean {
    const patterns = [
        /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]{11}/,
        /^https?:\/\/youtu\.be\/[\w-]{11}/,
        /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]{11}/,
    ]
    return patterns.some(p => p.test(url.trim()))
}

export default function UrlInput({ onAnalyze, isLoading }: UrlInputProps) {
    const [url, setUrl] = useState('')
    const [touched, setTouched] = useState(false)   // Đã tương tác chưa

    const isValid = isValidYouTubeUrl(url)
    const showError = touched && url.length > 0 && !isValid

    const handleSubmit = useCallback(() => {
        setTouched(true)
        if (isValid) onAnalyze(url.trim())
    }, [url, isValid, onAnalyze])

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSubmit()
    }

    return (
        <div className="w-full space-y-3">
            {/* Label */}
            <label className="block text-xs font-medium tracking-widest uppercase text-ghost">
                YouTube URL
            </label>

            {/* Input row */}
            <div className="flex gap-3 items-stretch">
                {/* Input field */}
                <div className="relative flex-1">
                    {/* Icon YouTube */}
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ghost pointer-events-none">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                        </svg>
                    </span>

                    <input
                        type="url"
                        value={url}
                        onChange={e => { setUrl(e.target.value); setTouched(false) }}
                        onKeyDown={handleKeyDown}
                        onBlur={() => setTouched(true)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        disabled={isLoading}
                        className={clsx(
                            'url-input pl-10 pr-4',
                            showError && 'border-red-500/50 focus:border-red-500/70',
                            isLoading && 'opacity-60 cursor-not-allowed'
                        )}
                        aria-label="Nhập URL video YouTube"
                        aria-invalid={showError}
                    />

                    {/* Checkmark khi URL hợp lệ */}
                    {isValid && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-jade animate-fade-in">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </span>
                    )}
                </div>

                {/* Nút Analyze */}
                <button
                    onClick={handleSubmit}
                    disabled={isLoading || (!isValid && touched && url.length > 0)}
                    className="btn-primary flex items-center gap-2 whitespace-nowrap"
                    aria-label="Phân tích video"
                >
                    {isLoading ? (
                        <>
                            {/* Spinner */}
                            <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                            </svg>
                            Đang xử lý...
                        </>
                    ) : (
                        <>
                            {/* Icon wand/magic */}
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72" />
                                <path d="m14 7 3 3" /><path d="M5 6v4" /><path d="M19 14v4" /><path d="M10 2v2" /><path d="M7 8H3" /><path d="M21 16h-4" /><path d="M11 3H9" />
                            </svg>
                            Phân tích
                        </>
                    )}
                </button>
            </div>

            {/* Error message */}
            {showError && (
                <p className="text-xs text-red-400/80 animate-fade-in flex items-center gap-1.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    URL không hợp lệ. Hãy dán đúng link YouTube.
                </p>
            )}
        </div>
    )
}