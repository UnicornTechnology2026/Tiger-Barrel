import { useAuth } from '@/contexts/AuthContext'
import { formatDate } from '@/lib/utils'

export default function AdminProfile() {
  const { profile } = useAuth()

  if (!profile) return null

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-900">My Profile</h1>
      <div className="card max-w-md p-6">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700">
            {profile.full_name.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">{profile.full_name}</h2>
            <p className="text-sm text-slate-500">{profile.email}</p>
            <span className="badge mt-1 bg-brand-100 text-brand-800">Admin</span>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Phone</span>
            <span>{profile.phone || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Status</span>
            <span className="capitalize">{profile.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Last Active</span>
            <span>
              {profile.last_active_at ? formatDate(profile.last_active_at, 'datetime') : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
