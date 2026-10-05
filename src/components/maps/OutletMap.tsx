import { useEffect, useState } from "react";
import { fixLeafletIcons } from "@/lib/leaflet-fix";
import { ExternalLink, Navigation } from "lucide-react";

interface OutletMapProps {
  latitude: number;
  longitude: number;
  name: string;
  agentLat?: number | null;
  agentLng?: number | null;
  height?: number;
  className?: string;
}

export function OutletMap({
  latitude,
  longitude,
  name,
  agentLat,
  agentLng,
  height = 220,
  className = "",
}: OutletMapProps) {
  const [mods, setMods] = useState<{
    MapContainer: React.ComponentType<Record<string, unknown>>;
    TileLayer: React.ComponentType<Record<string, unknown>>;
    Marker: React.ComponentType<Record<string, unknown>>;
    Popup: React.ComponentType<Record<string, unknown>>;
    Circle: React.ComponentType<Record<string, unknown>>;
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
        Circle: rl.Circle as unknown as React.ComponentType<
          Record<string, unknown>
        >,
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  const directionsUrl =
    agentLat != null && agentLng != null
      ? `https://www.google.com/maps/dir/?api=1&origin=${agentLat},${agentLng}&destination=${latitude},${longitude}`
      : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="card overflow-hidden" style={{ height }}>
        {!mods ? (
          <div className="flex h-full items-center justify-center bg-slate-100 text-sm text-slate-400">
            Loading map...
          </div>
        ) : (
          <mods.MapContainer
            center={[latitude, longitude]}
            zoom={16}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
          >
            <mods.TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <mods.Marker position={[latitude, longitude]}>
              <mods.Popup>
                <strong>{name}</strong>
                <br />
                Outlet location
              </mods.Popup>
            </mods.Marker>
            {agentLat != null && agentLng != null && (
              <mods.Marker position={[agentLat, agentLng]}>
                <mods.Popup>Your location</mods.Popup>
              </mods.Marker>
            )}
          </mods.MapContainer>
        )}
      </div>

      <div className="flex gap-2">
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary flex-1 text-sm"
        >
          <ExternalLink className="h-4 w-4" />
          Open in Maps
        </a>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex-1 text-sm"
        >
          <Navigation className="h-4 w-4" />
          Directions
        </a>
      </div>
    </div>
  );
}
