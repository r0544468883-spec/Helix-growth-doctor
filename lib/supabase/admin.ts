import { createClient } from '@supabase/supabase-js';

// Service-role client for server-side jobs (connectors, cron, digest) — bypasses RLS.
// NEVER import this into client components.
export function createAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
