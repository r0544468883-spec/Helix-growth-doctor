import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase/admin';
import { funnelFromEvents, DEMO } from '@/lib/analytics';
import { diagnose, digestText } from '@/lib/doctor';
import { sendTelegram } from '@/lib/channels';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Telegram bot webhook — ask the Doctor. "מה הכי דולף?" / "אבחון" → returns the
// diagnosis digest. WhatsApp/Email reuse the same digest via the digest cron.
export async function POST(req: Request) {
  const update = (await req.json().catch(() => ({}))) as { message?: { chat?: { id?: number }; text?: string } };
  const chatId = update.message?.chat?.id;
  if (!chatId) return NextResponse.json({ ok: true });

  const admin = createAdmin();
  // Resolve the workspace linked to this chat; else the first workspace; else demo.
  const { data: link } = await admin.from('bot_links').select('workspace_id').eq('chat_id', String(chatId)).maybeSingle();
  const ws = (link?.workspace_id as string) || (await admin.from('workspaces').select('id').limit(1).maybeSingle()).data?.id;

  const funnel = (ws && (await funnelFromEvents(admin, ws as string))) || DEMO.funnel();
  const insights = diagnose(funnel, DEMO.cohorts());
  const text = await digestText(insights);

  await sendTelegram(String(chatId), text);
  return NextResponse.json({ ok: true });
}
