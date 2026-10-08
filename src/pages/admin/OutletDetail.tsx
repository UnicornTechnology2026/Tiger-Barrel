import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, getTodayISO } from "@/lib/utils";
import { ArrowLeft, MapPin } from "lucide-react";
import { toast } from "sonner";
import type {
  Outlet,
  Visit,
  Photo,
  Comment,
  Profile,
  OutletAssignment,
} from "@/types";
import { useState } from "react";

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
      qc.invalidateQueries({ queryKey: ["admin-outlet-assignments", id] });
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
                      <p className="text-xs text-slate-400">{a.agent?.email}</p>
                    </td>
                    <td className="px-5 py-2 text-slate-600">
                      {a.agent?.phone || "—"}
                    </td>
                    <td className="px-5 py-2 text-slate-500">
                      {formatDate(a.assigned_date)}
                    </td>
                    <td className="px-5 py-2">
                      <StatusBadge status={a.active ? "active" : "inactive"} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
