'use client';

import { useState } from 'react';
import type { AutonomyMode } from '@/lib/autonomy/types';
import { setAutonomyMode } from '@/app/actions';

// A 3-mode switch (advisor → approve → autopilot) for one feature. The small
// "effect": the active pill SLIDES between segments, gives a quick pop on change,
// and autopilot glows. Risky (outbound/tos) features reveal a risk_ack checkbox
// that must be on for autopilot — otherwise the server downgrades to approve.
const MODES: { key: AutonomyMode; label: string; icon: string }[] = [
  { key: 'advisor', label: 'המלצה', icon: '💡' },
  { key: 'approve', label: 'אישור', icon: '📩' },
  { key: 'autopilot', label: 'אוטופיילוט', icon: '🤖' },
];

export default function AutonomySwitch({ featureKey, label, risky, initialMode, initialRiskAck }: {
  featureKey: string; label: string; risky: boolean; initialMode: AutonomyMode; initialRiskAck: boolean;
}) {
  const [mode, setMode] = useState<AutonomyMode>(initialMode);
  const [riskAck, setRiskAck] = useState<boolean>(initialRiskAck);
  const [saving, setSaving] = useState(false);
  const [popKey, setPopKey] = useState(0);

  const idx = MODES.findIndex((m) => m.key === mode);
  // Autopilot on a risky feature without ack is only "requested" — it will run as approve.
  const downgraded = mode === 'autopilot' && risky && !riskAck;

  async function persist(nextMode: AutonomyMode, nextAck: boolean) {
    setSaving(true);
    try { await setAutonomyMode(featureKey, nextMode, nextAck); } finally { setSaving(false); }
  }
  function pick(next: AutonomyMode) {
    if (next === mode) return;
    setMode(next); setPopKey((k) => k + 1);
    persist(next, riskAck);
  }
  function toggleAck() {
    const next = !riskAck; setRiskAck(next); persist(mode, next);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 14, background: 'var(--panel)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-2)', minWidth: 44, textAlign: 'end' }}>{saving ? '…שומר' : '✓'}</span>
      </div>

      {/* segmented control with a sliding pill */}
      <div role="radiogroup" aria-label={label} style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 11, padding: 3 }}>
        <span
          key={popKey}
          className="au-pill"
          style={{
            position: 'absolute', top: 3, bottom: 3, width: 'calc((100% - 6px) / 3)',
            insetInlineStart: `calc(${idx} * (100% - 6px) / 3 + 3px)`,
            borderRadius: 9, background: mode === 'autopilot' ? 'linear-gradient(135deg,var(--brand),var(--h1))' : 'var(--brand-soft)',
            boxShadow: mode === 'autopilot' ? '0 0 0 1px var(--brand), 0 4px 16px -4px var(--brand)' : 'none',
            transition: 'inset-inline-start .28s cubic-bezier(.34,1.56,.64,1), background .2s',
          }}
          aria-hidden
        />
        {MODES.map((m) => {
          const active = m.key === mode;
          return (
            <button key={m.key} role="radio" aria-checked={active} onClick={() => pick(m.key)}
              style={{ position: 'relative', zIndex: 1, background: 'transparent', border: 0, cursor: 'pointer', padding: '7px 4px', fontFamily: 'inherit',
                fontSize: 12, fontWeight: 800, color: active ? (m.key === 'autopilot' ? '#fff' : 'var(--brand-ink)') : 'var(--ink-2)', transition: 'color .2s' }}>
              <span style={{ fontSize: 13 }}>{m.icon}</span> {m.label}
            </button>
          );
        })}
      </div>

      {risky && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: downgraded ? 'var(--crit)' : 'var(--ink-2)', cursor: 'pointer' }}>
          <input type="checkbox" checked={riskAck} onChange={toggleAck} style={{ accentColor: 'var(--brand)' }} />
          {downgraded ? '⚠️ פעולה זו יוצאת החוצה — סמנו אישור כדי לאפשר אוטופיילוט (כרגע ירד ל״אישור״)' : 'מאשר/ת אוטופיילוט לפעולה שיוצאת ללקוחות'}
        </label>
      )}

      <style>{`.au-pill{animation:auPop .28s cubic-bezier(.34,1.56,.64,1)}
        @keyframes auPop{0%{transform:scaleY(.82) scaleX(.97)}60%{transform:scaleY(1.06) scaleX(1.01)}100%{transform:none}}
        @media (prefers-reduced-motion:reduce){.au-pill{animation:none;transition:none!important}}`}</style>
    </div>
  );
}
