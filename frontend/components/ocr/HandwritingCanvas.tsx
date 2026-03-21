/**
 * components/ocr/HandwritingCanvas.tsx
 * Canvas vẽ chữ viết tay + gửi API nhận dạng
 *
 * UX:
 *   - Nền tối, bút trắng (giống bảng đen)
 *   - Nét bút mượt dùng quadratic bezier
 *   - Nhận dạng tự động sau 1.5s không vẽ (debounce)
 *   - Nút Xoá + Nhận dạng thủ công
 */
import React, { useRef, useEffect, useState, useCallback } from 'react'

interface Props {
    onResult: (result: HandwritingResult) => void
    onLoading: (loading: boolean) => void
    isLoading: boolean
}

export interface HandwritingResult {
    candidates: string[]
    best: string
    pinyin: string[]
    pinyin_full: string
    meanings: string[]
    vietnamese: string
    confidence: number
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
const CANVAS_W = 400
const CANVAS_H = 300
const AUTO_RECOGNIZE_DELAY = 1500  // ms sau khi ngừng vẽ

export default function HandwritingCanvas({ onResult, onLoading, isLoading }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isDrawingRef = useRef(false)
    const lastPosRef = useRef({ x: 0, y: 0 })
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [isEmpty, setIsEmpty] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // ── Init canvas ──
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 8
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
    }, [])

    // ── Get canvas position (handle mobile) ──
    const getPos = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current!
        const rect = canvas.getBoundingClientRect()
        const scaleX = CANVAS_W / rect.width
        const scaleY = CANVAS_H / rect.height

        if ('touches' in e) {
            const t = e.touches[0]
            return {
                x: (t.clientX - rect.left) * scaleX,
                y: (t.clientY - rect.top) * scaleY,
            }
        }
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY,
        }
    }

    // ── Draw ──
    const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault()
        isDrawingRef.current = true
        lastPosRef.current = getPos(e)
        setIsEmpty(false)
        setError(null)
        if (timerRef.current) clearTimeout(timerRef.current)
    }, [])

    const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault()
        if (!isDrawingRef.current) return
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!
        const pos = getPos(e)

        ctx.beginPath()
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
        // Bezier curve cho nét mượt
        const mx = (lastPosRef.current.x + pos.x) / 2
        const my = (lastPosRef.current.y + pos.y) / 2
        ctx.quadraticCurveTo(lastPosRef.current.x, lastPosRef.current.y, mx, my)
        ctx.stroke()

        lastPosRef.current = pos
    }, [])

    const endDraw = useCallback(() => {
        if (!isDrawingRef.current) return
        isDrawingRef.current = false

        // Auto-recognize sau delay
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
            handleRecognize()
        }, AUTO_RECOGNIZE_DELAY)
    }, [])

    // ── Xoá ──
    const handleClear = () => {
        const canvas = canvasRef.current!
        const ctx = canvas.getContext('2d')!
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
        setIsEmpty(true)
        setError(null)
        if (timerRef.current) clearTimeout(timerRef.current)
    }

    // ── Nhận dạng ──
    const handleRecognize = useCallback(async () => {
        const canvas = canvasRef.current
        if (!canvas) return

        onLoading(true)
        setError(null)

        try {
            const imageData = canvas.toDataURL('image/png')

            const res = await fetch(`${BACKEND_URL}/api/handwriting`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
                },
                body: JSON.stringify({ image_data: imageData }),
            })

            if (!res.ok) {
                const err = await res.json()
                throw new Error(err.detail ?? 'Lỗi không xác định')
            }

            const data = await res.json()
            onResult(data)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Lỗi nhận dạng')
        } finally {
            onLoading(false)
        }
    }, [onResult, onLoading])

    return (
        <div className="space-y-3">
            {/* Hint */}
            <p className="text-[11px] text-ghost text-center">
                Vẽ chữ Hán lên bảng • Tự động nhận dạng sau {AUTO_RECOGNIZE_DELAY / 1000}s
            </p>

            {/* Canvas */}
            <div className="relative rounded-xl overflow-hidden border border-white/10">
                <canvas
                    ref={canvasRef}
                    width={CANVAS_W}
                    height={CANVAS_H}
                    className="w-full cursor-crosshair touch-none"
                    style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                />

                {/* Guide text khi canvas trống */}
                {isEmpty && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="text-center">
                            <p className="font-serif text-6xl text-white/10 select-none">写</p>
                            <p className="text-ghost/50 text-xs mt-1">Vẽ chữ ở đây</p>
                        </div>
                    </div>
                )}

                {/* Loading overlay */}
                {isLoading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <svg className="animate-spin text-amber-glow" width="32" height="32"
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                        </svg>
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="glass rounded-xl px-3 py-2 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
                <button
                    onClick={handleClear}
                    disabled={isEmpty || isLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 glass rounded-xl
                     text-ghost hover:text-snow transition-colors disabled:opacity-40 text-sm
                     border border-white/6 hover:border-white/15"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                    </svg>
                    Xoá
                </button>
                <button
                    onClick={handleRecognize}
                    disabled={isEmpty || isLoading}
                    className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5 text-sm
                     disabled:opacity-40"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    Nhận dạng
                </button>
            </div>
        </div>
    )
}