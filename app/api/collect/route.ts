import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export function OPTIONS() { return new Response('ok', { headers: cors }); }

// Ingest a behavior event from the HELIX tag (or a connector). First-party — the
// data lands in the workspace's own Supabase. Anonymous visitor_id, no PII.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { ws?: string; visitor_id?: string; name?: string; step?: number | null; meta?: Record<string, unknown>; page?: string };
  if (!b.ws || !b.visitor_id || !b.name) return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: cors });

  const admin = createAdmin();
  await admin.from('events').insert({
    workspace_id: b.ws, visitor_id: b.visitor_id, name: b.name,
    step: typeof b.step === 'number' ? b.step : null,
    meta: { ...(b.meta ?? {}), page: b.page ?? (b.meta as { page?: string })?.page },
  });
  return NextResponse.json({ ok: true }, { headers: cors });
}
