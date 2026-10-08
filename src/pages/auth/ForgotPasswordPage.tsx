import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Loader2,
  Mail,
  KeyRound,
  MailCheck,
  ShieldCheck,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assest/logo.png";

const schema = z.object({ email: z.string().email("Enter a valid email") });
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSentTo(data.email);
    setSent(true);
    toast.success("Password reset email sent");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-4">
      {/* decorative glows */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-brand-400/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* Back link */}
        <Link
          to="/login"
          className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-inset ring-white/15 transition-colors hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" /> Back to login
        </Link>

        {/* ───────── Brand ───────── */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/95 p-3 shadow-xl ring-2 ring-gold-400/60">
            <img src={logo} alt="Tiger's Barrel" className="h-full w-auto" />
          </div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
            <KeyRound className="h-3.5 w-3.5" />
            Account Recovery
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Tiger&apos;s Barrel
          </h1>
        </div>

        {/* ───────── Card ───────── */}
        <div className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gold-400/40 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-gold-400 to-brand-500" />

          {sent ? (
            /* ───── Success state ───── */
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
                <MailCheck className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                Check your inbox
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                We&apos;ve sent a password reset link to
              </p>
              <p className="mt-0.5 break-all text-sm font-semibold text-slate-900">
                {sentTo}
              </p>

              <div className="mt-5 rounded-xl bg-emerald-50 p-3.5 text-left text-xs text-emerald-800 ring-1 ring-inset ring-emerald-200">
                Didn&apos;t get it? Check your spam folder, or try again with a
                different email address.
              </div>

              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  className="btn-secondary w-full rounded-xl"
                  onClick={() => setSent(false)}
                >
                  Try a different email
                </button>
                <Link to="/login" className="btn-primary w-full rounded-xl">
                  Back to login
                </Link>
              </div>
            </div>
          ) : (
            /* ───── Form state ───── */
            <>
              <div className="mb-5 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400 text-brand-950 ring-1 ring-inset ring-gold-500/30">
                  <KeyRound className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Reset password
                  </h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Enter your email and we&apos;ll send you a reset link.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label className="label" htmlFor="email">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      className="input rounded-xl pl-10"
                      placeholder="you@company.com"
                      {...register("email")}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.email.message}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn-primary btn-lg w-full rounded-xl shadow-lg shadow-brand-600/30"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      Send reset link <Send className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-white/60">
          <ShieldCheck className="h-3.5 w-3.5 text-gold-300" />
          Secure access for authorized personnel only
        </p>
      </div>
    </div>
  );
}
