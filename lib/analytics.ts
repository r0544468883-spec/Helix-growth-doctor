import type { FunnelStage, CohortRow, HeatPoint } from './types';

// Deterministic pseudo-random so demo visuals are stable across SSR/CSR.
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const DEFAULT_STEPS = ['כניסה לאתר', 'דף מוצר', 'עגלה', 'צ׳קאאוט', 'רכישה'];

// ── Real compute from events (best-effort) ────────────────────────────────
type Client = { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => PromiseLike<{ data: { name: string; visitor_id: string }[] | null }> } } };

export async function funnelFromEvents(client: unknown, ws: string, steps = DEFAULT_STEPS): Promise<FunnelStage[] | null> {
  const { data } = await (client as Client).from('events').select('name, visitor_id').eq('workspace_id', ws);
  if (!data || data.length === 0) return null;
  // Count distinct visitors that reached each named step.
  const perStep = steps.map((_, i) => new Set<string>());
  const stepName = (i: number) => (i === 0 ? 'pageview' : `step:${['product', 'cart', 'checkout', 'purchase'][i - 1] ?? ''}`);
  for (const e of data) {
    for (let i = 0; i < steps.length; i++) if (e.name === stepName(i)) perStep[i].add(e.visitor_id);
  }
  const counts = perStep.map((s) => s.size);
  if (counts[0] === 0) return null;
  return steps.map((name, i) => ({ name, count: counts[i], dropPct: i === 0 ? 0 : Math.round((1 - counts[i] / (counts[i - 1] || 1)) * 100) }));
}

// ── Demo generators (render before live events) ───────────────────────────
export function demoFunnel(): FunnelStage[] {
  const counts = [10000, 6400, 4100, 1600, 590];
  return DEFAULT_STEPS.map((name, i) => ({ name, count: counts[i], dropPct: i === 0 ? 0 : Math.round((1 - counts[i] / counts[i - 1]) * 100) }));
}

export function demoCohorts(): CohortRow[] {
  const weeks = ['22 יולי', '15 יולי', '8 יולי', '1 יולי', '24 יונ׳', '17 יונ׳'];
  return weeks.map((label, ri) => {
    const cells: (number | null)[] = [];
    for (let col = 0; col < 7; col++) {
      if (col > ri) { cells.push(null); continue; }
      if (col === 0) { cells.push(100); continue; }
      cells.push(Math.max(6, Math.round(100 * Math.pow(0.62 - ri * 0.02, col))));
    }
    return { label, cells };
  });
}

export function demoHeat(): HeatPoint[] {
  return [
    { x: 0.44, y: 0.63, w: 1 }, { x: 0.44, y: 0.63, w: 0.6 },
    { x: 0.30, y: 0.11, w: 0.7 }, { x: 0.34, y: 0.42, w: 0.5 },
    { x: 0.60, y: 0.50, w: 0.35 }, { x: 0.20, y: 0.76, w: 0.3 },
  ];
}

export const DEMO = { funnel: demoFunnel, cohorts: demoCohorts, heat: demoHeat };
export { DEFAULT_STEPS };
