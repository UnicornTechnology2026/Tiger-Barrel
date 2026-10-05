import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const schema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
})

type FormData = z.infer<typeof schema>

export default function MyProfile() {
  const { profile, updateProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile?.full_name ?? '',
      phone: profile?.phone ?? '',
      address: profile?.address ?? '',
    },
  })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    const { error } = await updateProfile(data)
    setSubmitting(false)
    if (error) {
      toast.error(error)
      return
    }
    toast.success('Profile updated')
    setEditing(false)
  }

  if (!profile) return null

  return (
    <div className="space-y-5">
      <h1 className="text-lg font-bold text-slate-900">My Profile</h1>
      <div className="card p-5">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
            {profile.full_name.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">{profile.full_name}</h2>
            <p className="text-sm text-slate-500">{profile.email}</p>
            {profile.employee_id && (
              <p className="text-xs text-slate-400">ID: {profile.employee_id}</p>
            )}
          </div>
        </div>

        {editing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input" {...register('full_name')} />
              {errors.full_name && (
                <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>
              )}
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" {...register('phone')} />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" {...register('address')} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Phone</span>
              <span>{profile.phone || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Address</span>
              <span className="max-w-[60%] text-right">{profile.address || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Territory</span>
              <span>{profile.territory || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Designation</span>
              <span>{profile.designation || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Joined</span>
              <span>{profile.joining_date ? formatDate(profile.joining_date) : '—'}</span>
            </div>
            <button className="btn-secondary mt-4 w-full" onClick={() => setEditing(true)}>
              Edit Profile
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
