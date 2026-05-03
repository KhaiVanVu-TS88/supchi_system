/**
 * components/ocr/OcrResult.tsx
 * Hiển thị kết quả OCR: text, pinyin, dịch, từng từ có thể click tra từ điển
 */
import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import type { OcrResult } from './OcrUploader'

const WordPopup = dynamic(() => import('../dictionary/WordPopup'), { ssr: false })

interface Props { result: OcrResult }

export default function OcrResult({ result }: Props) {
    const [popup, setPopup] = useState<{ word: string; rect: DOMRect } | null>(null)

    const handleWordClick = (e: React.MouseEvent, word: string) => {
        if (!/[\u4e00-\u9fff]/.test(word)) return
        setPopup({ word, rect: (e.target as HTMLElement).getBoundingClientRect() })
    }

    const confidencePct = Math.round(result.confidence * 100)
    const confColor = confidencePct >= 80 ? 'text-jade-DEFAULT' : confidencePct >= 60 ? 'text-amber-glow' : 'text-red-400'

    return (
        <>
            <div className="glass rounded-2xl p-5 space-y-5 animate-slide-up">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-snow flex items-center gap-2">
                        <svg className="text-amber-glow" width="16" height="16" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                        Kết quả nhận dạng
                    </h3>
                    <span className={`text-xs font-mono ${confColor}`}>
                        {confidencePct}% chính xác
                    </span>
                </div>

                {/* Raw text — clickable words */}
                <div className="border-t border-gray-100 pt-4">
                    <p className="text-[11px] text-ghost uppercase tracking-wider mb-2">Văn bản nhận dạng</p>
                    <div className="font-serif text-2xl text-snow leading-loose flex flex-wrap gap-x-1">
                        {result.words.length > 0
                            ? result.words.map((w, i) => (
                                <span
                                    key={i}
                                    onClick={e => handleWordClick(e, w.word)}
                                    className="cursor-pointer hover:bg-amber-glow/20 hover:text-amber-glow
                               transition-colors rounded px-0.5"
                                    title={`${w.pinyin} — ${w.meaning}`}
                                >
                                    {w.word}
                                </span>
                            ))
                            : <span>{result.raw_text}</span>
                        }
                    </div>
                    {/* Đa dòng */}
                    {result.lines.length > 1 && (
                        <div className="mt-2 space-y-0.5">
                            {result.lines.map((line, i) => (
                                <p key={i} className="text-ghost text-xs font-mono">
                                    {i + 1}. {line}
                                </p>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pinyin */}
                <div>
                    <p className="text-[11px] text-ghost uppercase tracking-wider mb-1">Pinyin</p>
                    <p className="text-amber-glow font-mono text-base">{result.pinyin}</p>
                </div>

                {/* Vietnamese */}
                <div>
                    <p className="text-[11px] text-ghost uppercase tracking-wider mb-1">Nghĩa tiếng Việt</p>
                    <p className="text-snow text-base font-medium">{result.vietnamese}</p>
                </div>

                {/* Word breakdown */}
                {result.words.length > 0 && (
                    <div className="border-t border-gray-100 pt-4">
                        <p className="text-[11px] text-ghost uppercase tracking-wider mb-3">
                            Chi tiết từng từ
                            <span className="ml-1.5 text-amber-glow/60 normal-case">(click để tra từ điển)</span>
                        </p>
                        <div className="space-y-2">
                            {result.words.map((w, i) => (
                                <div
                                    key={i}
                                    onClick={e => handleWordClick(e, w.word)}
                                    className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 hover:bg-amber-glow/8
                             cursor-pointer transition-colors border border-transparent hover:border-amber-glow/20"
                                >
                                    <span className="font-serif text-xl text-snow w-12 text-center flex-shrink-0">
                                        {w.word}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-amber-glow font-mono text-sm">{w.pinyin}</p>
                                        <p className="text-mist text-xs truncate">{w.meaning}</p>
                                    </div>
                                    <svg className="text-ghost flex-shrink-0" width="12" height="12"
                                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Dictionary popup */}
            {popup && (
                <WordPopup word={popup.word} anchorRect={popup.rect} onClose={() => setPopup(null)} />
            )}
        </>
    )
}