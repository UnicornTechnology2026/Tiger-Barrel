import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { MapPin, Navigation } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { OutletMap } from "@/components/maps/OutletMap";
import type { Outlet } from "@/types";

export default function OutletDetail() {
  const { id } = useParams();
  const { data: outlet, isLoading } = useQuery({
    queryKey: ["outlet", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outlets")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as Outlet;
    },
    enabled: !!id,
  });

  if (isLoading)
    return <div className="card h-40 animate-pulse bg-slate-100" />;
  if (!outlet) return <p className="text-slate-500">Outlet not found</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-slate-900">{outlet.name}</h1>
        <StatusBadge status={outlet.status} className="mt-1" />
      </div>

      <div className="card space-y-2 p-4 text-sm">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          {outlet.address}
        </p>
        {outlet.owner_name && (
          <p>
            <span className="text-slate-500">Owner:</span> {outlet.owner_name}
          </p>
        )}
        {outlet.phone && (
          <p>
            <span className="text-slate-500">Phone:</span> {outlet.phone}
          </p>
        )}
        <p>
          <span className="text-slate-500">Area:</span> {outlet.area || "—"}
        </p>
        <p>
          <span className="text-slate-500">Code:</span> {outlet.outlet_code}
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Location</h2>
        <OutletMap
          latitude={outlet.latitude}
          longitude={outlet.longitude}
          name={outlet.name}
          height={240}
        />
      </div>

      <Link
        to={`/agent/visit/${outlet.id}`}
        className="btn-primary btn-lg w-full"
      >
        <Navigation className="h-4 w-4" /> Start Visit
      </Link>
    </div>
  );
}
