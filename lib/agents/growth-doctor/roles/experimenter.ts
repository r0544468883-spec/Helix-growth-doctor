// Experimenter archetype (CRO playbook) — when the fix is an A/B test, designs a
// real experiment instead of a vague "run an A/B": the hypothesis, two concrete
// variants, the primary metric, and a stopping rule. Grounded on the diagnosis.
import { narrate } from '../../../ollama';
import type { Insight } from '@/lib/types';
import { withSkills } from '../../../skills/registry';

export async function designExperiment(insight: Insight): Promise<string> {
  const text = await narrate([
    {
      role: 'system',
      content: withSkills(
        'אתה מתכנן ניסויי A/B ל-CRO. עצב ניסוי קונקרטי לאבחון: השערה, שני וריאנטים ברורים (A ביקורת, B שינוי), מדד-על אחד, וכלל-עצירה (מובהקות/משך). 3-5 שורות, בלי הבטחות-הרמה מומצאות.',
        ['cro-conversion'],
      ),
    },
    { role: 'user', content: `אבחון: ${insight.title}\n${insight.detail}\n\nעצב את הניסוי:` },
  ]);
  return (text || '').trim();
}
