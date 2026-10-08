import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, getTodayISO } from "@/lib/utils";
import { ArrowLeft, MapPin } from "lucide-react";
import { toast } from "sonner";
import type { Outlet, Visit, Photo, Comment, Profile } from "@/types";
import { useState } from "react";
import OutletSales from "@/components/admin/OutletSales";

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

  const { data: photos = [] } = useQuery({
    queryKey: ["admin-outlet-photos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("outlet_id", id!)
        .order("created_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data as Photo[];
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
      await supabase.from("audit_logs").insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: "assign_outlet",
        entity_type: "outlet_assignment",
        entity_id: id,
        metadata: { agent_id: assignAgentId, outlet_id: id },
      });
    },
    onSuccess: () => {
      toast.success("Outlet assigned");
      setAssignAgentId("");
      qc.invalidateQueries({ queryKey: ["admin-outlet", id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading || !outlet) {
    return <div className="card h-40 animate-pulse bg-slate-100" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/admin/outlets"
          className="mb-2 inline-flex items-center gap-1 text-sm text-brand-600"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Outlets
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{outlet.name}</h1>
            <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3.5 w-3.5" /> {outlet.address}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={outlet.status} />
              <span className="text-xs text-slate-400">
                {outlet.outlet_code}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Owner</p>
          <p className="font-medium">{outlet.owner_name || "—"}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Phone</p>
          <p className="font-medium">{outlet.phone || "—"}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Area / City</p>
          <p className="font-medium">
            {[outlet.area, outlet.city].filter(Boolean).join(", ") || "—"}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Geofence</p>
          <p className="font-medium">{outlet.geofence_radius}m</p>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-semibold">Assign to Agent (Today)</h2>
        <div className="flex gap-2">
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
            Assign
          </button>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold">Visit History ({visits.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-2 font-medium">Agent</th>
                <th className="px-5 py-2 font-medium">Check-in</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visits.length === 0 ? (
                <tr>
                  <td
                    colSpan={3}
                    className="px-5 py-6 text-center text-slate-400"
                  >
                    No visits yet
                  </td>
                </tr>
              ) : (
                visits.map((v) => (
                  <tr key={v.id} className="border-b border-slate-50">
                    <td className="px-5 py-2">
                      {(v as Visit & { agent?: { full_name: string } }).agent
                        ?.full_name ?? "—"}
                    </td>
                    <td className="px-5 py-2 text-slate-500">
                      {v.check_in_time
                        ? formatDate(v.check_in_time, "datetime")
                        : "—"}
                    </td>
                    <td className="px-5 py-2">
                      <StatusBadge status={v.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <OutletSales outletId={id!} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold">Photos ({photos.length})</h2>
          </div>
          <div className="grid grid-cols-4 gap-2 p-4">
            {photos.length === 0 ? (
              <p className="col-span-4 py-4 text-center text-sm text-slate-400">
                No photos
              </p>
            ) : (
              photos.map((p) => (
                <div
                  key={p.id}
                  className="aspect-square rounded-lg bg-slate-100"
                />
              ))
            )}
          </div>
        </div>
        <div className="card">
          <div className="border-b border-slate-100 px-5 py-3">
            <h2 className="font-semibold">Comments</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {comments.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-slate-400">
                No comments
              </p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="px-5 py-3">
                  <p className="text-sm text-slate-700">{c.comment_text}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {
                      (c as Comment & { agent?: { full_name: string } }).agent
                        ?.full_name
                    }{" "}
                    · {formatDate(c.created_at, "datetime")}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
