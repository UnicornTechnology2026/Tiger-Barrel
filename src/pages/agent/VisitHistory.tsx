import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatDate, cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  History,
  Search,
  MapPin,
  Store,
  CheckCircle2,
  Clock,
  Timer,
  LogIn,
  LogOut,
  CalendarDays,
  Filter,
  Radio,
} from "lucide-react";
import type { Visit } from "@/types";

type VisitRow = Omit<Visit, "outlet"> & {
  outlet?: { name: string; address: string | null } | null;
};

type StatusFilter =
  | "all"
  | "completed"
  | "in_progress"
  | "pending"
  | "cancelled";

/** Local YYYY-MM-DD key for grouping */
function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA");
}

function dayLabel(key: string) {
  const now = new Date();
  const todayKey = now.toLocaleDateString("en-CA");
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  const yesterdayKey = y.toLocaleDateString("en-CA");
  if (key === todayKey) return "Today";
  if (key === yesterdayKey) return "Yesterday";
  return formatDate(`${key}T12:00:00`, "long");
}

function formatMinutes(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Minutes spent at the outlet, or null if unknown */
function durationMinutes(v: VisitRow): number | null {
  if (v.duration_minutes != null) return v.duration_minutes;
  if (v.check_in_time && v.check_out_time) {
    return Math.max(
      0,
      Math.round(
        (new Date(v.check_out_time).getTime() -
          new Date(v.check_in_time).getTime()) /
          60000,
      ),
    );
  }
  if (v.status === "in_progress" && v.check_in_time) {
    return Math.max(
      0,
      Math.round((Date.now() - new Date(v.check_in_time).getTime()) / 60000),
    );
  }
  return null;
}

const RAIL: Record<string, string> = {
  completed: "bg-emerald-500",
  in_progress: "bg-blue-500",
  pending: "bg-amber-400",
  cancelled: "bg-slate-300",
};

export default function VisitHistory() {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["agent-visit-history", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("visits")
        .select("*, outlet:outlets(name, address)")
        .eq("agent_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as VisitRow[];
    },
    enabled: !!profile,
  });

  const counts = useMemo(() => {
    const c = {
      all: visits.length,
      completed: 0,
      in_progress: 0,
      pending: 0,
      cancelled: 0,
    };
    visits.forEach((v) => {
      if (v.status in c) c[v.status as keyof typeof c] += 1;
    });
    return c;
  }, [visits]);

  const avgMinutes = useMemo(() => {
    const done = visits
      .filter((v) => v.status === "completed")
      .map(durationMinutes)
      .filter((m): m is number => m != null);
    if (!done.length) return null;
    return Math.round(done.reduce((a, b) => a + b, 0) / done.length);
  }, [visits]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visits.filter((v) => {
      if (filter !== "all" && v.status !== filter) return false;
      if (!q) return true;
      return (
        (v.outlet?.name ?? "").toLowerCase().includes(q) ||
        (v.outlet?.address ?? "").toLowerCase().includes(q)
      );
    });
  }, [visits, filter, search]);

  // Group by day (visits are already newest-first)
  const groups = useMemo(() => {
    const map = new Map<string, VisitRow[]>();
    visible.forEach((v) => {
      const key = dayKey(v.check_in_time ?? v.created_at);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });
    return Array.from(map.entries());
  }, [visible]);

  const chips: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "completed", label: "Completed" },
    { key: "in_progress", label: "In progress" },
    { key: "pending", label: "Pending" },
    { key: "cancelled", label: "Cancelled" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-40 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-36 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200"
          />
        ))}
      </div>
    );
  }

  if (!visits.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
        <div className="mb-4 rounded-full bg-brand-50 p-5 ring-8 ring-brand-50/50">
          <History className="h-8 w-8 text-brand-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">No visits yet</h3>
        <p className="mt-1 max-w-xs text-sm text-slate-500">
          Your visit history will appear here after you complete outlet visits.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-5 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
            <History className="h-3.5 w-3.5" />
            Your Activity
          </div>
          <h1 className="text-xl font-bold tracking-tight">Visit History</h1>
          <p className="mt-0.5 text-sm text-white/70">
            Your latest {visits.length} visit{visits.length === 1 ? "" : "s"}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <StatChip icon={CalendarDays} label="Visits" value={counts.all} />
            <StatChip
              icon={CheckCircle2}
              label="Completed"
              value={counts.completed}
            />
            <StatChip
              icon={Timer}
              label="Avg time"
              value={avgMinutes != null ? formatMinutes(avgMinutes) : "—"}
            />
          </div>
        </div>
      </div>

      {/* ───────── Search + filters ───────── */}
      <div className="card p-4">
        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Search className="h-3.5 w-3.5 text-brand-600" /> Search
        </label>
        <input
          type="text"
          className="input"
          placeholder="Outlet name or address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {chips
            .filter((c) => c.key === "all" || counts[c.key] > 0)
            .map((c) => (
              <Chip
                key={c.key}
                active={filter === c.key}
                onClick={() => setFilter(c.key)}
              >
                {c.label} <span className="opacity-70">({counts[c.key]})</span>
              </Chip>
            ))}
        </div>
      </div>

      {/* ───────── Grouped visits ───────── */}
      {visible.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No visits found"
          description="Nothing matches your search or filter. Try clearing them."
          action={
            <button
              className="btn-secondary"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
            >
              Clear filters
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([key, items]) => (
            <section key={key}>
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {dayLabel(key)}
                </span>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                  {items.length}
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <div className="space-y-3">
                {items.map((v) => {
                  const live = v.status === "in_progress";
                  const mins = durationMinutes(v);
                  const hasLoc =
                    v.check_in_latitude != null && v.check_in_longitude != null;

                  return (
                    <div
                      key={v.id}
                      className={cn(
                        "relative overflow-hidden rounded-2xl bg-white p-4 pl-5 shadow-sm ring-1 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg",
                        live
                          ? "ring-blue-200"
                          : "ring-slate-200 hover:ring-brand-300",
                      )}
                    >
                      {/* status rail */}
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 w-1.5",
                          RAIL[v.status] ?? "bg-slate-300",
                        )}
                      />

                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-400 text-brand-950">
                            <Store className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold text-slate-900">
                              {v.outlet?.name ?? "Outlet"}
                            </h3>
                            {v.outlet?.address && (
                              <p className="mt-0.5 flex items-start gap-1 text-xs text-slate-500">
                                <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                                <span className="line-clamp-1">
                                  {v.outlet.address}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                        <StatusBadge status={v.status} className="shrink-0" />
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <TimeTile
                          icon={LogIn}
                          label="Check-in"
                          value={
                            v.check_in_time
                              ? formatDate(v.check_in_time, "time")
                              : "—"
                          }
                        />
                        <TimeTile
                          icon={LogOut}
                          label="Check-out"
                          value={
                            v.check_out_time
                              ? formatDate(v.check_out_time, "time")
                              : "—"
                          }
                        />
                        <TimeTile
                          icon={live ? Radio : Clock}
                          label={live ? "Elapsed" : "Duration"}
                          value={mins != null ? formatMinutes(mins) : "—"}
                          highlight={live}
                        />
                      </div>

                      {hasLoc && (
                        <a
                          href={`https://www.google.com/maps?q=${v.check_in_latitude},${v.check_in_longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 transition-colors hover:text-brand-800"
                        >
                          <MapPin className="h-3.5 w-3.5" />
                          View check-in location
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
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

function TimeTile({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl p-2.5 ring-1 ring-inset",
        highlight ? "bg-blue-50 ring-blue-200" : "bg-slate-50 ring-slate-200",
      )}
    >
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon
          className={cn(
            "h-3 w-3",
            highlight ? "text-blue-600" : "text-brand-600",
          )}
        />
        {label}
      </div>
      <p
        className={cn(
          "mt-1 truncate text-sm font-semibold",
          highlight ? "text-blue-700" : "text-slate-900",
        )}
      >
        {value}
      </p>
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
