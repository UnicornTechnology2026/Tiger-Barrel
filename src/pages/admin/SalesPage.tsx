import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { formatDate, getTodayISO, cn } from "@/lib/utils";
import { exportSalesExcel } from "@/lib/exportSalesExcel";
import type { SaleSheet } from "@/types";
import { toast } from "sonner";
import {
  TrendingUp,
  Calendar,
  Search,
  Download,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Percent,
  Phone,
} from "lucide-react";

const SIZES = ["90", "180", "375", "750", "1000"] as const;

type SaleRow = SaleSheet & {
  outlet?: { id: string; name: string; area: string | null };
};

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const bySize = (r: SaleSheet, prefix: "converted" | "not_converted") =>
  SIZES.map((s) => ({ s, n: r[`${prefix}_${s}` as const] })).filter(
    (x) => x.n > 0,
  );

const sum = (list: { n: number }[]) => list.reduce((a, x) => a + x.n, 0);

export default function SalesPage() {
  const today = getTodayISO();
  const yesterday = shiftDate(today, -1);

  // "" = all dates
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [exporting, setExporting] = useState(false);

  const {
    data: rows = [],
    isLoading,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["admin-sales", date],
    queryFn: async () => {
      let q = supabase
        .from("sale_sheets")
        .select(
          "*, agent:profiles!agent_id(full_name), outlet:outlets(id, name, area)",
        )
        .order("sale_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500);

      if (date) q = q.eq("sale_date", date);

      const { data, error } = await q;
      if (error) throw error;
      return data as SaleRow[];
    },
    refetchInterval: date === today ? 15_000 : false,
  });

  // Brand chips (with counts)
  const brands = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) =>
      map.set(r.brand_name, (map.get(r.brand_name) ?? 0) + 1),
    );
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (brandFilter !== "all" && r.brand_name !== brandFilter) return false;
      if (!q) return true;
      return (
        (r.outlet?.name ?? "").toLowerCase().includes(q) ||
        (r.outlet?.area ?? "").toLowerCase().includes(q) ||
        (r.agent?.full_name ?? "").toLowerCase().includes(q) ||
        r.brand_name.toLowerCase().includes(q)
      );
    });
  }, [rows, brandFilter, search]);

  const totals = useMemo(() => {
    let contacts = 0;
    let converted = 0;
    let notConverted = 0;
    visible.forEach((r) => {
      contacts += r.contact_count;
      converted += sum(bySize(r, "converted"));
      notConverted += sum(bySize(r, "not_converted"));
    });
    const total = converted + notConverted;
    const rate = total > 0 ? Math.round((converted / total) * 100) : 0;
    return { contacts, converted, notConverted, rate };
  }, [visible]);

  const handleDownload = async () => {
    if (visible.length === 0) {
      toast.error("No sales to export");
      return;
    }
    try {
      setExporting(true);
      await exportSalesExcel(visible, `sales-${date || "all-dates"}.xlsx`);
    } catch (e) {
      console.error(e);
      toast.error("Could not generate Excel file");
    } finally {
      setExporting(false);
    }
  };

  const subtitle = date ? formatDate(date, "long") : "All dates";

  return (
    <div className="space-y-6">
      {/* ───────── Hero header ───────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-800 to-brand-600 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 ring-1 ring-inset ring-gold-400/30">
              {date === today ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
              ) : (
                <TrendingUp className="h-3.5 w-3.5" />
              )}
              {date === today
                ? "Live · refreshes every 15s"
                : "Sales Performance"}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Sales
            </h1>
            <p className="mt-1 text-sm text-white/70">
              {subtitle} · {visible.length} sheet
              {visible.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <StatChip icon={Phone} label="Contacts" value={totals.contacts} />
            <StatChip
              icon={CheckCircle2}
              label="Converted"
              value={totals.converted}
            />
            <StatChip
              icon={XCircle}
              label="Not converted"
              value={totals.notConverted}
            />
            <StatChip
              icon={Percent}
              label="Conversion"
              value={`${totals.rate}%`}
            />
          </div>
        </div>
      </div>

      {/* ───────── Filters ───────── */}
      <div className="card p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Search className="h-3.5 w-3.5 text-brand-600" /> Search
              </label>
              <input
                type="text"
                className="input"
                placeholder="Outlet, promoter or brand..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Calendar className="h-3.5 w-3.5 text-brand-600" /> Date
              </label>
              <input
                type="date"
                className="input"
                value={date}
                max={today}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            {[
              { label: "Today", value: today },
              { label: "Yesterday", value: yesterday },
              { label: "All dates", value: "" },
            ].map((q) => (
              <button
                key={q.label}
                type="button"
                onClick={() => setDate(q.value)}
                className={cn(
                  "rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors",
                  date === q.value
                    ? "border-brand-600 bg-brand-600 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700",
                )}
              >
                {q.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="rounded-lg border border-slate-200 bg-white p-2.5 text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                className={cn("h-5 w-5", isFetching && "animate-spin")}
              />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={exporting}
              className="btn-primary"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Preparing..." : "Download Excel"}
            </button>
          </div>
        </div>

        {/* Brand chips */}
        {brands.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Brand
            </span>
            <Chip
              active={brandFilter === "all"}
              onClick={() => setBrandFilter("all")}
            >
              All <span className="opacity-70">({rows.length})</span>
            </Chip>
            {brands.map((b) => (
              <Chip
                key={b.name}
                active={brandFilter === b.name}
                onClick={() => setBrandFilter(b.name)}
              >
                {b.name} <span className="opacity-70">({b.count})</span>
              </Chip>
            ))}
          </div>
        )}

        <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="h-3.5 w-3.5" />
          Updated{" "}
          {dataUpdatedAt ? formatDate(new Date(dataUpdatedAt), "time") : "—"}
        </p>
      </div>

      {/* ───────── Table (unchanged) ───────── */}
      <div className="card">
        <div className="border-b border-slate-100 px-5 py-3">
          <h2 className="font-semibold">Sales ({visible.length})</h2>
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
              ) : visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-6 text-center text-slate-400"
                  >
                    No sales recorded yet
                  </td>
                </tr>
              ) : (
                visible.map((r) => {
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
