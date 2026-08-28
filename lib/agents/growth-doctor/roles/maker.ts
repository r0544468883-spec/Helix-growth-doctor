// Maker archetype (§4b) — writes a SPECIFIC, tailored remediation recommendation
// for a diagnosis, grounded in the Analyst's brief, instead of the generic
// deterministic template. Falls back to the template if no model is configured.
import { narrate } from '../../../ollama';
import type { Insight } from '@/lib/types';
import type { DiagnosisBrief } from '../contract';
import { withSkills } from '../../../skills/registry';

export async function writeRemediation(
  insight: Insight,
  brief: DiagnosisBrief | null,
  fallback: string,
): Promise<string> {
  const briefStr = brief
    ? `מובהק=${brief.significant}. ${brief.sampleNote} שורש אפשרי: ${brief.rootCauseHypotheses.join('; ')}.`
    : '';
  const text = await narrate([
    {
      role: 'system',
      content: withSkills(
        'אתה יועץ CRO. כתוב המלצת-תיקון אחת קונקרטית וממוקדת לאבחון (2-4 משפטים): מה בדיוק לעשות ולמה זה מטפל בשורש. התבסס רק על הנתון שקיבלת, בלי הבטחות מספריות מומצאות.',
        ['cro-conversion', 'helix-brand-voice'],
      ),
    },
    {
      role: 'user',
      content: `אבחון: ${insight.title}\n${insight.detail}\n${briefStr}\n\nסוג הפעולה: ${insight.action}. כתוב את ההמלצה.`,
    },
  ]);
  return text?.trim() || fallback;
}
