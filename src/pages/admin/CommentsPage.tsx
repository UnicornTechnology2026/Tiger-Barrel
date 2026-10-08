import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  MessageSquare,
  Calendar,
  Store,
  Users,
  Clock,
  Search,
  MapPin,
  X,
} from "lucide-react";
import { formatDate, getTodayISO, cn } from "@/lib/utils";
import type { Comment } from "@/types";

type CommentWithRelations = Comment & {
  agent?: { full_name: string } | null;
  outlet?: { name: string; area?: string | null } | null;
};

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

export default function CommentsPage() {
  const today = getTodayISO();
  const yesterday = shiftDate(today, -1);

  const [date, setDate] = useState(today);
  const [outletFilter, setOutletFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["admin-comments", date],
    queryFn: async () => {
      let q = supabase
        .from("comments")
        .select(
          "*, agent:profiles!agent_id(full_name), outlet:outlets(name, area)",
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (date) {
        const start = new Date(`${date}T00:00:00`).toISOString();
        const end = new Date(`${date}T23:59:59.999`).toISOString();
        q = q.gte("created_at", start).lte("created_at", end);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as CommentWithRelations[];
    },
  });

  // Reset filters when the date changes
  useEffect(() => {
    setOutletFilter("all");
    setAgentFilter("all");
    setSearch("");
  }, [date]);

  // Options derived from the loaded comments
  const outlets = useMemo(() => {
    const map = new Map<string, string>();
    comments.forEach((c) => {
      if (c.outlet?.name) map.set(c.outlet_id, c.outlet.name);
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [comments]);

  const promoters = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    comments.forEach((c) => {
      const existing = map.get(c.agent_id);
      if (existing) existing.count += 1;
      else
        map.set(c.agent_id, {
          id: c.agent_id,
          name: c.agent?.full_name ?? "Unknown",
          count: 1,
        });
    });
    return Array.from(map.values());
  }, [comments]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return comments.filter((c) => {
      if (outletFilter !== "all" && c.outlet_id !== outletFilter) return false;
      if (agentFilter !== "all" && c.agent_id !== agentFilter) return false;
      if (!term) return true;
      return (
        c.comment_text.toLowerCase().includes(term) ||
        (c.agent?.full_name ?? "").toLowerCase().includes(term) ||
        (c.outlet?.name ?? "").toLowerCase().includes(term)
      );
    });
  }, [comments, outletFilter, agentFilter, search]);

  const lastComment = comments[0]?.created_at;
  const hasFilters =
    outletFilter !== "all" || agentFilter !== "all" || search.trim() !== "";

  return (
    <div className="space-y-6">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
              <MessageSquare className="h-3.5 w-3.5" />
              Field Remarks
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Comments
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Remarks your promoters left during outlet visits ·{" "}
              {formatDate(date, "long")}
            </p>
          </div>

          {!isLoading && comments.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <StatChip
                icon={MessageSquare}
                label="Comments"
                value={comments.length}
              />
              <StatChip
                icon={Users}
                label="Promoters"
                value={promoters.length}
              />
              <StatChip icon={Store} label="Outlets" value={outlets.length} />
              <StatChip
                icon={Clock}
                label="Latest"
                value={lastComment ? formatDate(lastComment, "time") : "—"}
              />
            </div>
          )}
        </div>
      </div>

      {/* ───────── Filters ───────── */}
      <div className="card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[auto_1fr_1fr_auto]">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Calendar className="h-3.5 w-3.5 text-brand-600" /> Date
            </label>
            <input
              type="date"
              className="input"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Store className="h-3.5 w-3.5 text-brand-600" /> Outlet
            </label>
            <select
              className="input"
              value={outletFilter}
              onChange={(e) => setOutletFilter(e.target.value)}
            >
              <option value="all">All outlets</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Search className="h-3.5 w-3.5 text-brand-600" /> Search
            </label>
            <div className="relative">
              <input
                type="text"
                className="input pr-9"
                placeholder="Comment, promoter or outlet"
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

          <div className="flex items-end gap-2">
            {[
              { label: "Today", value: today },
              { label: "Yesterday", value: yesterday },
            ].map((q) => (
              <button
                key={q.label}
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
          </div>
        </div>

        {/* Promoter chips */}
        {promoters.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Promoter
            </span>
            <Chip
              active={agentFilter === "all"}
              onClick={() => setAgentFilter("all")}
            >
              All <span className="opacity-70">({comments.length})</span>
            </Chip>
            {promoters.map((p) => (
              <Chip
                key={p.id}
                active={agentFilter === p.id}
                onClick={() => setAgentFilter(p.id)}
              >
                {p.name} <span className="opacity-70">({p.count})</span>
              </Chip>
            ))}
          </div>
        )}
      </div>

      {/* ───────── Content ───────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200"
            />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments"
          description={`No promoter remarks on ${formatDate(date)}. Try another date.`}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching comments"
          description="Try changing the outlet, promoter or search text."
          action={
            hasFilters ? (
              <button
                className="btn-secondary"
                onClick={() => {
                  setOutletFilter("all");
                  setAgentFilter("all");
                  setSearch("");
                }}
              >
                Clear filters
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-700">
              {visible.length}
            </span>{" "}
            of {comments.length} comments
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {visible.map((c) => (
              <CommentCard key={c.id} comment={c} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ───────── Small helper components ───────── */

function CommentCard({ comment: c }: { comment: CommentWithRelations }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = c.comment_text.length > 180;

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:ring-brand-300">
      {/* gold accent bar */}
      <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-gold-400 to-brand-600" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-sm font-bold text-gold-300">
            {initials(c.agent?.full_name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">
              {c.agent?.full_name ?? "Unknown"}
            </p>
            <p className="text-xs text-slate-400">
              {formatDate(c.created_at, "datetime")}
            </p>
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-100">
          {formatDate(c.created_at, "time")}
        </span>
      </div>

      <p
        className={cn(
          "mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-700",
          !expanded && "line-clamp-4",
        )}
      >
        {c.comment_text}
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          <Store className="h-3.5 w-3.5 text-brand-600" />
          {c.outlet?.name ?? "Unknown outlet"}
        </span>
        {c.outlet?.area && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
            <MapPin className="h-3.5 w-3.5" />
            {c.outlet.area}
          </span>
        )}
      </div>
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
