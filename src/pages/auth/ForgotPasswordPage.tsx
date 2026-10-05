import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const schema = z.object({ email: z.string().email('Enter a valid email') })
type FormData = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setSubmitting(false)
    if (error) { toast.error(error.message); return }
    setSent(true)
    toast.success('Password reset email sent')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <Link to="/login" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>
        <div className="card p-6 sm:p-8">
          <h1 className="text-xl font-bold text-slate-900">Reset password</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your email and we&apos;ll send a reset link.</p>
          {sent ? (
            <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800">
              Check your inbox for a password reset link.
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" type="email" className="input" placeholder="you@company.com" {...register('email')} />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
              </div>
              <button type="submit" className="btn-primary w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending...</> : 'Send reset link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
