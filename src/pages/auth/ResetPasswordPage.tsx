import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: 'Passwords do not match', path: ['confirm'] })
type FormData = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password: data.password })
    setSubmitting(false)
    if (error) { toast.error(error.message); return }
    toast.success('Password updated successfully')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-xl font-bold text-slate-900">Set new password</h1>
        <p className="mt-1 text-sm text-slate-500">Choose a strong password for your account.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="password">New password</label>
            <input id="password" type="password" className="input" {...register('password')} />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" className="input" {...register('confirm')} />
            {errors.confirm && <p className="mt-1 text-xs text-red-600">{errors.confirm.message}</p>}
          </div>
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating...</> : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
