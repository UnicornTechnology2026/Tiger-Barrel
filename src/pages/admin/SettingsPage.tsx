import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useState, useEffect, useMemo } from "react";
import {
  Loader2,
  Settings as SettingsIcon,
  Radius,
  Crosshair,
  Camera,
  Radio,
  Save,
  RotateCcw,
  MapPin,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppSettings } from "@/types";

// Only these keys are shown and saved from this page.
const KEYS = [
  "default_geofence_radius",
  "min_gps_accuracy",
  "max_photos_per_visit",
  "tracking_enabled",
] as const;

type SettingKey = (typeof KEYS)[number];

const DEFAULTS: Record<SettingKey, string> = {
  default_geofence_radius: "",
  min_gps_accuracy: "",
  max_photos_per_visit: "",
  tracking_enabled: "true",
};

export default function SettingsPage() {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      return data as AppSettings[];
    },
  });

  const saved = useMemo(() => {
    const map: Record<string, string> = {};
    settings.forEach((s) => {
      map[s.key] = s.value;
    });
    return map;
  }, [settings]);

  useEffect(() => {
    if (settings.length) setValues(saved);
  }, [settings, saved]);

  const get = (key: SettingKey) => values[key] ?? DEFAULTS[key];
  const getSaved = (key: SettingKey) => saved[key] ?? DEFAULTS[key];

  const isDirty = KEYS.some((k) => get(k) !== getSaved(k));
  const trackingOn = get("tracking_enabled") === "true";

  const setValue = (key: SettingKey, value: string) =>
    setValues((v) => ({ ...v, [key]: value }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, string> = {};
      for (const key of KEYS) {
        if (key in saved) payload[key] = get(key);
      }

      for (const [key, value] of Object.entries(payload)) {
        const { error } = await supabase
          .from("app_settings")
          .update({ value, updated_at: new Date().toISOString() })
          .eq("key", key);
        if (error) throw error;
      }

      await supabase.from("audit_logs").insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: "update_settings",
        entity_type: "app_settings",
        metadata: payload,
      });
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["app-settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reset = () => setValues(saved);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-44 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
              <SettingsIcon className="h-3.5 w-3.5" />
              Configuration
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Settings
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Control tracking, geofencing and visit rules for your promoters
            </p>
          </div>
        </div>
      </div>

      {/* ───────── Setting sections ───────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Location & geofence */}
        <SectionCard
          icon={MapPin}
          title="Location & Geofence"
          description="Rules used to verify a promoter is actually at the outlet."
        >
          <Field
            icon={Radius}
            label="Default Geofence Radius"
            hint="Distance from the outlet within which check-in is allowed."
            unit="meters"
          >
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className="input"
              value={get("default_geofence_radius")}
              onChange={(e) =>
                setValue("default_geofence_radius", e.target.value)
              }
            />
          </Field>

          <Field
            icon={Crosshair}
            label="Minimum GPS Accuracy"
            hint="Readings less accurate than this are rejected."
            unit="meters"
          >
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className="input"
              value={get("min_gps_accuracy")}
              onChange={(e) => setValue("min_gps_accuracy", e.target.value)}
            />
          </Field>
        </SectionCard>

        {/* Visits */}
        <SectionCard
          icon={ClipboardList}
          title="Visit Rules"
          description="Limits applied while a promoter is on a visit."
        >
          <Field
            icon={Camera}
            label="Max Photos Per Visit"
            hint="How many photos a promoter can upload for one visit."
            unit="photos"
          >
            <input
              type="number"
              min={0}
              inputMode="numeric"
              className="input"
              value={get("max_photos_per_visit")}
              onChange={(e) => setValue("max_photos_per_visit", e.target.value)}
            />
          </Field>
        </SectionCard>

        {/* Tracking */}
        <div className="lg:col-span-2">
          <SectionCard
            icon={Radio}
            title="Live Tracking"
            description="Turn promoter location tracking on or off for the whole app."
          >
            <div className="flex flex-col gap-4 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                    trackingOn
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-slate-200 text-slate-500",
                  )}
                >
                  <Radio className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Location Tracking
                  </p>
                  <p className="text-xs text-slate-500">
                    {trackingOn
                      ? "Promoter locations are being recorded."
                      : "Promoter locations are not being recorded."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={trackingOn}
                onClick={() =>
                  setValue("tracking_enabled", trackingOn ? "false" : "true")
                }
                className={cn(
                  "relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
                  trackingOn ? "bg-emerald-500" : "bg-slate-300",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-6 w-6 rounded-full bg-white shadow transition-transform",
                    trackingOn ? "translate-x-7" : "translate-x-1",
                  )}
                />
              </button>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* ───────── Save bar ───────── */}
      <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p
          className={cn(
            "flex items-center gap-2 text-sm",
            isDirty ? "font-medium text-amber-600" : "text-slate-400",
          )}
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isDirty ? "bg-amber-500" : "bg-slate-300",
            )}
          />
          {isDirty ? "You have unsaved changes" : "All changes saved"}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            className="btn-secondary"
            onClick={reset}
            disabled={!isDirty || saveMutation.isPending}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> Save Settings
              </>
            )}
          </button>
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

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card h-full rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  hint,
  unit,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  unit?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5 text-brand-600" /> {label}
        {unit && (
          <span className="font-medium normal-case tracking-normal text-slate-400">
            ({unit})
          </span>
        )}
      </label>
      {children}
      <p className="mt-1.5 text-xs text-slate-400">{hint}</p>
    </div>
  );
}
