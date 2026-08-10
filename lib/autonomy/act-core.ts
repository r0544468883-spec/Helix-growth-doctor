// Shared core for acting on a Doctor insight — used both by the in-app server
// action (auth-scoped) and the cross-product trigger endpoint (admin-scoped).
// Keeping it client-agnostic lets Dashboards drive Growth Doctor over HTTP while
// the SAME autonomy switch governs what actually happens.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Insight } from '@/lib/types';
import type { AutonomyMode } from '@/lib/autonomy/types';
import { resolveMode } from '@/lib/autonomy/resolve';
import { supabaseStore, recordAction } from '@/lib/autonomy/store';
import { runAction } from '@/lib/autonomy/guard';
import { sendWhatsApp, sendTelegram } from '@/lib/channels';

export const FEATURE_BY_ACTION: Record<Insight['action'], string> = {
  landing: 'gd.edit_landing',
  ab: 'gd.ab_test',
  campaign: 'gd.campaign',
  winback: 'gd.winback',
};

export function remediationPlan(ins: Insight): string {
  switch (ins.action) {
    case 'landing':
      return `וריאנט דף-נחיתה מתוקן לנקודת הנשירה "${ins.title}": קיצור טופס, הורדת חיכוך, הוכחה חברתית מעל הקיפול.`;
    case 'ab':
      return `A/B test על הנקודה החלשה — 2 וריאנטים, חלוקה 50/50, הכרעה אחרי מובהקות. ${ins.detail}`;
    case 'campaign':
      return `קמפיין remarketing לקהל קיים+מרוצה שלא שדרג — הודעת upsell ממוקדת. ${ins.detail}`;
    case 'winback':
      return `רצף win-back לנושרים מהקבוצה האחרונה: תזכורת ערך + תמריץ חזרה. ${ins.detail}`;
  }
}

async function notifyOperator(supabase: SupabaseClient, ws: string, text: string): Promise<void> {
  const { data } = await supabase.from('bot_links').select('chat_id').eq('workspace_id', ws);
  for (const row of (data ?? []) as { chat_id: string }[]) {
    await sendWhatsApp(row.chat_id, text);
    await sendTelegram(row.chat_id, text);
  }
}

export type ActOutcome = { mode: AutonomyMode; disposition: 'display' | 'enqueue' | 'execute'; message: string };

// Route ONE insight through the autonomy switch against a given workspace.
// `supabase` may be an auth-scoped or admin client — the switch decision is the
// same either way (resolved server-side by feature_key).
export async function actInsightCore(supabase: SupabaseClient, ws: string, ins: Insight): Promise<ActOutcome> {
  const featureKey = FEATURE_BY_ACTION[ins.action];
  const mode = await resolveMode(supabaseStore(supabase), ws, featureKey);
  const plan = remediationPlan(ins);
  const summary = `${ins.title} → ${plan}`;

  const { disposition } = await runAction(mode, { featureKey, summary, payload: { insight: ins, plan } }, {
    display: async () => {
      await supabase.from('insights').insert({ workspace_id: ws, axis: ins.axis, severity: ins.severity, title: ins.title, detail: ins.detail, action: ins.action });
    },
    enqueue: async () => {
      const id = await recordAction(supabase, ws, featureKey, summary, { insight: ins, plan }, 'pending');
      await notifyOperator(supabase, ws, `🩺 המלצה לאישור:\n${summary}\n\nאשר/דחה בלוח הבקרה.`);
      return id;
    },
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
