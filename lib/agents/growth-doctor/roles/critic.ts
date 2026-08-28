// Critic (archetype 3 — the adversary) — challenges a Doctor recommendation
// BEFORE the autonomy switch may auto-execute it. This is what stops the Doctor
// from auto-acting on a spurious diagnosis (a noise-level drop-off, or the wrong
// lever — rewriting a landing page when the real problem is traffic quality).
// Harsh, honest, direct. Doubt counts against the recommendation.
import { narrate } from '@/lib/ollama';
import type { Insight } from '@/lib/types';
import type { DiagnosisBrief, InsightReview } from '../contract';
import { parseJson } from '../json';
import { withSkills } from '../../../skills/registry';

export async function critique(
  insight: Insight,
  plan: string,
  brief: DiagnosisBrief | null,
): Promise<InsightReview | null> {
  const system = `אתה מבקר CRO בכיר, קשוח וישיר. תפקידך לתקוף את ההמלצה לפני שהיא מבוצעת — לא לשבח. ברירת-מחדל: חשדנות.
כללים (מחייבים):
1. מובהקות: אם האבחון מבוסס על נפח נמוך/רעש, או שהאנליסט סימן significant=false — verdict=reject. ספק פועל לרעת ההמלצה.
2. התאמת-פעולה: האם הפעולה המוצעת מטפלת בשורש? (למשל: לשכתב דף-נחיתה כשהבעיה היא איכות-תנועה = פעולה שגויה → reject/review).
3. בטיחות לביצוע-אוטומטי: safeToAutoExecute=true אך ורק אם האבחון מובהק, הפעולה מתאימה לשורש, והסיכון מהפעולה נמוך והפיך. בכל ספק — false (יעבור לאישור-אדם).
4. אל תמציא בעיות שלא קיימות; כל חשש חייב להתבסס על הנתון או על השערת האנליסט. היה כן בשני הכיוונים.
5. note = משפט אחד בוטה, בלי סוכר, על ההמלצה.
verdict: "reject" (אבחון לא-מובהק / פעולה שגויה), "review" (בסיס סביר אך צריך עין-אדם), "proceed" (מובהק, פעולה מתאימה, בטוח לביצוע).
החזר JSON בלבד: {"verdict":"proceed|review|reject","confidence":0,"safeToAutoExecute":false,"concerns":[],"note":""}`;

  const briefStr = brief
    ? `ניתוח האנליסט: מובהק=${brief.significant}. ${brief.sampleNote} · שורש אפשרי: ${brief.rootCauseHypotheses.join('; ')} · מטעים: ${brief.confounders.join('; ')}`
    : 'אין ניתוח אנליסט (נתוני נפח חסרים) — הנח חוסר-ודאות ואל תאשר ביצוע אוטומטי.';

  const user = `אבחון: ${insight.title}\n${insight.detail}\nפעולה מוצעת: ${plan}\n\n${briefStr}`;

  const raw = await narrate([
    { role: 'system', content: withSkills(system, ['cro-conversion']) },
    { role: 'user', content: user },
  ]);
  return parseJson<InsightReview>(raw);
}
