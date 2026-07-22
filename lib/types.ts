export type FunnelStage = { name: string; count: number; dropPct: number };
export type CohortRow = { label: string; cells: (number | null)[] };
export type HeatPoint = { x: number; y: number; w: number };
export type Insight = {
  axis: 'conversion' | 'retention' | 'monetization';
  severity: 'crit' | 'warn' | 'good';
  title: string;
  detail: string;
  action: 'landing' | 'ab' | 'campaign' | 'winback';
};
