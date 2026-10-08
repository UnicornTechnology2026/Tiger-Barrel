import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Users,
  Plus,
  Search,
  UserCheck,
  UserX,
  Mail,
  Phone,
  MapPin,
  Clock,
  Power,
  X,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatDate } from "@/lib/utils";
import type { Profile } from "@/types";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

/**
 * Create a new promoter (Supabase Auth user + profile) or update an existing one by email.
 * New users are created with a throwaway, non-persisting client so the admin's own
 * session is never replaced.
 */
const linkSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  phone: z.string().optional(),
  password: z
    .string()
    .optional()
    .refine(
      (v) => !v || v.length >= 6,
      "Password must be at least 6 characters",
    ),
});

type LinkForm = z.infer<typeof linkSchema>;
type StatusFilter = "all" | "active" | "inactive";

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AgentList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ["admin-agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("role", "agent")
        .order("full_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  const activeCount = useMemo(
    () => agents.filter((a) => a.status === "active").length,
    [agents],
  );
  const inactiveCount = agents.length - activeCount;

  const filtered = useMemo(
    () =>
      agents.filter((a) => {
        const q = search.toLowerCase();
        const matchesSearch =
          a.full_name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q);
        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "active"
              ? a.status === "active"
              : a.status !== "active";
        return matchesSearch && matchesStatus;
      }),
    [agents, search, statusFilter],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LinkForm>({ resolver: zodResolver(linkSchema) });

  const updateMutation = useMutation({
    mutationFn: async (form: LinkForm) => {
      const email = form.email.trim().toLowerCase();

      const findProfile = async () => {
        const { data, error } = await supabase
          .from("profiles")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (error) throw error;
        return data;
      };

      let existing = await findProfile();

      if (!existing) {
        if (!form.password) {
          throw new Error(
            "No promoter found with that email. Enter a password (min 6 characters) to create a new promoter.",
          );
        }
        // Separate client: does not persist/replace the admin session.
        const tempClient = createClient(
          import.meta.env.VITE_SUPABASE_URL as string,
          import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          },
        );
        const { error: signUpErr } = await tempClient.auth.signUp({
          email,
          password: form.password,
          options: { data: { role: "agent", full_name: form.full_name } },
        });
        if (signUpErr) throw signUpErr;

        existing = await findProfile();
        if (!existing) {
          throw new Error(
            "User was created but the profile was not found. Check the handle_new_user trigger in Supabase.",
          );
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          phone: form.phone || null,
          role: "agent",
          status: "active",
          joining_date: new Date().toISOString().split("T")[0],
        })
        .eq("id", existing.id);

      if (error) throw error;

      await supabase.from("audit_logs").insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: "update_agent_profile",
        entity_type: "profile",
        entity_id: existing.id,
        metadata: { email: form.email, name: form.full_name },
      });
    },
    onSuccess: () => {
      toast.success("Promoter saved");
      setShowCreate(false);
      reset();
      qc.invalidateQueries({ queryKey: ["admin-agents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: newStatus === "active" ? "activate_agent" : "deactivate_agent",
        entity_type: "profile",
        entity_id: id,
      });
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["admin-agents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
              <Users className="h-3.5 w-3.5" />
              Field Team
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Promoters
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Manage your promoters, their access and their status
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isLoading && (
              <>
                <StatChip icon={Users} label="Total" value={agents.length} />
                <StatChip icon={UserCheck} label="Active" value={activeCount} />
                <StatChip icon={UserX} label="Inactive" value={inactiveCount} />
              </>
            )}
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-brand-950 shadow-sm transition hover:bg-gold-300"
            >
              <Plus className="h-4 w-4" /> Manage Promoter
            </button>
          </div>
        </div>
      </div>

      {/* ───────── Filters ───────── */}
      <div className="card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Search className="h-3.5 w-3.5 text-brand-600" /> Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Status
            </span>
            <Chip
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              All <span className="opacity-70">({agents.length})</span>
            </Chip>
            <Chip
              active={statusFilter === "active"}
              onClick={() => setStatusFilter("active")}
            >
              Active <span className="opacity-70">({activeCount})</span>
            </Chip>
            <Chip
              active={statusFilter === "inactive"}
              onClick={() => setStatusFilter("inactive")}
            >
              Inactive <span className="opacity-70">({inactiveCount})</span>
            </Chip>
          </div>
        </div>
      </div>

      {/* ───────── Content ───────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No promoters found"
          description={
            agents.length === 0
              ? "Click “Manage Promoter” to add your first promoter."
              : "Try a different search or status filter."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((a) => {
            const isActive = a.status === "active";
            return (
              <div
                key={a.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-brand-300"
              >
                {/* cover */}
                <div className="relative h-20 ">
                  <div className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full bg-gold-400/20 blur-2xl" />
                  <span
                    className={cn(
                      "absolute right-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm",
                      isActive
                        ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-inset ring-emerald-300/40"
                        : "bg-black/40 text-white/80 ring-1 ring-inset ring-white/20",
                    )}
                  >
                    {isActive ? "Active" : a.status}
                  </span>
                </div>

                {/* avatar */}
                <div className="-mt-8 px-5">
                  {a.profile_photo_url ? (
                    <img
                      src={a.profile_photo_url}
                      alt={a.full_name}
                      className="h-16 w-16 rounded-full object-cover ring-4 ring-white"
                    />
                  ) : (
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gold-400 text-lg font-bold text-brand-950 ring-4 ring-white">
                      {initials(a.full_name)}
                    </span>
                  )}
                </div>

                {/* body */}
                <div className="flex flex-1 flex-col px-5 pb-4 pt-3">
                  <Link
                    to={`/admin/agents/${a.id}`}
                    className="flex items-center justify-between gap-2 font-semibold text-slate-900 transition-colors hover:text-brand-700"
                  >
                    <span className="truncate">{a.full_name}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600" />
                  </Link>

                  <ul className="mt-2 space-y-1.5 text-xs text-slate-500">
                    <li className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                      <span className="truncate">{a.email}</span>
                    </li>
                    {a.phone && (
                      <li className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                        <span className="truncate">{a.phone}</span>
                      </li>
                    )}
                    {a.territory && (
                      <li className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                        <span className="truncate">{a.territory}</span>
                      </li>
                    )}
                    <li className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                      <span className="truncate">
                        {a.last_active_at
                          ? `Last active ${formatDate(a.last_active_at, "datetime")}`
                          : "Never active"}
                      </span>
                    </li>
                  </ul>

                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <StatusBadge status={a.status} />
                    <button
                      type="button"
                      disabled={toggleStatus.isPending}
                      onClick={() =>
                        toggleStatus.mutate({ id: a.id, status: a.status })
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                        isActive
                          ? "border-slate-200 bg-white text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                          : "border-brand-600 bg-brand-600 text-white hover:bg-brand-700",
                      )}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ───────── Add / Update modal ───────── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/70 p-4 backdrop-blur-md"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 px-6 py-5 text-white">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold-400/20 blur-2xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">
                    Add / Update Promoter
                  </h2>
                  <p className="mt-1 text-xs text-white/70">
                    Enter the promoter&apos;s details and a password to create a
                    new login. If the email already exists, the details are
                    updated and the password can be left blank.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit((d) => updateMutation.mutate(d))}
              className="space-y-3 p-6"
            >
              <div>
                <label className="label">Email *</label>
                <input className="input" type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-xs text-red-600">{errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="label">Full Name *</label>
                <input className="input" {...register("full_name")} />
                {errors.full_name && (
                  <p className="text-xs text-red-600">
                    {errors.full_name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" {...register("phone")} />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Required only for a new promoter"
                  {...register("password")}
                />
                {errors.password && (
                  <p className="text-xs text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Small helper components (same as Photos Gallery) ───────── */

function StatChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/10 px-4 py-2.5 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
      <Icon className="h-5 w-5 text-gold-300" />
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="mt-1 text-[11px] uppercase tracking-wide text-white/60">
          {label}
        </p>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-brand-600 bg-brand-600 text-white shadow-sm"
          : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
      )}
    >
      {children}
    </button>
  );
}
