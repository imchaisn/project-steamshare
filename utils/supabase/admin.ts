import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS.
 * NEVER expose this to the browser. Use only in Route Handlers.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
