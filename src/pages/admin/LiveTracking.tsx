import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getTodayISO, formatDate } from "@/lib/utils";
import { fixLeafletIcons } from "@/lib/leaflet-fix";
import {
  MapPin,
  Navigation,
  ExternalLink,
  RefreshCw,
  Users,
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
      <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-400">
        Loading map...
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 bg-slate-100 text-sm text-slate-400">
        <MapPin className="h-8 w-8 text-slate-300" />
        <p>No agent locations yet today</p>
        <p className="max-w-xs text-center text-xs">
          Locations appear when agents check in or share GPS during a visit.
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
          eventHandlers={{
            click: () => onSelect(loc.agentId),
          }}
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

export default function LiveTracking() {
  const today = getTodayISO();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

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
      return data as (Visit & {
        agent?: Profile;
        outlet?: { name: string; latitude: number; longitude: number };
      })[];
    },
    refetchInterval: 15_000,
  });

  const {
    data: recentLocations = [],
    refetch: refetchLocs,
    isFetching: fetchingLocs,
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

  const { data: allAgents = [] } = useQuery({
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
    const map = new Map<
      string,
      Visit & {
        agent?: Profile;
        outlet?: { name: string; latitude: number; longitude: number };
      }
    >();
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

  const selectedLoc = selectedAgent
    ? mapLocations.find((l) => l.agentId === selectedAgent)
    : null;
  const selectedVisit = selectedAgent
    ? latestVisitByAgent.get(selectedAgent)
    : null;
  const inProgressCount = activeVisits.filter(
    (v) => v.status === "in_progress",
  ).length;

  const refresh = () => {
    refetchVisits();
    refetchLocs();
  };

  const mapsUrl = selectedLoc
    ? `https://www.google.com/maps/search/?api=1&query=${selectedLoc.lat},${selectedLoc.lng}`
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Live Tracking</h1>
          <p className="text-sm text-slate-500">
            {inProgressCount} visiting now · {mapLocations.length} with location
            today · Auto-refresh 15s
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={refresh}
          disabled={fetchingVisits || fetchingLocs}
        >
          <RefreshCw
            className={`h-4 w-4 ${fetchingVisits || fetchingLocs ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="card overflow-hidden" style={{ height: 520 }}>
          <AgentMap
            locations={mapLocations}
            selectedAgentId={selectedAgent}
            onSelect={setSelectedAgent}
          />
        </div>

        <div className="space-y-3">
          <div className="card max-h-[520px] overflow-y-auto">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-500">
              <Users className="h-4 w-4" />
              Promoter ({allAgents.length})
            </div>

            {allAgents.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                No active promoters
              </p>
            ) : (
              allAgents.map((agent) => {
                const loc = mapLocations.find((l) => l.agentId === agent.id);
                const visit = latestVisitByAgent.get(agent.id);
                const isVisiting = visit?.status === "in_progress";
                return (
                  <button
                    key={agent.id}
                    type="button"
                    className={`flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${
                      selectedAgent === agent.id ? "bg-brand-50" : ""
                    }`}
                    onClick={() => setSelectedAgent(agent.id)}
                  >
                    <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                      {agent.full_name.charAt(0)}
                      {isVisiting && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">
                        {agent.full_name}
                      </p>
                      {visit?.outlet?.name ? (
                        <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                          <MapPin className="h-3 w-3" />
                          {visit.outlet.name}
                          {isVisiting ? " · Visiting" : ` · ${visit.status}`}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">No visit today</p>
                      )}
                      {loc ? (
                        <p className="text-xs text-emerald-600">
                          Location{" "}
                          {loc.updatedAt
                            ? formatDate(loc.updatedAt, "time")
                            : "available"}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">No GPS yet</p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {selectedAgent && (selectedLoc || selectedVisit) && (
            <div className="card space-y-2 p-4 text-sm">
              <h3 className="font-semibold text-slate-900">
                {selectedLoc?.name ?? selectedVisit?.agent?.full_name}
              </h3>
              {selectedVisit && (
                <>
                  <p className="text-slate-600">
                    <Navigation className="mr-1 inline h-3.5 w-3.5" />
                    {selectedVisit.outlet?.name ?? "Outlet"}
                  </p>
                  <p className="capitalize text-slate-500">
                    Status: {selectedVisit.status.replace("_", " ")}
                  </p>
                  {selectedVisit.check_in_time && (
                    <p className="text-slate-500">
                      Checked in:{" "}
                      {formatDate(selectedVisit.check_in_time, "datetime")}
                    </p>
                  )}
                </>
              )}
              {selectedLoc && (
                <>
                  <p className="text-slate-500">
                    Last location:{" "}
                    {selectedLoc.updatedAt
                      ? formatDate(selectedLoc.updatedAt, "datetime")
                      : "—"}
                  </p>
                  {selectedLoc.accuracy != null && (
                    <p className="text-slate-500">
                      Accuracy: {Math.round(selectedLoc.accuracy)}m
                    </p>
                  )}
                  <p className="font-mono text-xs text-slate-400">
                    {selectedLoc.lat.toFixed(6)}, {selectedLoc.lng.toFixed(6)}
                  </p>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary mt-2 w-full text-sm"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open in Google Maps
                    </a>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
