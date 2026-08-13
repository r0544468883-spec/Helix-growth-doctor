// HELIX Growth Doctor — internal agent department (charter §4b of
// HELIX-CHIEF-AND-AGENTS-SPEC). Same shape as Rank's: the deterministic detector
// (lib/doctor.ts::diagnose) stays the honest analyzer; the agents live at the
// recommendation/decision node — Analyst (Researcher) grounds the diagnosis,
// Critic challenges it BEFORE the autonomy switch is allowed to auto-execute.
import type { FunnelStage, CohortRow } from '@/lib/types';

export type DiagnosisContext = { funnel: FunnelStage[]; cohorts: CohortRow[] };

// --- Analyst (Researcher) output: grounds the diagnosis in the real numbers. ---
export type DiagnosisBrief = {
  significant: boolean;         // is the finding backed by enough volume to act on?
  sampleNote: string;          // what the numbers actually support / don't
  rootCauseHypotheses: string[];
  confounders: string[];       // seasonality, traffic mix, tracking gaps…
};

// --- Critic output: an adversarial verdict that gates auto-execution. ----------
export type CriticVerdict = 'proceed' | 'review' | 'reject';
export type InsightReview = {
  verdict: CriticVerdict;
  confidence: number;           // 0..100
  safeToAutoExecute: boolean;   // may the autonomy switch auto-execute this fix?
  concerns: string[];
  note: string;                 // one blunt sentence, no sugarcoating
};
