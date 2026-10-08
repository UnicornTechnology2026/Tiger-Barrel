import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getTodayISO, formatDate, cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Users,
  Store,
  CheckCircle2,
  Clock,
  Camera,
  MessageSquare,
  MapPin,
  Activity,
  ArrowUpRight,
  LayoutDashboard,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { DashboardStats } from "@/types";

async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = getTodayISO();

  const [
    agentsRes,
    activeAgentsRes,
    visitsRes,
    completedRes,
    photosRes,
    commentsRes,
    messagesRes,
    assignmentsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "agent"),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "agent")
      .eq("status", "active"),
    supabase
      .from("visits")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`),
    supabase
      .from("visits")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`),
    supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00`),
    supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00`),
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false),
    supabase
      .from("outlet_assignments")
      .select("*", { count: "exact", head: true })
      .eq("assigned_date", today)
      .eq("active", true),
  ]);

  const totalAssigned = assignmentsRes.count ?? 0;
  const completed = completedRes.count ?? 0;

  const { count: visitingCount } = await supabase
    .from("visits")
    .select("*", { count: "exact", head: true })
    .eq("status", "in_progress")
    .gte("created_at", `${today}T00:00:00`);

  return {
    totalAgents: agentsRes.count ?? 0,
    activeAgents: activeAgentsRes.count ?? 0,
    agentsVisiting: visitingCount ?? 0,
    totalAssignedOutlets: totalAssigned,
    completedVisits: completed,
    pendingVisits: Math.max(0, totalAssigned - completed),
    totalPhotos: photosRes.count ?? 0,
    totalComments: commentsRes.count ?? 0,
    unreadMessages: messagesRes.count ?? 0,
  };
}

type VisitRow = {
  id: string;
  status: string;
  check_in_time: string | null;
  created_at: string;
  agent?: { full_name?: string } | null;
  outlet?: { name?: string } | null;
};

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  in_progress: "bg-blue-50 text-blue-700 ring-blue-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
};

function statusLabel(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
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

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function AdminDashboard() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: fetchDashboardStats,
    refetchInterval: 60_000,
  });

  const { data: recentVisits = [], isLoading: visitsLoading } = useQuery({
    queryKey: ["admin-recent-visits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("*, agent:profiles!agent_id(full_name), outlet:outlets(name)")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as VisitRow[];
    },
  });

  const statusChips = useMemo(() => {
    const map = new Map<string, number>();
    recentVisits.forEach((v) =>
      map.set(v.status, (map.get(v.status) ?? 0) + 1),
    );
    return Array.from(map.entries());
  }, [recentVisits]);

  const visibleVisits = useMemo(
    () =>
      statusFilter === "all"
        ? recentVisits
        : recentVisits.filter((v) => v.status === statusFilter),
    [recentVisits, statusFilter],
  );

  const ready = !isLoading && !!stats;
  const pct =
    ready && stats.totalAssignedOutlets > 0
      ? Math.min(
          100,
          Math.round(
            (stats.completedVisits / stats.totalAssignedOutlets) * 100,
          ),
        )
      : 0;

  const tiles: {
    label: string;
    value: number | undefined;
    icon: LucideIcon;
    tone: string;
    href?: string;
  }[] = [
    {
      label: "Total Promoters",
      value: stats?.totalAgents,
      icon: Users,
      tone: "bg-blue-50 text-blue-700 ring-blue-200",
      href: "/admin/agents",
    },
    {
      label: "Active Promoters",
      value: stats?.activeAgents,
      icon: Activity,
      tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    },
    {
      label: "Currently Visiting",
      value: stats?.agentsVisiting,
      icon: MapPin,
      tone: "bg-violet-50 text-violet-700 ring-violet-200",
      href: "/admin/tracking",
    },
    {
      label: "Assigned Outlets",
      value: stats?.totalAssignedOutlets,
      icon: Store,
      tone: "bg-amber-50 text-amber-700 ring-amber-200",
      href: "/admin/outlets",
    },
    {
      label: "Completed Visits",
      value: stats?.completedVisits,
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-700 ring-emerald-200",
      href: "/admin/visits",
    },
    {
      label: "Pending Visits",
      value: stats?.pendingVisits,
      icon: Clock,
      tone: "bg-orange-50 text-orange-700 ring-orange-200",
      href: "/admin/visits",
    },
    {
      label: "Photos Today",
      value: stats?.totalPhotos,
      icon: Camera,
      tone: "bg-pink-50 text-pink-700 ring-pink-200",
      href: "/admin/photos",
    },
    {
      label: "Unread Messages",
      value: stats?.unreadMessages,
      icon: MessageSquare,
      tone: "bg-sky-50 text-sky-700 ring-sky-200",
      href: "/admin/messages",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
              <LayoutDashboard className="h-3.5 w-3.5" />
              Live Overview
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {greeting()} · {formatDate(getTodayISO(), "long")}
            </p>
          </div>

          {ready && (
            <div className="flex flex-wrap gap-3">
              <StatChip
                icon={Activity}
                label="Active"
                value={stats.activeAgents}
              />
              <StatChip
                icon={MapPin}
                label="Visiting"
                value={stats.agentsVisiting}
              />
              <StatChip
                icon={CheckCircle2}
                label="Done today"
                value={`${pct}%`}
              />
            </div>
          )}
        </div>
      </div>

      {/* ───────── Today's progress ───────── */}
      {ready && stats.totalAssignedOutlets > 0 && (
        <div className="card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <CheckCircle2 className="h-3.5 w-3.5 text-brand-600" />
              Today&apos;s visit progress
            </span>
            <span className="text-sm font-semibold text-slate-700">
              {stats.completedVisits} / {stats.totalAssignedOutlets}
              <span className="ml-1.5 font-normal text-slate-400">
                ({pct}%)
              </span>
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-gold-400 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* ───────── Stat tiles ───────── */}
      {!ready ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {tiles.map((t) => (
            <StatTile key={t.label} {...t} value={t.value ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── Small helper components ───────── */

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl ring-1 ring-inset transition-transform duration-300 group-hover:scale-110",
            tone,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        {href && (
          <ArrowUpRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-brand-600" />
        )}
      </div>
      <div>
        <p className="text-3xl font-bold tracking-tight text-slate-900">
          {value}
        </p>
        <p className="mt-0.5 text-sm text-slate-500">{label}</p>
      </div>
    </>
  );

  const cls =
    "group relative flex flex-col justify-between gap-4 overflow-hidden rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition-all duration-300 sm:p-5";
  return href ? (
    <Link
      to={href}
      className={cn(
        cls,
        "hover:-translate-y-1 hover:shadow-xl hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
      )}
    >
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
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
