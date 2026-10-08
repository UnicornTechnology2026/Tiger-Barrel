import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Check, Plus, Store, User, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn, getTodayISO } from "@/lib/utils";
import type { OutletAssignment, SaleSheet } from "@/types";

const SIZES = ["90", "180", "375", "750", "1000"] as const;
const DEFAULT_BRANDS = ["Tiger Barrel (Direct sale)", "MDR", "Derby"];

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const convOf = (r?: SaleSheet) =>
  SIZES.map((s) => (r ? r[`converted_${s}` as const] : 0));
const ncOf = (r?: SaleSheet) =>
  SIZES.map((s) => (r ? r[`not_converted_${s}` as const] : 0));

interface TapVars {
  brand: string;
  size: number;
  converted: boolean;
}

function blankRow(brand: string): SaleSheet {
  return {
    id: `local-${brand}`,
    agent_id: "",
    outlet_id: "",
    sale_date: "",
    brand_name: brand,
    contact_count: 0,
    converted_90: 0,
    converted_180: 0,
    converted_375: 0,
    converted_750: 0,
    converted_1000: 0,
    not_converted_90: 0,
    not_converted_180: 0,
    not_converted_375: 0,
    not_converted_750: 0,
    not_converted_1000: 0,
    created_at: "",
    updated_at: "",
  };
}

function applyTap(rows: SaleSheet[], v: TapVars): SaleSheet[] {
  const exists = rows.some((r) => r.brand_name === v.brand);
  const list = exists ? rows : [...rows, blankRow(v.brand)];
  return list.map((r) => {
    if (r.brand_name !== v.brand) return r;
    const next = { ...r };
    next.contact_count += 1;
    const key = (
      v.converted ? `converted_${v.size}` : `not_converted_${v.size}`
    ) as keyof SaleSheet;
    (next[key] as number) += 1;
    return next;
  });
}

