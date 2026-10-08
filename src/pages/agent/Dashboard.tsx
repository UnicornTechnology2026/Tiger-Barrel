import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Link } from "react-router-dom";
import {
  MapPin,
  Navigation,
  CheckCircle2,
  Clock,
  Store,
  Radio,
  Hourglass,
  Target,
  PartyPopper,
  ExternalLink,
} from "lucide-react";
import { formatDate, getTodayISO, cn } from "@/lib/utils";
import type { OutletAssignment, Visit } from "@/types";

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AgentDashboard() {
  const { profile } = useAuth();
  const today = getTodayISO();
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["agent-assignments", profile?.id, today],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("outlet_assignments")
        .select("*, outlet:outlets(*)")
        .eq("agent_id", profile.id)
        .eq("assigned_date", today)
        .eq("active", true);
      if (error) throw error;
      return data as OutletAssignment[];
    },
    enabled: !!profile,
  });

  const { data: visits = [] } = useQuery({
    queryKey: ["agent-visits-today", profile?.id, today],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("visits")
        .select("*")
        .eq("agent_id", profile.id)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);
      if (error) throw error;
      return data as Visit[];
    },
    enabled: !!profile,
  });

  const completed = visits.filter((v) => v.status === "completed").length;
  const inProgress = visits.filter((v) => v.status === "in_progress").length;
  const total = assignments.length || 4;
  const pending = Math.max(total - completed - inProgress, 0);
  const pct =
    total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
  const allDone = total > 0 && completed >= total;
  const visitByOutlet = Object.fromEntries(visits.map((v) => [v.outlet_id, v]));

  return (
    <div className="space-y-5">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
                <Target className="h-3.5 w-3.5" />
                Today&apos;s Target
              </div>
              <h1 className="truncate text-xl font-bold tracking-tight">
                {greeting}, {profile?.full_name?.split(" ")[0]}
              </h1>
              <p className="mt-0.5 text-sm text-white/70">
                {formatDate(new Date(), "long")}
              </p>
            </div>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-400 text-sm font-bold text-brand-950">
              {initials(profile?.full_name)}
            </span>
          </div>

          {/* Progress */}
          <div className="mt-5 flex items-center gap-5">
            <ProgressRing percent={pct} />
            <div className="min-w-0 flex-1">
              <p className="text-3xl font-bold leading-none">
                {completed}
                <span className="text-lg font-medium text-white/60">
                  {" "}
                  / {total}
                </span>
              </p>
              <p className="mt-1 text-sm text-white/70">
                {allDone ? "All outlets completed" : "Outlets completed"}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gold-400 transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Stat chips */}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <StatChip icon={Radio} label="In progress" value={inProgress} />
            <StatChip icon={CheckCircle2} label="Completed" value={completed} />
            <StatChip icon={Hourglass} label="Pending" value={pending} />
          </div>
        </div>
      </div>

      {allDone && (
        <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 ring-1 ring-emerald-200">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <PartyPopper className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-emerald-800">
              Great work today!
            </p>
            <p className="text-xs text-emerald-700">
              You&apos;ve completed all your assigned outlets.
            </p>
          </div>
        </div>
      )}

      {/* ───────── Assigned outlets ───────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Store className="h-4 w-4 text-brand-600" />
            Assigned Outlets
          </h2>
          {assignments.length > 0 && (
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
              {assignments.length}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-36 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200"
              />
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
            <div className="mb-4 rounded-full bg-brand-50 p-5 ring-8 ring-brand-50/50">
              <Store className="h-8 w-8 text-brand-600" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">
              No outlets assigned for today
            </h3>
            <p className="mt-1 max-w-xs text-sm text-slate-500">
              Contact your administrator to get your outlets for the day.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((a, index) => {
              const outlet = a.outlet;
              if (!outlet) return null;
              const visit = visitByOutlet[outlet.id];
              const status = visit?.status ?? "pending";
              const live = status === "in_progress";
              const done = status === "completed";

              return (
                <div
                  key={a.id}
                  className={cn(
                    "relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 transition-all duration-300 active:scale-[0.99]",
                    live
                      ? "ring-emerald-200"
                      : done
                        ? "ring-slate-200"
                        : "ring-slate-200 hover:ring-brand-300",
                  )}
                >
                  {live && (
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
                  )}

                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ring-inset",
                        done
                          ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                          : live
                            ? "bg-emerald-50 text-emerald-600 ring-emerald-200"
                            : "bg-gold-400 text-brand-950 ring-gold-500/30",
                      )}
                    >
                      {done ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : live ? (
                        <span className="relative flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                        </span>
                      ) : (
                        index + 1
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="truncate text-base font-semibold text-slate-900">
                          {outlet.name}
                        </h3>
                        <StatusBadge status={status} className="shrink-0" />
                      </div>
                      <p className="mt-0.5 flex items-start gap-1 text-xs text-slate-500">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="line-clamp-2">{outlet.address}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    {done ? (
                      <div className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        <CheckCircle2 className="h-4 w-4" /> Completed
                      </div>
                    ) : live ? (
                      <Link
                        to={`/agent/visit/${outlet.id}`}
                        className="btn-primary flex-1"
                      >
                        <Clock className="h-4 w-4" /> Continue Visit
                      </Link>
                    ) : (
                      <Link
                        to={`/agent/visit/${outlet.id}`}
                        className="btn-primary flex-1"
                      >
                        <Navigation className="h-4 w-4" /> Start Visit
                      </Link>
                    )}

                    {!done &&
                      outlet.latitude != null &&
                      outlet.longitude != null && (
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${outlet.latitude},${outlet.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary px-3.5"
                          title="Get directions"
                          aria-label="Get directions"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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

function ProgressRing({ percent }: { percent: number }) {
  const size = 84;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#d4b25a"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">
        {percent}%
      </span>
    </div>
  );
}
