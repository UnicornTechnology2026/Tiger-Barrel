import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingScreen } from './LoadingScreen'
import type { UserRole } from '@/types'
import type { ReactNode } from 'react'

interface Props {
  role: UserRole
  children: ReactNode
}

export function ProtectedRoute({ role, children }: Props) {
  const { profile, loading, user } = useAuth()

  if (loading) return <LoadingScreen />

  if (!user || !profile) {
    return <Navigate to="/login" replace />
  }

  if (profile.status !== 'active') {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-md p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Account Inactive</h1>
          <p className="mt-2 text-slate-600">
            Your account has been deactivated. Please contact your administrator.
          </p>
        </div>
      </div>
    )
  }

  if (profile.role !== role) {
    return <Navigate to={profile.role === 'admin' ? '/admin' : '/agent'} replace />
  }

  return <>{children}</>
}
