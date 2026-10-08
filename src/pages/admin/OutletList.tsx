import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  Store,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  Hash,
  Power,
  X,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Outlet } from "@/types";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  outlet_code: z.string().min(1, "Required"),
  name: z.string().min(2, "Required"),
  owner_name: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().min(5, "Required"),
  city: z.string().optional(),
  area: z.string().optional(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  geofence_radius: z.coerce.number().min(10).max(5000).default(100),
});

type FormData = z.infer<typeof schema>;
type StatusFilter = "all" | "active" | "inactive";

export default function OutletList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ["admin-outlets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outlets")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Outlet[];
    },
  });

  const activeCount = useMemo(
    () => outlets.filter((o) => o.status === "active").length,
    [outlets],
  );
  const inactiveCount = outlets.length - activeCount;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return outlets.filter((o) => {
      const matchesSearch =
        o.name.toLowerCase().includes(q) ||
        o.outlet_code.toLowerCase().includes(q) ||
        (o.area ?? "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
            ? o.status === "active"
            : o.status !== "active";
      return matchesSearch && matchesStatus;
    });
  }, [outlets, search, statusFilter]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { geofence_radius: 100 },
  });

  const createMutation = useMutation({
    mutationFn: async (form: FormData) => {
      const { data, error } = await supabase
        .from("outlets")
        .insert(form)
        .select()
        .single();
      if (error) throw error;
      await logAudit({
        action: "create_outlet",
        entityType: "outlet",
        entityId: data.id,
        metadata: {
          name: form.name,
          code: form.outlet_code,
          area: form.area || null,
          city: form.city || null,
        },
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Outlet created");
      setShowCreate(false);
      reset();
      qc.invalidateQueries({ queryKey: ["admin-outlets"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      name,
      code,
    }: {
      id: string;
      status: string;
      name: string;
      code: string;
    }) => {
      const newStatus = status === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("outlets")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      await logAudit({
        action:
          newStatus === "active" ? "activate_outlet" : "deactivate_outlet",
        entityType: "outlet",
        entityId: id,
        metadata: { name, code, from: status, to: newStatus },
      });
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["admin-outlets"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
              <Store className="h-3.5 w-3.5" />
              Retail Network
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Outlets
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Manage your outlets, locations and geofences
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!isLoading && (
              <>
                <StatChip icon={Store} label="Total" value={outlets.length} />
                <StatChip
                  icon={CheckCircle2}
                  label="Active"
                  value={activeCount}
                />
                <StatChip
                  icon={XCircle}
                  label="Inactive"
                  value={inactiveCount}
                />
              </>
            )}
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-gold-400 px-4 py-3 text-sm font-semibold text-brand-950 shadow-sm transition hover:bg-gold-300"
            >
              <Plus className="h-4 w-4" /> Add Outlet
            </button>
          </div>
        </div>
      </div>

      {/* ───────── Filters ───────── */}
      <div className="card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Search className="h-3.5 w-3.5 text-brand-600" /> Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder="Search by name, code or area..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Status
            </span>
            <Chip
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              All <span className="opacity-70">({outlets.length})</span>
            </Chip>
            <Chip
              active={statusFilter === "active"}
              onClick={() => setStatusFilter("active")}
            >
              Active <span className="opacity-70">({activeCount})</span>
            </Chip>
            <Chip
              active={statusFilter === "inactive"}
              onClick={() => setStatusFilter("inactive")}
            >
              Inactive <span className="opacity-70">({inactiveCount})</span>
            </Chip>
          </div>
        </div>
      </div>

      {/* ───────── Content ───────── */}
      {isLoading ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse border-b border-slate-100 bg-gradient-to-r from-slate-50 to-slate-100"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No outlets found"
          description={
            outlets.length === 0
              ? "Add your first liquor outlet."
              : "Try a different search or status filter."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-gradient-to-r from-brand-950 via-brand-800 to-brand-700 text-left text-xs uppercase tracking-wide text-white/80">
                  <th className="px-5 py-3.5 font-semibold">Outlet</th>
                  <th className="hidden px-5 py-3.5 font-semibold md:table-cell">
                    Code
                  </th>
                  <th className="hidden px-5 py-3.5 font-semibold lg:table-cell">
                    Area
                  </th>
                  <th className="hidden px-5 py-3.5 font-semibold xl:table-cell">
                    Owner
                  </th>
                  <th className="hidden px-5 py-3.5 font-semibold xl:table-cell">
                    Geofence
                  </th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                  <th className="px-5 py-3.5 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((o) => {
                  const isActive = o.status === "active";
                  const place = [o.area, o.city].filter(Boolean).join(", ");
                  return (
                    <tr
                      key={o.id}
                      className="group transition-colors hover:bg-brand-50/60"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-400 text-brand-950">
                            <Store className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <Link
                              to={`/admin/outlets/${o.id}`}
                              className="block truncate font-semibold text-slate-900 transition-colors hover:text-brand-700"
                            >
                              {o.name}
                            </Link>
                            <p className="flex max-w-[260px] items-center gap-1 truncate text-xs text-slate-400">
                              <MapPin className="h-3 w-3 shrink-0" />
                              <span className="truncate">{o.address}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="hidden px-5 py-3.5 md:table-cell">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          <Hash className="h-3 w-3" />
                          {o.outlet_code}
                        </span>
                      </td>

                      <td className="hidden px-5 py-3.5 text-slate-600 lg:table-cell">
                        {place || "—"}
                      </td>

                      <td className="hidden px-5 py-3.5 xl:table-cell">
                        {o.owner_name || o.phone ? (
                          <div className="text-slate-600">
                            <p>{o.owner_name || "—"}</p>
                            {o.phone && (
                              <p className="flex items-center gap-1 text-xs text-slate-400">
                                <Phone className="h-3 w-3" />
                                {o.phone}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="hidden px-5 py-3.5 text-slate-600 xl:table-cell">
                        {o.geofence_radius} m
                      </td>

                      <td className="px-5 py-3.5">
                        <StatusBadge status={o.status} />
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="btn-ghost text-xs"
                            onClick={() =>
                              toggleStatus.mutate({
                                id: o.id,
                                status: o.status,
                                name: o.name,
                                code: o.outlet_code,
                              })
                            }
                          >
                            <Power className="h-3.5 w-3.5" />
                            {isActive ? "Deactivate" : "Activate"}
                          </button>
                          <Link
                            to={`/admin/outlets/${o.id}`}
                            className="rounded-lg p-1.5 text-slate-300 transition-colors hover:bg-brand-50 hover:text-brand-600"
                            title="View outlet"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-500">
            Showing {filtered.length} of {outlets.length} outlets
          </div>
        </div>
      )}

      {/* ───────── Add outlet modal ───────── */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-brand-950/70 p-4 backdrop-blur-md sm:items-center"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="my-8 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 px-6 py-5 text-white">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold-400/20 blur-2xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Add Outlet</h2>
                  <p className="mt-1 text-xs text-white/70">
                    Enter the outlet details, its coordinates and the geofence
                    radius used for visit check-ins.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-full bg-white/10 p-2 transition hover:bg-white/20"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit((d) => createMutation.mutate(d))}
              className="space-y-3 p-6"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Outlet Code *</label>
                  <input className="input" {...register("outlet_code")} />
                  {errors.outlet_code && (
                    <p className="text-xs text-red-600">
                      {errors.outlet_code.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Name *</label>
                  <input className="input" {...register("name")} />
                  {errors.name && (
                    <p className="text-xs text-red-600">
                      {errors.name.message}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="label">Address *</label>
                <input className="input" {...register("address")} />
                {errors.address && (
                  <p className="text-xs text-red-600">
                    {errors.address.message}
                  </p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Owner</label>
                  <input className="input" {...register("owner_name")} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" {...register("phone")} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">City</label>
                  <input className="input" {...register("city")} />
                </div>
                <div>
                  <label className="label">Area</label>
                  <input className="input" {...register("area")} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label">Latitude *</label>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    {...register("latitude")}
                  />
                  {errors.latitude && (
                    <p className="text-xs text-red-600">
                      {errors.latitude.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Longitude *</label>
                  <input
                    className="input"
                    type="number"
                    step="any"
                    {...register("longitude")}
                  />
                  {errors.longitude && (
                    <p className="text-xs text-red-600">
                      {errors.longitude.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="label">Geofence (m)</label>
                  <input
                    className="input"
                    type="number"
                    {...register("geofence_radius")}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  className="btn-secondary flex-1"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── Small helper components (same as Photos Gallery) ───────── */

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
