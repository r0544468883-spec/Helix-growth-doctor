// HELIX Autonomy Switch — mode resolution. Fail-safe & downgrade-only:
// any error / missing row / missing risk_ack can only lower autonomy.

import type { AutonomyMode } from './types';
import { needsRiskAck } from './types';

export interface AutonomyStore {
  getSettings(
    workspaceId: string,
    featureKey: string,
  ): Promise<{ mode: AutonomyMode; risk_ack: boolean } | null>;
}

export async function resolveMode(
  store: AutonomyStore,
  workspaceId: string,
  featureKey: string,
): Promise<AutonomyMode> {
  let row: { mode: AutonomyMode; risk_ack: boolean } | null = null;
  try {
    row = await store.getSettings(workspaceId, featureKey);
  } catch {
    return 'advisor';
  }
  if (!row) return 'advisor';
  if (row.mode === 'autopilot' && needsRiskAck(featureKey) && !row.risk_ack) {
    return 'approve';
  }
  return row.mode;
}
