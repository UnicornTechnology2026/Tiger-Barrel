import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import {
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assest/logo.png";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { signIn, profile } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  if (profile) {
    return (
      <Navigate to={profile.role === "admin" ? "/admin" : "/agent"} replace />
    );
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    const { error } = await signIn(data.email, data.password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Welcome back!");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-4">
      {/* decorative glows */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-brand-400/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        {/* ───────── Brand ───────── */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-white/95 p-3 shadow-xl ring-2 ring-gold-400/60">
            <img src={logo} alt="Tiger's Barrel" className="h-full w-auto" />
          </div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure Sign In
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Tiger&apos;s Barrel
          </h1>
          <p className="mt-1 text-sm text-white/70">
            Sign in to continue to your dashboard
          </p>
        </div>

        {/* ───────── Form card ───────── */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="relative space-y-5 overflow-hidden rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-gold-400/40 sm:p-8"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand-500 via-gold-400 to-brand-500" />

          <div>
            <h2 className="text-lg font-bold text-slate-900">Welcome back</h2>
            <p className="text-sm text-slate-500">
              Enter your credentials to access your account.
            </p>
          </div>

          {/* Email */}
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

          {/* Password */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="password"
              >
                Password
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-semibold text-brand-600 hover:text-brand-700"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="input rounded-xl pl-10 pr-11"
                placeholder="••••••••"
                {...register("password")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="btn-primary btn-lg w-full rounded-xl shadow-lg shadow-brand-600/30"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
              </>
            ) : (
              <>
                Sign in <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-white/60">
          <ShieldCheck className="h-3.5 w-3.5 text-gold-300" />
          Secure access for authorized personnel only
        </p>
      </div>
    </div>
  );
}
