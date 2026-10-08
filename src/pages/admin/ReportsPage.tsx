import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatDate, getTodayISO } from "@/lib/utils";
import { Download, FileText } from "lucide-react";
import type { Visit, Profile } from "@/types";

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(getTodayISO());
  const [toDate, setToDate] = useState(getTodayISO());
  const [agentFilter, setAgentFilter] = useState("");

  const { data: agents = [] } = useQuery({
    queryKey: ["admin-agents-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "agent")
        .order("full_name");
      if (error) throw error;
      return data as Pick<Profile, "id" | "full_name">[];
    },
  });

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["admin-report-visits", fromDate, toDate, agentFilter],
    queryFn: async () => {
      let q = supabase
        .from("visits")
        .select(
          "*, agent:profiles!agent_id(full_name, employee_id), outlet:outlets(name, outlet_code, area)",
        )
        .gte("created_at", `${fromDate}T00:00:00`)
        .lte("created_at", `${toDate}T23:59:59`)
        .order("created_at", { ascending: false })
        .limit(500);

      if (agentFilter) q = q.eq("agent_id", agentFilter);

      const { data, error } = await q;
      if (error) throw error;
      return data as Visit[];
    },
  });

  const completed = visits.filter((v) => v.status === "completed").length;
  const pending = visits.filter(
    (v) => v.status === "pending" || v.status === "in_progress",
  ).length;

  const exportCsv = () => {
    const headers = [
      "Date",
      "Agent",
      "Outlet",
      "Outlet Code",
      "Area",
      "Check-in",
      "Check-out",
      "Status",
    ];
    const rows = visits.map((v) => {
      const agent = (
        v as Visit & { agent?: { full_name: string; employee_id: string } }
      ).agent;
      const outlet = (
        v as Visit & {
          outlet?: { name: string; outlet_code: string; area: string };
        }
      ).outlet;
      return [
        formatDate(v.created_at),
        agent?.full_name ?? "",
        agent?.employee_id ?? "",
        outlet?.name ?? "",
        outlet?.outlet_code ?? "",
        outlet?.area ?? "",
        v.check_in_time ? formatDate(v.check_in_time, "datetime") : "",
        v.check_out_time ? formatDate(v.check_out_time, "datetime") : "",
        v.status,
      ];
    });
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${c}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `visits-report-${fromDate}-to-${toDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          <p className="text-sm text-slate-500">Visit activity reports</p>
        </div>
        <button
          className="btn-primary"
          onClick={exportCsv}
          disabled={!visits.length}
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <label className="label">From</label>
          <input
            type="date"
            className="input w-auto"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">To</label>
          <input
            type="date"
            className="input w-auto"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Promoter</label>
          <select
            className="input w-auto"
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
          >
            <option value="">All promoters</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Total Visits</p>
          <p className="text-2xl font-bold">{visits.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Completed</p>
          <p className="text-2xl font-bold text-emerald-600">{completed}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Pending / In Progress</p>
          <p className="text-2xl font-bold text-amber-600">{pending}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Outlet</th>
              <th className="px-5 py-3 font-medium">Promoter</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-slate-400"
                >
                  Loading...
                </td>
              </tr>
            ) : visits.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-5 py-8 text-center text-slate-400"
                >
                  <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  No data for selected filters
                </td>
              </tr>
            ) : (
              visits.map((v) => (
                <tr key={v.id} className="border-b border-slate-50">
                  <td className="px-5 py-3 text-slate-500">
                    {formatDate(v.created_at)}
                  </td>
                  <td className="px-5 py-3">
                    {(v as Visit & { outlet?: { name: string } }).outlet
                      ?.name ?? "—"}
                  </td>
                  <td className="px-5 py-3 font-medium">
                    {(v as Visit & { agent?: { full_name: string } }).agent
                      ?.full_name ?? "—"}
                  </td>
                  <td className="px-5 py-3 capitalize">
                    {v.status.replace("_", " ")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
