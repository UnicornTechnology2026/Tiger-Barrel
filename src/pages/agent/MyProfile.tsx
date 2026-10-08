import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Loader2,
  User,
  Mail,
  Phone,
  MapPin,
  CalendarDays,
  BadgeCheck,
  Briefcase,
  Map,
  Hash,
  Pencil,
  CheckCircle2,
  Camera,
  Clock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDate, cn } from "@/lib/utils";

const schema = z.object({
  full_name: z.string().min(2, "Name is required"),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function MyProfile() {
  const { profile, updateProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: profile?.full_name ?? "",
      phone: profile?.phone ?? "",
      address: profile?.address ?? "",
    },
  });

  // Lightweight activity counts for the stat chips
  const { data: visitCount = 0 } = useQuery({
    queryKey: ["profile-visit-count", profile?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("visits")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", profile!.id)
        .eq("status", "completed");
      return count ?? 0;
    },
    enabled: !!profile,
  });

  const { data: photoCount = 0 } = useQuery({
    queryKey: ["profile-photo-count", profile?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("photos")
        .select("*", { count: "exact", head: true })
        .eq("agent_id", profile!.id);
      return count ?? 0;
    },
    enabled: !!profile,
  });

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    const { error } = await updateProfile(data);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Profile updated");
    setEditing(false);
  };

  const startEditing = () => {
    if (!profile) return;
    reset({
      full_name: profile.full_name ?? "",
      phone: profile.phone ?? "",
      address: profile.address ?? "",
    });
    setEditing(true);
  };

  if (!profile) return null;

  const daysSinceJoin = profile.joining_date
    ? Math.max(
        0,
        Math.floor(
          (Date.now() - new Date(profile.joining_date).getTime()) / 86_400_000,
        ),
      )
    : null;

  const active = profile.status === "active";

  return (
    <div className="space-y-5">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

        <div className="relative">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
            <User className="h-3.5 w-3.5" />
            My Profile
          </div>

          <div className="flex items-center gap-4">
            {profile.profile_photo_url ? (
              <img
                src={profile.profile_photo_url}
                alt={profile.full_name}
                className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-gold-400"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gold-400 text-xl font-bold text-brand-950 ring-2 ring-gold-300/60">
                {initials(profile.full_name)}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold tracking-tight">
                {profile.full_name}
              </h1>
              <p className="truncate text-sm text-white/70">
                {profile.designation || "Promoter"}
              </p>
              <span
                className={cn(
                  "mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset",
                  active
                    ? "bg-emerald-400/15 text-emerald-200 ring-emerald-300/30"
                    : "bg-white/10 text-white/70 ring-white/20",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    active ? "bg-emerald-400" : "bg-white/50",
                  )}
                />
                {profile.status}
              </span>
            </div>
          </div>

          {/* Stat chips */}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <StatChip
              icon={CheckCircle2}
              label="Visits done"
              value={visitCount}
            />
            <StatChip icon={Camera} label="Photos" value={photoCount} />
            <StatChip
              icon={Clock}
              label="Days with us"
              value={daysSinceJoin ?? "—"}
            />
          </div>
        </div>
      </div>

      {/* ───────── Details / edit ───────── */}
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <BadgeCheck className="h-4 w-4 text-brand-600" />
            {editing ? "Edit Details" : "Personal Details"}
          </h2>
          {!editing && (
            <button
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200 transition-colors hover:bg-brand-100"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">Full Name</label>
              <input className="input rounded-xl" {...register("full_name")} />
              {errors.full_name && (
                <p className="mt-1 text-xs text-red-600">
                  {errors.full_name.message}
                </p>
              )}
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input rounded-xl" {...register("phone")} />
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input rounded-xl" {...register("address")} />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="btn-primary flex-1 rounded-xl"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Save"
                )}
              </button>
              <button
                type="button"
                className="btn-secondary flex-1 rounded-xl"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="divide-y divide-slate-100">
            <InfoRow icon={Mail} label="Email" value={profile.email} />
            <InfoRow icon={Phone} label="Phone" value={profile.phone} />
            <InfoRow icon={MapPin} label="Address" value={profile.address} />
            <InfoRow
              icon={CalendarDays}
              label="Joined"
              value={
                profile.joining_date ? formatDate(profile.joining_date) : null
              }
            />
          </div>
        )}
      </div>

      {/* ───────── Work info (read-only, only if available) ───────── */}
      {!editing &&
        (profile.employee_id || profile.designation || profile.territory) && (
          <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Briefcase className="h-4 w-4 text-brand-600" />
              Work Info
            </h2>
            <div className="divide-y divide-slate-100">
              {profile.employee_id && (
                <InfoRow
                  icon={Hash}
                  label="Employee ID"
                  value={profile.employee_id}
                />
              )}
              {profile.designation && (
                <InfoRow
                  icon={Briefcase}
                  label="Designation"
                  value={profile.designation}
                />
              )}
              {profile.territory && (
                <InfoRow
                  icon={Map}
                  label="Territory"
                  value={profile.territory}
                />
              )}
            </div>
          </div>
        )}
    </div>
  );
}

/* ───────── Small helper components ───────── */

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
    <div className="flex flex-col items-start gap-1.5 rounded-xl bg-white/10 px-3 py-2.5 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
      <Icon className="h-4 w-4 text-gold-300" />
      <div>
        <p className="text-lg font-bold leading-none">{value}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-white/60">
          {label}
        </p>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="break-words text-sm font-medium text-slate-900">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}
