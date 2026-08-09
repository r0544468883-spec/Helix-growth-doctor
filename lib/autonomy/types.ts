// HELIX Autonomy Switch — canonical types. Source: helix/PRODUCTS/autonomy-reference.

export type AutonomyMode = 'advisor' | 'approve' | 'autopilot';
export type RiskClass = 'internal' | 'outbound' | 'money' | 'tos';

export interface AutonomySettings {
  workspaceId: string;
  featureKey: string;
  mode: AutonomyMode;
  riskAck: boolean;
  dailyCap: number | null;
}

export type Disposition = 'display' | 'enqueue' | 'execute';

export interface ProposedAction<T = unknown> {
  featureKey: string;
  summary: string;
  payload: T;
}

export interface Degradation {
  entity: string;
  metric: string;
  direction: 'down' | 'up';
  severity: 'info' | 'warn' | 'crit';
  detail?: string;
}

export const RISK_BY_FEATURE: Record<string, RiskClass> = {
  'gd.ab_test': 'internal',
  'gd.edit_landing': 'tos',
  'gd.campaign': 'outbound',
  'gd.winback': 'outbound',
};

export function riskOf(featureKey: string): RiskClass {
  return RISK_BY_FEATURE[featureKey] ?? 'outbound'; // unknown => treat as risky
}

export function needsRiskAck(featureKey: string): boolean {
  return riskOf(featureKey) !== 'internal';
}
