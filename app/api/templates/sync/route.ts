// POST /api/templates/sync?secret=... — registers every WhatsApp template in the
// catalog on the workspace's WABA (Meta message_templates). Idempotent: templates
// that already exist are treated as OK. Run once after setting up the WABA, and
// again whenever the catalog changes. Templates then need Meta APPROVAL (async).
// Config comes from env (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID / WHATSAPP_WABA_ID).
import { NextResponse } from 'next/server';
import { createWhatsAppTemplate, whatsappConfigFromEnv } from '@/lib/channels/whatsapp';
import { allRegistrationPayloads } from '@/lib/templates/whatsapp-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.EXPORT_SECRET;
  const provided = url.searchParams.get('secret') || req.headers.get('x-export-secret');
  if (secret && provided !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const config = whatsappConfigFromEnv();
  const wabaId = config.waba_id;
  if (!config.access_token) return NextResponse.json({ error: 'whatsapp_not_configured (WHATSAPP_TOKEN missing)' }, { status: 400 });
  if (!wabaId) return NextResponse.json({ error: 'WHATSAPP_WABA_ID missing (required to register templates)' }, { status: 400 });

  const results: { name: unknown; ok: boolean; status?: string; error?: string }[] = [];
  for (const payload of allRegistrationPayloads(appUrl)) {
    const r = await createWhatsAppTemplate(config, wabaId, payload);
    results.push({ name: payload.name, ok: r.ok, status: r.status, error: r.error });
  }
  return NextResponse.json({ ok: true, registered: results.filter((r) => r.ok).length, total: results.length, results });
}
