import { useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Link } from "react-router-dom";
import {
  MapPin,
  Store,
  Search,
  ChevronRight,
  Navigation,
  Clock,
  CheckCircle2,
  Radio,
  Hourglass,
  Hash,
  ExternalLink,
  Filter,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate, getTodayISO, cn } from "@/lib/utils";
import type { OutletAssignment, Visit } from "@/types";

type StatusFilter = "all" | "pending" | "in_progress" | "completed";

export default function MyOutlets() {
  const { profile } = useAuth();
  const today = getTodayISO();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");

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

  // Same query key as the dashboard, so this is served from cache
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

  const visitByOutlet = useMemo(
    () => Object.fromEntries(visits.map((v) => [v.outlet_id, v])),
    [visits],
  );

  const statusOf = (outletId: string) =>
    visitByOutlet[outletId]?.status ?? "pending";

  const counts = useMemo(() => {
    const c = { all: 0, pending: 0, in_progress: 0, completed: 0 };
    assignments.forEach((a) => {
      if (!a.outlet) return;
      c.all += 1;
      const s = statusOf(a.outlet.id);
      if (s === "in_progress") c.in_progress += 1;
      else if (s === "completed") c.completed += 1;
      else c.pending += 1;
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, visitByOutlet]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignments.filter((a) => {
      const o = a.outlet;
      if (!o) return false;

      const s = statusOf(o.id);
      if (filter === "completed" && s !== "completed") return false;
      if (filter === "in_progress" && s !== "in_progress") return false;
      if (filter === "pending" && (s === "completed" || s === "in_progress"))
        return false;

      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        (o.address ?? "").toLowerCase().includes(q) ||
        (o.area ?? "").toLowerCase().includes(q) ||
        o.outlet_code.toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignments, visitByOutlet, search, filter]);

  const chips: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "pending", label: "Pending" },
    { key: "in_progress", label: "In progress" },
    { key: "completed", label: "Completed" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-36 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200"
          />
        ))}
      </div>
    );
  }

  if (!assignments.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-16 text-center">
        <div className="mb-4 rounded-full bg-brand-50 p-5 ring-8 ring-brand-50/50">
          <Store className="h-8 w-8 text-brand-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">
          No outlets assigned
        </h3>
        <p className="mt-1 max-w-xs text-sm text-slate-500">
          No outlets assigned for today. Contact your administrator.
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
            <Store className="h-3.5 w-3.5" />
            Today&apos;s Route
          </div>
          <h1 className="text-xl font-bold tracking-tight">My Outlets</h1>
          <p className="mt-0.5 text-sm text-white/70">
            {formatDate(new Date(), "long")} · {counts.all} outlet
            {counts.all === 1 ? "" : "s"} assigned
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <StatChip icon={Hourglass} label="Pending" value={counts.pending} />
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
          placeholder="Outlet name, area or code..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {chips.map((c) => (
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

      {/* ───────── Outlet cards ───────── */}
      {visible.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="No outlets found"
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
        <div className="space-y-3">
          {visible.map((a, index) => {
            const outlet = a.outlet;
            if (!outlet) return null;
            const status = statusOf(outlet.id);
            const live = status === "in_progress";
            const done = status === "completed";
            const place = [outlet.area, outlet.city].filter(Boolean).join(", ");

            return (
              <div
                key={a.id}
                className={cn(
                  "relative overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition-all duration-300",
                  live
                    ? "ring-emerald-200"
                    : "ring-slate-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-brand-300",
                )}
              >
                {live && (
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 to-emerald-600" />
                )}

                {/* Tap area → outlet details */}
                <Link
                  to={`/agent/outlets/${outlet.id}`}
                  className="flex items-start gap-3 p-4 pb-3"
                >
                  <span
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ring-1 ring-inset",
                      done || live
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
                      <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                    </div>

                    <p className="mt-0.5 flex items-start gap-1 text-xs text-slate-500">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="line-clamp-2">{outlet.address}</span>
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <StatusBadge status={status} />
                      {outlet.status !== "active" && (
                        <StatusBadge status={outlet.status} />
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                        <Hash className="h-3 w-3" />
                        {outlet.outlet_code}
                      </span>
                      {place && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                          <MapPin className="h-3 w-3" />
                          {place}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Actions */}
                <div className="flex gap-2 px-4 pb-4">
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
