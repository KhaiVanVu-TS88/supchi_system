interface Props {
  page: number; total_pages: number
  onChange: (p: number) => void
}
export default function Pagination({ page, total_pages, onChange }: Props) {
  if (total_pages <= 1) return null
  return (
    <div className="flex items-center gap-2 justify-end mt-4">
      <button onClick={() => onChange(page - 1)} disabled={page === 1}
        className="px-3 py-1.5 text-xs glass rounded-lg border border-white/8
                   text-ghost hover:text-snow disabled:opacity-30 transition-colors">
        ← Trước
      </button>
      <span className="text-xs text-ghost font-mono">
        {page} / {total_pages}
      </span>
      <button onClick={() => onChange(page + 1)} disabled={page === total_pages}
        className="px-3 py-1.5 text-xs glass rounded-lg border border-white/8
                   text-ghost hover:text-snow disabled:opacity-30 transition-colors">
        Tiếp →
      </button>
    </div>
  )
}
