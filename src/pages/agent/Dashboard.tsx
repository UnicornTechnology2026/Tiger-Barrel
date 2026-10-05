import { useAuth } from '@/contexts/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Link } from 'react-router-dom'
import { MapPin, Navigation, CheckCircle2, Clock } from 'lucide-react'
import { formatDate, getTodayISO } from '@/lib/utils'
import type { OutletAssignment, Visit } from '@/types'

export default function AgentDashboard() {
  const { profile } = useAuth()
  const today = getTodayISO()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

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

  const { data: visits = [] } = useQuery({
    queryKey: ['agent-visits-today', profile?.id, today],
    queryFn: async () => {
      if (!profile) return []
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('agent_id', profile.id)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
      if (error) throw error
      return data as Visit[]
    },
    enabled: !!profile,
  })

  const completed = visits.filter(v => v.status === 'completed').length
  const total = assignments.length || 4
  const visitByOutlet = Object.fromEntries(visits.map(v => [v.outlet_id, v]))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {greeting}, {profile?.full_name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-slate-500">{formatDate(new Date(), 'long')}</p>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Today&apos;s Target</h2>
          <span className="text-sm text-slate-500">{total} Outlets</span>
        </div>
        <ProgressBar value={completed} max={total || 1} />
      </div>

      <div>
        <h2 className="mb-3 font-semibold text-slate-900">Assigned Outlets</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="card h-24 animate-pulse bg-slate-100" />)}
          </div>
        ) : assignments.length === 0 ? (
          <div className="card p-8 text-center text-sm text-slate-500">
            No outlets assigned for today. Contact your administrator.
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => {
              const outlet = a.outlet
              if (!outlet) return null
              const visit = visitByOutlet[outlet.id]
              const status = visit?.status ?? 'pending'
              return (
                <div key={a.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-slate-900 truncate">{outlet.name}</h3>
                        <StatusBadge status={status} />
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{outlet.address}</span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    {status === 'completed' ? (
                      <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                        <CheckCircle2 className="h-4 w-4" /> Completed
                      </div>
                    ) : status === 'in_progress' ? (
                      <Link to={`/agent/visit/${outlet.id}`} className="btn-primary w-full">
                        <Clock className="h-4 w-4" /> Continue Visit
                      </Link>
                    ) : (
                      <Link to={`/agent/visit/${outlet.id}`} className="btn-primary w-full">
                        <Navigation className="h-4 w-4" /> Start Visit
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
