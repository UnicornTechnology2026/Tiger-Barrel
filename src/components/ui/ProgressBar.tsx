import { cn } from '@/lib/utils'

interface Props {
  value: number
  max: number
  className?: string
  showLabel?: boolean
}

export function ProgressBar({ value, max, className, showLabel = true }: Props) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="font-medium text-slate-700">
            {value} / {max} Completed
          </span>
          <span className="text-slate-500">{pct}%</span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
