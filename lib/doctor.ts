import type { FunnelStage, CohortRow, Insight } from './types';
import { narrate } from './ollama';

// The diagnosis engine. Rule-based detection (deterministic, explainable) finds
// the leak points; the model (Ollama-first) writes the Hebrew recommendation.
export function diagnose(funnel: FunnelStage[], cohorts: CohortRow[]): Insight[] {
  const out: Insight[] = [];

  // Conversion: the biggest drop-off step.
  const worst = funnel.slice(1).reduce((a, b) => (b.dropPct > a.dropPct ? b : a), funnel[1] ?? { name: '', dropPct: 0, count: 0 });
  if (worst && worst.dropPct >= 40) {
    out.push({
      axis: 'conversion', severity: worst.dropPct >= 55 ? 'crit' : 'warn',
      title: `נקודת-נשירה קריטית: ${worst.name} (${worst.dropPct}%)`,
      detail: `שלב "${worst.name}" מאבד ${worst.dropPct}% מהמשתמשים — הנקודה עם הפוטנציאל הגבוה ביותר לשיפור. שקול לקצר טפסים, להוריד חיכוך, ולהוסיף הוכחה חברתית.`,
      action: 'landing',
    });
  }

  // Retention: latest cohort's D7-ish retention (col 1) vs an earlier one.
  const latest = cohorts[0]?.cells[1];
  const earlier = cohorts[2]?.cells[1];
  if (typeof latest === 'number' && typeof earlier === 'number' && latest < earlier - 3) {
    out.push({
      axis: 'retention', severity: 'warn',
      title: `שימור חוזרים ירד (${earlier}%→${latest}%)`,
      detail: `הקבוצה האחרונה חוזרת פחות — כדאי להפעיל רצף-החזרה (win-back) לנושרים ולבדוק שינויים ב-onboarding.`,
      action: 'winback',
    });
  }

  // Monetization: always surface the "activate existing audience" angle.
  out.push({
    axis: 'monetization', severity: 'good',
    title: 'הזדמנות: מוניטיזציה של קהל קיים',
    detail: 'לקוחות פעילים+מרוצים שלא שדרגו — הזדמנות ל-upsell/remarketing. זול וחם יותר מרכישת לקוח חדש.',
    action: 'campaign',
  });

  return out;
}

// A short Hebrew digest of the diagnosis, for the bot / daily brief.
export async function digestText(insights: Insight[]): Promise<string> {
  const facts = insights.map((i) => `• [${i.severity}] ${i.title}`).join('\n');
  const narrative = await narrate([
    { role: 'system', content: 'אתה יועץ CRO שכותב בעברית טבעית וקצרה (2-3 משפטים). התבסס רק על העובדות שקיבלת. הדגש את הפעולה הכי דחופה.' },
    { role: 'user', content: `אבחון צמיחה:\n${facts}\n\nכתוב סיכום קצר.` },
  ]);
  const header = '🩺 האבחון היומי — HELIX Growth Doctor';
  return narrative ? `${header}\n\n${narrative}\n\n—\n${facts}` : `${header}\n\n${facts}`;
}
