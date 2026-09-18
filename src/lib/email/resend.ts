/**
 * Minimal REST client for Resend's transactional email API. Deliberately a
 * plain `fetch` call, not the `resend` SDK -- CLAUDE.md forbids adding new
 * runtime dependencies, and this is the only endpoint the app needs.
 *
 * Never logs the API key. Callers get back either `{ ok: true }` or
 * `{ ok: false, status, body }` so they can decide how to surface a provider
 * failure without this module reaching into request/response handling.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailParams {
  apiKey: string;
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export type SendEmailResult = { ok: true } | { ok: false; status: number; body: string };

/**
 * POSTs to Resend's `/emails` endpoint. Network failures (DNS, timeout, etc.)
 * are surfaced as a synthetic `status: 0` result rather than thrown, so every
 * caller can handle "email did not go out" with one code path.
 */
export async function sendEmailViaResend(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });

    if (response.ok) {
      return { ok: true };
    }

    const body = await response.text().catch(() => "");
    return { ok: false, status: response.status, body };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, body: message };
  }
}
