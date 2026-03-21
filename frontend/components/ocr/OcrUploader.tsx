/**
 * components/ocr/OcrUploader.tsx
 * Upload ảnh hoặc chụp từ camera → gửi API OCR
 */
import React, { useRef, useState, useCallback } from 'react'

interface Props {
  onResult: (result: OcrResult) => void
  onLoading: (loading: boolean) => void
  isLoading: boolean
}

export interface OcrResult {
  raw_text: string
  lines: string[]
  pinyin: string
  vietnamese: string
  words: { word: string; pinyin: string; meaning: string }[]
  confidence: number
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'

export default function OcrUploader({ onResult, onLoading, isLoading }: Props) {
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const videoRef      = useRef<HTMLVideoElement>(null)
  const [preview,     setPreview]    = useState<string | null>(null)
  const [cameraOn,    setCameraOn]   = useState(false)
  const [error,       setError]      = useState<string | null>(null)
  const streamRef     = useRef<MediaStream | null>(null)

  // ── Upload file ──
  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    // Preview
    const url = URL.createObjectURL(file)
    setPreview(url)

    await submitFile(file)
  }, [])

  // ── Camera ──
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }  // Camera sau trên mobile
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }
      setCameraOn(true)
      setError(null)
    } catch {
      setError('Không thể mở camera. Hãy kiểm tra quyền truy cập.')
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  const capturePhoto = async () => {
    if (!videoRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width  = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0)

    canvas.toBlob(async (blob) => {
      if (!blob) return
      stopCamera()
      const url = URL.createObjectURL(blob)
      setPreview(url)
      const file = new File([blob], 'camera.jpg', { type: 'image/jpeg' })
      await submitFile(file)
    }, 'image/jpeg', 0.95)
  }

  // ── Submit ──
  const submitFile = async (file: File) => {
    onLoading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${BACKEND_URL}/api/ocr`, {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}`,
        },
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail ?? 'Lỗi không xác định')
      }

      const data = await res.json()
      onResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      onLoading(false)
    }
  }

  const reset = () => {
    setPreview(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      {/* Camera preview */}
      {cameraOn && (
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full max-h-64 object-cover" playsInline muted />
          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-3">
            <button
              onClick={capturePhoto}
              className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg
                         hover:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-full border-4 border-gray-800" />
            </button>
            <button
              onClick={stopCamera}
              className="px-4 py-2 bg-red-500/80 text-white rounded-xl text-sm"
            >
              Thoát
            </button>
          </div>
        </div>
      )}

      {/* Image preview */}
      {preview && !cameraOn && (
        <div className="relative rounded-xl overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="preview" className="w-full max-h-64 object-contain bg-ink-900 rounded-xl" />
          <button
            onClick={reset}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white
                       flex items-center justify-center hover:bg-black/80 transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass rounded-xl px-4 py-3 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Action buttons */}
      {!cameraOn && (
        <div className="grid grid-cols-2 gap-3">
          {/* Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="flex flex-col items-center gap-2 p-4 glass rounded-xl
                       hover:bg-white/8 transition-colors disabled:opacity-50 border border-white/6"
          >
            <svg className="text-amber-glow" width="24" height="24" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span className="text-sm text-snow">Tải ảnh lên</span>
            <span className="text-[11px] text-ghost">JPG, PNG, WEBP</span>
          </button>

          {/* Camera */}
          <button
            onClick={startCamera}
            disabled={isLoading}
            className="flex flex-col items-center gap-2 p-4 glass rounded-xl
                       hover:bg-white/8 transition-colors disabled:opacity-50 border border-white/6"
          >
            <svg className="text-amber-glow" width="24" height="24" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            <span className="text-sm text-snow">Chụp ảnh</span>
            <span className="text-[11px] text-ghost">Dùng camera</span>
          </button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-4 text-ghost text-sm">
          <svg className="animate-spin text-amber-glow" width="18" height="18"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/>
          </svg>
          Đang nhận dạng chữ...
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/bmp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
