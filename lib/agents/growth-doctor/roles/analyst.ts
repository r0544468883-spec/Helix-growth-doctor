// Analyst / Researcher (archetype 1) — grounds a diagnosis in the real numbers
// before anyone recommends a fix. Judges statistical significance from actual
// volume (a 60% drop on 30 visitors is noise, not a finding), and surfaces
// confounders. It analyses; it does NOT recommend or fabricate numbers.
import { narrate } from '@/lib/ollama';
import type { Insight } from '@/lib/types';
import type { DiagnosisBrief, DiagnosisContext } from '../contract';
import { parseJson } from '../json';
import { withSkills } from '../../../skills/registry';

export async function analyze(insight: Insight, ctx: DiagnosisContext): Promise<DiagnosisBrief | null> {
  const funnelStr = ctx.funnel.map((s) => `${s.name}: ${s.count} (נשירה ${s.dropPct}%)`).join('; ');
  const cohortStr = ctx.cohorts.slice(0, 4).map((c) => `${c.label}: ${c.cells.join('/')}`).join(' | ');

  const system = `אתה אנליסט צמיחה/CRO. תפקידך לבסס את האבחון בעובדות — לא להמליץ עדיין.
כללי-ברזל:
- שפוט מובהקות מהמספרים בפועל (count/נפח). נשירה של 60% על 30 מבקרים היא רעש, לא ממצא. significant=false כשהנפח דל.
- אל תמציא מספרים. אם הנתונים דלים או חסרים — אמור זאת מפורשות ב-sampleNote.
- rootCauseHypotheses = 2-4 השערות סיבתיות סבירות לאבחון.
- confounders = מה שעלול לזייף את הממצא (עונתיות, תמהיל תנועה, פערי-מדידה, קמפיין חד-פעמי).
החזר JSON בלבד: {"significant":true,"sampleNote":"","rootCauseHypotheses":[],"confounders":[]}`;

  const user = `אבחון: ${insight.title}\n${insight.detail}\n\nמשפך (נפחים): ${funnelStr}\nקוהורטות שימור: ${cohortStr}`;

  const raw = await narrate([
    { role: 'system', content: withSkills(system, ['cro-conversion', 'finance-metrics']) },
    { role: 'user', content: user },
  ]);
  return parseJson<DiagnosisBrief>(raw);
}
