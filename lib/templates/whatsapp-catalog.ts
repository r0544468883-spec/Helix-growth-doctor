// WhatsApp TEMPLATE CATALOG — one approved template per PROACTIVE message the
// Growth Doctor sends over WhatsApp. Templates are the compliant way to open a
// conversation outside the 24h window (Meta §business-initiated). Each entry is
// BOTH:
//   1. a Meta registration payload (used by /api/templates/sync to create them), and
//   2. a runtime mapping (name + language + how to build the ordered {{n}} params)
//      used by the digest/alert senders to send via sendWhatsAppTemplate().
// This product only sends analytics NOTIFICATIONS (digests + alerts) → all UTILITY.

export type TemplateCategory = 'UTILITY' | 'MARKETING';

export type TemplateDef = {
  /** WhatsApp template name (a–z0–9_ only, unique per WABA). */
  name: string;
  language: string; // 'he'
  category: TemplateCategory;
  /** Body with {{1}},{{2}}… placeholders, exactly as registered with Meta. */
  body: string;
  /** Human-readable list of what each {{n}} is, for the example block + docs. */
  params: string[];
  /** Optional dynamic URL button (e.g. the dashboard deep-link). {{1}} = suffix. */
  urlButton?: { text: string; baseUrl: string }; // full url = baseUrl + {{1}}
  sampleParams: string[];
  sampleUrlSuffix?: string;
};

// Feature → template. One proactive message this analytics product emits per key.
export const TEMPLATES: Record<string, TemplateDef> = {
  daily_digest: {
    name: 'gd_daily_digest',
    language: 'he',
    category: 'UTILITY',
    body: 'בוקר טוב {{1}} 👋 האבחון היומי מ-HELIX Growth Doctor מוכן:\n\n{{2}}\n\nהפעולה הדחופה להיום: {{3}}. ללוח המלא הקישו על הכפתור.',
    params: ['שם העסק', 'שורת סיכום האבחון', 'הפעולה המומלצת הדחופה'],
    urlButton: { text: 'ללוח הבקרה', baseUrl: '{{APP_URL}}/d/' },
    sampleParams: ['סטודיו רהיטים', 'ההמרה ירדה ל-5.9% והנשירה בעגלה עלתה', 'לקצר את טופס העגלה'],
    sampleUrlSuffix: 'ws_123',
  },
  weekly_digest: {
    name: 'gd_weekly_digest',
    language: 'he',
    category: 'UTILITY',
    body: 'סיכום שבועי 📈 {{1}}\n\nהמרה כוללת: {{2}} | נקודת הנשירה הגדולה: {{3}} | שימור D7: {{4}}.\n\nלפירוט מלא ומגמות הקישו על הכפתור.',
    params: ['שם העסק', 'אחוז המרה כולל', 'שם שלב הנשירה הגדול', 'אחוז שימור D7'],
    urlButton: { text: 'לדוח השבועי', baseUrl: '{{APP_URL}}/d/' },
    sampleParams: ['סטודיו רהיטים', '5.9%', 'עגלה (61%)', '18%'],
    sampleUrlSuffix: 'ws_123',
  },
  funnel_dropoff_alert: {
    name: 'gd_funnel_dropoff_alert',
    language: 'he',
    category: 'UTILITY',
    body: '⚠️ התראת נשירה — {{1}}\n\nבשלב "{{2}}" נושרים כעת {{3}}% מהמשתמשים, מעל הרף הרגיל. שווה לבדוק את השלב הזה עכשיו לפני שהוא פוגע בהמרה.',
    params: ['שם העסק', 'שם השלב שדולף', 'אחוז הנשירה'],
    sampleParams: ['סטודיו רהיטים', 'צ׳קאאוט', '74'],
  },
  retention_decline_alert: {
    name: 'gd_retention_decline_alert',
    language: 'he',
    category: 'UTILITY',
    body: '📉 התראת שימור — {{1}}\n\nשיעור החזרה של הקבוצה האחרונה ירד מ-{{2}}% ל-{{3}}%. מומלץ להפעיל רצף win-back לנושרים ולבדוק שינויים ב-onboarding.',
    params: ['שם העסק', 'אחוז שימור קודם', 'אחוז שימור נוכחי'],
    sampleParams: ['סטודיו רהיטים', '24', '17'],
  },
  diagnosis_ready: {
    name: 'gd_diagnosis_ready',
    language: 'he',
    category: 'UTILITY',
    body: 'האבחון החדש של {{1}} מוכן ✅\n\nזיהינו {{2}} הזדמנויות שיפור, בראשן: {{3}}. להצגת הממצאים המלאים והמלצות הפעולה הקישו על הכפתור.',
    params: ['שם העסק', 'מספר הממצאים', 'הממצא המוביל'],
    urlButton: { text: 'לצפייה באבחון', baseUrl: '{{APP_URL}}/d/' },
    sampleParams: ['סטודיו רהיטים', '3', 'נקודת נשירה קריטית בצ׳קאאוט'],
    sampleUrlSuffix: 'ws_123',
  },
};

/** Runtime: build the ordered {{n}} params a template expects from render context. */
export function templateParams(
  key: string,
  ctx: {
    business?: string;
    summary?: string;
    action?: string;
    conversion?: string;
    dropStep?: string;
    dropPct?: string;
    retentionD7?: string;
    prevRetention?: string;
    currRetention?: string;
    findingsCount?: string;
    topFinding?: string;
  },
): { def: TemplateDef; params: string[]; urlSuffix?: string } | null {
  const def = TEMPLATES[key];
  if (!def) return null;
  const biz = ctx.business ?? '';
  const map: Record<string, string[]> = {
    daily_digest: [biz, ctx.summary ?? '', ctx.action ?? ''],
    weekly_digest: [biz, ctx.conversion ?? '', ctx.dropStep ?? '', ctx.retentionD7 ?? ''],
    funnel_dropoff_alert: [biz, ctx.dropStep ?? '', ctx.dropPct ?? ''],
    retention_decline_alert: [biz, ctx.prevRetention ?? '', ctx.currRetention ?? ''],
    diagnosis_ready: [biz, ctx.findingsCount ?? '', ctx.topFinding ?? ''],
  };
  return { def, params: map[key] ?? [] };
}

/** Build the Meta message_templates registration payload for one template. */
export function registrationPayload(def: TemplateDef, appUrl: string): Record<string, unknown> {
  const components: Record<string, unknown>[] = [
    { type: 'BODY', text: def.body, example: { body_text: [def.sampleParams] } },
  ];
  if (def.urlButton) {
    const base = def.urlButton.baseUrl.replace('{{APP_URL}}', appUrl.replace(/\/$/, ''));
    components.push({
      type: 'BUTTONS',
      buttons: [
        {
          type: 'URL',
          text: def.urlButton.text,
          url: `${base}{{1}}`,
          example: [`${base}${def.sampleUrlSuffix ?? 'sample'}`],
        },
      ],
    });
  }
  return { name: def.name, language: def.language, category: def.category, components };
}

export function allRegistrationPayloads(appUrl: string): Record<string, unknown>[] {
  return Object.values(TEMPLATES).map((d) => registrationPayload(d, appUrl));
}
