import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatDate, getTodayISO, cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Download,
  FileText,
  Calendar,
  Users,
  Search,
  X,
  ClipboardList,
  CheckCircle2,
  Hourglass,
  TrendingUp,
  BarChart3,
  Store,
  AlertTriangle,
} from "lucide-react";
import type { Visit, Profile } from "@/types";

type VisitRow = Visit & {
  agent?: { full_name: string; employee_id: string | null } | null;
  outlet?: {
    name: string;
    outlet_code: string | null;
    area: string | null;
  } | null;
};

type StatusKey = "all" | "completed" | "open" | "cancelled";

const PAGE_SIZE = 50;

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function localISO(d: Date) {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
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

function duration(from?: string | null, to?: string | null) {
  if (!from || !to) return "—";
  const mins = Math.round(
    (new Date(to).getTime() - new Date(from).getTime()) / 60000,
  );
  if (isNaN(mins) || mins < 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

const isOpen = (s: string) => s === "pending" || s === "in_progress";

export default function ReportsPage() {
  const today = getTodayISO();

  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [agentFilter, setAgentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);

  // Allow either order of dates without breaking the query
  const rangeStart = fromDate <= toDate ? fromDate : toDate;
  const rangeEnd = fromDate <= toDate ? toDate : fromDate;
  const reversed = fromDate > toDate;

  const { data: agents = [] } = useQuery({
    queryKey: ["admin-agents-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "agent")
        .order("full_name");
      if (error) throw error;
      return data as Pick<Profile, "id" | "full_name">[];
    },
  });

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["admin-report-visits", rangeStart, rangeEnd, agentFilter],
    queryFn: async () => {
      const start = new Date(`${rangeStart}T00:00:00`).toISOString();
      const end = new Date(`${rangeEnd}T23:59:59.999`).toISOString();

      let q = supabase
        .from("visits")
        .select(
          "*, agent:profiles!agent_id(full_name, employee_id), outlet:outlets(name, outlet_code, area)",
        )
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false })
        .limit(500);

      if (agentFilter) q = q.eq("agent_id", agentFilter);

      const { data, error } = await q;
      if (error) throw error;
      return data as VisitRow[];
    },
  });

  // Reset paging/filters when the data set changes
  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [rangeStart, rangeEnd, agentFilter, statusFilter, search]);

  useEffect(() => {
    setStatusFilter("all");
    setSearch("");
  }, [rangeStart, rangeEnd, agentFilter]);

  // Stats (always for the whole loaded range)
  const completed = visits.filter((v) => v.status === "completed").length;
  const open = visits.filter((v) => isOpen(v.status)).length;
  const cancelled = visits.filter((v) => v.status === "cancelled").length;
  const rate = visits.length
    ? Math.round((completed / visits.length) * 100)
    : 0;

  // Table rows (after status + search filters)
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return visits.filter((v) => {
      if (statusFilter === "completed" && v.status !== "completed")
        return false;
      if (statusFilter === "open" && !isOpen(v.status)) return false;
      if (statusFilter === "cancelled" && v.status !== "cancelled")
        return false;
      if (!term) return true;
      return (
        (v.outlet?.name ?? "").toLowerCase().includes(term) ||
        (v.outlet?.outlet_code ?? "").toLowerCase().includes(term) ||
        (v.agent?.full_name ?? "").toLowerCase().includes(term)
      );
    });
  }, [visits, statusFilter, search]);

  // Visits by day (only for ranges up to 31 days)
  const daily = useMemo(() => {
    const start = new Date(`${rangeStart}T12:00:00`);
    const end = new Date(`${rangeEnd}T12:00:00`);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    if (days < 2 || days > 31) return null;

    const map = new Map<string, { done: number; other: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      map.set(localISO(d), { done: 0, other: 0 });
    }
    visits.forEach((v) => {
      const key = localISO(new Date(v.created_at));
      const slot = map.get(key);
      if (!slot) return;
      if (v.status === "completed") slot.done += 1;
      else slot.other += 1;
    });
    const list = Array.from(map, ([date, v]) => ({ date, ...v }));
    const max = Math.max(1, ...list.map((d) => d.done + d.other));
    return { list, max };
  }, [visits, rangeStart, rangeEnd]);

  const exportCsv = () => {
    const headers = [
      "Date",
      "Outlet",
      "Outlet Code",
      "Area",
      "Promoter",
      "Employee ID",
      "Check-in",
      "Check-out",
      "Duration",
      "Status",
    ];
    const lines = rows.map((v) => [
      formatDate(v.created_at),
      v.outlet?.name ?? "",
      v.outlet?.outlet_code ?? "",
      v.outlet?.area ?? "",
      v.agent?.full_name ?? "",
      v.agent?.employee_id ?? "",
      v.check_in_time ? formatDate(v.check_in_time, "datetime") : "",
      v.check_out_time ? formatDate(v.check_out_time, "datetime") : "",
      duration(v.check_in_time, v.check_out_time),
      v.status,
    ]);
    const csv = [headers, ...lines]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visits-report-${rangeStart}-to-${rangeEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const quickRanges = [
    { label: "Today", from: today, to: today },
    {
      label: "Yesterday",
      from: shiftDate(today, -1),
      to: shiftDate(today, -1),
    },
    { label: "Last 7 days", from: shiftDate(today, -6), to: today },
    { label: "This month", from: `${today.slice(0, 7)}-01`, to: today },
  ];

  const selectedAgentName = agents.find((a) => a.id === agentFilter)?.full_name;
  const rangeLabel =
    rangeStart === rangeEnd
      ? formatDate(rangeStart, "long")
      : `${formatDate(rangeStart)} – ${formatDate(rangeEnd)}`;

  return (
    <div className="space-y-6">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
              <BarChart3 className="h-3.5 w-3.5" />
              Visit Activity
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Reports
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {rangeLabel}
              {selectedAgentName
                ? ` · ${selectedAgentName}`
                : " · All promoters"}
            </p>
          </div>

          <button
            onClick={exportCsv}
            disabled={!rows.length}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-400 px-5 py-3 text-sm font-semibold text-brand-950 shadow-md transition hover:bg-gold-300 hover:shadow-lg disabled:pointer-events-none disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* ───────── Filters ───────── */}
      <div className="card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr]">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-brand-600" /> From
            </label>
            <input
              type="date"
              className="input"
              value={fromDate}
              max={today}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-brand-600" /> To
            </label>
            <input
              type="date"
              className="input"
              value={toDate}
              max={today}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Users className="h-3.5 w-3.5 text-brand-600" /> Promoter
            </label>
            <select
              className="input"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
            >
              <option value="">All promoters</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Quick range
          </span>
          {quickRanges.map((q) => (
            <Chip
              key={q.label}
              active={fromDate === q.from && toDate === q.to}
              onClick={() => {
                setFromDate(q.from);
                setToDate(q.to);
              }}
            >
              {q.label}
            </Chip>
          ))}
        </div>

        {reversed && (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            “From” is after “To” — showing {formatDate(rangeStart)} to{" "}
            {formatDate(rangeEnd)}.
          </p>
        )}
      </div>

      {/* ───────── Stat cards ───────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={ClipboardList}
          label="Total visits"
          value={visits.length}
          tone="brand"
          loading={isLoading}
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={completed}
          tone="emerald"
          loading={isLoading}
        />
        <StatCard
          icon={Hourglass}
          label="Pending / In progress"
          value={open}
          tone="amber"
          loading={isLoading}
        />
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Completion rate
            </p>
            <span className="rounded-lg bg-gold-300/30 p-2 text-gold-500">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {isLoading ? "–" : `${rate}%`}
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-gold-400 transition-all duration-500"
              style={{ width: `${rate}%` }}
            />
          </div>
        </div>
      </div>

      {/* ───────── Visits by day ───────── */}
      {daily && !isLoading && visits.length > 0 && (
        <div className="card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <BarChart3 className="h-4 w-4 text-brand-600" /> Visits by day
            </h2>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" />
                Completed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-gold-400" />
                Other
              </span>
            </div>
          </div>

          <div className="flex h-40 items-end gap-1.5 overflow-x-auto sm:gap-2">
            {daily.list.map((d) => {
              const total = d.done + d.other;
              return (
                <div
                  key={d.date}
                  className="group flex h-full min-w-[22px] flex-1 flex-col items-center justify-end"
                  title={`${formatDate(d.date)} — ${total} visits (${d.done} completed)`}
                >
                  <span className="mb-1 text-[10px] font-semibold text-slate-500 opacity-0 transition-opacity group-hover:opacity-100">
                    {total}
                  </span>
                  <div
                    className="flex w-full flex-col-reverse overflow-hidden rounded-t-md bg-slate-100"
                    style={{
                      height: `${Math.max((total / daily.max) * 100, 3)}%`,
                    }}
                  >
                    <div
                      className="bg-brand-600"
                      style={{
                        height: `${total ? (d.done / total) * 100 : 0}%`,
                      }}
                    />
                    <div
                      className="bg-gold-400"
                      style={{
                        height: `${total ? (d.other / total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="mt-1.5 text-[10px] text-slate-400">
                    {new Date(`${d.date}T12:00:00`).getDate()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ───────── Table toolbar ───────── */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          >
            All <span className="opacity-70">({visits.length})</span>
          </Chip>
          <Chip
            active={statusFilter === "completed"}
            onClick={() => setStatusFilter("completed")}
          >
            Completed <span className="opacity-70">({completed})</span>
          </Chip>
          <Chip
            active={statusFilter === "open"}
            onClick={() => setStatusFilter("open")}
          >
            Pending / In progress <span className="opacity-70">({open})</span>
          </Chip>
          {cancelled > 0 && (
            <Chip
              active={statusFilter === "cancelled"}
              onClick={() => setStatusFilter("cancelled")}
            >
              Cancelled <span className="opacity-70">({cancelled})</span>
            </Chip>
          )}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input px-9"
            placeholder="Search outlet or promoter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* ───────── Table ───────── */}
      {isLoading ? (
        <div className="card divide-y divide-slate-100 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse bg-slate-50" />
          ))}
        </div>
      ) : visits.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No data for selected filters"
          description="Try a wider date range or a different promoter."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching visits"
          description="Try a different status or search text."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-gradient-to-r from-brand-50 to-white text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3.5 font-semibold">Date</th>
                  <th className="px-5 py-3.5 font-semibold">Outlet</th>
                  <th className="px-5 py-3.5 font-semibold">Promoter</th>
                  <th className="px-5 py-3.5 font-semibold">Check-in</th>
                  <th className="px-5 py-3.5 font-semibold">Check-out</th>
                  <th className="px-5 py-3.5 font-semibold">Duration</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.slice(0, shown).map((v) => (
                  <tr
                    key={v.id}
                    className="transition-colors hover:bg-brand-50/40"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-500">
                      {formatDate(v.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                          <Store className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">
                            {v.outlet?.name ?? "—"}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {[v.outlet?.outlet_code, v.outlet?.area]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-[11px] font-bold text-gold-300">
                          {initials(v.agent?.full_name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">
                            {v.agent?.full_name ?? "—"}
                          </p>
                          {v.agent?.employee_id && (
                            <p className="truncate text-xs text-slate-400">
                              {v.agent.employee_id}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">
                      {v.check_in_time
                        ? formatDate(v.check_in_time, "time")
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">
                      {v.check_out_time
                        ? formatDate(v.check_out_time, "time")
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-medium text-slate-700">
                      {duration(v.check_in_time, v.check_out_time)}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={v.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3.5 sm:flex-row">
            <p className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {Math.min(shown, rows.length)}
              </span>{" "}
              of {rows.length} visits
              {visits.length >= 500 && " (report limited to latest 500)"}
            </p>
            {shown < rows.length && (
              <button
                className="btn-secondary !py-2"
                onClick={() => setShown((n) => n + PAGE_SIZE)}
              >
                Show more
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Small helper components ───────── */

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "brand" | "emerald" | "amber";
  loading?: boolean;
}) {
  const tones = {
    brand: { icon: "bg-brand-50 text-brand-600", value: "text-slate-900" },
    emerald: {
      icon: "bg-emerald-50 text-emerald-600",
      value: "text-emerald-600",
    },
    amber: { icon: "bg-amber-50 text-amber-600", value: "text-amber-600" },
  }[tone];

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        <span className={cn("rounded-lg p-2", tones.icon)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={cn("mt-2 text-3xl font-bold", tones.value)}>
        {loading ? "–" : value}
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
