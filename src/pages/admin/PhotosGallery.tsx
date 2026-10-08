import { useEffect, useMemo, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Image as ImageIcon,
  X,
  Store,
  Calendar,
  Camera,
  Users,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  MapPin,
  Search,
} from "lucide-react";
import { formatDate, getTodayISO, cn } from "@/lib/utils";
import type { Photo } from "@/types";

type PhotoWithRelations = Photo & {
  agent?: { full_name: string } | null;
  outlet?: { name: string } | null;
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

export default function PhotosGallery() {
  const today = getTodayISO();
  const yesterday = shiftDate(today, -1);

  const [outletId, setOutletId] = useState("");
  const [date, setDate] = useState(today);
  const [agentFilter, setAgentFilter] = useState("all");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  // Outlets for the dropdown
  const { data: outlets = [] } = useQuery({
    queryKey: ["admin-photo-outlets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outlets")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  // Photos for the selected outlet + date
  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["admin-photos", outletId, date],
    enabled: !!outletId && !!date,
    queryFn: async () => {
      const start = new Date(`${date}T00:00:00`).toISOString();
      const end = new Date(`${date}T23:59:59.999`).toISOString();

      const { data, error } = await supabase
        .from("photos")
        .select("*, agent:profiles!agent_id(full_name), outlet:outlets(name)")
        .eq("outlet_id", outletId)
        .gte("created_at", start)
        .lte("created_at", end)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return Promise.all(
        (data as PhotoWithRelations[]).map(async (p) => {
          const { data: signed } = await supabase.storage
            .from("outlet-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, signed_url: signed?.signedUrl };
        }),
      );
    },
  });

  // Reset promoter filter when outlet/date changes
  useEffect(() => {
    setAgentFilter("all");
    setViewerIndex(null);
  }, [outletId, date]);

  const selectedOutletName = outlets.find((o) => o.id === outletId)?.name;

  // Promoter chips
  const promoters = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    photos.forEach((p) => {
      const existing = map.get(p.agent_id);
      if (existing) existing.count += 1;
      else
        map.set(p.agent_id, {
          id: p.agent_id,
          name: p.agent?.full_name ?? "Unknown",
          count: 1,
        });
    });
    return Array.from(map.values());
  }, [photos]);

  const visible = useMemo(
    () =>
      agentFilter === "all"
        ? photos
        : photos.filter((p) => p.agent_id === agentFilter),
    [photos, agentFilter],
  );

  const lastUpload = photos[0]?.created_at;

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

  const downloadPhoto = async (p: PhotoWithRelations) => {
    if (!p.signed_url) return;
    try {
      const res = await fetch(p.signed_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = p.file_name ?? `photo-${p.id}.jpg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(p.signed_url, "_blank");
    }
  };

  return (
    <div className="space-y-6">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
              <Camera className="h-3.5 w-3.5" />
              Visit Evidence
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Photos Gallery
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {outletId
                ? `${selectedOutletName ?? "Outlet"} · ${formatDate(date, "long")}`
                : "Pick an outlet and a date to see what your promoters captured"}
            </p>
          </div>

          {outletId && !isLoading && photos.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <StatChip icon={ImageIcon} label="Photos" value={photos.length} />
              <StatChip
                icon={Users}
                label="Promoters"
                value={promoters.length}
              />
              <StatChip
                icon={Clock}
                label="Last upload"
                value={lastUpload ? formatDate(lastUpload, "time") : "—"}
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
                <Store className="h-3.5 w-3.5 text-brand-600" /> Outlet
              </label>
              <select
                className="input"
                value={outletId}
                onChange={(e) => setOutletId(e.target.value)}
              >
                <option value="">Select outlet</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
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
                onChange={(e) => setDate(e.target.value)}
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
        {outletId && promoters.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Promoter
            </span>
            <Chip
              active={agentFilter === "all"}
              onClick={() => setAgentFilter("all")}
            >
              All <span className="opacity-70">({photos.length})</span>
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
      {!outletId ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 py-20 text-center">
          <div className="mb-4 rounded-full bg-brand-50 p-5 ring-8 ring-brand-50/50">
            <Search className="h-8 w-8 text-brand-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            Choose an outlet to begin
          </h3>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Photos uploaded by promoters during their visits will appear here.
          </p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[4/5] animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200"
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No photos found"
          description={`No photos for ${selectedOutletName ?? "this outlet"} on ${formatDate(date)}. Try another date.`}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setViewerIndex(i)}
              className="group relative aspect-[4/5] overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {p.signed_url ? (
                <img
                  src={p.signed_url}
                  alt={`Photo by ${p.agent?.full_name ?? "promoter"}`}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <ImageIcon className="h-10 w-10" />
                </div>
              )}

              {/* time badge */}
              <span className="absolute left-2.5 top-2.5 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm">
                {formatDate(p.created_at, "time")}
              </span>

              {/* bottom overlay */}
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-400 text-[11px] font-bold text-brand-950">
                  {initials(p.agent?.full_name)}
                </span>
                <span className="truncate text-left text-sm font-medium text-white">
                  {p.agent?.full_name ?? "Unknown"}
                </span>
              </div>
            </button>
          ))}
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
                {initials(current.agent?.full_name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {current.agent?.full_name ?? "Unknown"}
                </p>
                <p className="truncate text-xs text-white/60">
                  {current.outlet?.name} ·{" "}
                  {formatDate(current.created_at, "datetime")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-white/10 px-3 py-1 text-xs font-medium sm:inline">
                {(viewerIndex ?? 0) + 1} / {visible.length}
              </span>
              {current.latitude != null && current.longitude != null && (
                <a
                  href={`https://www.google.com/maps?q=${current.latitude},${current.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full bg-white/10 p-2.5 transition hover:bg-white/20"
                  title="Open location in Maps"
                >
                  <MapPin className="h-5 w-5" />
                </a>
              )}
              <button
                onClick={() => downloadPhoto(current)}
                className="rounded-full bg-white/10 p-2.5 transition hover:bg-white/20"
                title="Download"
              >
                <Download className="h-5 w-5" />
              </button>
              <button
                onClick={close}
                className="rounded-full bg-white/10 p-2.5 transition hover:bg-brand-600"
                title="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* image stage */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-16">
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

            {current.signed_url && (
              <img
                key={current.id}
                src={current.signed_url}
                alt=""
                onClick={(e) => e.stopPropagation()}
                className="max-h-full max-w-full rounded-xl object-contain shadow-2xl ring-1 ring-white/10"
              />
            )}

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

          {/* thumbnail strip */}
          {visible.length > 1 && (
            <div
              className="flex justify-center gap-2 overflow-x-auto px-4 py-4"
              onClick={(e) => e.stopPropagation()}
            >
              {visible.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setViewerIndex(i)}
                  className={cn(
                    "h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 transition",
                    i === viewerIndex
                      ? "scale-110 ring-gold-400"
                      : "opacity-50 ring-transparent hover:opacity-100",
                  )}
                >
                  {p.signed_url && (
                    <img
                      src={p.signed_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  )}
                </button>
              ))}
            </div>
          )}
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
