import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCurrentPosition,
  watchPosition,
  clearWatch,
  MIN_ACCURACY_METERS,
  GeolocationError,
} from "@/lib/geolocation";
import { checkGeofence, formatDistance, formatDate } from "@/lib/utils";
import type { Outlet, Visit, GeoPosition, Photo } from "@/types";
import { OutletMap } from "@/components/maps/OutletMap";
import { toast } from "sonner";
import {
  MapPin,
  Navigation,
  Camera,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Crosshair,
  X,
  Upload,
} from "lucide-react";

const MAX_SIZE = 20 * 1024 * 1024;
const MAX_PHOTOS = 10;

export default function StartVisit() {
  const { outletId } = useParams<{ outletId: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [visitId, setVisitId] = useState<string | null>(null);
  const [visitStatus, setVisitStatus] = useState<
    "none" | "in_progress" | "completed"
  >("none");
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState<{ file: File; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: outlet, isLoading: outletLoading } = useQuery({
    queryKey: ["outlet", outletId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outlets")
        .select("*")
        .eq("id", outletId!)
        .single();
      if (error) throw error;
      return data as Outlet;
    },
    enabled: !!outletId,
  });

  useEffect(() => {
    if (!profile || !outletId) return;
    const today = new Date().toISOString().split("T")[0];
    supabase
      .from("visits")
      .select("*")
      .eq("agent_id", profile.id)
      .eq("outlet_id", outletId)
      .gte("created_at", `${today}T00:00:00`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const v = data as Visit;
        setVisitId(v.id);
        if (v.status === "completed") setVisitStatus("completed");
        else if (v.status === "in_progress") setVisitStatus("in_progress");
      });
  }, [profile, outletId]);

  const { data: uploadedPhotos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ["visit-photos", visitId],
    queryFn: async () => {
      if (!visitId) return [];
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("visit_id", visitId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const withUrls = await Promise.all(
        (data as Photo[]).map(async (p) => {
          const { data: signed } = await supabase.storage
            .from("outlet-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, signed_url: signed?.signedUrl };
        }),
      );
      return withUrls;
    },
    enabled: !!visitId,
  });

  const locate = useCallback(async () => {
    setLocating(true);
    setGeoError(null);
    try {
      const pos = await getCurrentPosition();
      setPosition(pos);
      if (pos.accuracy > MIN_ACCURACY_METERS) {
        toast.warning(
          `GPS accuracy is ${Math.round(pos.accuracy)}m. Move to an open area for better accuracy.`,
        );
      }
    } catch (err) {
      const msg =
        err instanceof GeolocationError
          ? err.message
          : "Failed to get location";
      setGeoError(msg);
      toast.error(msg);
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  useEffect(() => {
    if (visitStatus !== "in_progress" || !visitId || !profile) return;
    watchIdRef.current = watchPosition(
      (pos) => {
        setPosition(pos);
        supabase.from("location_logs").insert({
          agent_id: profile.id,
          visit_id: visitId,
          latitude: pos.latitude,
          longitude: pos.longitude,
          accuracy: pos.accuracy,
        });
      },
      (err) => toast.error(err.message),
    );
    return () => {
      if (watchIdRef.current !== null) clearWatch(watchIdRef.current);
    };
  }, [visitStatus, visitId, profile]);

  const geofence =
    position && outlet
      ? checkGeofence(
          position.latitude,
          position.longitude,
          outlet.latitude,
          outlet.longitude,
          outlet.geofence_radius,
        )
      : null;

  const checkIn = useMutation({
    mutationFn: async () => {
      if (!profile || !outlet || !position) throw new Error("Missing data");
      if (!geofence?.isWithin)
        throw new Error("You are outside the permitted outlet radius.");
      if (visitId && visitStatus === "in_progress") return visitId;
      const { data, error } = await supabase
        .from("visits")
        .insert({
          agent_id: profile.id,
          outlet_id: outlet.id,
          check_in_time: new Date().toISOString(),
          check_in_latitude: position.latitude,
          check_in_longitude: position.longitude,
          check_in_accuracy: position.accuracy,
          status: "in_progress",
        })
        .select()
        .single();
      if (error) throw error;
      return (data as Visit).id;
    },
    onSuccess: (id) => {
      setVisitId(id);
      setVisitStatus("in_progress");
      toast.success("Checked in — upload photos anytime, then Mark Completed");
      queryClient.invalidateQueries({ queryKey: ["agent-visits-today"] });
      queryClient.invalidateQueries({ queryKey: ["agent-assignments"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSelectFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter((f) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) {
        toast.error(`${f.name}: invalid type`);
        return false;
      }
      if (f.size > MAX_SIZE) {
        toast.error(`${f.name}: too large (max 20MB)`);
        return false;
      }
      return true;
    });
    setPending((prev) =>
      [
        ...prev,
        ...valid.map((f) => ({ file: f, preview: URL.createObjectURL(f) })),
      ].slice(0, MAX_PHOTOS),
    );
    e.target.value = "";
  };

  const removePending = (idx: number) => {
    setPending((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[idx].preview);
      next.splice(idx, 1);
      return next;
    });
  };

  const uploadPhotos = async () => {
    if (!visitId || !profile || !outlet) {
      toast.error("Check in first");
      return;
    }
    if (pending.length === 0) {
      toast.error("Select photos first");
      return;
    }
    setUploading(true);
    try {
      for (const { file } of pending) {
        const path = `agents/${profile.id}/outlets/${outlet.id}/visits/${visitId}/${Date.now()}_${file.name}`;
        const { error: upErr } = await supabase.storage
          .from("outlet-photos")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });
        if (upErr) throw upErr;
        const { error: dbErr } = await supabase.from("photos").insert({
          agent_id: profile.id,
          outlet_id: outlet.id,
          visit_id: visitId,
          storage_path: path,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          latitude: position?.latitude ?? null,
          longitude: position?.longitude ?? null,
        });
        if (dbErr) throw dbErr;
      }
      toast.success(
        `${pending.length} photo(s) uploaded — visit still in progress`,
      );
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
      refetchPhotos();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const markCompleted = async () => {
    if (!visitId) {
      toast.error("Check in first");
      return;
    }
    if (visitStatus === "completed") return;
    setCompleting(true);
    try {
      if (pending.length > 0 && profile && outlet) {
        for (const { file } of pending) {
          const path = `agents/${profile.id}/outlets/${outlet.id}/visits/${visitId}/${Date.now()}_${file.name}`;
          const { error: upErr } = await supabase.storage
            .from("outlet-photos")
            .upload(path, file, {
              contentType: file.type,
              upsert: false,
            });
          if (upErr) throw upErr;
          await supabase.from("photos").insert({
            agent_id: profile.id,
            outlet_id: outlet.id,
            visit_id: visitId,
            storage_path: path,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
          });
        }
        pending.forEach((p) => URL.revokeObjectURL(p.preview));
        setPending([]);
      }
      if (comment.trim() && profile && outlet) {
        await supabase.from("comments").insert({
          agent_id: profile.id,
          outlet_id: outlet.id,
          visit_id: visitId,
          comment_text: comment.trim(),
        });
      }
      const checkout = position
        ? {
            check_out_time: new Date().toISOString(),
            check_out_latitude: position.latitude,
            check_out_longitude: position.longitude,
            status: "completed" as const,
          }
        : {
            check_out_time: new Date().toISOString(),
            status: "completed" as const,
          };
      const { error } = await supabase
        .from("visits")
        .update(checkout)
        .eq("id", visitId);
      if (error) throw error;
      setVisitStatus("completed");
      toast.success("Outlet marked as completed");
      queryClient.invalidateQueries({ queryKey: ["agent-visits-today"] });
      queryClient.invalidateQueries({ queryKey: ["agent-assignments"] });
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Could not complete visit",
      );
    } finally {
      setCompleting(false);
    }
  };

  if (outletLoading || !outlet) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (visitStatus === "completed") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-full bg-emerald-100 p-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Outlet completed</h2>
        <p className="mt-2 text-sm text-slate-500">{outlet.name}</p>
        <button
          type="button"
          onClick={() => navigate("/agent")}
          className="btn-primary mt-6"
        >
          Back to Dashboard
        </button>
        <button
          type="button"
          className="btn-ghost mt-3 text-sm"
          onClick={() => navigate(`/agent/outlets/${outlet.id}`)}
        >
          Add more photos later
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-2 text-sm text-brand-600"
        >
          ← Back
        </button>
        <h1 className="text-lg font-bold text-slate-900">{outlet.name}</h1>
        <p className="flex items-center gap-1 text-sm text-slate-500">
          <MapPin className="h-3.5 w-3.5" /> {outlet.address}
        </p>
        {visitStatus === "in_progress" && (
          <span className="badge mt-2 bg-blue-100 text-blue-800">
            In progress — not completed yet
          </span>
        )}
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-medium text-slate-900">
            <Crosshair className="h-4 w-4" /> Location
          </h3>
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="btn-ghost text-xs"
          >
            {locating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Refresh"
            )}
          </button>
        </div>
        {geoError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {geoError}
          </div>
        )}
        {position && (
          <div className="space-y-1 text-sm">
            <p className="text-slate-600">
              Accuracy:{" "}
              <span className="font-medium">
                {Math.round(position.accuracy)}m
              </span>
            </p>
            {geofence &&
              (geofence.isWithin ? (
                <p className="flex items-center gap-1 font-medium text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" /> Outlet verified — you are
                  at the outlet.
                </p>
              ) : (
                <p className="font-medium text-amber-600">
                  You are about {formatDistance(geofence.distanceMeters)} away
                  from the outlet.
                </p>
              ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">
          Outlet on map
        </h2>
        <OutletMap
          latitude={outlet.latitude}
          longitude={outlet.longitude}
          name={outlet.name}
          agentLat={position?.latitude}
          agentLng={position?.longitude}
          height={200}
        />
      </div>

      {visitStatus === "none" && (
        <button
          type="button"
          className="btn-primary btn-lg w-full"
          disabled={!geofence?.isWithin || checkIn.isPending}
          onClick={() => checkIn.mutate()}
        >
          {checkIn.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Checking in...
            </>
          ) : (
            <>
              <Navigation className="h-4 w-4" /> Check In
            </>
          )}
        </button>
      )}

      {visitStatus === "in_progress" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
            Checked in. Upload photos as many times as you need. Tap{" "}
            <strong>Mark Completed</strong> only when this outlet is done.
          </div>

          <div className="card space-y-3 p-4">
            <h3 className="flex items-center gap-2 font-medium text-slate-900">
              <Camera className="h-4 w-4" /> Photos ({uploadedPhotos.length}{" "}
              uploaded)
            </h3>
            {uploadedPhotos.length > 0 && (
              <div className="grid grid-cols-4 gap-1.5">
                {uploadedPhotos.map((p) => (
                  <div
                    key={p.id}
                    className="aspect-square overflow-hidden rounded-md bg-slate-100"
                  >
                    {p.signed_url ? (
                      <img
                        src={p.signed_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {pending.map((p, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded-lg bg-slate-100"
                >
                  <img
                    src={p.preview}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePending(i)}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {pending.length < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-square flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200 text-slate-400 hover:border-brand-400 hover:text-brand-600"
                >
                  <Camera className="h-6 w-6" />
                  <span className="mt-1 text-xs">Add</span>
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              multiple
              className="hidden"
              onChange={handleSelectFiles}
            />
            <button
              type="button"
              className="btn-secondary w-full"
              disabled={uploading || pending.length === 0}
              onClick={uploadPhotos}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Upload photos (stay in
                  progress)
                </>
              )}
            </button>
          </div>

          <div className="card space-y-2 p-4">
            <label className="label">Comment (optional)</label>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="Notes about this outlet..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
            />
          </div>

          <button
            type="button"
            className="btn-primary btn-lg w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={completing}
            onClick={markCompleted}
          >
            {completing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Completing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Mark Completed
              </>
            )}
          </button>
          <p className="text-center text-xs text-slate-400">
            Outlet stays incomplete until you press Mark Completed
          </p>
        </div>
      )}
    </div>
  );
}
