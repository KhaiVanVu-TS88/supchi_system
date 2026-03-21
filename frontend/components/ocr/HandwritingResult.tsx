/**
 * components/ocr/HandwritingResult.tsx
 * Hiển thị kết quả nhận dạng chữ viết tay
 */
import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import type { HandwritingResult } from './HandwritingCanvas'

const WordPopup = dynamic(() => import('../dictionary/WordPopup'), { ssr: false })

interface Props { result: HandwritingResult }

export default function HandwritingResult({ result }: Props) {
    const [popup, setPopup] = useState<{ word: string; rect: DOMRect } | null>(null)
    const confPct = Math.round(result.confidence * 100)

    return (
        <>
            <div className="glass rounded-2xl p-5 space-y-4 animate-slide-up">

                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-snow">Kết quả nhận dạng</h3>
                    <span className={`text-xs font-mono ${confPct >= 70 ? 'text-jade-DEFAULT' : 'text-amber-glow'}`}>
                        {confPct}%
                    </span>
                </div>

                {/* Best match — lớn và rõ */}
                <div className="text-center py-4 border-y border-white/6">
                    <button
                        onClick={e => setPopup({ word: result.best, rect: (e.target as HTMLElement).getBoundingClientRect() })}
                        className="font-serif text-6xl text-snow hover:text-amber-glow transition-colors"
                    >
                        {result.best}
                    </button>
                    <p className="text-amber-glow font-mono text-lg mt-2">{result.pinyin_full}</p>
                    <p className="text-mist text-sm mt-1">{result.vietnamese}</p>
                </div>

                {/* Candidates */}
                {result.candidates.length > 1 && (
                    <div>
                        <p className="text-[11px] text-ghost uppercase tracking-wider mb-2">
                            Gợi ý khác
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            {result.candidates.map((c, i) => (
                                <button
                                    key={i}
                                    onClick={e => setPopup({ word: c, rect: (e.target as HTMLElement).getBoundingClientRect() })}
                                    className="flex flex-col items-center gap-1 p-2 glass rounded-xl
                             hover:bg-amber-glow/10 hover:border-amber-glow/30 transition-colors
                             border border-white/6 min-w-[56px]"
                                >
                                    <span className="font-serif text-xl text-snow">{c}</span>
                                    <span className="text-[10px] text-amber-glow font-mono">{result.pinyin[i]}</span>
                                    <span className="text-[10px] text-ghost truncate max-w-[56px]">{result.meanings[i]}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {popup && (
                <WordPopup word={popup.word} anchorRect={popup.rect} onClose={() => setPopup(null)} />
            )}
        </>
    )
}