import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Image as ImageIcon,
  Camera,
  CalendarDays,
  Store,
  Images,
  X,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
} from "lucide-react";
import { formatDate, getTodayISO, cn } from "@/lib/utils";
import type { Photo } from "@/types";

type PhotoWithOutlet = Photo & { outlet?: { name: string } | null };
type Filter = "all" | "today" | "week";

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
}

function dayLabel(key: string, today: string) {
  const d = new Date(`${key}T12:00:00`);
  const t = new Date(`${today}T12:00:00`);
  const diff = Math.round((t.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return formatDate(d, "long");
}

export default function MyPhotos() {
  const { profile } = useAuth();
  const today = getTodayISO();
  const [filter, setFilter] = useState<Filter>("all");
  const [outletFilter, setOutletFilter] = useState("all");
  const [viewerId, setViewerId] = useState<string | null>(null);

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["agent-photos", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("photos")
        .select("*, outlet:outlets(name)")
        .eq("agent_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      return Promise.all(
        (data as PhotoWithOutlet[]).map(async (p) => {
          const { data: signed } = await supabase.storage
            .from("outlet-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, signed_url: signed?.signedUrl };
        }),
      );
    },
    enabled: !!profile,
  });

  /* ───────── Stats ───────── */
  const stats = useMemo(() => {
    const todayCount = photos.filter(
      (p) => dayKey(p.created_at) === today,
    ).length;
    const outletIds = new Set(photos.map((p) => p.outlet_id));
    const days = new Set(photos.map((p) => dayKey(p.created_at)));
    return {
      total: photos.length,
      today: todayCount,
      outlets: outletIds.size,
      days: days.size,
    };
  }, [photos, today]);

  /* ───────── Outlet chips ───────── */
  const outletOptions = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    photos.forEach((p) => {
      const cur = map.get(p.outlet_id);
      map.set(p.outlet_id, {
        name: p.outlet?.name ?? "Outlet",
        count: (cur?.count ?? 0) + 1,
      });
    });
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [photos]);

  /* ───────── Filtering + grouping ───────── */
  const filtered = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);

    return photos.filter((p) => {
      if (outletFilter !== "all" && p.outlet_id !== outletFilter) return false;
      if (filter === "today") return dayKey(p.created_at) === today;
      if (filter === "week") return new Date(p.created_at) >= weekAgo;
      return true;
    });
  }, [photos, filter, outletFilter, today]);

  const groups = useMemo(() => {
    const map = new Map<string, PhotoWithOutlet[]>();
    filtered.forEach((p) => {
      const k = dayKey(p.created_at);
      map.set(k, [...(map.get(k) ?? []), p]);
    });
    return Array.from(map.entries());
  }, [filtered]);

  /* ───────── Lightbox ───────── */
  const viewerIndex = viewerId
    ? filtered.findIndex((p) => p.id === viewerId)
    : -1;
  const current = viewerIndex >= 0 ? filtered[viewerIndex] : null;

  const step = useCallback(
    (dir: 1 | -1) => {
      if (viewerIndex < 0) return;
      const next = filtered[viewerIndex + dir];
      if (next) setViewerId(next.id);
    },
    [filtered, viewerIndex],
  );

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerId(null);
      if (e.key === "ArrowLeft") step(-1);
      if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [current, step]);

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
                <Camera className="h-3.5 w-3.5" />
                Photo Library
              </div>
              <h1 className="text-xl font-bold tracking-tight">My Photos</h1>
              <p className="mt-0.5 text-sm text-white/70">
                {formatDate(new Date(), "long")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold leading-none">{stats.total}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-white/60">
                Total photos
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2.5">
            <StatChip icon={Camera} label="Today" value={stats.today} />
            <StatChip icon={Store} label="Outlets" value={stats.outlets} />
            <StatChip icon={CalendarDays} label="Days" value={stats.days} />
          </div>
        </div>
      </div>

      {/* ───────── Filters ───────── */}
      {!isLoading && photos.length > 0 && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(
              [
                ["all", "All"],
                ["today", "Today"],
                ["week", "Last 7 days"],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ring-inset transition-colors",
                  filter === key
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-white text-slate-600 ring-slate-200 hover:ring-brand-300",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {outletOptions.length > 1 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              <button
                onClick={() => setOutletFilter("all")}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
                  outletFilter === "all"
                    ? "bg-gold-400 text-brand-950 ring-gold-500/30"
                    : "bg-white text-slate-600 ring-slate-200",
                )}
              >
                All outlets
              </button>
              {outletOptions.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setOutletFilter(o.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors",
                    outletFilter === o.id
                      ? "bg-gold-400 text-brand-950 ring-gold-500/30"
                      : "bg-white text-slate-600 ring-slate-200",
                  )}
                >
                  <span className="max-w-[140px] truncate">{o.name}</span>
                  <span className="rounded-full bg-black/10 px-1.5 text-[10px] font-bold">
                    {o.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ───────── Content ───────── */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-xl bg-gradient-to-br from-slate-100 to-slate-200"
            />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-14 text-center">
          <div className="mb-4 rounded-full bg-brand-50 p-5 ring-8 ring-brand-50/50">
            <Images className="h-8 w-8 text-brand-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            No photos yet
          </h3>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Photos you capture during outlet visits will appear here.
          </p>
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 ring-1 ring-slate-200">
          No photos match these filters.
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map(([key, items]) => (
            <section key={key}>
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <CalendarDays className="h-4 w-4 text-brand-600" />
                  {dayLabel(key, today)}
                </h2>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                  {items.length}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {items.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setViewerId(p.id)}
                    className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 shadow-sm ring-1 ring-slate-200 transition-all active:scale-[0.97]"
                  >
                    {p.signed_url ? (
                      <img
                        src={p.signed_url}
                        alt={p.outlet?.name ?? "Visit photo"}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-5">
                      <p className="truncate text-[10px] font-medium text-white">
                        {p.outlet?.name}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ───────── Lightbox ───────── */}
      {current && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={() => setViewerId(null)}
        >
          <div
            className="flex items-center justify-between px-4 py-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {current.outlet?.name ?? "Outlet"}
              </p>
              <p className="text-xs text-white/60">
                {viewerIndex + 1} of {filtered.length}
              </p>
            </div>
            <button
              onClick={() => setViewerId(null)}
              className="rounded-full bg-white/10 p-2 hover:bg-white/20"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-2">
            {current.signed_url && (
              <img
                src={current.signed_url}
                alt=""
                className="max-h-full max-w-full rounded-lg object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            {viewerIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                className="absolute left-2 rounded-full bg-white/15 p-2 text-white backdrop-blur hover:bg-white/25"
                aria-label="Previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}
            {viewerIndex < filtered.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                className="absolute right-2 rounded-full bg-white/15 p-2 text-white backdrop-blur hover:bg-white/25"
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}
          </div>

          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs text-white/70"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gold-300" />
              {formatDate(current.created_at, "datetime")}
            </span>
            {current.latitude != null && current.longitude != null && (
              <a
                href={`https://www.google.com/maps?q=${current.latitude},${current.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-white"
              >
                <MapPin className="h-3.5 w-3.5 text-gold-300" />
                View location
              </a>
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
