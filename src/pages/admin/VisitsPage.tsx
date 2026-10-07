import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, getTodayISO } from "@/lib/utils";
import type { Visit } from "@/types";

export default function VisitsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState(getTodayISO());

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["admin-visits", statusFilter, dateFilter],
    queryFn: async () => {
      let q = supabase
        .from("visits")
        .select(
          "*, agent:profiles!agent_id(full_name), outlet:outlets(name, area)",
        )
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter) q = q.eq("status", statusFilter);
      if (dateFilter) {
        q = q
          .gte("created_at", `${dateFilter}T00:00:00`)
          .lte("created_at", `${dateFilter}T23:59:59`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as Visit[];
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Visits</h1>
        <p className="text-sm text-slate-500">{visits.length} records</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          className="input w-auto"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
        />
        <select
          className="input w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-slate-500">
              <th className="px-5 py-3 font-medium">Promoters</th>
              <th className="px-5 py-3 font-medium">Outlet</th>
              <th className="hidden px-5 py-3 font-medium md:table-cell">
                Check-in
              </th>
              <th className="hidden px-5 py-3 font-medium lg:table-cell">
                Check-out
              </th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-8 text-center text-slate-400"
                >
                  Loading...
                </td>
              </tr>
            ) : visits.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-8 text-center text-slate-400"
                >
                  No visits found
                </td>
              </tr>
            ) : (
              visits.map((v) => (
                <tr
                  key={v.id}
                  className="border-b border-slate-50 hover:bg-slate-50"
                >
                  <td className="px-5 py-3 font-medium">
                    {(v as Visit & { agent?: { full_name: string } }).agent
                      ?.full_name ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    {(v as Visit & { outlet?: { name: string } }).outlet
                      ?.name ?? "—"}
                  </td>
                  <td className="hidden px-5 py-3 text-slate-500 md:table-cell">
                    {v.check_in_time
                      ? formatDate(v.check_in_time, "datetime")
                      : "—"}
                  </td>
                  <td className="hidden px-5 py-3 text-slate-500 lg:table-cell">
                    {v.check_out_time
                      ? formatDate(v.check_out_time, "datetime")
                      : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={v.status} />
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
