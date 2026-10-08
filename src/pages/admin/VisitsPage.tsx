import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate, getTodayISO, cn } from "@/lib/utils";
import {
  ClipboardList,
  Calendar,
  Search,
  Store,
  Users,
  Clock,
  Radio,
  CheckCircle2,
  LogIn,
  LogOut,
  MapPin,
  RefreshCw,
  Timer,
} from "lucide-react";
import type { Visit } from "@/types";

type VisitRow = Omit<Visit, "agent" | "outlet"> & {
  agent?: { full_name: string } | null;
  outlet?: { name: string; area: string | null } | null;
};

type StatusFilter =
  | "all"
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled";

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatMinutes(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function getDuration(v: VisitRow): string | null {
  if (v.duration_minutes != null) return formatMinutes(v.duration_minutes);
  if (v.status === "in_progress" && v.check_in_time) {
    const mins = Math.max(
      0,
      Math.round((Date.now() - new Date(v.check_in_time).getTime()) / 60000),
    );
    return formatMinutes(mins);
  }
  return null;
}

export default function VisitsPage() {
  const today = getTodayISO();
  const yesterday = shiftDate(today, -1);

  const [date, setDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  // Fetch all visits for the day; status/search filters run client-side
  // so the chip counts always stay accurate.
  const {
    data: visits = [],
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["admin-visits", date],
    queryFn: async () => {
      const start = new Date(`${date}T00:00:00`).toISOString();
      const end = new Date(`${date}T23:59:59.999`).toISOString();

      const { data, error } = await supabase
        .from("visits")
        .select(
          "*, agent:profiles!agent_id(full_name), outlet:outlets(name, area)",
        )
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(300);

      if (error) throw error;
      return data as unknown as VisitRow[];
    },
    refetchInterval: date === today ? 15_000 : false,
  });

  const counts = useMemo(() => {
    const c = {
      all: visits.length,
      pending: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
    };
    visits.forEach((v) => {
      if (v.status in c) c[v.status as keyof typeof c] += 1;
    });
    return c;
  }, [visits]);

  const promoterCount = useMemo(
    () => new Set(visits.map((v) => v.agent_id)).size,
    [visits],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visits.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (v.agent?.full_name ?? "").toLowerCase().includes(q) ||
        (v.outlet?.name ?? "").toLowerCase().includes(q) ||
        (v.outlet?.area ?? "").toLowerCase().includes(q)
      );
    });
  }, [visits, statusFilter, search]);

  const chips: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "in_progress", label: "In progress" },
    { key: "completed", label: "Completed" },
    { key: "pending", label: "Pending" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="space-y-6">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
              {date === today ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              ) : (
                <ClipboardList className="h-3.5 w-3.5" />
              )}
              {date === today ? "Live · refreshes every 15s" : "Visit Records"}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Visits
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {formatDate(date, "long")} · {visits.length} visit
              {visits.length === 1 ? "" : "s"} recorded
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <StatChip
              icon={Radio}
              label="In progress"
              value={counts.in_progress}
            />
            <StatChip
              icon={CheckCircle2}
              label="Completed"
              value={counts.completed}
            />
            <StatChip icon={Users} label="Promoters" value={promoterCount} />
            <StatChip
              icon={Clock}
              label="Updated"
              value={
                dataUpdatedAt
                  ? formatDate(new Date(dataUpdatedAt), "time")
                  : "—"
              }
            />
          </div>
        </div>
      </div>

      {/* ───────── Filters ───────── */}
      <div className="card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Search className="h-3.5 w-3.5 text-brand-600" /> Search
              </label>
              <input
                type="text"
                className="input"
                placeholder="Promoter, outlet or area..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Calendar className="h-3.5 w-3.5 text-brand-600" /> Date
              </label>
              <input
                type="date"
                className="input"
                value={date}
                max={today}
                onChange={(e) => e.target.value && setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-end gap-2">
            {[
              { label: "Today", value: today },
              { label: "Yesterday", value: yesterday },
            ].map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setDate(q.value)}
                className={cn(
                  "rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors",
                  date === q.value
                    ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
                )}
              >
                {q.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                className={cn("h-5 w-5", isFetching && "animate-spin")}
              />
            </button>
          </div>
        </div>

        {/* Status chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Status
          </span>
          {chips.map((c) => (
            <Chip
              key={c.key}
              active={statusFilter === c.key}
              onClick={() => setStatusFilter(c.key)}
            >
              {c.label} <span className="opacity-70">({counts[c.key]})</span>
            </Chip>
          ))}
        </div>
      </div>

      {/* ───────── Content ───────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No visits found"
          description={`No visits match your filters on ${formatDate(date)}. Try another date or status.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((v) => {
            const duration = getDuration(v);
            const live = v.status === "in_progress";
            const hasLoc =
              v.check_in_latitude != null && v.check_in_longitude != null;

            return (
              <div
                key={v.id}
                className={cn(
                  "group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl",
                  live
                    ? "ring-emerald-200 hover:ring-emerald-300"
                    : "ring-slate-200 hover:ring-brand-300",
                )}
              >
                {live && (
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
                )}

                {/* Top: promoter + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="relative shrink-0">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-400 text-sm font-bold text-brand-950">
                        {initials(v.agent?.full_name)}
                      </span>
                      {live && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {v.agent?.full_name ?? "Unknown promoter"}
                      </p>
                      <p className="text-xs text-slate-400">Promoter</p>
                    </div>
                  </div>
                  <StatusBadge status={v.status} />
                </div>

                {/* Outlet */}
                <div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-3">
                  <Store className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {v.outlet?.name ?? "—"}
                    </p>
                    {v.outlet?.area && (
                      <p className="truncate text-xs text-slate-500">
                        {v.outlet.area}
                      </p>
                    )}
                  </div>
                </div>

                {/* Times */}
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
                    icon={Timer}
                    label={live ? "Elapsed" : "Duration"}
                    value={duration ?? "—"}
                    highlight={live}
                  />
                </div>

                {/* Footer */}
                {hasLoc && (
                  <a
                    href={`https://www.google.com/maps?q=${v.check_in_latitude},${v.check_in_longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 transition-colors hover:text-brand-800"
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    View check-in location
                  </a>
                )}
              </div>
            );
          })}
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
        highlight
          ? "bg-emerald-50 ring-emerald-200"
          : "bg-white ring-slate-200",
      )}
    >
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
        <Icon
          className={cn(
            "h-3 w-3",
            highlight ? "text-emerald-600" : "text-brand-600",
          )}
        />
        {label}
      </div>
      <p
        className={cn(
          "mt-1 truncate text-sm font-semibold",
          highlight ? "text-emerald-700" : "text-slate-900",
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
