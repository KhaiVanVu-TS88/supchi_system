/**
 * components/pronunciation/VoiceRecorder.tsx
 *
 * Ghi âm giọng nói realtime bằng MediaRecorder API.
 * Props:
 * - onRecorded(file: File): callback khi ghi xong
 * - disabled: disable nút ghi
 */
import React, { useRef, useState, useCallback } from 'react'

interface Props {
  onRecorded: (file: File) => void
  disabled?: boolean
}

export type RecorderState = 'idle' | 'recording' | 'processing'

export default function VoiceRecorder({ onRecorded, disabled }: Props) {
  const [state, setState] = useState<RecorderState>('idle')
  const [error, setError] = useState<string | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      recorder.onstop = () => {
        setState('processing')
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], 'recording.webm', { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        setState('idle')
        onRecorded(file)
      }

      recorder.start(100) // emit data every 100ms
      setState('recording')
    } catch (e) {
      if (e instanceof Error) {
        if (e.name === 'NotAllowedError') {
          setError('Không có quyền truy cập microphone. Hãy cho phép trong trình duyệt.')
        } else {
          setError(`Lỗi microphone: ${e.message}`)
        }
      } else {
        setError('Không thể truy cập microphone.')
      }
    }
  }, [onRecorded])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        {/* Recording pulse ring */}
        {state === 'recording' && (
          <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
        )}

        <button
          type="button"
          onClick={state === 'recording' ? stopRecording : startRecording}
          disabled={disabled}
          className={`
            relative w-20 h-20 rounded-full flex items-center justify-center
            transition-all duration-200 border-2
            ${state === 'recording'
              ? 'bg-red-500/20 border-red-500 text-red-400 shadow-lg shadow-red-500/30'
              : 'bg-amber-glow/15 border-amber-glow/50 text-amber-glow hover:bg-amber-glow/25'
            }
            disabled:opacity-40 disabled:cursor-not-allowed
          `}
          aria-label={state === 'recording' ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}
        >
          {state === 'idle' && (
            /* Micro icon */
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
          {state === 'recording' && (
            /* Stop square */
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          )}
          {state === 'processing' && (
            <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </div>

      <p className="text-xs text-ghost">
        {state === 'idle' && 'Nhấn để ghi âm'}
        {state === 'recording' && 'Đang ghi — nhấn để dừng'}
        {state === 'processing' && 'Đang xử lý...'}
      </p>

      {error && (
        <p className="text-xs text-red-400 text-center max-w-xs">{error}</p>
      )}
    </div>
  )
}
