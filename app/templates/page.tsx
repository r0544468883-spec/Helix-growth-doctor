'use client';
// WhatsApp templates manager — view the built-in Growth Doctor templates and
// upload / edit / delete your OWN. A custom entry with the same key OVERRIDES the
// built-in. Talks to /api/templates/{list,custom}. Theme-aware via globals.css vars.
import { useCallback, useEffect, useState } from 'react';

type WaItem = {
  key: string; name: string; language: string; category: string; body: string;
  params: string[]; sampleParams: string[]; quickReply: string[] | null;
  urlButton: { text: string; baseUrl: string } | null;
  source: 'builtin' | 'custom'; overrides: boolean;
};

type EditData = {
  key: string; name: string; language: string; category: string; body: string;
  params: string; sampleParams: string; quickReply: string;
};

type Status = { kind: 'ok' | 'err'; msg: string } | null;

const chip = (bg: string, fg = '#fff'): React.CSSProperties => ({
  fontSize: 11, padding: '2px 8px', borderRadius: 999, background: bg, color: fg, whiteSpace: 'nowrap', fontWeight: 600,
});
const input: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--line)',
  background: 'var(--bg)', color: 'var(--ink)', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
};
const btn = (bg: string, fg = '#fff'): React.CSSProperties => ({
  padding: '9px 16px', borderRadius: 8, border: 'none', background: bg, color: fg,
  fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
});

