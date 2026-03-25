interface Props { status: string }

const MAP: Record<string, { label: string; cls: string }> = {
  queued:     { label: 'Chờ',       cls: 'bg-white/10 text-ghost' },
  processing: { label: 'Đang xử lý', cls: 'bg-amber-glow/15 text-amber-glow' },
  done:       { label: 'Hoàn thành', cls: 'bg-jade/15 text-jade' },
  failed:     { label: 'Lỗi',       cls: 'bg-red-500/15 text-red-400' },
  admin:      { label: 'Admin',     cls: 'bg-amber-glow/15 text-amber-glow' },
  user:       { label: 'User',      cls: 'bg-white/8 text-ghost' },
  active:     { label: 'Hoạt động', cls: 'bg-jade/15 text-jade' },
  inactive:   { label: 'Bị khoá',   cls: 'bg-red-500/15 text-red-400' },
}

export default function Badge({ status }: Props) {
  const cfg = MAP[status] ?? { label: status, cls: 'bg-white/8 text-ghost' }
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}
