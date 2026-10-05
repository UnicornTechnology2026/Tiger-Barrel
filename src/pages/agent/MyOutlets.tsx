import { useAuth } from '@/contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { getTodayISO } from '@/lib/utils'
import type { OutletAssignment } from '@/types'

export default function MyOutlets() {
  const { profile } = useAuth()
  const today = getTodayISO()
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['agent-assignments', profile?.id, today],
    queryFn: async () => {
      if (!profile) return []
      const { data, error } = await supabase
        .from('outlet_assignments')
        .select('*, outlet:outlets(*)')
        .eq('agent_id', profile.id)
        .eq('assigned_date', today)
        .eq('active', true)
      if (error) throw error
      return data as OutletAssignment[]
    },
    enabled: !!profile,
  })

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card h-20 animate-pulse bg-slate-100" />)}</div>
  if (!assignments.length) return <EmptyState icon={MapPin} title="No outlets assigned" description="No outlets assigned for today." />

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">My Outlets</h1>
      {assignments.map(a => a.outlet && (
        <Link key={a.id} to={`/agent/outlets/${a.outlet.id}`} className="card block p-4 hover:border-brand-300 transition-colors">
          <h3 className="font-medium text-slate-900">{a.outlet.name}</h3>
          <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {a.outlet.address}
          </p>
          <StatusBadge status={a.outlet.status} className="mt-2" />
        </Link>
      ))}
    </div>
  )
}
