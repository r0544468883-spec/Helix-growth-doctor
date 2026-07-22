import { createClient } from '@/lib/supabase/server';
import { DEMO, funnelFromEvents } from '@/lib/analytics';
import { diagnose } from '@/lib/doctor';
import { modelInUse } from '@/lib/ollama';
import Dashboard from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

// Growth Doctor dashboard — real funnel from the workspace's events when present,
// else a demo so the product renders immediately. Diagnosis is computed either way.
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  let funnel = DEMO.funnel();
  if (user) {
    const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
    if (mem?.workspace_id) {
      const real = await funnelFromEvents(supabase, mem.workspace_id as string);
      if (real) funnel = real;
    }
  }
  const cohorts = DEMO.cohorts();
  const insights = diagnose(funnel, cohorts);

  return <Dashboard funnel={funnel} cohorts={cohorts} heat={DEMO.heat()} insights={insights} model={modelInUse()} />;
}
