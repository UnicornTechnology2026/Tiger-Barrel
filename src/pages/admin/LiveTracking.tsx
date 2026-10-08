import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getTodayISO, formatDate, cn } from "@/lib/utils";
import { fixLeafletIcons } from "@/lib/leaflet-fix";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  MapPin,
  Navigation,
  ExternalLink,
  RefreshCw,
  Users,
  Radio,
  Clock,
  Search,
  Crosshair,
  X,
  CheckCircle2,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import type { LocationLog, Profile, Visit } from "@/types";

type MapLoc = {
  agentId: string;
  lat: number;
  lng: number;
  name: string;
  accuracy?: number;
  outletName?: string;
  updatedAt?: string;
  status?: string;
};

type VisitWithRelations = Visit & {
  agent?: Profile;
  outlet?: { name: string; latitude: number; longitude: number };
};

type AgentFilter = "all" | "visiting" | "completed" | "no_gps";

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/* ───────────────────────── Map ───────────────────────── */

function AgentMap({
  locations,
  selectedAgentId,
  onSelect,
}: {
  locations: MapLoc[];
  selectedAgentId: string | null;
  onSelect: (agentId: string) => void;
}) {
  const [mods, setMods] = useState<{
    MapContainer: React.ComponentType<Record<string, unknown>>;
    TileLayer: React.ComponentType<Record<string, unknown>>;
    Marker: React.ComponentType<Record<string, unknown>>;
    Popup: React.ComponentType<Record<string, unknown>>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([import("leaflet"), import("react-leaflet")]).then(([, rl]) => {
      if (cancelled) return;
      fixLeafletIcons();
      setMods({
        MapContainer: rl.MapContainer as unknown as React.ComponentType<
          Record<string, unknown>
        >,
        TileLayer: rl.TileLayer as unknown as React.ComponentType<
          Record<string, unknown>
        >,
        Marker: rl.Marker as unknown as React.ComponentType<
          Record<string, unknown>
        >,
        Popup: rl.Popup as unknown as React.ComponentType<
          Record<string, unknown>
        >,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mods) {
    return (
      <div className="h-full w-full animate-pulse bg-gradient-to-br from-slate-100 to-slate-200" />
    );
  }

  if (locations.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
        <div className="rounded-full bg-brand-50 p-5 ring-8 ring-brand-50/50">
          <MapPin className="h-8 w-8 text-brand-600" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">
          No locations to show
        </h3>
        <p className="max-w-xs text-sm text-slate-500">
          Locations appear when promoters check in or share GPS during a visit.
        </p>
      </div>
    );
  }

  const { MapContainer, TileLayer, Marker, Popup } = mods;
  const focused = selectedAgentId
    ? locations.find((l) => l.agentId === selectedAgentId)
    : null;
  const center: [number, number] = focused
    ? [focused.lat, focused.lng]
    : [locations[0].lat, locations[0].lng];

  return (
    <MapContainer
      key={`${center[0]}-${center[1]}-${locations.length}`}
      center={center}
      zoom={focused ? 15 : 12}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((loc) => (
        <Marker
          key={loc.agentId}
          position={[loc.lat, loc.lng]}
          eventHandlers={{ click: () => onSelect(loc.agentId) }}
        >
          <Popup>
            <strong>{loc.name}</strong>
            {loc.outletName && (
              <>
                <br />
                Outlet: {loc.outletName}
              </>
            )}
            {loc.accuracy != null && (
              <>
                <br />
                Accuracy: {Math.round(loc.accuracy)}m
              </>
            )}
            {loc.updatedAt && (
              <>
                <br />
                {formatDate(loc.updatedAt, "datetime")}
              </>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

/* ───────────────────────── Page ───────────────────────── */

export default function LiveTracking() {
  const today = getTodayISO();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AgentFilter>("all");

  const {
    data: activeVisits = [],
    refetch: refetchVisits,
    isFetching: fetchingVisits,
  } = useQuery({
    queryKey: ["admin-active-visits", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select(
          "*, agent:profiles!agent_id(id, full_name, profile_photo_url), outlet:outlets(name, latitude, longitude)",
        )
        .in("status", ["in_progress", "completed"])
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as VisitWithRelations[];
    },
    refetchInterval: 15_000,
  });

  const {
    data: recentLocations = [],
    refetch: refetchLocs,
    isFetching: fetchingLocs,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["admin-recent-locations", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("location_logs")
        .select("*, agent:profiles!agent_id(full_name)")
        .gte("recorded_at", `${today}T00:00:00`)
        .order("recorded_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as (LocationLog & { agent?: { full_name: string } })[];
    },
    refetchInterval: 15_000,
  });

  const { data: allAgents = [], isLoading: loadingAgents } = useQuery({
    queryKey: ["admin-agents-active-tracking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, status")
        .eq("role", "agent")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data as Pick<Profile, "id" | "full_name" | "status">[];
    },
  });

  const latestByAgent = useMemo(() => {
    const map = new Map<
      string,
      LocationLog & { agent?: { full_name: string } }
    >();
    for (const loc of recentLocations) {
      if (!map.has(loc.agent_id)) map.set(loc.agent_id, loc);
    }
    return map;
  }, [recentLocations]);

  const latestVisitByAgent = useMemo(() => {
    const map = new Map<string, VisitWithRelations>();
    for (const v of activeVisits) {
      if (!map.has(v.agent_id)) map.set(v.agent_id, v);
    }
    return map;
  }, [activeVisits]);

  const mapLocations: MapLoc[] = useMemo(() => {
    const result: MapLoc[] = [];
    const seen = new Set<string>();

    for (const [agentId, loc] of latestByAgent) {
      const visit = latestVisitByAgent.get(agentId);
      result.push({
        agentId,
        lat: loc.latitude,
        lng: loc.longitude,
        name: loc.agent?.full_name ?? visit?.agent?.full_name ?? "Agent",
        accuracy: loc.accuracy ?? undefined,
        outletName: visit?.outlet?.name,
        updatedAt: loc.recorded_at,
        status: visit?.status,
      });
      seen.add(agentId);
    }

    for (const [agentId, visit] of latestVisitByAgent) {
      if (seen.has(agentId)) continue;
      if (visit.check_in_latitude != null && visit.check_in_longitude != null) {
        result.push({
          agentId,
          lat: visit.check_in_latitude,
          lng: visit.check_in_longitude,
          name: visit.agent?.full_name ?? "Agent",
          accuracy: visit.check_in_accuracy ?? undefined,
          outletName: visit.outlet?.name,
          updatedAt: visit.check_in_time ?? visit.created_at,
          status: visit.status,
        });
      }
    }

    return result;
  }, [latestByAgent, latestVisitByAgent]);

  const locByAgent = useMemo(
    () => new Map(mapLocations.map((l) => [l.agentId, l])),
    [mapLocations],
  );

  const inProgressCount = activeVisits.filter(
    (v) => v.status === "in_progress",
  ).length;

  // Counts for filter chips
  const counts = useMemo(() => {
    let visiting = 0;
    let completed = 0;
    let noGps = 0;
    for (const a of allAgents) {
      const v = latestVisitByAgent.get(a.id);
      if (v?.status === "in_progress") visiting++;
      if (v?.status === "completed") completed++;
      if (!locByAgent.has(a.id)) noGps++;
    }
    return { all: allAgents.length, visiting, completed, no_gps: noGps };
  }, [allAgents, latestVisitByAgent, locByAgent]);

  // Filtered promoter list
  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allAgents.filter((a) => {
      if (q && !a.full_name.toLowerCase().includes(q)) return false;
      const v = latestVisitByAgent.get(a.id);
      if (filter === "visiting") return v?.status === "in_progress";
      if (filter === "completed") return v?.status === "completed";
      if (filter === "no_gps") return !locByAgent.has(a.id);
      return true;
    });
  }, [allAgents, search, filter, latestVisitByAgent, locByAgent]);

  // Map only shows the filtered promoters
  const visibleLocations = useMemo(() => {
    const ids = new Set(filteredAgents.map((a) => a.id));
    return mapLocations.filter((l) => ids.has(l.agentId));
  }, [mapLocations, filteredAgents]);

  const selectedLoc = selectedAgent ? locByAgent.get(selectedAgent) : null;
  const selectedVisit = selectedAgent
    ? latestVisitByAgent.get(selectedAgent)
    : null;
  const selectedName =
    selectedLoc?.name ??
    selectedVisit?.agent?.full_name ??
    allAgents.find((a) => a.id === selectedAgent)?.full_name;

  const mapsUrl = selectedLoc
    ? `https://www.google.com/maps/search/?api=1&query=${selectedLoc.lat},${selectedLoc.lng}`
    : null;

  const isRefreshing = fetchingVisits || fetchingLocs;
  const refresh = () => {
    refetchVisits();
    refetchLocs();
  };

  const filterChips: { key: AgentFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "visiting", label: "Visiting now" },
    { key: "completed", label: "Completed" },
    { key: "no_gps", label: "No GPS" },
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
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              Live · refreshes every 15s
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Live Tracking
            </h1>
            <p className="mt-1 text-sm text-white/70">
              See where your promoters are right now ·{" "}
              {formatDate(today, "long")}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <StatChip
              icon={Radio}
              label="Visiting now"
              value={inProgressCount}
            />
            <StatChip
              icon={Crosshair}
              label="With location"
              value={mapLocations.length}
            />
            <StatChip icon={Users} label="Promoters" value={allAgents.length} />
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
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Search className="h-3.5 w-3.5 text-brand-600" /> Search promoter
            </label>
            <input
              type="text"
              className="input"
              placeholder="Type a promoter name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={refresh}
              disabled={isRefreshing}
              className="btn-primary w-full md:w-auto"
            >
              <RefreshCw
                className={cn("h-4 w-4", isRefreshing && "animate-spin")}
              />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Status
          </span>
          {filterChips.map((c) => (
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

      {/* ───────── Map + promoters ───────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* Map */}
        <div
          className="overflow-hidden rounded-2xl bg-slate-100 shadow-sm ring-1 ring-slate-200"
          style={{ height: 560 }}
        >
          <AgentMap
            locations={visibleLocations}
            selectedAgentId={selectedAgent}
            onSelect={setSelectedAgent}
          />
        </div>

        {/* Side column */}
        <div className="space-y-4">
          <div className="card flex max-h-[560px] flex-col overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Users className="h-4 w-4 text-brand-600" />
                Promoters
              </div>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                {filteredAgents.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {loadingAgents ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-[68px] animate-pulse rounded-xl bg-gradient-to-br from-slate-100 to-slate-200"
                  />
                ))
              ) : filteredAgents.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No promoters found"
                  description="Try a different search or status filter."
                />
              ) : (
                filteredAgents.map((agent) => {
                  const loc = locByAgent.get(agent.id);
                  const visit = latestVisitByAgent.get(agent.id);
                  const isVisiting = visit?.status === "in_progress";
                  const isSelected = selectedAgent === agent.id;

                  return (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => setSelectedAgent(agent.id)}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200",
                        isSelected
                          ? "border-brand-300 bg-brand-50 shadow-sm ring-1 ring-brand-200"
                          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md",
                      )}
                    >
                      <div className="relative shrink-0">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold-400 text-sm font-bold text-brand-950">
                          {initials(agent.full_name)}
                        </span>
                        {isVisiting && (
                          <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {agent.full_name}
                        </p>
                        {visit?.outlet?.name ? (
                          <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {visit.outlet.name}
                            </span>
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400">
                            No visit today
                          </p>
                        )}
                        <p
                          className={cn(
                            "mt-0.5 text-[11px] font-medium",
                            loc ? "text-emerald-600" : "text-slate-400",
                          )}
                        >
                          {loc
                            ? `Location · ${loc.updatedAt ? formatDate(loc.updatedAt, "time") : "available"}`
                            : "No GPS yet"}
                        </p>
                      </div>

                      {visit && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                            isVisiting
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-slate-100 text-slate-600",
                          )}
                        >
                          {isVisiting ? "Visiting" : "Completed"}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected promoter detail */}
          {selectedAgent && (selectedLoc || selectedVisit) && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-5 text-white shadow-lg">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold-400/20 blur-2xl" />

              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-400 text-sm font-bold text-brand-950">
                      {initials(selectedName)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {selectedName}
                      </p>
                      <p className="truncate text-xs capitalize text-white/60">
                        {selectedVisit
                          ? selectedVisit.status.replace("_", " ")
                          : "No visit today"}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAgent(null)}
                    className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"
                    title="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {selectedVisit && (
                    <MiniStat
                      icon={Navigation}
                      label="Outlet"
                      value={selectedVisit.outlet?.name ?? "—"}
                    />
                  )}
                  {selectedVisit?.check_in_time && (
                    <MiniStat
                      icon={CheckCircle2}
                      label="Checked in"
                      value={formatDate(selectedVisit.check_in_time, "time")}
                    />
                  )}
                  {selectedLoc && (
                    <MiniStat
                      icon={Clock}
                      label="Last location"
                      value={
                        selectedLoc.updatedAt
                          ? formatDate(selectedLoc.updatedAt, "time")
                          : "—"
                      }
                    />
                  )}
                  {selectedLoc?.accuracy != null && (
                    <MiniStat
                      icon={Crosshair}
                      label="Accuracy"
                      value={`${Math.round(selectedLoc.accuracy)} m`}
                    />
                  )}
                </div>

                {selectedLoc && (
                  <>
                    <p className="mt-3 font-mono text-[11px] text-white/50">
                      {selectedLoc.lat.toFixed(6)}, {selectedLoc.lng.toFixed(6)}
                    </p>
                    {mapsUrl && (
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold-400 px-4 py-2.5 text-sm font-semibold text-brand-950 transition hover:bg-gold-300"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Open in Google Maps
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
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

function MiniStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/10 p-3 ring-1 ring-inset ring-white/15 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-white/60">
        <Icon className="h-3.5 w-3.5 text-gold-300" />
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
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
