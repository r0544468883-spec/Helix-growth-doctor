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
import { composeRemediation } from '@/lib/agents/growth-doctor/department-chief';
import type { InsightReview, DiagnosisContext } from '@/lib/agents/growth-doctor/contract';

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
//
// opts.ctx (funnel+cohorts) lets the adversarial Critic judge significance before
// auto-execution; opts.review lets a caller pass a pre-computed review. The Critic
// gate ONLY narrows autopilot → approve (never widens) — a weak/unsafe diagnosis
// is held for human approval instead of silently auto-acting.
export async function actInsightCore(
  supabase: SupabaseClient,
  ws: string,
  ins: Insight,
  opts?: { ctx?: DiagnosisContext; review?: InsightReview },
): Promise<ActOutcome> {
  const featureKey = FEATURE_BY_ACTION[ins.action];
  const mode = await resolveMode(supabaseStore(supabase), ws, featureKey);

  // Remediation department (§4b): Analyst (Researcher) → Maker (a tailored fix, not
  // the generic template) → Critic → Editor. Produces the plan that is shown/queued
  // AND the review that gates auto-execution.
  const { plan, review } = opts?.review
    ? { plan: remediationPlan(ins), review: opts.review }
    : await composeRemediation(ins, remediationPlan(ins), opts?.ctx);
  const summary = `${ins.title} → ${plan}`;

  // The Critic gate only narrows autopilot → approve — a fix the Critic couldn't
  // stand behind is held for a human instead of being auto-applied.
  const effectiveMode = mode === 'autopilot' && !review.safeToAutoExecute ? 'approve' : mode;
  const heldByCritic = mode === 'autopilot' && effectiveMode === 'approve';
  const payload = { insight: ins, plan, review };

  const { disposition } = await runAction(effectiveMode, { featureKey, summary, payload }, {
    display: async () => {
      await supabase.from('insights').insert({ workspace_id: ws, axis: ins.axis, severity: ins.severity, title: ins.title, detail: ins.detail, action: ins.action });
    },
    enqueue: async () => {
      const id = await recordAction(supabase, ws, featureKey, summary, payload, 'pending');
      const held = heldByCritic ? `\n🔎 העורך-המבקר עצר ביצוע אוטומטי: ${review?.note ?? ''}` : '';
      await notifyOperator(supabase, ws, `🩺 המלצה לאישור:\n${summary}${held}\n\nאשר/דחה בלוח הבקרה.`);
      return id;
    },
    execute: async () => {
      await supabase.from('insights').insert({ workspace_id: ws, axis: ins.axis, severity: ins.severity, title: ins.title, detail: ins.detail, action: ins.action });
      const id = await recordAction(supabase, ws, featureKey, summary, payload, 'executed');
      await notifyOperator(supabase, ws, `🤖 בוצע אוטומטית:\n${summary}`);
      return id;
    },
  });

  const message =
    disposition === 'display' ? 'נשמר כהמלצה — עברו למצב "מאשר" או "אוטופיילוט" כדי לפעול.'
    : disposition === 'enqueue' ? (heldByCritic
        ? 'העורך-המבקר עצר ביצוע אוטומטי (אבחון לא-מובהק/פעולה לא-מתאימה) — נשלח לאישור אדם.'
        : 'נשלח לתור אישור + נשלחה התראה למפעיל.')
    : 'בוצע אוטומטית + נשלחה התראה.';
  return { mode, disposition, message };
}
