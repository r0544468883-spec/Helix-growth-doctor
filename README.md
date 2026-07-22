# HELIX Growth Doctor (מוצר 7)

מאבחן איפה מאבדים לקוחות — ומתקן. שני צירים: **המרה (CRO)** + **שימור (משתמשים חוזרים)**. עברית-first · פרטיות (Ollama on-prem) · תרגום תובנה→פעולה.

## הרצה
```bash
npm install
cp .env.example .env.local   # מלא Supabase לפחות
npm run dev                  # http://localhost:3000
```
הרץ `supabase/schema.sql` ב-Supabase.

## ארכיטקטורה
```
[HELIX tag / Clarity / GA4] → events → [funnel + retention engines]
   → [Doctor agent (Ollama-first)] → תובנה→פעולה
   → מתקן דרך HELIX OPS (Landing/A-B/Campaigns) · digest בבוט · מדדים לדשבורדים
```

## מחובר לאקו-סיסטם (כמו שאר המוצרים)
- **🔒 Ollama** — `lib/ollama.ts` (model-router, on-prem — הדאטה לא עוזבת).
- **🤖 בוט** — `/api/bot` (טלגרם) + `lib/channels` (וואטסאפ/מייל). "מה הכי דולף?" → אבחון.
- **📊 דשבורדים** — `/api/export/growth-metrics` → connector `helix_growth` ב-HELIX DASHBOARDS.

## מסלולים
| נתיב | תיאור |
|---|---|
| `/` | דשבורד: heatmap · funnel · cohort heatmap · אבחון |
| `/api/collect` | קליטת אירועים מה-HELIX tag (`public/helix-tag.js`) |
| `/api/bot` | webhook בוט — אבחון על דרישה |
| `/api/export/growth-metrics` | ייצוא מדדים לדשבורד-העל |

## מה נשאר (ראה `PRODUCTS/07-growth-doctor.md` §11)
connector Clarity/GA4 · מנוע cohort real-data מלא · חיווט הפעלת-התיקון ל-HELIX OPS · לולאה אוטונומית (cron) · הרצה live.
