import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Shield,
  X,
  Calendar,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  Search,
  Activity,
  Store,
  MessageSquare,
  Settings,
  UserCog,
  UserCheck,
  UserX,
  PlusCircle,
  Link2,
  Filter,
  type LucideIcon,
} from "lucide-react";
import { formatDate, getTodayISO, cn } from "@/lib/utils";
import type { AuditLog } from "@/types";

/* ───────── Helpers ───────── */

const ACTION_META: Record<
  string,
  { label: string; icon: LucideIcon; tone: string }
> = {
  assign_outlet: {
    label: "Outlet assigned",
    icon: Link2,
    tone: "bg-blue-50 text-blue-700 ring-blue-200",
  },
  send_message: {
    label: "Message sent",
    icon: MessageSquare,
    tone: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  update_settings: {
    label: "Settings updated",
    icon: Settings,
    tone: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  update_agent_profile: {
    label: "Promoter profile updated",
    icon: UserCog,
    tone: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  activate_agent: {
    label: "Promoter activated",
    icon: UserCheck,
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  deactivate_agent: {
    label: "Promoter deactivated",
    icon: UserX,
    tone: "bg-red-50 text-red-700 ring-red-200",
  },
  create_outlet: {
    label: "Outlet created",
    icon: PlusCircle,
    tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
};

function humanize(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function actionMeta(action: string) {
  return (
    ACTION_META[action] ?? {
      label: humanize(action),
      icon: Shield,
      tone: "bg-slate-100 text-slate-700 ring-slate-200",
    }
  );
}

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function initials(name?: string | null) {
  if (!name) return "SY";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

type Range = { from: string; to: string } | null;

/* ───────── Page ───────── */

export default function AuditLogsPage() {
  const today = getTodayISO();
  const yesterday = shiftDate(today, -1);
  const weekAgo = shiftDate(today, -6);

  const [range, setRange] = useState<Range>(null); // null = latest activity
  const [search, setSearch] = useState("");
  const [actorFilter, setActorFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-audit-logs", range?.from ?? "all", range?.to ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*, actor:profiles!actor_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (range) {
        q = q
          .gte("created_at", new Date(`${range.from}T00:00:00`).toISOString())
          .lte(
            "created_at",
            new Date(`${range.to}T23:59:59.999`).toISOString(),
          );
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as AuditLog[];
    },
  });

  // Reset secondary filters when the date range changes
  useEffect(() => {
    setActorFilter("all");
    setActionFilter("all");
    setViewerIndex(null);
  }, [range?.from, range?.to]);

  const actors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    logs.forEach((l) => {
      const key = l.actor_id ?? "system";
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else
        map.set(key, {
          id: key,
          name: l.actor?.full_name ?? "System",
          count: 1,
        });
    });
    return Array.from(map.values());
  }, [logs]);

  const actions = useMemo(() => {
    const map = new Map<string, number>();
    logs.forEach((l) => map.set(l.action, (map.get(l.action) ?? 0) + 1));
    return Array.from(map.entries()).map(([action, count]) => ({
      action,
      count,
    }));
  }, [logs]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (actorFilter !== "all" && (l.actor_id ?? "system") !== actorFilter)
        return false;
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (term) {
        const hay = [
          l.action,
          actionMeta(l.action).label,
          l.entity_type,
          l.entity_id ?? "",
          l.actor?.full_name ?? "system",
          l.metadata ? JSON.stringify(l.metadata) : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [logs, actorFilter, actionFilter, search]);

  const lastEvent = logs[0]?.created_at;

  // Viewer controls
  const current = viewerIndex !== null ? visible[viewerIndex] : null;
  const close = useCallback(() => setViewerIndex(null), []);
  const prev = useCallback(
    () =>
      setViewerIndex((i) =>
        i === null ? i : (i - 1 + visible.length) % visible.length,
      ),
    [visible.length],
  );
  const next = useCallback(
    () => setViewerIndex((i) => (i === null ? i : (i + 1) % visible.length)),
    [visible.length],
  );

  useEffect(() => {
    if (viewerIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [viewerIndex, close, prev, next]);

  const isRange = (from: string, to: string) =>
    range?.from === from && range?.to === to;

  const quick = [
    { label: "Latest", active: range === null, set: () => setRange(null) },
    {
      label: "Today",
      active: isRange(today, today),
      set: () => setRange({ from: today, to: today }),
    },
    {
      label: "Yesterday",
      active: isRange(yesterday, yesterday),
      set: () => setRange({ from: yesterday, to: yesterday }),
    },
    {
      label: "7 days",
      active: isRange(weekAgo, today),
      set: () => setRange({ from: weekAgo, to: today }),
    },
  ];

  const rangeLabel = !range
    ? "Latest 200 events"
    : range.from === range.to
      ? formatDate(range.from, "long")
      : `${formatDate(range.from)} – ${formatDate(range.to)}`;

  const hasStats = !isLoading && logs.length > 0;
  const filtersActive =
    actorFilter !== "all" || actionFilter !== "all" || search !== "";

  return (
    <div className="space-y-6">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
              <Shield className="h-3.5 w-3.5" />
              Admin Activity
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Audit Logs
            </h1>
            <p className="mt-1 text-sm text-white/70">{rangeLabel}</p>
          </div>

          {hasStats && (
            <div className="flex flex-wrap gap-3">
              <StatChip icon={Activity} label="Events" value={logs.length} />
              <StatChip icon={Users} label="Admins" value={actors.length} />
              <StatChip
                icon={Clock}
                label="Last event"
                value={lastEvent ? formatDate(lastEvent, "time") : "—"}
              />
            </div>
          )}
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
                placeholder="Action, admin, entity…"
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
                value={range && range.from === range.to ? range.from : ""}
                max={today}
                onChange={(e) =>
                  e.target.value
                    ? setRange({ from: e.target.value, to: e.target.value })
                    : setRange(null)
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            {quick.map((q) => (
              <button
                key={q.label}
                onClick={q.set}
                className={cn(
                  "rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors",
                  q.active
                    ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
                )}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action chips */}
        {actions.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Action
            </span>
            <Chip
              active={actionFilter === "all"}
              onClick={() => setActionFilter("all")}
            >
              All <span className="opacity-70">({logs.length})</span>
            </Chip>
            {actions.map((a) => (
              <Chip
                key={a.action}
                active={actionFilter === a.action}
                onClick={() => setActionFilter(a.action)}
              >
                {actionMeta(a.action).label}{" "}
                <span className="opacity-70">({a.count})</span>
              </Chip>
            ))}
          </div>
        )}

        {/* Admin chips */}
        {actors.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Admin
            </span>
            <Chip
              active={actorFilter === "all"}
              onClick={() => setActorFilter("all")}
            >
              All <span className="opacity-70">({logs.length})</span>
            </Chip>
            {actors.map((a) => (
              <Chip
                key={a.id}
                active={actorFilter === a.id}
                onClick={() => setActorFilter(a.id)}
              >
                {a.name} <span className="opacity-70">({a.count})</span>
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* ───────── Content ───────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200"
            />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 py-20 text-center">
          <div className="mb-4 rounded-full bg-brand-50 p-5 ring-8 ring-brand-50/50">
            <Shield className="h-8 w-8 text-brand-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            No audit logs {range ? "for this period" : "yet"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            {range
              ? "Try a wider date range to see more activity."
              : "Admin actions will be recorded here as they happen."}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No matching events"
          description="Nothing matches your current filters. Try clearing the search or chips."
          action={
            filtersActive ? (
              <button
                className="btn-secondary"
                onClick={() => {
                  setSearch("");
                  setActorFilter("all");
                  setActionFilter("all");
                }}
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((log, i) => {
            const meta = actionMeta(log.action);
            const Icon = meta.icon;
            const name = log.actor?.full_name ?? "System";
            return (
              <button
                key={log.id}
                onClick={() => setViewerIndex(i)}
                className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                {/* time badge */}
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-300 group-hover:scale-110",
                      meta.tone,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">
                    {formatDate(log.created_at, "time")}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900">
                    {meta.label}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-slate-500">
                    <Store className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    {humanize(log.entity_type)}
                    {log.entity_id && (
                      <span className="font-mono text-xs text-slate-400">
                        · {log.entity_id.slice(0, 8)}…
                      </span>
                    )}
                  </p>
                </div>

                {/* footer */}
                <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-400 text-[11px] font-bold text-brand-950">
                    {initials(log.actor?.full_name)}
                  </span>
                  <span className="truncate text-sm font-medium text-slate-700">
                    {name}
                  </span>
                  <span className="ml-auto shrink-0 text-xs text-slate-400">
                    {formatDate(log.created_at)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ───────── Full-screen viewer ───────── */}
      {current && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-brand-950/95 backdrop-blur-md"
          onClick={close}
        >
          {/* top bar */}
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 text-white sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-400 text-sm font-bold text-brand-950">
                {initials(current.actor?.full_name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {current.actor?.full_name ?? "System"}
                </p>
                <p className="truncate text-xs text-white/60">
                  {formatDate(current.created_at, "datetime")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-white/10 px-3 py-1 text-xs font-medium sm:inline">
                {(viewerIndex ?? 0) + 1} / {visible.length}
              </span>
              <button
                onClick={close}
                className="rounded-full bg-white/10 p-2.5 transition hover:bg-brand-600"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* detail stage */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-20">
            {visible.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                className="absolute left-2 z-10 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/25 sm:left-5"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            <DetailPanel log={current} key={current.id} />

            {visible.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                className="absolute right-2 z-10 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/25 sm:right-5"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          {/* icon strip */}
          {visible.length > 1 && (
            <div
              className="flex justify-center gap-2 overflow-x-auto px-4 py-4"
              onClick={(e) => e.stopPropagation()}
            >
              {visible.slice(0, 40).map((l, i) => {
                const Icon = actionMeta(l.action).icon;
                return (
                  <button
                    key={l.id}
                    onClick={() => setViewerIndex(i)}
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-2 transition",
                      i === viewerIndex
                        ? "scale-110 ring-gold-400"
                        : "opacity-50 ring-transparent hover:opacity-100",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ───────── Small helper components ───────── */

function DetailPanel({ log }: { log: AuditLog }) {
  const meta = actionMeta(log.action);
  const Icon = meta.icon;
  const entries = log.metadata ? Object.entries(log.metadata) : [];

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="max-h-full w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-white/10"
    >
      <div className="flex items-center gap-4 border-b border-slate-100 p-5">
        <span
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
            meta.tone,
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-slate-900">
            {meta.label}
          </h3>
          <p className="truncate font-mono text-xs text-slate-400">
            {log.action}
          </p>
        </div>
      </div>

      <dl className="divide-y divide-slate-100 text-sm">
        <Row label="Admin" value={log.actor?.full_name ?? "System"} />
        <Row label="When" value={formatDate(log.created_at, "datetime")} />
        <Row label="Entity" value={humanize(log.entity_type)} />
        {log.entity_id && <Row label="Entity ID" value={log.entity_id} mono />}
      </dl>

      {entries.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 p-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Details
          </p>
          <dl className="space-y-2 text-sm">
            {entries.map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-28 shrink-0 text-slate-500">{humanize(k)}</dt>
                <dd className="min-w-0 break-words font-medium text-slate-800">
                  {formatValue(v)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-3 px-5 py-3">
      <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
      <dd
        className={cn(
          "min-w-0 break-all font-medium text-slate-800",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

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
