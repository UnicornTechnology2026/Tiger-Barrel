import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Store, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import type { Outlet } from '@/types'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({
  outlet_code: z.string().min(1, 'Required'),
  name: z.string().min(2, 'Required'),
  owner_name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().min(5, 'Required'),
  city: z.string().optional(),
  area: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  geofence_radius: z.coerce.number().min(10).max(5000).default(100),
})

type FormData = z.infer<typeof schema>

export default function OutletList() {
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const qc = useQueryClient()

  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ['admin-outlets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('outlets').select('*').order('name')
      if (error) throw error
      return data as Outlet[]
    },
  })

  const filtered = outlets.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.outlet_code.toLowerCase().includes(search.toLowerCase()) ||
      (o.area ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { geofence_radius: 100 },
  })

  const createMutation = useMutation({
    mutationFn: async (form: FormData) => {
      const { data, error } = await supabase.from('outlets').insert(form).select().single()
      if (error) throw error
      await supabase.from('audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'create_outlet',
        entity_type: 'outlet',
        entity_id: data.id,
        metadata: { name: form.name, code: form.outlet_code },
      })
      return data
    },
    onSuccess: () => {
      toast.success('Outlet created')
      setShowCreate(false)
      reset()
      qc.invalidateQueries({ queryKey: ['admin-outlets'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === 'active' ? 'inactive' : 'active'
      const { error } = await supabase.from('outlets').update({ status: newStatus }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Status updated')
      qc.invalidateQueries({ queryKey: ['admin-outlets'] })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Outlets</h1>
          <p className="text-sm text-slate-500">{outlets.length} total</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Add Outlet
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className="input pl-9"
          placeholder="Search outlets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card h-16 animate-pulse bg-slate-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Store} title="No outlets" description="Add your first liquor outlet." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">Code</th>
                <th className="hidden px-5 py-3 font-medium lg:table-cell">Area</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link to={`/admin/outlets/${o.id}`} className="font-medium text-brand-700 hover:underline">
                      {o.name}
                    </Link>
                    <p className="text-xs text-slate-400 truncate max-w-[200px]">{o.address}</p>
                  </td>
                  <td className="hidden px-5 py-3 text-slate-600 md:table-cell">{o.outlet_code}</td>
                  <td className="hidden px-5 py-3 text-slate-600 lg:table-cell">{o.area || '—'}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="px-5 py-3">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => toggleStatus.mutate({ id: o.id, status: o.status })}
                    >
                      {o.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4">
          <div className="card my-8 w-full max-w-lg p-6">
            <h2 className="mb-4 text-lg font-semibold">Add Outlet</h2>
            <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Outlet Code *</label>
                  <input className="input" {...register('outlet_code')} />
                  {errors.outlet_code && <p className="text-xs text-red-600">{errors.outlet_code.message}</p>}
                </div>
                <div>
                  <label className="label">Name *</label>
                  <input className="input" {...register('name')} />
                  {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
                </div>
              </div>
              <div>
                <label className="label">Address *</label>
                <input className="input" {...register('address')} />
                {errors.address && <p className="text-xs text-red-600">{errors.address.message}</p>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Owner</label>
                  <input className="input" {...register('owner_name')} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" {...register('phone')} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">City</label>
                  <input className="input" {...register('city')} />
                </div>
                <div>
                  <label className="label">Area</label>
                  <input className="input" {...register('area')} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">Latitude *</label>
                  <input className="input" type="number" step="any" {...register('latitude')} />
                  {errors.latitude && <p className="text-xs text-red-600">{errors.latitude.message}</p>}
                </div>
                <div>
                  <label className="label">Longitude *</label>
                  <input className="input" type="number" step="any" {...register('longitude')} />
                  {errors.longitude && <p className="text-xs text-red-600">{errors.longitude.message}</p>}
                </div>
                <div>
                  <label className="label">Geofence (m)</label>
                  <input className="input" type="number" {...register('geofence_radius')} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary flex-1" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
                <button type="button" className="btn-secondary flex-1" onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
