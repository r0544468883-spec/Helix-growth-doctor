// Prioritizer archetype (collected from the CRO playbook — ICE scoring). Ranks the
// diagnosed insights by Impact × Confidence × Ease so the Doctor works the highest-
// ROI leak FIRST instead of top-to-bottom. Deterministic (no model call): impact
// from severity, confidence from whether we could measure it, ease from the action
// type. Pure logic — cheap and explainable.
import type { Insight } from '@/lib/types';

const IMPACT: Record<Insight['severity'], number> = { crit: 3, warn: 2, good: 1 };
// Ease: campaign/winback are quick wins; landing edits are medium; A/B tests take time.
const EASE: Record<Insight['action'], number> = { campaign: 3, winback: 3, landing: 2, ab: 1 };

export interface RankedInsight {
  insight: Insight;
  ice: number; // 1..9 (impact × ease); higher = do first
}

export function prioritize(insights: Insight[]): RankedInsight[] {
  return insights
    .map((insight) => ({ insight, ice: IMPACT[insight.severity] * EASE[insight.action] }))
    .sort((a, b) => b.ice - a.ice);
}
