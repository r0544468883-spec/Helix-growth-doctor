// Operator bot commands — the business OWNER talks to the Growth Doctor from
// Telegram/WhatsApp to run every feature in natural Hebrew. Messages from a linked
// operator chat (bot_links) route HERE. Commands are read-only status/diagnosis
// lookups, so intent is matched with deterministic Hebrew keyword routing (no LLM
// parse needed); the diagnosis narrative itself still goes through the model.
import { createAdmin } from '@/lib/supabase/admin';
import { funnelFromEvents, DEMO } from '@/lib/analytics';
import { diagnose, digestText } from '@/lib/doctor';
import type { FunnelStage, CohortRow } from '@/lib/types';

const HELP = [
  '🩺 שלום, אני HELIX Growth Doctor. אפשר לשאול אותי בשפה חופשית, למשל:',
  '• "אבחון" — האבחון המלא (נשירה, שימור, הזדמנויות) + המלצת פעולה',
  '• "דוח" / "דייג׳סט" — סיכום האבחון היומי',
  '• "משפך" — סטטוס המשפך וכל שלב',
  '• "נשירה" / "מה הכי דולף" — נקודת הנשירה הגדולה ביותר',
  '• "שימור" / "קוהורט" — מצב השימור לפי קבוצות',
  '• "עזרה" — התפריט הזה',
].join('\n');

export type BotChannel = 'whatsapp' | 'telegram' | 'email';

// Resolve the operator's workspace for a channel identity (null → not linked).
export async function resolveOperatorWorkspace(channel: BotChannel, identifier: string): Promise<string | null> {
  const admin = createAdmin();
  const { data } = await admin.from('bot_links').select('workspace_id').eq('channel', channel).eq('identifier', identifier).maybeSingle();
  return (data?.workspace_id as string) ?? null;
}

async function loadFunnel(workspaceId: string): Promise<FunnelStage[]> {
  const admin = createAdmin();
  return (await funnelFromEvents(admin, workspaceId)) || DEMO.funnel();
}

function loadCohorts(): CohortRow[] {
  // Cohort/retention rows are computed by the demo generator until live cohort
  // aggregation lands; the whole app (doctor, dashboard) reads them the same way.
  return DEMO.cohorts();
}

function worstStep(funnel: FunnelStage[]): FunnelStage | undefined {
  return funnel.slice(1).reduce<FunnelStage | undefined>((a, b) => (!a || b.dropPct > a.dropPct ? b : a), undefined);
}

function funnelStatus(funnel: FunnelStage[]): string {
  const lines = funnel.map((s, i) =>
    i === 0 ? `• ${s.name}: ${s.count.toLocaleString('he-IL')}` : `• ${s.name}: ${s.count.toLocaleString('he-IL')} (נשירה ${s.dropPct}%)`,
  );
  const entered = funnel[0]?.count || 0;
  const converted = funnel[funnel.length - 1]?.count || 0;
  const conv = entered ? Math.round((converted / entered) * 1000) / 10 : 0;
  return ['📊 סטטוס המשפך:', ...lines, `\nהמרה כוללת: ${conv}%`].join('\n');
}

function dropoffStatus(funnel: FunnelStage[]): string {
  const w = worstStep(funnel);
  if (!w) return 'אין מספיק נתונים כדי לזהות נקודת נשירה.';
  return `🩸 נקודת הנשירה הגדולה ביותר: "${w.name}" — ${w.dropPct}% מהמשתמשים נושרים כאן. זו נקודת השיפור עם הפוטנציאל הגבוה ביותר.`;
}

function retentionStatus(cohorts: CohortRow[]): string {
  const lines = cohorts.slice(0, 6).map((r) => {
    const cells = r.cells.map((c) => (c === null ? '·' : `${c}%`)).join('  ');
    return `• ${r.label}: ${cells}`;
  });
  const latest = cohorts[0]?.cells[1];
  const earlier = cohorts[2]?.cells[1];
  let trend = '';
  if (typeof latest === 'number' && typeof earlier === 'number') {
    trend = latest < earlier ? `\n⚠️ שימור החוזרים ירד (${earlier}%→${latest}%) — שקול רצף win-back.` : `\n✅ שימור החוזרים יציב (${latest}%).`;
  }
  return ['🔁 מצב השימור (לפי קבוצות, D0…D6):', ...lines, trend].filter(Boolean).join('\n');
}

async function diagnosisText(funnel: FunnelStage[], cohorts: CohortRow[]): Promise<string> {
  return digestText(diagnose(funnel, cohorts));
}

// Route an operator message to the matching Growth Doctor feature.
export async function handleOperatorCommand(input: { workspaceId: string; text: string }): Promise<string> {
  const t = (input.text || '').trim();
  if (!t || /^(עזרה|help|\?|התחל|start)/i.test(t)) return HELP;

  try {
    if (/(משפך|funnel|שלבים)/i.test(t)) {
      return funnelStatus(await loadFunnel(input.workspaceId));
    }
    if (/(נשיר|דולף|דליפ|drop.?off|נשירה הכי)/i.test(t)) {
      return dropoffStatus(await loadFunnel(input.workspaceId));
    }
    if (/(שימור|קוהורט|cohort|retention|חוזרים|החזר)/i.test(t)) {
      return retentionStatus(loadCohorts());
    }
    if (/(דוח|דו״ח|דייג׳סט|דיג׳סט|digest|סיכום)/i.test(t)) {
      return diagnosisText(await loadFunnel(input.workspaceId), loadCohorts());
    }
    if (/(אבחון|אבחן|diagnos|מה קורה|מצב|status|סטטוס)/i.test(t)) {
      return diagnosisText(await loadFunnel(input.workspaceId), loadCohorts());
    }
    // Unknown → default to the full diagnosis (the product's core answer).
    return diagnosisText(await loadFunnel(input.workspaceId), loadCohorts());
  } catch (e) {
    return `שגיאה בביצוע: ${e instanceof Error ? e.message : 'לא ידועה'}`;
  }
}
