import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { History } from "lucide-react";
import type { Visit } from "@/types";

export default function VisitHistory() {
  const { profile } = useAuth();

  const { data: visits = [], isLoading } = useQuery({
    queryKey: ["agent-visit-history", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("visits")
        .select("*, outlet:outlets(name, address)")
        .eq("agent_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Visit[];
    },
    enabled: !!profile,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card h-16 animate-pulse bg-slate-100" />
        ))}
      </div>
    );
  }

  if (!visits.length) {
    return (
      <EmptyState
        icon={History}
        title="No visits yet"
        description="Your visit history will appear here after you complete outlet visits."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Visit History</h1>
      {visits.map((v) => (
        <div key={v.id} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-medium text-slate-900">
                {(v as Visit & { outlet?: { name: string } }).outlet?.name ??
                  "Outlet"}
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                {v.check_in_time
                  ? formatDate(v.check_in_time, "datetime")
                  : formatDate(v.created_at, "datetime")}
              </p>
              {v.check_out_time && (
                <p className="text-xs text-slate-400">
                  Out: {formatDate(v.check_out_time, "time")}
                </p>
              )}
            </div>
            <StatusBadge status={v.status} />
          </div>
        </div>
      ))}
    </div>
  );
}
