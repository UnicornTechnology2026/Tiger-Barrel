import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { EmptyState } from "@/components/shared/EmptyState";
import { Image, X, Store, Calendar } from "lucide-react";
import { formatDate, getTodayISO } from "@/lib/utils";
import type { Photo } from "@/types";

type PhotoWithRelations = Photo & {
  agent?: { full_name: string } | null;
  outlet?: { name: string } | null;
};

export default function PhotosGallery() {
  const [outletId, setOutletId] = useState("");
  const [date, setDate] = useState(getTodayISO());
  const [preview, setPreview] = useState<PhotoWithRelations | null>(null);

  // Outlet names for the dropdown
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

  // Photos for the selected outlet + date only
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

      const withUrls = await Promise.all(
        (data as PhotoWithRelations[]).map(async (p) => {
          const { data: signed } = await supabase.storage
            .from("outlet-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, signed_url: signed?.signedUrl };
        }),
      );
      return withUrls;
    },
  });

  const selectedOutletName = outlets.find((o) => o.id === outletId)?.name;

  return (
    <div className="space-y-6">
      {/* Header: title + count only */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Photos Gallery</h1>
        <p className="text-sm text-slate-500">
          {outletId
            ? `${photos.length} photos`
            : "Select an outlet and date to view photos"}
        </p>
      </div>

      {/* Outlet + Date filters, centered in the middle of the screen */}
      <div
        className={
          outletId
            ? "flex justify-center"
            : "flex min-h-[40vh] items-center justify-center"
        }
      >
        <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
                <Store className="h-3.5 w-3.5" /> Outlet name
              </label>
              <select
                className="input w-full"
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

            <div className="flex flex-col gap-1">
              <label className="flex items-center gap-1 text-xs font-medium text-slate-600">
                <Calendar className="h-3.5 w-3.5" /> Date
              </label>
              <input
                type="date"
                className="input w-full"
                value={date}
                max={getTodayISO()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Photos for the selected outlet + date */}
      {!outletId ? null : isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="aspect-square animate-pulse rounded-lg bg-slate-100"
            />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <EmptyState
          icon={Image}
          title="No photos"
          description={`No photos found for ${selectedOutletName ?? "this outlet"} on ${formatDate(date)}.`}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {photos.map((p) => (
            <button
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-lg bg-slate-100"
              onClick={() => setPreview(p)}
            >
              {p.signed_url ? (
                <img
                  src={p.signed_url}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <Image className="h-8 w-8" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <p className="truncate text-xs text-white">
                  {p.agent?.full_name}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Full-size preview */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={() => setPreview(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <div
            className="max-h-[90vh] max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {preview.signed_url && (
              <img
                src={preview.signed_url}
                alt=""
                className="max-h-[80vh] rounded-lg object-contain"
              />
            )}
            <div className="mt-3 text-center text-sm text-white">
              <p>
                {preview.agent?.full_name} · {preview.outlet?.name}
              </p>
              <p className="text-white/60">
                {formatDate(preview.created_at, "datetime")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
