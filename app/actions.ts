'use server';

import { createClient } from '@/lib/supabase/server';

// Resolve the logged-in user's workspace the same way the dashboard does
// (memberships → workspace_id).
async function currentWorkspace(): Promise<{ ws?: string; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'unauthorized' };
  const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
  const ws = mem?.workspace_id as string | undefined;
  if (!ws) return { error: 'no_workspace' };
  return { ws };
}

// Link a WhatsApp number to the workspace so the WhatsApp bot returns real data.
// bot_links.chat_id holds the sender id Meta delivers on inbound messages — the
// phone in international format WITHOUT '+' (e.g. 972501234567). We normalise any
// pasted number (spaces/dashes/leading + or 00) to bare digits so it matches.
export async function linkWhatsApp(phone: string): Promise<{ ok?: boolean; error?: string }> {
  const { ws, error } = await currentWorkspace();
  if (error) return { error };
  // Bare digits; drop a leading international "00" prefix (00972… → 972…).
  const digits = phone.replace(/\D/g, '').replace(/^00/, '');
  if (digits.length < 8) return { error: 'phone_required' };

  const supabase = await createClient();
  const { error: dbError } = await supabase.from('bot_links').upsert({ chat_id: digits, workspace_id: ws }, { onConflict: 'chat_id' });
  if (dbError) return { error: dbError.message };
  return { ok: true };
}
