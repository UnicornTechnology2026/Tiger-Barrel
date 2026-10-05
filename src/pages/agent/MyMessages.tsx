import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { EmptyState } from '@/components/shared/EmptyState'
import { MessageSquare } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Message } from '@/types'

export default function MyMessages() {
  const { profile } = useAuth()
  const qc = useQueryClient()

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['agent-messages', profile?.id],
    queryFn: async () => {
      if (!profile) return []
      const { data, error } = await supabase
        .from('messages')
        .select('*, sender:profiles!sender_id(full_name)')
        .eq('receiver_id', profile.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Message[]
    },
    enabled: !!profile,
  })

  useEffect(() => {
    if (!profile || !messages.length) return
    const unread = messages.filter((m) => !m.is_read).map((m) => m.id)
    if (unread.length) {
      supabase
        .from('messages')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .in('id', unread)
        .then(() => qc.invalidateQueries({ queryKey: ['unread-messages'] }))
    }
  }, [messages, profile, qc])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="card h-20 animate-pulse bg-slate-100" />
        ))}
      </div>
    )
  }

  if (!messages.length) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No messages"
        description="Messages from admin will appear here."
      />
    )
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">My Messages</h1>
      {messages.map((m) => (
        <div
          key={m.id}
          className={`card p-4 ${!m.is_read ? 'border-brand-300 bg-brand-50/30' : ''}`}
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm font-medium text-slate-900">
              {(m as Message & { sender?: { full_name: string } }).sender?.full_name ?? 'Admin'}
            </span>
            <span className="text-xs text-slate-400">
              {formatDate(m.created_at, 'datetime')}
            </span>
          </div>
          <p className="text-sm text-slate-700">{m.message_text}</p>
        </div>
      ))}
    </div>
  )
}
