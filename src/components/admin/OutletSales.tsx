import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import type { SaleSheet } from "@/types";

const SIZES = ["90", "180", "375", "750", "1000"] as const;

export default function OutletSales({ outletId }: { outletId: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-outlet-sales", outletId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_sheets")
        .select("*, agent:profiles!agent_id(full_name)")
        .eq("outlet_id", outletId)
        .order("sale_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as SaleSheet[];
    },
  });

  const bySize = (r: SaleSheet, prefix: "converted" | "not_converted") =>
    SIZES.map((s) => ({ s, n: r[`${prefix}_${s}` as const] })).filter(
      (x) => x.n > 0,
    );

  return (
    <div className="card">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2 className="font-semibold">Sales ({rows.length})</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-slate-500">
              <th className="px-5 py-2 font-medium">Date</th>
              <th className="px-5 py-2 font-medium">Promoter</th>
              <th className="px-5 py-2 font-medium">Brand</th>
              <th className="px-5 py-2 font-medium">Contact</th>
              <th className="px-5 py-2 font-medium">Converted</th>
              <th className="px-5 py-2 font-medium">Not converted</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
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
                  <tr key={r.id} className="border-b border-slate-50 align-top">
                    <td className="px-5 py-2 text-slate-500">
                      {formatDate(r.sale_date)}
                    </td>
                    <td className="px-5 py-2">{r.agent?.full_name ?? "—"}</td>
                    <td className="px-5 py-2 font-medium">{r.brand_name}</td>
                    <td className="px-5 py-2">{r.contact_count}</td>
                    <td className="px-5 py-2">
                      <span className="font-medium text-emerald-700">
                        {conv.reduce((n, x) => n + x.n, 0)}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {conv.map((x) => `${x.s}ml: ${x.n}`).join(" · ") || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-2">
                      <span className="font-medium text-red-700">
                        {nc.reduce((n, x) => n + x.n, 0)}
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
  );
}
