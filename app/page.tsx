import { createClient } from '@/lib/supabase/server';
import { DEMO, funnelFromEvents } from '@/lib/analytics';
import { diagnose } from '@/lib/doctor';
import { modelInUse } from '@/lib/ollama';
import Dashboard from '@/components/Dashboard';
import WhatsAppLink from '@/components/WhatsAppLink';
import { resolveMode } from '@/lib/autonomy/resolve';
import { supabaseStore } from '@/lib/autonomy/store';
import type { AutonomyMode } from '@/lib/autonomy/types';
import type { Insight } from '@/lib/types';

export const dynamic = 'force-dynamic';

const FEATURE_BY_ACTION: Record<Insight['action'], string> = {
  landing: 'gd.edit_landing', ab: 'gd.ab_test', campaign: 'gd.campaign', winback: 'gd.winback',
};

// Growth Doctor dashboard — real funnel from the workspace's events when present,
// else a demo so the product renders immediately. Diagnosis is computed either way.
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  let funnel = DEMO.funnel();
  let ws: string | null = null;
  if (user) {
    const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
    if (mem?.workspace_id) {
      ws = mem.workspace_id as string;
      const real = await funnelFromEvents(supabase, ws);
      if (real) funnel = real;
    }
  }
  const cohorts = DEMO.cohorts();
  const insights = diagnose(funnel, cohorts);

  // Resolve the effective autonomy mode per action type so the CTA reflects what
  // will actually happen (recommend / send-for-approval / auto-execute).
  const modes: Record<Insight['action'], AutonomyMode> = { landing: 'advisor', ab: 'advisor', campaign: 'advisor', winback: 'advisor' };
  if (ws) {
    const store = supabaseStore(supabase);
    await Promise.all((Object.keys(modes) as Insight['action'][]).map(async (a) => {
      modes[a] = await resolveMode(store, ws!, FEATURE_BY_ACTION[a]);
    }));
  }

  return (
    <>
      <Dashboard funnel={funnel} cohorts={cohorts} heat={DEMO.heat()} insights={insights} model={modelInUse()} modes={modes} />
      <WhatsAppLink />
    </>
  );
}
