// Model Router — Ollama first (local, private — the CRO agent runs on the
// business's own data), Claude fallback for quality. Same pattern as the rest of
// the HELIX ecosystem.
type Msg = { role: 'user' | 'system'; content: string };

async function askOllama(messages: Msg[]): Promise<string | null> {
  const base = process.env.OLLAMA_BASE_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.OLLAMA_MODEL || 'llama3.1', messages, stream: false }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { message?: { content?: string } };
    return j.message?.content ?? null;
  } catch { return null; }
}

async function askClaude(messages: Msg[]): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const user = messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n');
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: process.env.CONTENT_MODEL || 'claude-sonnet-5', max_tokens: 1024, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { content?: { type?: string; text?: string }[] };
    return (j.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('') || null;
  } catch { return null; }
}

export async function narrate(messages: Msg[]): Promise<string> {
  return (await askOllama(messages)) ?? (await askClaude(messages)) ?? '';
}
export function modelInUse(): 'ollama' | 'claude' | 'none' {
  if (process.env.OLLAMA_BASE_URL) return 'ollama';
  if (process.env.ANTHROPIC_API_KEY) return 'claude';
  return 'none';
}
