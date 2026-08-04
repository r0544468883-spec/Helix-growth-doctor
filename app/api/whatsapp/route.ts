import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase/admin';
import { sendWhatsApp } from '@/lib/channels';
import { handleOperatorCommand } from '@/lib/bot/operator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// WhatsApp Cloud API webhook — the mirror of the Telegram bot (app/api/bot).
// Meta verifies the endpoint once with a GET challenge, then POSTs inbound
// messages. A linked number (bot_links.chat_id = sender phone, bare digits like
// 972501234567) gets its workspace's REAL data via the same operator router;
// else we fall back to the first workspace. Replies are free-text — valid inside
// the 24h window the user's inbound message opens.

// Meta webhook verification handshake.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 });
  }
  return new Response('forbidden', { status: 403 });
}

type WaWebhook = {
  entry?: { changes?: { value?: { messages?: { from?: string; type?: string; text?: { body?: string } }[] } }[] }[];
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as WaWebhook;
  const msg = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const from = msg?.from;
  // Non-message events (delivery/read status callbacks etc.) — ack and ignore.
  if (!from || msg?.type !== 'text') return NextResponse.json({ ok: true });
  const text = (msg?.text?.body ?? '').trim();

  const admin = createAdmin();
  // Resolve the workspace linked to this number; else the first workspace.
  const { data: link } = await admin.from('bot_links').select('workspace_id').eq('chat_id', from).maybeSingle();
  const ws = (link?.workspace_id as string) || (await admin.from('workspaces').select('id').limit(1).maybeSingle()).data?.id;
  if (!ws) return NextResponse.json({ ok: true });

  const reply = await handleOperatorCommand({ workspaceId: ws as string, text });
  await sendWhatsApp(from, reply);
  return NextResponse.json({ ok: true });
}
