'use client';

import { useState } from 'react';
import { linkWhatsApp } from '@/app/actions';

const panel: React.CSSProperties = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 18, boxShadow: 'var(--shadow)' };

const ERR: Record<string, string> = {
  unauthorized: 'צריך להתחבר כדי לקשר מספר.',
  no_workspace: 'לא נמצא סביבת עבודה לחשבון הזה.',
  phone_required: 'הזן מספר טלפון תקין (לפחות 8 ספרות).',
};

// Link a WhatsApp number to the workspace so the WhatsApp bot answers with the
// business's REAL data — the mirror of the Telegram bot linking. Minimal RTL card.
export default function WhatsAppLink() {
  const [phone, setPhone] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    const res = await linkWhatsApp(phone);
    if (res.ok) { setState('ok'); setMsg('המספר קושר. שלח הודעה לבוט ב-WhatsApp וקבל את הנתונים שלך.'); }
    else { setState('err'); setMsg(ERR[res.error ?? ''] ?? 'שגיאה בקישור המספר.'); }
  }

  return (
    <section style={{ maxWidth: 1140, margin: '0 auto', padding: '0 clamp(16px,3vw,40px) clamp(16px,3vw,40px)' }}>
      <div style={{ ...panel, padding: 18 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 18 }}>💬</span>
          <h2 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>קשר את ה-WhatsApp שלך</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', margin: '0 0 12px' }}>
          קשר את מספר ה-WhatsApp שלך כדי שהבוט יענה עם הנתונים האמיתיים שלך — אבחון, משפך, נשירה ושימור, בשיחה חופשית בעברית.
        </p>
        <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            dir="ltr"
            placeholder="972501234567"
            aria-label="מספר WhatsApp"
            style={{ flex: '1 1 220px', minWidth: 0, background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 9, padding: '9px 12px', fontSize: 14, color: 'var(--ink)', fontFamily: 'inherit', textAlign: 'left' }}
          />
          <button
            type="submit"
            disabled={state === 'busy'}
            style={{ background: 'var(--brand)', color: '#fff', border: 0, borderRadius: 9, padding: '9px 16px', fontSize: 13, fontWeight: 800, cursor: state === 'busy' ? 'default' : 'pointer', fontFamily: 'inherit', opacity: state === 'busy' ? 0.6 : 1 }}
          >{state === 'busy' ? 'מקשר…' : 'קשר מספר'}</button>
        </form>
        {state === 'ok' && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: 'var(--brand)' }}>✓ {msg}</div>}
        {state === 'err' && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 700, color: 'var(--crit)' }}>{msg}</div>}
      </div>
    </section>
  );
}
