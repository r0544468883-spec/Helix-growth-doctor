import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase/admin';
import { sendTelegram } from '@/lib/channels';
import { handleOperatorCommand } from '@/lib/bot/operator';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Telegram bot webhook — the operator runs the whole product from chat. Every
// Growth Doctor feature is reachable in natural Hebrew via handleOperatorCommand:
// "אבחון" (full diagnosis), "דוח"/"דייג׳סט" (digest), "משפך" (funnel status),
// "נשירה" (top drop-off), "שימור"/"קוהורט" (retention). WhatsApp/Email reuse the
// same digest via the digest cron.
export async function POST(req: Request) {
  const update = (await req.json().catch(() => ({}))) as { message?: { chat?: { id?: number }; text?: string } };
  const chatId = update.message?.chat?.id;
  if (!chatId) return NextResponse.json({ ok: true });
  const text = update.message?.text ?? '';

  const admin = createAdmin();
  // Resolve the workspace linked to this chat; else the first workspace.
  const { data: link } = await admin.from('bot_links').select('workspace_id').eq('chat_id', String(chatId)).maybeSingle();
  const ws = (link?.workspace_id as string) || (await admin.from('workspaces').select('id').limit(1).maybeSingle()).data?.id;
  if (!ws) return NextResponse.json({ ok: true });

  const reply = await handleOperatorCommand({ workspaceId: ws as string, text });
  await sendTelegram(String(chatId), reply);
  return NextResponse.json({ ok: true });
}