const splitList = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export default function TemplatesPage() {
  const [wa, setWa] = useState<WaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>(null);
  const [editor, setEditor] = useState<null | { data: EditData; isNew: boolean }>(null);

  const flash = (kind: 'ok' | 'err', msg: string) => {
    setStatus({ kind, msg });
    window.setTimeout(() => setStatus(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/templates/list');
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'טעינה נכשלה');
      setWa(j.whatsapp ?? []);
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'טעינה נכשלה');
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const newTpl = (): EditData => ({ key: '', name: '', language: 'he', category: 'UTILITY', body: '', params: '', sampleParams: '', quickReply: '' });
  const openNew = () => setEditor({ isNew: true, data: newTpl() });
  const openEdit = (i: WaItem) => setEditor({
    isNew: i.source !== 'custom', // built-in → "clone as custom"
    data: {
      key: i.key, name: i.name, language: i.language, category: i.category, body: i.body,
      params: i.params.join(', '), sampleParams: i.sampleParams.join(', '),
      quickReply: (i.quickReply ?? []).join(', '),
    },
  });

  const save = async () => {
    if (!editor) return;
    const d = editor.data;
    if (!d.key.trim()) return flash('err', 'חובה מפתח (key)');
    if (!/^[a-z0-9_]+$/.test(d.name.trim())) return flash('err', 'שם התבנית חייב להיות באותיות a-z, ספרות ו־_');
    try {
      const definition: Record<string, unknown> = {
        name: d.name.trim(), language: d.language.trim() || 'he', category: d.category, body: d.body,
        params: splitList(d.params), sampleParams: splitList(d.sampleParams),
      };
      if (d.quickReply.trim()) definition.quickReply = splitList(d.quickReply);
      const r = await fetch('/api/templates/custom', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'whatsapp', key: d.key.trim(), definition }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.results?.[0]?.error || j.error || 'שמירה נכשלה');
      setEditor(null); flash('ok', 'נשמר ✓'); load();
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'שמירה נכשלה');
    }
  };

  const remove = async (key: string) => {
    if (!confirm(`למחוק את "${key}"? (חוזר לתבנית המובנית אם קיימת)`)) return;
    try {
      const r = await fetch(`/api/templates/custom?kind=whatsapp&key=${encodeURIComponent(key)}`, { method: 'DELETE' });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'מחיקה נכשלה');
      flash('ok', 'נמחק'); load();
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'מחיקה נכשלה');
    }
  };

  const catColor = (c: string) => (c === 'MARKETING' ? 'var(--warn)' : c === 'AUTHENTICATION' ? '#6d28d9' : 'var(--ink-2)');

  return (
    <main dir="rtl" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)' }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '32px 20px 80px' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 6 }}>ניהול תבניות WhatsApp</h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
          צפייה בתבניות המובנות של HELIX Growth Doctor והעלאת תבניות משלך. תבנית מותאמת עם אותו מפתח דורסת את המובנית.
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={chip('var(--brand-soft)', 'var(--brand-ink)')}>WhatsApp · {wa.length} תבניות</span>
          <div style={{ flex: 1 }} />
          <button onClick={openNew} style={btn('var(--brand)')}>+ תבנית חדשה</button>
        </div>

        {status && (
          <div role="status" style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            background: status.kind === 'ok' ? 'var(--brand-soft)' : '#ef444418',
            color: status.kind === 'ok' ? 'var(--brand-ink)' : 'var(--crit)',
            border: `1px solid ${status.kind === 'ok' ? 'var(--brand)' : 'var(--crit)'}`,
          }}>{status.msg}</div>
        )}

        {loading ? (
          <div style={{ color: 'var(--ink-2)', padding: 40, textAlign: 'center' }}>טוען…</div>
        ) : wa.length === 0 ? (
          <div style={{ color: 'var(--ink-2)', padding: 40, textAlign: 'center', border: '1px dashed var(--line)', borderRadius: 12 }}>
            אין תבניות עדיין. הוסף תבנית ראשונה.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {wa.map((i) => (
              <Row
                key={i.key}
                title={i.name}
                sub={i.body}
                badges={[
                  <span key="c" style={chip(catColor(i.category))}>{i.category}</span>,
                  i.source === 'custom'
                    ? <span key="s" style={chip('var(--good)')}>{i.overrides ? 'דורס מובנה' : 'מותאם'}</span>
                    : <span key="s" style={chip('var(--ink-2)')}>מובנה</span>,
                  ...(i.quickReply ? [<span key="q" style={chip('#0e7490')}>Quick-Reply</span>] : []),
                  ...(i.urlButton ? [<span key="u" style={chip('#334155')}>כפתור URL</span>] : []),
                ]}
                onEdit={() => openEdit(i)}
                onDelete={i.source === 'custom' ? () => remove(i.key) : undefined}
                editLabel={i.source === 'custom' ? 'ערוך' : 'שכפל כמותאם'}
              />
            ))}
          </div>
        )}
      </div>

      {editor && (
        <div onClick={() => setEditor(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', overflowY: 'auto', padding: '40px 16px', zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 560, boxShadow: 'var(--shadow)' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>
              {editor.isNew ? 'תבנית WhatsApp חדשה' : 'עריכת תבנית WhatsApp'}
            </h2>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="מפתח (key)">
                <input style={input} value={editor.data.key}
                  onChange={(e) => setEditor({ ...editor, data: { ...editor.data, key: e.target.value } })}
                  placeholder="למשל daily_digest / my_promo" />
              </Field>
              <Field label="שם התבנית ב-Meta (a-z0-9_)">
                <input style={input} value={editor.data.name}
                  onChange={(e) => setEditor({ ...editor, data: { ...editor.data, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') } })}
                  placeholder="gd_my_promo" />
              </Field>
              <div style={{ display: 'flex', gap: 12 }}>
                <Field label="קטגוריה">
                  <select style={input} value={editor.data.category}
                    onChange={(e) => setEditor({ ...editor, data: { ...editor.data, category: e.target.value } })}>
                    <option value="UTILITY">UTILITY</option>
                    <option value="MARKETING">MARKETING</option>
                    <option value="AUTHENTICATION">AUTHENTICATION</option>
                  </select>
                </Field>
                <Field label="שפה">
                  <input style={input} value={editor.data.language}
                    onChange={(e) => setEditor({ ...editor, data: { ...editor.data, language: e.target.value } })}
                    placeholder="he" />
                </Field>
              </div>
              <Field label="גוף ההודעה ({{1}}, {{2}}…)">
                <textarea style={{ ...input, minHeight: 100, resize: 'vertical' }} value={editor.data.body}
                  onChange={(e) => setEditor({ ...editor, data: { ...editor.data, body: e.target.value } })} />
              </Field>
              <Field label="פרמטרים (תיאור, מופרד בפסיקים)">
                <input style={input} value={editor.data.params}
                  onChange={(e) => setEditor({ ...editor, data: { ...editor.data, params: e.target.value } })}
                  placeholder="שם העסק, שורת סיכום, פעולה מומלצת" />
              </Field>
              <Field label="דוגמאות לפרמטרים (מופרד בפסיקים)">
                <input style={input} value={editor.data.sampleParams}
                  onChange={(e) => setEditor({ ...editor, data: { ...editor.data, sampleParams: e.target.value } })}
                  placeholder="סטודיו רהיטים, ההמרה ירדה, לקצר את הטופס" />
              </Field>
              <Field label="כפתורי Quick-Reply (אופציונלי, מופרד בפסיקים)">
                <input style={input} value={editor.data.quickReply}
                  onChange={(e) => setEditor({ ...editor, data: { ...editor.data, quickReply: e.target.value } })}
                  placeholder="אישור, ביטול" />
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={save} style={btn('var(--brand)')}>שמירה</button>
              <button onClick={() => setEditor(null)} style={btn('var(--line)', 'var(--ink)')}>ביטול</button>
            </div>
            <p style={{ color: 'var(--ink-2)', fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>
              אחרי שמירה — הרץ סנכרון (/api/templates/sync) ואשר את התבנית ב-WhatsApp Manager לפני שליחה מחוץ לחלון 24 השעות.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ title, sub, badges, onEdit, onDelete, editLabel }: {
  title: string; sub: string; badges: React.ReactNode[]; onEdit: () => void; onDelete?: () => void; editLabel: string;
}) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'center', boxShadow: 'var(--shadow)' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 5, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 14 }}>{title}</strong>
          {badges}
        </div>
        <div style={{ color: 'var(--ink-2)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
      </div>
      <button onClick={onEdit} style={{ ...btn('var(--line)', 'var(--ink)'), padding: '7px 12px' }}>{editLabel}</button>
      {onDelete && (
        <button onClick={onDelete} style={{ padding: '7px 10px', borderRadius: 8, background: 'transparent', color: 'var(--crit)', border: '1px solid var(--line)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>מחק</button>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', flex: 1 }}>
      <span style={{ display: 'block', fontSize: 12, color: 'var(--ink-2)', marginBottom: 5 }}>{label}</span>
      {children}
    </label>
  );
}
