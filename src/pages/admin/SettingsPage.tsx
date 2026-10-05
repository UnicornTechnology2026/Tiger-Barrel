import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import type { AppSettings } from '@/types'

export default function SettingsPage() {
  const qc = useQueryClient()
  const [values, setValues] = useState<Record<string, string>>({})

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('app_settings').select('*')
      if (error) throw error
      return data as AppSettings[]
    },
  })

  useEffect(() => {
    if (settings.length) {
      const map: Record<string, string> = {}
      settings.forEach((s) => {
        map[s.key] = s.value
      })
      setValues(map)
    }
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const [key, value] of Object.entries(values)) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('key', key)
        if (error) throw error
      }
      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'update_settings',
        entity_type: 'app_settings',
        metadata: values,
      })
    },
    onSuccess: () => {
      toast.success('Settings saved')
      qc.invalidateQueries({ queryKey: ['app-settings'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const labels: Record<string, string> = {
    default_geofence_radius: 'Default Geofence Radius (meters)',
    min_gps_accuracy: 'Minimum GPS Accuracy (meters)',
    max_photo_size_mb: 'Max Photo Size (MB)',
    max_photos_per_visit: 'Max Photos Per Visit',
    allowed_photo_types: 'Allowed Photo Types',
    tracking_enabled: 'Location Tracking Enabled',
  }

  if (isLoading) {
    return <div className="card h-40 animate-pulse bg-slate-100" />
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Application configuration</p>
      </div>

      <div className="card max-w-lg space-y-4 p-6">
        {Object.keys(labels).map((key) => (
          <div key={key}>
            <label className="label">{labels[key] ?? key}</label>
            {key === 'tracking_enabled' ? (
              <select
                className="input"
                value={values[key] ?? 'true'}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            ) : (
              <input
                className="input"
                value={values[key] ?? ''}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              />
            )}
          </div>
        ))}
        <button
          className="btn-primary"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            'Save Settings'
          )}
        </button>
      </div>
    </div>
  )
}
