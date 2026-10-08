import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getTodayISO, formatDate } from "@/lib/utils";
import {
  Users,
  Store,
  CheckCircle2,
  Clock,
  Camera,
  MessageSquare,
  MapPin,
  Activity,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { DashboardStats } from "@/types";

async function fetchDashboardStats(): Promise<DashboardStats> {
  const today = getTodayISO();

  const [
    agentsRes,
    activeAgentsRes,
    visitsRes,
    completedRes,
    photosRes,
    commentsRes,
    messagesRes,
    assignmentsRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "agent"),
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role", "agent")
      .eq("status", "active"),
    supabase
      .from("visits")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`),
    supabase
      .from("visits")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`),
    supabase
      .from("photos")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00`),
    supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .gte("created_at", `${today}T00:00:00`),
    supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("is_read", false),
    supabase
      .from("outlet_assignments")
      .select("*", { count: "exact", head: true })
      .eq("assigned_date", today)
      .eq("active", true),
  ]);

  const totalAssigned = assignmentsRes.count ?? 0;
  const completed = completedRes.count ?? 0;

  const { count: visitingCount } = await supabase
    .from("visits")
    .select("*", { count: "exact", head: true })
    .eq("status", "in_progress")
    .gte("created_at", `${today}T00:00:00`);

  return {
    totalAgents: agentsRes.count ?? 0,
    activeAgents: activeAgentsRes.count ?? 0,
    agentsVisiting: visitingCount ?? 0,
    totalAssignedOutlets: totalAssigned,
    completedVisits: completed,
    pendingVisits: Math.max(0, totalAssigned - completed),
    totalPhotos: photosRes.count ?? 0,
    totalComments: commentsRes.count ?? 0,
    unreadMessages: messagesRes.count ?? 0,
  };
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  href?: string;
}) {
  const content = (
    <div className="card flex items-center gap-4 p-5 transition-shadow hover:shadow-md blur-0">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-xl ${color}`}
      >
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
  return href ? <Link to={href}>{content}</Link> : content;
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: fetchDashboardStats,
    refetchInterval: 60_000,
  });

  const { data: recentVisits = [] } = useQuery({
    queryKey: ["admin-recent-visits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visits")
        .select("*, agent:profiles!agent_id(full_name), outlet:outlets(name)")
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data;
    },
  });

  if (isLoading || !stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="card h-24 animate-pulse bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Promoters"
          value={stats.totalAgents}
          icon={Users}
          color="bg-blue-100 text-blue-700"
          href="/admin/agents"
        />
        <StatCard
          label="Active Promoters"
          value={stats.activeAgents}
          icon={Activity}
          color="bg-emerald-100 text-emerald-700"
        />
        <StatCard
          label="Currently Visiting"
          value={stats.agentsVisiting}
          icon={MapPin}
          color="bg-violet-100 text-violet-700"
          href="/admin/tracking"
        />
        <StatCard
          label="Assigned Outlets"
          value={stats.totalAssignedOutlets}
          icon={Store}
          color="bg-amber-100 text-amber-700"
          href="/admin/outlets"
        />
        <StatCard
          label="Completed Visits"
          value={stats.completedVisits}
          icon={CheckCircle2}
          color="bg-emerald-100 text-emerald-700"
          href="/admin/visits"
        />
        <StatCard
          label="Pending Visits"
          value={stats.pendingVisits}
          icon={Clock}
          color="bg-orange-100 text-orange-700"
          href="/admin/visits"
        />
        <StatCard
          label="Photos Today"
          value={stats.totalPhotos}
          icon={Camera}
          color="bg-pink-100 text-pink-700"
          href="/admin/photos"
        />
        <StatCard
          label="Unread Messages"
          value={stats.unreadMessages}
          icon={MessageSquare}
          color="bg-sky-100 text-sky-700"
          href="/admin/messages"
        />
      </div>

      <div className="card">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Recent Visits</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-3 font-medium">Outlet</th>
                <th className="px-5 py-3 font-medium">Promoter</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentVisits.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-8 text-center text-slate-400"
                  >
                    No visits yet today
                  </td>
                </tr>
              ) : (
                recentVisits.map((v: Record<string, unknown>) => (
                  <tr
                    key={v.id as string}
                    className="border-b border-slate-50 hover:bg-slate-50"
                  >
                    <td className="px-5 py-3 text-slate-600">
                      {(v.outlet as { name?: string })?.name ?? "—"}
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {(v.agent as { full_name?: string })?.full_name ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`badge capitalize ${
                          v.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : v.status === "in_progress"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {String(v.status).replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-500">
                      {v.check_in_time
                        ? formatDate(v.check_in_time as string, "time")
                        : formatDate(v.created_at as string, "time")}
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
