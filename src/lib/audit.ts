import { supabase } from "@/lib/supabase";

export async function logAudit(entry: {
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { data } = await supabase.auth.getUser();
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: data.user?.id,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
  });
  if (error) console.error("Audit log failed:", error.message);
}
