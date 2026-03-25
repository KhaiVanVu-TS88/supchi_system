interface Props {
  label: string
  value: string | number
  sub?: string
  color?: 'amber' | 'jade' | 'red' | 'default'
  icon: string
}

export default function StatCard({ label, value, sub, color = 'default', icon }: Props) {
  const colors = {
    amber:   'border-amber-glow/20 bg-amber-glow/5',
    jade:    'border-jade/20 bg-jade/5',
    red:     'border-red-500/20 bg-red-500/5',
    default: 'border-white/8 bg-white/3',
  }
  const valueColors = {
    amber: 'text-amber-glow', jade: 'text-jade',
    red: 'text-red-400', default: 'text-snow',
  }

  return (
    <div className={`glass rounded-2xl p-5 border ${colors[color]}`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        {sub && <span className="text-[11px] text-ghost">{sub}</span>}
      </div>
      <p className={`text-3xl font-bold font-mono ${valueColors[color]}`}>{value}</p>
      <p className="text-xs text-ghost mt-1">{label}</p>
    </div>
  )
}
