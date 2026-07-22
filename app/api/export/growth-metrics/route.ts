import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase/admin';
import { funnelFromEvents, DEMO } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

// Cross-product export — HELIX DASHBOARDS pulls CRO/retention metrics from here
// into its metric_points (connector 'helix_growth'). Secret-protected.
// GET ?workspace=<id>&secret=<EXPORT_SECRET>
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.EXPORT_SECRET;
  const provided = url.searchParams.get('secret') || req.headers.get('x-export-secret');
  if (secret && provided !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const ws = url.searchParams.get('workspace');
  if (!ws) return NextResponse.json({ error: 'workspace_required' }, { status: 400 });

  const admin = createAdmin();
  const funnel = (await funnelFromEvents(admin, ws)) || DEMO.funnel();
  const worst = funnel.slice(1).reduce((a, b) => (b.dropPct > a.dropPct ? b : a), funnel[1]);
  const entered = funnel[0]?.count || 0;
  const converted = funnel[funnel.length - 1]?.count || 0;

  const conversionRate = entered ? Math.round((converted / entered) * 1000) / 10 : 0;
  const points = [
    { metric: 'gd_conversion_rate', dims: {}, value: conversionRate },
    { metric: 'gd_overall_dropoff_pct', dims: {}, value: entered ? Math.round((1 - converted / entered) * 1000) / 10 : 0 },
    { metric: 'gd_top_dropoff_pct', dims: { step: worst?.name ?? '' }, value: worst?.dropPct ?? 0 },
    { metric: 'gd_entered', dims: {}, value: entered },
    { metric: 'gd_converted', dims: {}, value: converted },
  ];
  return NextResponse.json({ points });
}
