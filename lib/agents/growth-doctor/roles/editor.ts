// Editor archetype (§4b) — rewrites the remediation recommendation to address the
// Critic's concerns (action doesn't fit the root, over-reach, weak significance),
// keeping it concrete and grounded. draft → critique → revise.
import { narrate } from '../../../ollama';
import { withSkills } from '../../../skills/registry';

export async function reviseRemediation(
  plan: string,
  concerns: string[],
  insightTitle: string,
): Promise<string | null> {
  const text = await narrate([
    {
      role: 'system',
      content: withSkills(
        'אתה עורך המלצות CRO. שכתב את ההמלצה כך שתטפל בהערות המבקר ותהיה קונקרטית, ישימה ומדויקת לשורש הבעיה. 2-4 משפטים, בלי הבטחות מומצאות. החזר אך ורק את ההמלצה המתוקנת.',
        ['cro-conversion', 'helix-brand-voice'],
      ),
    },
    {
      role: 'user',
      content: `אבחון: ${insightTitle}\nהערות המבקר: ${concerns.join('; ') || 'חדד והתאם לשורש.'}\n\nההמלצה הנוכחית:\n${plan}`,
    },
  ]);
  return text?.trim() || null;
}
