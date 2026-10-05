import { cn, statusColor } from '@/lib/utils'

interface Props {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: Props) {
  const label = status.replace(/_/g, ' ')
  return (
    <span className={cn('badge capitalize', statusColor(status), className)}>
      {label}
    </span>
  )
}
