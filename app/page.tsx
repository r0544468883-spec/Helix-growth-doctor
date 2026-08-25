import { createClient } from '@/lib/supabase/server';
import { DEMO, funnelFromEvents, heatFromEvents, frictionFromEvents, type FrictionSummary } from '@/lib/analytics';
import { diagnose } from '@/lib/doctor';
import { modelInUse } from '@/lib/ollama';
import Dashboard from '@/components/Dashboard';
import WhatsAppLink from '@/components/WhatsAppLink';
import AutonomySwitch from '@/components/AutonomySwitch';
import { resolveMode } from '@/lib/autonomy/resolve';
import { supabaseStore } from '@/lib/autonomy/store';
import type { AutonomyMode } from '@/lib/autonomy/types';
import type { Insight } from '@/lib/types';

export const dynamic = 'force-dynamic';

const FEATURE_BY_ACTION: Record<Insight['action'], string> = {
  landing: 'gd.edit_landing', ab: 'gd.ab_test', campaign: 'gd.campaign', winback: 'gd.winback',
};

// The switch UI surfaces one control per actable feature. `risky` (outbound/tos)
// features show a risk_ack checkbox and can only autopilot once it's on.
const AUTONOMY_FEATURES: { key: string; label: string; risky: boolean }[] = [
  { key: 'gd.ab_test', label: '🅰️🅱️ ניסויי A/B', risky: false },
  { key: 'gd.edit_landing', label: '🖥️ תיקון דף נחיתה', risky: true },
  { key: 'gd.campaign', label: '📣 קמפיינים', risky: true },
  { key: 'gd.winback', label: '💬 Win-back לנושרים', risky: true },
];

// Growth Doctor dashboard — real funnel from the workspace's events when present,
// else a demo so the product renders immediately. Diagnosis is computed either way.
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));

  let funnel = DEMO.funnel();
  let heat = DEMO.heat();
  let friction: FrictionSummary | null = null;
  let ws: string | null = null;
  if (user) {
    const { data: mem } = await supabase.from('memberships').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();
    if (mem?.workspace_id) {
      ws = mem.workspace_id as string;
      const real = await funnelFromEvents(supabase, ws);
      if (real) funnel = real;
      const realHeat = await heatFromEvents(supabase, ws);
      if (realHeat && realHeat.length) heat = realHeat;
      friction = await frictionFromEvents(supabase, ws);
    }
  }
  const cohorts = DEMO.cohorts();
  const insights = diagnose(funnel, cohorts, friction);

  // Resolve the effective autonomy mode per action type so the CTA reflects what
  // will actually happen (recommend / send-for-approval / auto-execute).
  const modes: Record<Insight['action'], AutonomyMode> = { landing: 'advisor', ab: 'advisor', campaign: 'advisor', winback: 'advisor' };
  // Raw stored settings for the switch UI (what the user set, not the resolved mode).
  const settings: Record<string, { mode: AutonomyMode; risk_ack: boolean }> = {};
  if (ws) {
    const store = supabaseStore(supabase);
    await Promise.all((Object.keys(modes) as Insight['action'][]).map(async (a) => {
      modes[a] = await resolveMode(store, ws!, FEATURE_BY_ACTION[a]);
    }));
    const { data: rows } = await supabase.from('autonomy_settings').select('feature_key, mode, risk_ack').eq('workspace_id', ws);
    for (const r of (rows ?? []) as { feature_key: string; mode: AutonomyMode; risk_ack: boolean }[]) {
      settings[r.feature_key] = { mode: r.mode, risk_ack: r.risk_ack };
    }
  }

  return (
    <>
      <Dashboard funnel={funnel} cohorts={cohorts} heat={heat} insights={insights} model={modelInUse()} modes={modes} />

      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '0 clamp(16px,3vw,40px) 40px' }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.02em', color: 'var(--ink-2)', margin: '4px 2px 12px', textTransform: 'uppercase' }}>
          ⚙️ מתג אוטונומיה — כמה חופש לתת לרופא
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          {AUTONOMY_FEATURES.map((f) => (
            <AutonomySwitch key={f.key} featureKey={f.key} label={f.label} risky={f.risky}
              initialMode={settings[f.key]?.mode ?? 'advisor'} initialRiskAck={settings[f.key]?.risk_ack ?? false} />
          ))}
        </div>
      </section>

      <WhatsAppLink />
    </>
  );
}
