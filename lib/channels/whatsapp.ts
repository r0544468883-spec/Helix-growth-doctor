// WhatsApp Cloud API — text send + approved-template send + template registration.
// ⚠️ Proactive (business-initiated) messages need an OPEN 24h window OR an approved
// template. The Growth Doctor's digests/alerts go out proactively → template first.
// Config comes from env (WHATSAPP_TOKEN / WHATSAPP_PHONE_ID / WHATSAPP_WABA_ID) via
// whatsappConfigFromEnv(), mirroring the rest of the HELIX ecosystem.
const GRAPH = 'https://graph.facebook.com/v21.0';

export type WhatsAppConfig = {
  access_token?: string;
  phone_number_id?: string;
  waba_id?: string;
};

export type SendResult = { ok: boolean; externalId?: string; error?: string };

/** Read WhatsApp config from this repo's env vars. */
export function whatsappConfigFromEnv(): WhatsAppConfig {
  return {
    access_token: process.env.WHATSAPP_TOKEN,
    phone_number_id: process.env.WHATSAPP_PHONE_ID,
    waba_id: process.env.WHATSAPP_WABA_ID,
  };
}

export async function sendWhatsApp(config: WhatsAppConfig, to: string, content: string): Promise<SendResult> {
  const token = config.access_token;
  const phoneId = config.phone_number_id;
  if (!token || !phoneId) return { ok: false, error: 'whatsapp_not_configured' };
  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: content } }),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { message?: string } };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `whatsapp_${res.status}` };
    return { ok: true, externalId: json.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * Send an APPROVED WhatsApp template — the compliant way to open a conversation
 * proactively (outside the 24h window). `params` fill the body {{1}},{{2}}… in order.
 * `urlButtonParam` fills a dynamic URL button suffix (e.g. the dashboard deep-link).
 */
export async function sendWhatsAppTemplate(
  config: WhatsAppConfig,
  to: string,
  templateName: string,
  language: string,
  params: string[],
  urlButtonParam?: string,
): Promise<SendResult> {
  const token = config.access_token;
  const phoneId = config.phone_number_id;
  if (!token || !phoneId) return { ok: false, error: 'whatsapp_not_configured' };
  const components: Record<string, unknown>[] = [];
  if (params.length) {
    components.push({ type: 'body', parameters: params.map((t) => ({ type: 'text', text: t })) });
  }
  if (urlButtonParam) {
    components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: urlButtonParam }] });
  }
  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: templateName, language: { code: language }, ...(components.length ? { components } : {}) },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[]; error?: { message?: string } };
    if (!res.ok) return { ok: false, error: json.error?.message ?? `whatsapp_${res.status}` };
    return { ok: true, externalId: json.messages?.[0]?.id };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Register (create) a message template on the WABA. Duplicate name is treated as OK. */
export async function createWhatsAppTemplate(
  config: WhatsAppConfig,
  wabaId: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; id?: string; error?: string; status?: string }> {
  const token = config.access_token;
  if (!token) return { ok: false, error: 'whatsapp_not_configured' };
  try {
    const res = await fetch(`${GRAPH}/${wabaId}/message_templates`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { id?: string; status?: string; error?: { message?: string; code?: number } };
    if (!res.ok) {
      // Duplicate template name → already exists → fine for our sync purpose.
      if (json.error?.message?.toLowerCase().includes('already exists')) return { ok: true, status: 'exists' };
      return { ok: false, error: json.error?.message ?? `waba_${res.status}` };
    }
    return { ok: true, id: json.id, status: json.status };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
