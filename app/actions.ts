'use server';

import { createClient } from '@/lib/supabase/server';
import type { Insight } from '@/lib/types';
import type { AutonomyMode } from '@/lib/autonomy/types';
import { resolveMode } from '@/lib/autonomy/resolve';
import { runAction } from '@/lib/autonomy/guard';
import { supabaseStore, recordAction } from '@/lib/autonomy/store';
import { sendWhatsApp, sendTelegram } from '@/lib/channels';

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

// ---- Autonomy switch (advisor → approve → autopilot) -----------------------
// The Doctor's insight CTAs route through here. In advisor mode we only record
// the recommendation; in approve mode we enqueue a real task + ping the operator;
// in autopilot we execute what Growth Doctor legitimately can (log the fix +
// notify). No fake UI state — every path leaves a real DB row.

// Diagnosis action → canonical feature_key (§4 of the spec).
const FEATURE_BY_ACTION: Record<Insight['action'], string> = {
  landing: 'gd.edit_landing',
  ab: 'gd.ab_test',
  campaign: 'gd.campaign',
  winback: 'gd.winback',
};

// Concrete next-step the Doctor commits to, per action type.
function remediationPlan(ins: Insight): string {
  switch (ins.action) {
    case 'landing':
      return `וריאנט דף-נחיתה מתוקן לנקודת הנשירה "${ins.title}": קיצור טופס, הורדת חיכוך, הוכחה חברתית מעל הקיפול. יעד: הקטנת הנשירה בשלב זה.`;
    case 'ab':
      return `A/B test על הנקודה החלשה — 2 וריאנטים, חלוקה 50/50, הכרעה אחרי מובהקות. ${ins.detail}`;
    case 'campaign':
      return `קמפיין remarketing לקהל קיים+מרוצה שלא שדרג — הודעת upsell ממוקדת. ${ins.detail}`;
    case 'winback':
      return `רצף win-back לנושרים מהקבוצה האחרונה: תזכורת ערך + תמריץ חזרה. ${ins.detail}`;
  }
}

// Best-effort ping to any channel linked to the workspace (no-op if env unset).
async function notifyOperator(supabase: Awaited<ReturnType<typeof createClient>>, ws: string, text: string): Promise<void> {
  const { data } = await supabase.from('bot_links').select('chat_id').eq('workspace_id', ws);
  for (const row of (data ?? []) as { chat_id: string }[]) {
    await sendWhatsApp(row.chat_id, text);
    await sendTelegram(row.chat_id, text);
  }
}

export type ActOutcome = { mode: AutonomyMode; disposition: 'display' | 'enqueue' | 'execute'; message: string; error?: string };

// The button target. Mode is resolved server-side — the client cannot force execution.
export async function actOnInsight(ins: Insight): Promise<ActOutcome> {
  const { ws, error } = await currentWorkspace();
  if (error || !ws) return { mode: 'advisor', disposition: 'display', message: '', error: error ?? 'no_workspace' };

  const supabase = await createClient();
  const featureKey = FEATURE_BY_ACTION[ins.action];
  const mode = await resolveMode(supabaseStore(supabase), ws, featureKey);
  const plan = remediationPlan(ins);
  const summary = `${ins.title} → ${plan}`;

  const { disposition } = await runAction(mode, { featureKey, summary, payload: { insight: ins, plan } }, {
    // advisor: keep it a recommendation — persist the insight for the record, nothing acts.
    display: async () => {
      await supabase.from('insights').insert({ workspace_id: ws, axis: ins.axis, severity: ins.severity, title: ins.title, detail: ins.detail, action: ins.action });
    },
    // approve (HITL): real task in the queue + a real ping to the operator to approve.
    enqueue: async () => {
      const id = await recordAction(supabase, ws, featureKey, summary, { insight: ins, plan }, 'pending');
      await notifyOperator(supabase, ws, `🩺 המלצה לאישור:\n${summary}\n\nאשר/דחה בלוח הבקרה.`);
      return id;
    },
    // autopilot: execute what GD can (log the concrete fix + notify). Outbound/tos
    // features only reach here when risk_ack was granted (guard enforces it).
    execute: async () => {
      await supabase.from('insights').insert({ workspace_id: ws, axis: ins.axis, severity: ins.severity, title: ins.title, detail: ins.detail, action: ins.action });
      const id = await recordAction(supabase, ws, featureKey, summary, { insight: ins, plan }, 'executed');
      await notifyOperator(supabase, ws, `🤖 בוצע אוטומטית:\n${summary}`);
      return id;
    },
  });

  const message =
    disposition === 'display' ? 'נשמר כהמלצה — עברו למצב "מאשר" או "אוטופיילוט" כדי לפעול.'
    : disposition === 'enqueue' ? 'נשלח לתור אישור + נשלחה התראה למפעיל.'
    : 'בוצע אוטומטית + נשלחה התראה.';
  return { mode, disposition, message };
}

// Set the autonomy mode for one feature. risk_ack is required for outbound/tos
// features; the resolver downgrades autopilot without it, so we store it honestly.
export async function setAutonomyMode(featureKey: string, mode: AutonomyMode, riskAck: boolean): Promise<{ ok?: boolean; error?: string }> {
  const { ws, error } = await currentWorkspace();
  if (error || !ws) return { error: error ?? 'no_workspace' };
  const supabase = await createClient();
  const { error: dbError } = await supabase.from('autonomy_settings').upsert(
    { workspace_id: ws, feature_key: featureKey, mode, risk_ack: riskAck, updated_at: new Date().toISOString() },
    { onConflict: 'workspace_id,feature_key' },
  );
  if (dbError) return { error: dbError.message };
  return { ok: true };
}
