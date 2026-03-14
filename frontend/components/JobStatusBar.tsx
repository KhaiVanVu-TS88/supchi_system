/**
 * components/JobStatusBar.tsx
 *
 * Hiển thị tiến trình xử lý video realtime.
 * Poll /api/jobs/{jobId} mỗi 3 giây cho đến khi done hoặc failed.
 *
 * Props:
 *   jobId      — ID của job đang chạy
 *   onDone     — callback khi job hoàn thành, nhận video_id
 *   onFailed   — callback khi job thất bại, nhận error message
 */
import React, { useEffect, useRef, useState } from 'react'
import { jobsApi, type JobStatus } from '../lib/api'

interface Props {
  jobId: number
  onDone: (videoId: number) => void
  onFailed: (error: string) => void
}

const STAGE_LABELS: Record<string, string> = {
  queued:     'Đang chờ trong hàng đợi...',
  processing: 'Đang xử lý video...',
  done:       'Hoàn thành!',
  failed:     'Xử lý thất bại',
}

const SOURCE_LABELS: Record<string, string> = {
  manual:  '📋 Dùng subtitle gốc YouTube',
  whisper: '🎙️ Nhận dạng giọng nói AI',
}

export default function JobStatusBar({ jobId, onDone, onFailed }: Props) {
  const [job, setJob]         = useState<JobStatus | null>(null)
  const [dots, setDots]       = useState('.')
  const intervalRef           = useRef<ReturnType<typeof setInterval> | null>(null)
  const dotsRef               = useRef<ReturnType<typeof setInterval> | null>(null)

  // Animated dots
  useEffect(() => {
    dotsRef.current = setInterval(() => {
      setDots(d => d.length >= 3 ? '.' : d + '.')
    }, 500)
    return () => { if (dotsRef.current) clearInterval(dotsRef.current) }
  }, [])

  // Poll job status
  useEffect(() => {
    const poll = async () => {
      try {
        const data = await jobsApi.get(jobId)
        setJob(data)

        if (data.status === 'done') {
          clearInterval(intervalRef.current!)
          setTimeout(() => onDone(data.video_id!), 800)
        } else if (data.status === 'failed') {
          clearInterval(intervalRef.current!)
          onFailed(data.error_message ?? 'Xử lý thất bại.')
        }
      } catch (e) {
        // Lỗi network — tiếp tục poll
      }
    }

    poll() // Gọi ngay lần đầu
    intervalRef.current = setInterval(poll, 3000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [jobId, onDone, onFailed])

  if (!job) {
    return (
      <div className="glass rounded-2xl p-6 animate-pulse">
        <div className="h-4 skeleton rounded w-1/2 mb-3" />
        <div className="h-2 skeleton rounded w-full" />
      </div>
    )
  }

  const progress = job.progress
  const isBusy   = job.status === 'queued' || job.status === 'processing'

  return (
    <div className="glass rounded-2xl p-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {isBusy && (
            <span className="inline-block w-2 h-2 rounded-full bg-amber-glow animate-ping" />
          )}
          <span className="text-sm font-medium text-snow">
            {STAGE_LABELS[job.status]}{isBusy ? dots : ''}
          </span>
        </div>
        <span className="text-xs font-mono text-amber-glow font-bold">
          {Math.round(progress)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/6 rounded-full overflow-hidden mb-4">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${progress}%`,
            background: job.status === 'failed'
              ? 'rgb(239,68,68)'
              : 'linear-gradient(90deg, #f5c842, #f0a855)',
          }}
        />
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-ghost">
        <span className="font-mono bg-white/5 px-2 py-0.5 rounded">
          job #{job.id}
        </span>

        {job.subtitle_source && (
          <span>{SOURCE_LABELS[job.subtitle_source] ?? job.subtitle_source}</span>
        )}

        {job.llm_used === 'yes' && (
          <span className="text-jade-DEFAULT">✨ LLM enhanced</span>
        )}

        {job.status === 'failed' && job.error_message && (
          <span className="text-red-400 ml-auto">{job.error_message}</span>
        )}
      </div>
    </div>
  )
}
