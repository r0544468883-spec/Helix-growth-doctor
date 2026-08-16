// Department Chief for Growth Doctor's decision node (charter §4b). Given ONE
// insight + its remediation plan, runs Analyst → Critic and returns the review
// that gates auto-execution. The deterministic detector (lib/doctor.ts) stays
// the System Chief; this only decides whether a fix is safe to auto-apply.
//
// Takes `plan` as a param (not imported from act-core) to avoid a circular import
// — act-core computes the plan and also calls the autonomy gate with this review.
import type { Insight } from '@/lib/types';
import { analyze } from './roles/analyst';
import { critique } from './roles/critic';
import { writeRemediation } from './roles/maker';
import { reviseRemediation } from './roles/editor';
import { designExperiment } from './roles/experimenter';
import type { InsightReview, DiagnosisContext } from './contract';

// Conservative default when the Critic can't be reached: never auto-execute a CRO
// change un-reviewed — downgrade to human approval (mirrors Rank: absent critic →
// safe path, no surprise action).
const HELD: InsightReview = {
  verdict: 'review',
  confidence: 0,
  safeToAutoExecute: false,
  concerns: ['המבקר לא זמין'],
  note: 'המבקר לא זמין — לא מבצע אוטומטית, מעביר לאישור אדם.',
};

export async function reviewInsight(
  insight: Insight,
  plan: string,
  ctx?: DiagnosisContext,
): Promise<InsightReview> {
  const brief = ctx ? await analyze(insight, ctx).catch(() => null) : null;
  const review = await critique(insight, plan, brief).catch(() => null);
  return review ?? HELD;
}

// The full remediation team (§4b): Analyst (Researcher) → Maker (tailored fix, not
// the generic template) → Critic → Editor (revise once if the fix doesn't fit the
// root). Returns the improved plan + the review that gates auto-execution.
export async function composeRemediation(
  insight: Insight,
  fallbackPlan: string,
  ctx?: DiagnosisContext,
): Promise<{ plan: string; review: InsightReview }> {
  const brief = ctx ? await analyze(insight, ctx).catch(() => null) : null;

  let plan = await writeRemediation(insight, brief, fallbackPlan).catch(() => fallbackPlan);

  // Experimenter: for an A/B action, attach a concrete test design to the plan.
  if (insight.action === 'ab') {
    const design = await designExperiment(insight).catch(() => '');
    if (design) plan = `${plan}\n\nעיצוב ניסוי: ${design}`;
  }

  let review = (await critique(insight, plan, brief).catch(() => null)) ?? HELD;

  if (review.verdict !== 'proceed') {
    const revised = await reviseRemediation(plan, review.concerns, insight.title).catch(() => null);
    if (revised) {
      plan = revised;
      review = (await critique(insight, plan, brief).catch(() => null)) ?? review;
    }
  }
  return { plan, review };
}
