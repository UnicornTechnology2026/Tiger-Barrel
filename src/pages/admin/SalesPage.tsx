import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import type { SaleSheet } from "@/types";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { exportSalesExcel } from "@/lib/exportSalesExcel";

const SIZES = ["90", "180", "375", "750", "1000"] as const;

type SaleRow = SaleSheet & {
  outlet?: { id: string; name: string; area: string | null };
};

export default function SalesPage() {
  const [dateFilter, setDateFilter] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-sales", dateFilter],
    queryFn: async () => {
      let q = supabase
        .from("sale_sheets")
        .select(
          "*, agent:profiles!agent_id(full_name), outlet:outlets(id, name, area)",
        )
        .order("sale_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);

      if (dateFilter) q = q.eq("sale_date", dateFilter);

      const { data, error } = await q;
      if (error) throw error;
      return data as SaleRow[];
    },
  });

  const [exporting, setExporting] = useState(false);

  const handleDownload = async () => {
    if (rows.length === 0) {
      toast.error("No sales to export");
      return;
    }
    try {
      setExporting(true);
      await exportSalesExcel(rows, `sales-${dateFilter || "all-dates"}.xlsx`);
    } catch (e) {
      console.error(e);
      toast.error("Could not generate Excel file");
    } finally {
      setExporting(false);
    }
  };

  const bySize = (r: SaleSheet, prefix: "converted" | "not_converted") =>
    SIZES.map((s) => ({ s, n: r[`${prefix}_${s}` as const] })).filter(
      (x) => x.n > 0,
    );

  const sum = (list: { n: number }[]) => list.reduce((a, x) => a + x.n, 0);

  const totalConverted = rows.reduce(
    (a, r) => a + sum(bySize(r, "converted")),
    0,
  );
  const totalNotConverted = rows.reduce(
    (a, r) => a + sum(bySize(r, "not_converted")),
    0,
  );
  const totalContacts = rows.reduce((a, r) => a + r.contact_count, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white lg:text-2xl">Sales</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          {dateFilter && (
            <button
              onClick={() => setDateFilter("")}
              className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700"
            >
              All dates
            </button>
          )}

          <button
            onClick={handleDownload}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-brand-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Preparing..." : "Download Excel"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-sm text-slate-500">Contacts</p>
          <p className="text-2xl font-semibold">{totalContacts}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Converted</p>
          <p className="text-2xl font-semibold text-emerald-700">
            {totalConverted}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500">Not converted</p>
          <p className="text-2xl font-semibold text-red-700">
            {totalNotConverted}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold">Sales ({rows.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-5 py-2 font-medium">Date</th>
                <th className="px-5 py-2 font-medium">Outlet</th>
                <th className="px-5 py-2 font-medium">Promoter</th>
                <th className="px-5 py-2 font-medium">Brand</th>
                <th className="px-5 py-2 font-medium">Contact</th>
                <th className="px-5 py-2 font-medium">Converted</th>
                <th className="px-5 py-2 font-medium">Not converted</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-6 text-center text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-6 text-center text-slate-400"
                  >
                    No sales recorded yet
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const conv = bySize(r, "converted");
                  const nc = bySize(r, "not_converted");
                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-50 align-top"
                    >
                      <td className="px-5 py-2 text-slate-500">
                        {formatDate(r.sale_date)}
                      </td>
                      <td className="px-5 py-2">
                        {r.outlet ? (
                          <Link
                            to={`/admin/outlets/${r.outlet.id}`}
                            className="font-medium text-brand-700 hover:underline"
                          >
                            {r.outlet.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                        {r.outlet?.area && (
                          <span className="block text-xs text-slate-400">
                            {r.outlet.area}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-2">{r.agent?.full_name ?? "—"}</td>
                      <td className="px-5 py-2 font-medium">{r.brand_name}</td>
                      <td className="px-5 py-2">{r.contact_count}</td>
                      <td className="px-5 py-2">
                        <span className="font-medium text-emerald-700">
                          {sum(conv)}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {conv.map((x) => `${x.s}ml: ${x.n}`).join(" · ") ||
                            "—"}
                        </span>
                      </td>
                      <td className="px-5 py-2">
                        <span className="font-medium text-red-700">
                          {sum(nc)}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {nc.map((x) => `${x.s}ml: ${x.n}`).join(" · ") || "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
