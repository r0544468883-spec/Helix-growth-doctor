// POST /api/templates/sync?secret=... — registers every WhatsApp template
// (built-in catalog ∪ the workspace's custom uploads) on the workspace's WABA
// (Meta message_templates). Idempotent: templates that already exist are treated
// as OK. Run once after setting up the WABA, and again whenever the catalog or the
// workspace's custom templates change. Templates then need Meta APPROVAL (async).
// Config comes from env (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID / WHATSAPP_WABA_ID).
// Body (optional): { workspace_id } — or ?workspace=… — to fold in custom templates.
import { NextResponse } from 'next/server';
import { createWhatsAppTemplate, whatsappConfigFromEnv } from '@/lib/channels/whatsapp';
import { allRegistrationPayloads, registrationPayloadsFor } from '@/lib/templates/whatsapp-catalog';
import { mergedWhatsAppTemplates } from '@/lib/templates/custom';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.EXPORT_SECRET;
  const provided = url.searchParams.get('secret') || req.headers.get('x-export-secret');
  if (secret && provided !== secret) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({} as { workspace_id?: string }));
  const workspaceId = body?.workspace_id || url.searchParams.get('workspace') || process.env.DEFAULT_WORKSPACE_ID || '';

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  const config = whatsappConfigFromEnv();
  const wabaId = config.waba_id;
  if (!config.access_token) return NextResponse.json({ error: 'whatsapp_not_configured (WHATSAPP_TOKEN missing)' }, { status: 400 });
  if (!wabaId) return NextResponse.json({ error: 'WHATSAPP_WABA_ID missing (required to register templates)' }, { status: 400 });

  // Register built-in ∪ this workspace's custom WhatsApp templates. Without a
  // workspace we can only register the built-in catalog.
  const payloads = workspaceId
    ? registrationPayloadsFor(Object.values(await mergedWhatsAppTemplates(workspaceId)), appUrl)
    : allRegistrationPayloads(appUrl);

  const results: { name: unknown; ok: boolean; status?: string; error?: string }[] = [];
  for (const payload of payloads) {
    const r = await createWhatsAppTemplate(config, wabaId, payload);
    results.push({ name: payload.name, ok: r.ok, status: r.status, error: r.error });
  }
  return NextResponse.json({ ok: true, registered: results.filter((r) => r.ok).length, total: results.length, results });
}
