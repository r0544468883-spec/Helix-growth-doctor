// POST /api/act/trigger — cross-product hook. Lets the HELIX Dashboards hub kick
// Growth Doctor to diagnose a workspace and act on the findings. Secret-gated.
// SAFETY: each finding still routes through Growth Doctor's OWN autonomy switch
// (actInsightCore → resolveMode), so with the default 'advisor' this only records
// diagnoses — it never acts unless THIS product's workspace opted in.
import { NextRequest, NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase/admin';
import { funnelFromEvents, DEMO } from '@/lib/analytics';
import { diagnose } from '@/lib/doctor';
import { actInsightCore } from '@/lib/autonomy/act-core';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secret = process.env.CROSS_ACT_SECRET;
  if (!secret || req.headers.get('x-cross-act-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const admin = createAdmin();
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const reason: string = body.reason ?? 'cross-act trigger';

  // Resolve target workspaces: an explicit id, else the most recently active ones.
  let workspaceIds: string[] = [];
  if (body.workspaceId) {
    workspaceIds = [body.workspaceId as string];
  } else {
    const { data } = await admin
      .from('events')
      .select('workspace_id, ts')
      .not('workspace_id', 'is', null)
      .order('ts', { ascending: false })
      .limit(200);
    workspaceIds = [...new Set((data ?? []).map((r: { workspace_id: string }) => r.workspace_id))].slice(0, 5) as string[];
  }

  const results: Array<{ workspaceId: string; insights: number; outcomes: string[] }> = [];
  for (const ws of workspaceIds) {
    const funnel = (await funnelFromEvents(admin, ws)) ?? DEMO.funnel();
    const cohorts = DEMO.cohorts();
    const insights = diagnose(funnel, cohorts);
    const outcomes: string[] = [];
    for (const ins of insights) {
      // Pass the data context so the adversarial Critic can gate auto-execution.
      const r = await actInsightCore(admin, ws, ins, { ctx: { funnel, cohorts } });
      outcomes.push(`${ins.action}:${r.disposition}`);
    }
    results.push({ workspaceId: ws, insights: insights.length, outcomes });
  }

  return NextResponse.json({ ok: true, reason, workspaces: results.length, results });
}
