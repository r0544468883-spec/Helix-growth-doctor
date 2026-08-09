// Growth Doctor's binding of the autonomy switch to Supabase.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AutonomyStore } from './resolve';
import type { AutonomyMode } from './types';

// A thin AutonomyStore over the workspace's Supabase (RLS-scoped by is_member).
export function supabaseStore(supabase: SupabaseClient): AutonomyStore {
  return {
    async getSettings(workspaceId, featureKey) {
      const { data } = await supabase
        .from('autonomy_settings')
        .select('mode, risk_ack')
        .eq('workspace_id', workspaceId)
        .eq('feature_key', featureKey)
        .maybeSingle();
      return (data as { mode: AutonomyMode; risk_ack: boolean } | null) ?? null;
    },
  };
}

// Persist a proposed action to the shared queue (approve mode) or as an audit
// record of an autopilot execution.
export async function recordAction(
  supabase: SupabaseClient,
  workspaceId: string,
  featureKey: string,
  summary: string,
  payload: unknown,
  status: 'pending' | 'executed',
): Promise<string | null> {
  const row: Record<string, unknown> = {
    workspace_id: workspaceId,
    feature_key: featureKey,
    summary,
    payload,
    status,
  };
  if (status === 'executed') row.executed_at = new Date().toISOString();
  const { data, error } = await supabase
    .from('autonomy_actions')
    .insert(row)
    .select('id')
    .maybeSingle();
  if (error) return null;
  return (data?.id as string) ?? null;
}
