import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/contexts/AuthContext";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import logo from "../../assest/logo.png";
import bgPrint from "../../assest/bg print.png";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { signIn, profile } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  if (profile) {
    navigate(profile.role === "admin" ? "/admin" : "/agent", { replace: true });
    return null;
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
    <div className="flex min-h-screen items-center justify-center bg-brand-600 bg-cover bg-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img
            src={logo}
            alt="Tiger's Barrel"
            className="mx-auto mb-3 h-28 w-auto drop-shadow-[0_4px_12px_rgba(0,0,0,0.45)]"
          />
          <h1 className="text-3xl font-bold tracking-wide text-white">
            Tiger's Barrel
          </h1>
          <p className="mt-1 text-sm text-red-100">Sign in to continue</p>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="card space-y-5 border-gold-400/60 p-6 shadow-xl sm:p-8"
        >
          <div>
            <label className="label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="input"
              placeholder="you@company.com"
              {...register("email")}
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">
                {errors.email.message}
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="input pr-10"
                placeholder="••••••••"
                {...register("password")}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
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
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            className="btn-danger w-full btn-lg"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-red-100/80">
          Secure access for authorized personnel only
        </p>
      </div>
    </div>
  );
}