export default function Sale() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const today = getTodayISO();

  const [brandName, setBrandName] = useState("");
  const [error, setError] = useState("");
  const [outletId, setOutletId] = useState("");
  const [sel, setSel] = useState<Record<string, number | null>>({});

  const { data: assignments = [] } = useQuery({
    queryKey: ["agent-assignments", profile?.id, today],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("outlet_assignments")
        .select("*, outlet:outlets(*)")
        .eq("agent_id", profile.id)
        .eq("assigned_date", today)
        .eq("active", true);
      if (error) throw error;
      return data as OutletAssignment[];
    },
    enabled: !!profile,
  });

  const outlets = assignments.flatMap((a) => (a.outlet ? [a.outlet] : []));
  const selectedOutletId = outletId || outlets[0]?.id || "";
  const sheetKey = ["sale-sheets", profile?.id, selectedOutletId, today];

  const { data: rows = [], isLoading } = useQuery({
    queryKey: sheetKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_sheets")
        .select("*")
        .eq("agent_id", profile!.id)
        .eq("outlet_id", selectedOutletId)
        .eq("sale_date", today)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as SaleSheet[];
    },
    enabled: !!profile && !!selectedOutletId,
  });

  const record = useMutation({
    mutationKey: ["record-sale"],
    mutationFn: async (v: TapVars) => {
      const { error } = await supabase.rpc("record_sale", {
        p_outlet_id: selectedOutletId,
        p_brand: v.brand,
        p_size: v.size,
        p_converted: v.converted,
        p_date: today,
      });
      if (error) throw error;
    },
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: sheetKey });
      const previous = qc.getQueryData<SaleSheet[]>(sheetKey);
      qc.setQueryData<SaleSheet[]>(sheetKey, (old) => applyTap(old ?? [], v));
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(sheetKey, ctx?.previous);
      toast.error("Could not save that tap. Try again.");
    },
    onSettled: () => {
      if (qc.isMutating({ mutationKey: ["record-sale"] }) === 1) {
        qc.invalidateQueries({ queryKey: sheetKey });
      }
    },
  });

  const addBrandMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("sale_sheets").upsert(
        {
          agent_id: profile!.id,
          outlet_id: selectedOutletId,
          sale_date: today,
          brand_name: name,
        },
        {
          onConflict: "agent_id,outlet_id,sale_date,brand_name",
          ignoreDuplicates: true,
        },
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: sheetKey }),
    onError: () => toast.error("Could not add the brand. Try again."),
  });

  const rowByBrand = new Map(rows.map((r) => [r.brand_name, r]));
  const brandNames = [
    ...DEFAULT_BRANDS,
    ...rows.map((r) => r.brand_name).filter((n) => !DEFAULT_BRANDS.includes(n)),
  ];

  const addBrand = () => {
    const name = brandName.trim();
    if (!name) {
      setError("Enter a brand name");
      return;
    }
    if (name.length > 80) {
      setError("Brand name is too long");
      return;
    }
    if (brandNames.some((b) => b.toLowerCase() === name.toLowerCase())) {
      setError("That brand is already in the list");
      return;
    }
    addBrandMutation.mutate(name);
    setBrandName("");
    setError("");
  };

  const decide = (brand: string, converted: boolean) => {
    const size = sel[brand];
    if (size === null || size === undefined) return;
    record.mutate({ brand, size: Number(SIZES[size]), converted });
    setSel((s) => ({ ...s, [brand]: null }));
  };

  const totalContact = rows.reduce((n, r) => n + r.contact_count, 0);
  const totalConverted = rows.reduce((n, r) => n + sum(convOf(r)), 0);
  const totalNotConverted = rows.reduce((n, r) => n + sum(ncOf(r)), 0);
  const direct = sum(convOf(rowByBrand.get(DEFAULT_BRANDS[0])));
  const convBySize = SIZES.map((_, i) =>
    rows.reduce((n, r) => n + convOf(r)[i], 0),
  );
  const ncBySize = SIZES.map((_, i) =>
    rows.reduce((n, r) => n + ncOf(r)[i], 0),
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Sale</h1>

      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700">
          <User className="h-3.5 w-3.5 text-slate-500" />
          <span className="text-slate-500">Promoter</span>
          {profile?.full_name ?? "—"}
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs text-slate-700">
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          {today}
        </div>
      </div>

      <div>
        <label className="label flex items-center gap-1.5">
          <Store className="h-4 w-4 text-slate-500" /> Outlet
        </label>
        <select
          className="input"
          value={selectedOutletId}
          onChange={(e) => {
            setOutletId(e.target.value);
            setSel({});
          }}
        >
          {outlets.length === 0 && (
            <option value="">No outlet assigned today</option>
          )}
          {outlets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      {!selectedOutletId ? (
        <EmptyState
          icon={Store}
          title="No outlet assigned"
          description="You need an outlet assigned for today to record sales."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-lg bg-slate-100 p-3">
              <p className="text-xs text-slate-500">Total contact</p>
              <p className="text-2xl font-semibold text-slate-900">
                {totalContact}
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-3">
              <p className="text-xs text-slate-500">Total converted</p>
              <p className="text-2xl font-semibold text-emerald-600">
                {totalConverted}
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-3">
              <p className="text-xs text-slate-500">Not converted</p>
              <p className="text-2xl font-semibold text-red-600">
                {totalNotConverted}
              </p>
            </div>
            <div className="rounded-lg bg-slate-100 p-3">
              <p className="text-xs text-slate-500">Direct</p>
              <p className="text-2xl font-semibold text-slate-900">{direct}</p>
            </div>
          </div>

          <div>
            <div className="flex gap-2">
              <input
                className="input flex-1"
                type="text"
                placeholder="Royal Stag"
                aria-label="Brand name"
                value={brandName}
                onChange={(e) => {
                  setBrandName(e.target.value);
                  setError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addBrand();
                }}
              />
              <button
                type="button"
                className="btn-primary shrink-0"
                onClick={addBrand}
                disabled={addBrandMutation.isPending}
              >
                <Plus className="h-4 w-4" /> Add brand
              </button>
            </div>
            {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card h-36 animate-pulse bg-slate-100" />
              ))}
            </div>
          ) : (
            brandNames.map((name) => {
              const row = rowByBrand.get(name);
              const conv = convOf(row);
              const nc = ncOf(row);
              const selected = sel[name] ?? null;
              return (
                <div key={name} className="card p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold text-slate-900">{name}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        Contact {row?.contact_count ?? 0}
                      </span>
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                        Converted {sum(conv)}
                      </span>
                      <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs text-red-700">
                        Not converted {sum(nc)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2">
                    {SIZES.map((size, si) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() =>
                          setSel((s) => ({
                            ...s,
                            [name]: selected === si ? null : si,
                          }))
                        }
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-lg border px-1 py-2.5 transition-colors",
                          selected === si
                            ? "border-brand-500 bg-brand-50"
                            : "border-slate-200 bg-white hover:bg-slate-50",
                        )}
                      >
                        <span className="text-sm font-semibold text-slate-900">
                          {size}
                          <span className="ml-0.5 text-[10px] font-normal text-slate-500">
                            ml
                          </span>
                        </span>
                        <span className="flex gap-2 text-xs">
                          <span className="flex items-center text-emerald-600">
                            <Check className="h-3 w-3" />
                            {conv[si]}
                          </span>
                          <span className="flex items-center text-red-600">
                            <X className="h-3 w-3" />
                            {nc[si]}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>

                  {selected !== null && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                      <span className="min-w-[120px] flex-1 text-sm text-slate-600">
                        {SIZES[selected]} ml: did the customer buy?
                      </span>
                      <button
                        type="button"
                        className="btn bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => decide(name, true)}
                      >
                        <Check className="h-4 w-4" /> Converted
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => decide(name, false)}
                      >
                        <X className="h-4 w-4" /> Not converted
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="rounded-xl bg-slate-100 p-4">
            <h3 className="mb-2.5 text-sm font-semibold text-slate-900">
              Totals by size
            </h3>
            <div className="grid grid-cols-5 gap-2 text-center">
              {SIZES.map((size, i) => (
                <div
                  key={size}
                  className="rounded-lg border border-slate-200 bg-white px-1 py-2"
                >
                  <p className="text-xs font-semibold text-slate-900">
                    {size} ml
                  </p>
                  <p className="text-xs text-emerald-600">
                    {convBySize[i]} sold
                  </p>
                  <p className="text-xs text-red-600">{ncBySize[i]} missed</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
