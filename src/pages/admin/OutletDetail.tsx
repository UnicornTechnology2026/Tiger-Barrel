import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { OutletMap } from "@/components/maps/OutletMap";
import { formatDate, getTodayISO, cn } from "@/lib/utils";
import {
  ArrowLeft,
  MapPin,
  Store,
  User,
  Phone,
  Building2,
  Radius,
  Users,
  CheckCircle2,
  Clock,
  UserPlus,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import type {
  Outlet,
  Visit,
  Comment,
  Profile,
  OutletAssignment,
} from "@/types";
import { useState } from "react";
import { logAudit } from "@/lib/audit";

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function OutletDetailAdmin() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [assignAgentId, setAssignAgentId] = useState("");

  const { data: outlet, isLoading } = useQuery({
    queryKey: ["admin-outlet", id],
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

  const { data: visits = [] } = useQuery({
    queryKey: ["admin-outlet-visits", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("*, agent:profiles!agent_id(full_name)")
        .eq("outlet_id", id!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as Visit[];
    },
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["admin-outlet-comments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*, agent:profiles!agent_id(full_name)")
        .eq("outlet_id", id!)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as Comment[];
    },
    enabled: !!id,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["admin-agents-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "agent")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data as Pick<Profile, "id" | "full_name">[];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["admin-outlet-assignments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outlet_assignments")
        .select(
          "*, agent:profiles!agent_id(id, full_name, email, phone, status)",
        )
        .eq("outlet_id", id!)
        .order("assigned_date", { ascending: false });
      if (error) throw error;
      return data as OutletAssignment[];
    },
    enabled: !!id,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignAgentId || !id) throw new Error("Select an agent");
      const { error } = await supabase.from("outlet_assignments").insert({
        agent_id: assignAgentId,
        outlet_id: id,
        assigned_date: getTodayISO(),
        active: true,
      });
      if (error) throw error;
      await logAudit({
        action: "assign_outlet",
        entityType: "outlet_assignment",
        entityId: id,
        metadata: {
          agent_id: assignAgentId,
          agent_name: agents.find((a) => a.id === assignAgentId)?.full_name,
          outlet_id: id,
          outlet_name: outlet?.name,
          outlet_code: outlet?.outlet_code,
        },
      });
    },
    onSuccess: () => {
      toast.success("Outlet assigned");
      setAssignAgentId("");
      qc.invalidateQueries({ queryKey: ["admin-outlet", id] });
      qc.invalidateQueries({ queryKey: ["admin-outlet-assignments", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !outlet) {
    return (
      <div className="space-y-6">
        <div className="h-44 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200"
            />
          ))}
        </div>
      </div>
    );
  }

  const activeCount = assignments.filter((a) => a.active).length;
  const lastVisit = visits[0]?.created_at;

  return (
    <div className="space-y-6">
      <Link
        to="/admin/outlets"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 transition-colors hover:text-brand-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Outlets
      </Link>

      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
                <Store className="h-3.5 w-3.5" />
                Outlet Details
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80 ring-1 ring-inset ring-white/15">
                <Hash className="h-3 w-3" />
                {outlet.outlet_code}
              </span>
              <StatusBadge status={outlet.status} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {outlet.name}
            </h1>
            <p className="mt-1 flex items-start gap-1.5 text-sm text-white/70">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              {outlet.address}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <StatChip
              icon={Users}
              label="Promoters"
              value={assignments.length}
            />
            <StatChip icon={CheckCircle2} label="Active" value={activeCount} />
            <StatChip
              icon={Radius}
              label="Geofence"
              value={`${outlet.geofence_radius}m`}
            />
            <StatChip
              icon={Clock}
              label="Last visit"
              value={lastVisit ? formatDate(lastVisit) : "—"}
            />
          </div>
        </div>
      </div>

      {/* ───────── Info tiles ───────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoTile icon={User} label="Owner" value={outlet.owner_name || "—"} />
        <InfoTile
          icon={Phone}
          label="Phone"
          value={outlet.phone || "—"}
          href={outlet.phone ? `tel:${outlet.phone}` : undefined}
        />
        <InfoTile
          icon={Building2}
          label="Area / City"
          value={[outlet.area, outlet.city].filter(Boolean).join(", ") || "—"}
        />
        <InfoTile
          icon={Radius}
          label="Geofence"
          value={`${outlet.geofence_radius}m`}
        />
      </div>

      {/* ───────── Main grid ───────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Left column */}
        <div className="min-w-0 space-y-6">
          {/* Assign */}
          <div className="card p-4 sm:p-5">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <UserPlus className="h-3.5 w-3.5 text-brand-600" /> Assign to
              promoter (today)
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                className="input flex-1"
                value={assignAgentId}
                onChange={(e) => setAssignAgentId(e.target.value)}
              >
                <option value="">Select agent...</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
              <button
                className="btn-primary"
                disabled={!assignAgentId || assignMutation.isPending}
                onClick={() => assignMutation.mutate()}
              >
                <UserPlus className="h-4 w-4" />
                {assignMutation.isPending ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>

          {/* Assigned promoters table (unchanged) */}
          <div className="card">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="font-semibold">
                Assigned Promoters ({assignments.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-500">
                    <th className="px-5 py-2 font-medium">Promoter</th>
                    <th className="px-5 py-2 font-medium">Phone</th>
                    <th className="px-5 py-2 font-medium">Assigned Date</th>
                    <th className="px-5 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-6 text-center text-slate-400"
                      >
                        No promoter assigned to this outlet yet
                      </td>
                    </tr>
                  ) : (
                    assignments.map((a) => (
                      <tr key={a.id} className="border-b border-slate-50">
                        <td className="px-5 py-2">
                          {a.agent ? (
                            <Link
                              to={`/admin/agents/${a.agent.id}`}
                              className="font-medium text-brand-700 hover:underline"
                            >
                              {a.agent.full_name}
                            </Link>
                          ) : (
                            "—"
                          )}
                          <p className="text-xs text-slate-400">
                            {a.agent?.email}
                          </p>
                        </td>
                        <td className="px-5 py-2 text-slate-600">
                          {a.agent?.phone || "—"}
                        </td>
                        <td className="px-5 py-2 text-slate-500">
                          {formatDate(a.assigned_date)}
                        </td>
                        <td className="px-5 py-2">
                          <StatusBadge
                            status={a.active ? "active" : "inactive"}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Map */}
          <div className="card p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <MapPin className="h-3.5 w-3.5 text-brand-600" /> Location
            </p>
            <OutletMap
              latitude={outlet.latitude}
              longitude={outlet.longitude}
              name={outlet.name}
              height={260}
            />
          </div>
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

function InfoTile({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:ring-brand-300">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        {href ? (
          <a
            href={href}
            className="block truncate text-sm font-semibold text-brand-700 hover:underline"
          >
            {value}
          </a>
        ) : (
          <p className="truncate text-sm font-semibold text-slate-900">
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
