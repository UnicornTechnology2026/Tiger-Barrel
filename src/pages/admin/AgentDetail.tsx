import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { formatDate, getTodayISO } from '@/lib/utils'
import { ArrowLeft, MapPin, Camera, MessageSquare } from 'lucide-react'
import type { Profile, Visit, Photo, Comment, OutletAssignment } from '@/types'

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>()
  const today = getTodayISO()

  const { data: agent, isLoading } = useQuery({
    queryKey: ['admin-agent', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', id!).single()
      if (error) throw error
      return data as Profile
    },
    enabled: !!id,
  })

  const { data: assignments = [] } = useQuery({
    queryKey: ['admin-agent-assignments', id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('outlet_assignments')
        .select('*, outlet:outlets(*)')
        .eq('agent_id', id!)
        .eq('assigned_date', today)
        .eq('active', true)
      if (error) throw error
      return data as OutletAssignment[]
    },
    enabled: !!id,
  })

  const { data: visits = [] } = useQuery({
    queryKey: ['admin-agent-visits', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*, outlet:outlets(name)')
        .eq('agent_id', id!)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data as Visit[]
    },
    enabled: !!id,
  })

  const { data: photos = [] } = useQuery({
    queryKey: ['admin-agent-photos', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('photos')
        .select('*')
        .eq('agent_id', id!)
        .order('created_at', { ascending: false })
        .limit(12)
      if (error) throw error
      return data as Photo[]
    },
    enabled: !!id,
  })

  const { data: comments = [] } = useQuery({
    queryKey: ['admin-agent-comments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('comments')
        .select('*, outlet:outlets(name)')
        .eq('agent_id', id!)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data as Comment[]
    },
    enabled: !!id,
  })

  if (isLoading || !agent) {
    return <div className="card h-40 animate-pulse bg-slate-100" />
  }

  const completedToday = visits.filter(
    (v) => v.status === 'completed' && v.created_at?.startsWith(today)
  ).length

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/agents" className="mb-2 inline-flex items-center gap-1 text-sm text-brand-600">
          <ArrowLeft className="h-4 w-4" /> Back to Agents
        </Link>
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
            {agent.full_name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{agent.full_name}</h1>
            <p className="text-sm text-slate-500">{agent.email}</p>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={agent.status} />
              {agent.employee_id && (
                <span className="text-xs text-slate-400">ID: {agent.employee_id}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Territory</p>
          <p className="font-medium">{agent.territory || '—'}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Phone</p>
          <p className="font-medium">{agent.phone || '—'}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Today Assigned</p>
          <p className="font-medium">{assignments.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Completed Today</p>
          <p className="font-medium">{completedToday}</p>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold">Today&apos;s Outlets</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {assignments.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">No outlets assigned today</p>
          ) : (
            assignments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                <MapPin className="h-4 w-4 text-slate-400" />
                <div>
                  <p className="font-medium text-slate-900">{a.outlet?.name}</p>
                  <p className="text-xs text-slate-500">{a.outlet?.address}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold">Visit History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-2 font-medium">Outlet</th>
                <th className="px-5 py-2 font-medium">Check-in</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((v) => (
                <tr key={v.id} className="border-b border-slate-50">
                  <td className="px-5 py-2">{(v as Visit & { outlet?: { name: string } }).outlet?.name ?? '—'}</td>
                  <td className="px-5 py-2 text-slate-500">
                    {v.check_in_time ? formatDate(v.check_in_time, 'datetime') : '—'}
                  </td>
                  <td className="px-5 py-2">
                    <StatusBadge status={v.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
            <Camera className="h-4 w-4" />
            <h2 className="font-semibold">Recent Photos ({photos.length})</h2>
          </div>
          <div className="grid grid-cols-4 gap-2 p-4">
            {photos.length === 0 ? (
              <p className="col-span-4 py-4 text-center text-sm text-slate-400">No photos</p>
            ) : (
              photos.map((p) => (
                <div key={p.id} className="aspect-square rounded-lg bg-slate-100" title={formatDate(p.created_at, 'datetime')} />
              ))
            )}
          </div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
            <MessageSquare className="h-4 w-4" />
            <h2 className="font-semibold">Comments</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {comments.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-400">No comments</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="px-5 py-3">
                  <p className="text-sm text-slate-700">{c.comment_text}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {(c as Comment & { outlet?: { name: string } }).outlet?.name} · {formatDate(c.created_at, 'datetime')}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
