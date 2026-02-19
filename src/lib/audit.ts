import { SupabaseClient } from "@supabase/supabase-js";

export async function logAudit(
  supabase: SupabaseClient,
  {
    action,
    entityType,
    entityId,
    meta,
  }: {
    action: string;
    entityType: string;
    entityId?: string;
    meta?: Record<string, unknown>;
  }
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase.from("audit_logs").insert({
    actor_user_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    meta: meta || null,
  });
}
