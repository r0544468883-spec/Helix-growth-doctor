'use client';

import { useEffect, useRef } from 'react';
import type { FunnelStage, CohortRow, HeatPoint, Insight } from '@/lib/types';

const panel: React.CSSProperties = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 18, boxShadow: 'var(--shadow)' };
const nf = (n: number) => n.toLocaleString('he-IL');

// Retention cell color (red→green heat).
function retColor(v: number): string {
  const stops: [number, string][] = [[0, '#dc2626'], [20, '#f97316'], [40, '#eab308'], [60, '#10b981'], [100, '#065f46']];
  const p = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  for (let i = 0; i < stops.length - 1; i++) {
    const [av, ah] = stops[i], [bv, bh] = stops[i + 1];
    if (v <= bv) { const t = (v - av) / (bv - av || 1); const a = p(ah), b = p(bh); return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`; }
  }
  return stops[stops.length - 1][1];
}
const SEV: Record<Insight['severity'], { bg: string; icon: string }> = {
  crit: { bg: '#ef44441a', icon: '🩹' }, warn: { bg: '#f59e0b1a', icon: '📉' }, good: { bg: '#10b9811a', icon: '💰' },
};
const ACTION: Record<Insight['action'], string> = { landing: '🖥️ תקן את הדף + הרץ A/B', ab: '🅰️🅱️ הרץ A/B', campaign: '📣 בנה קמפיין', winback: '💬 שלח win-back' };

export default function Dashboard({ funnel, cohorts, heat, insights, model }: {
  funnel: FunnelStage[]; cohorts: CohortRow[]; heat: HeatPoint[]; insights: Insight[]; model: string;
}) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current; if (!c) return; const x = c.getContext('2d'); if (!x) return;
    const cols = ['rgba(30,64,175,', 'rgba(8,145,178,', 'rgba(16,185,129,', 'rgba(234,179,8,', 'rgba(249,115,22,', 'rgba(220,38,38,'];
    x.clearRect(0, 0, c.width, c.height); x.globalCompositeOperation = 'lighter';
    for (const p of heat) {
      const col = cols[Math.min(5, Math.floor(p.w * 5))];
      const r = 50 + p.w * 90, g = x.createRadialGradient(p.x * c.width, p.y * c.height, 0, p.x * c.width, p.y * c.height, r);
      g.addColorStop(0, col + '.9)'); g.addColorStop(.4, col + '.5)'); g.addColorStop(1, col + '0)');
      x.fillStyle = g; x.beginPath(); x.arc(p.x * c.width, p.y * c.height, r, 0, 7); x.fill();
    }
  }, [heat]);

  const entered = funnel[0]?.count ?? 0, converted = funnel[funnel.length - 1]?.count ?? 0;
  const convRate = entered ? ((converted / entered) * 100).toFixed(1) : '0';
  const worst = funnel.slice(1).reduce((a, b) => (b.dropPct > a.dropPct ? b : a), funnel[1] ?? { name: '', dropPct: 0, count: 0 });
  const d7 = cohorts[0]?.cells[1] ?? 0;

  return (
    <main className="tnum" style={{ maxWidth: 1140, margin: '0 auto', padding: 'clamp(16px,3vw,40px)' }}>
      {/* header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: 'linear-gradient(135deg,var(--brand),var(--h1))', display: 'grid', placeItems: 'center', fontSize: 22, boxShadow: 'var(--shadow)' }}>🩺</div>
          <div>
            <h1 style={{ fontSize: 'clamp(21px,3vw,29px)', fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>HELIX Growth Doctor</h1>
            <div style={{ color: 'var(--ink-2)', fontSize: 14, marginTop: 2 }}>מאבחן איפה מאבדים לקוחות — ומתקן. המרה + שימור, בעברית.</div>
          </div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--brand-soft)', color: 'var(--brand-ink)', border: '1px solid var(--brand)', borderRadius: 999, padding: '7px 13px', fontSize: 12.5, fontWeight: 700, height: 'max-content' }}>
          🔒 {model === 'ollama' ? 'Ollama מקומי — הדאטה נשארת אצלך' : model === 'claude' ? 'Claude' : 'מנוע לא מוגדר'}
        </div>
      </header>

      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { k: 'אחוז המרה', v: convRate + '%', s: 'var(--warn)' },
          { k: `נשירה · ${worst?.name ?? ''}`, v: (worst?.dropPct ?? 0) + '%', s: 'var(--crit)' },
          { k: 'שימור D7', v: d7 + '%', s: 'var(--crit)' },
          { k: 'המרות', v: nf(converted), s: 'var(--good)' },
        ].map((t, i) => (
          <div key={i} style={{ ...panel, borderRadius: 15, padding: '15px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', insetInlineStart: 0, top: 0, bottom: 0, width: 4, background: t.s }} />
            <div style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 600 }}>{t.k}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', marginTop: 4 }}>{t.v}</div>
          </div>
        ))}
      </div>

      {/* axis A: heatmap + funnel */}
      <SectionLabel>ציר A · המרה — למה ביקור ראשון לא הופך ללקוח</SectionLabel>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,.9fr)', gap: 14, marginBottom: 20 }} className="gd-grid">
        <div style={{ ...panel, overflow: 'hidden' }}>
          <PHead title="🔥 מפת-חום · דף הנחיתה" eyebrow="Heatmap" />
          <div style={{ padding: 18 }}>
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)' }}>
              <canvas ref={cv} width={640} height={340} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', mixBlendMode: 'screen', opacity: .9 }} aria-hidden />
              <div style={{ position: 'relative', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[16, 11, 11].map((h, i) => <div key={i} style={{ height: h, borderRadius: 5, background: 'var(--line)', width: ['55%', '80%', '72%'][i] }} />)}
                <div style={{ height: 70, borderRadius: 9, background: 'repeating-linear-gradient(45deg,var(--line),var(--line) 8px,transparent 8px,transparent 16px)' }} />
                <div style={{ margin: '4px auto 0', padding: '9px 22px', borderRadius: 9, background: 'var(--ink)', color: 'var(--panel)', fontSize: 12, fontWeight: 800, width: 'max-content' }}>קנה עכשיו</div>
              </div>
            </div>
            <Legend from="מוזנח" to="הרבה תשומת-לב" grad="linear-gradient(90deg,var(--h0),var(--h1),var(--h2),var(--h3),var(--h4),var(--h5))" />
          </div>
        </div>
        <div style={{ ...panel, overflow: 'hidden' }}>
          <PHead title="🪜 משפך · איפה נופלים" eyebrow="Funnel" />
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {funnel.map((s, i) => {
              const pct = Math.max(4, Math.round((s.count / entered) * 100));
              const hot = i >= 3;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 84, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)', flex: 'none' }}>{s.name}</span>
                  <div style={{ flex: 1, height: 30, background: 'var(--bg)', borderRadius: 8, position: 'relative', overflow: 'hidden', border: '1px solid var(--line)' }}>
                    <div style={{ position: 'absolute', insetBlock: 0, insetInlineStart: 0, width: pct + '%', borderRadius: 8, background: hot ? 'linear-gradient(90deg,var(--h4),var(--h5))' : 'linear-gradient(90deg,var(--brand),var(--h2))', display: 'flex', alignItems: 'center', paddingInlineStart: 10, color: '#fff', fontSize: 12, fontWeight: 800 }}>{nf(s.count)}</div>
                  </div>
                  <span style={{ width: 46, fontSize: 12, fontWeight: 800, color: 'var(--crit)', flex: 'none' }}>{i === 0 ? '—' : '‎-' + s.dropPct + '%'}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* axis B: cohort heatmap */}
      <SectionLabel>ציר B · שימור — מי חוזר, מי נושר, ומתי</SectionLabel>
      <div style={{ ...panel, overflow: 'hidden', marginBottom: 20 }}>
        <PHead title="🌡️ Cohort Heatmap · אחוז חוזרים לפי שבוע" eyebrow="Retention" />
        <div style={{ padding: 18, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 4, fontSize: 12, width: '100%' }}>
            <thead><tr>{['', 'שבוע 0', '1', '2', '3', '4', '5', '6'].map((h, i) => <th key={i} style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 700, padding: 2 }}>{h}</th>)}</tr></thead>
            <tbody>
              {cohorts.map((r, ri) => (
                <tr key={ri}>
                  <td style={{ color: 'var(--ink-2)', fontWeight: 700, whiteSpace: 'nowrap', paddingInlineEnd: 6, textAlign: 'start' }}>{r.label}</td>
                  {r.cells.map((v, ci) => (
                    <td key={ci}>
                      {v === null
                        ? <div style={{ height: 32, borderRadius: 7, background: 'var(--line)', opacity: .35 }} />
                        : <div style={{ height: 32, borderRadius: 7, background: retColor(v), color: '#06231a', fontWeight: 800, display: 'grid', placeItems: 'center' }}>{v}%</div>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <Legend from="נשירה" to="חוזרים" grad="linear-gradient(90deg,var(--h5),var(--h4),var(--h3),var(--h2),var(--good))" />
        </div>
      </div>

      {/* insights */}
      <SectionLabel>🧠 האבחון של הסוכן — תובנה → פעולה</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {insights.map((ins, i) => (
          <div key={i} style={{ ...panel, borderRadius: 14, padding: '13px 15px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', fontSize: 17, flex: 'none', background: SEV[ins.severity].bg }}>{SEV[ins.severity].icon}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{ins.title}</div>
              <div style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>{ins.detail}</div>
              <button style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--brand)', color: '#fff', border: 0, borderRadius: 9, padding: '7px 13px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>{ACTION[ins.action]}</button>
            </div>
          </div>
        ))}
      </div>

      <footer style={{ marginTop: 26, textAlign: 'center', color: 'var(--ink-2)', fontSize: 12 }}>HELIX Growth Doctor · אבחון · תיקון · מדידה — לולאה אחת</footer>
      <style>{`@media (max-width:820px){.gd-grid{grid-template-columns:1fr!important}}`}</style>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '.02em', color: 'var(--ink-2)', margin: '4px 2px 12px', textTransform: 'uppercase' }}>{children}</h2>;
}
function PHead({ title, eyebrow }: { title: string; eyebrow: string }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', padding: '15px 18px 0' }}><span style={{ fontSize: 15, fontWeight: 800 }}>{title}</span><span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--brand-ink)' }}>{eyebrow}</span></div>;
}
function Legend({ from, to, grad }: { from: string; to: string; grad: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 11, color: 'var(--ink-2)' }}><span>{from}</span><span style={{ height: 9, flex: 1, borderRadius: 5, background: grad }} /><span>{to}</span></div>;
}
