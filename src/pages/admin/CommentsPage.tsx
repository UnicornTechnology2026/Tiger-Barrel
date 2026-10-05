import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/shared/EmptyState'
import { MessageSquare } from 'lucide-react'
import { formatDate, getTodayISO } from '@/lib/utils'
import type { Comment } from '@/types'

export default function CommentsPage() {
  const [dateFilter, setDateFilter] = useState(getTodayISO())

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['admin-comments', dateFilter],
    queryFn: async () => {
      let q = supabase
        .from('comments')
        .select('*, agent:profiles!agent_id(full_name), outlet:outlets(name, area)')
        .order('created_at', { ascending: false })
        .limit(100)

      if (dateFilter) {
        q = q.gte('created_at', `${dateFilter}T00:00:00`).lte('created_at', `${dateFilter}T23:59:59`)
      }

      const { data, error } = await q
      if (error) throw error
      return data as Comment[]
    },
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Comments</h1>
          <p className="text-sm text-slate-500">{comments.length} comments</p>
        </div>
        <input
          type="date"
          className="input w-auto"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-20 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No comments" description="Agent remarks will appear here." />
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="card p-4">
              <p className="text-sm text-slate-800">{c.comment_text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span className="font-medium text-slate-600">
                  {(c as Comment & { agent?: { full_name: string } }).agent?.full_name}
                </span>
                <span>
                  {(c as Comment & { outlet?: { name: string } }).outlet?.name}
                </span>
                <span>{formatDate(c.created_at, 'datetime')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
