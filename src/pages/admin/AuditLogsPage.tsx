import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { EmptyState } from '@/components/shared/EmptyState'
import { Shield } from 'lucide-react'
import type { AuditLog } from '@/types'

export default function AuditLogsPage() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, actor:profiles!actor_id(full_name)')
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data as AuditLog[]
    },
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Audit Logs</h1>
        <p className="text-sm text-slate-500">Administrative action history</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-14 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={Shield} title="No audit logs" description="Admin actions will be recorded here." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Actor</th>
                <th className="px-5 py-3 font-medium">Action</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">Entity</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50">
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                    {formatDate(log.created_at, 'datetime')}
                  </td>
                  <td className="px-5 py-3 font-medium">
                    {(log as AuditLog & { actor?: { full_name: string } }).actor?.full_name ?? 'System'}
                  </td>
                  <td className="px-5 py-3">
                    <span className="badge bg-slate-100 text-slate-700">{log.action}</span>
                  </td>
                  <td className="hidden px-5 py-3 text-slate-500 md:table-cell">
                    {log.entity_type}
                    {log.entity_id ? ` · ${log.entity_id.slice(0, 8)}…` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
