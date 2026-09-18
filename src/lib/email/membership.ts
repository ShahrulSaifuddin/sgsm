/**
 * Turns a validated membership application into an email to the Society and
 * sends it via Resend's HTTP API (`./resend.ts`). This replaces the old
 * `createMembershipApplication` SQLite write -- Vercel's filesystem is
 * read-only and ephemeral, so a DB write in `data/sgsm.db` would never
 * persist in production.
 *
 * Configuration is entirely via environment variables (see `.env.example`):
 *   - RESEND_API_KEY       Resend API key. Never logged.
 *   - MEMBERSHIP_TO_EMAIL  Recipient. Defaults to the Society's published
 *                          email in content/site.json (`golf@sgsm.com.my`).
 *   - MEMBERSHIP_FROM_EMAIL Verified Resend sender address.
 *
 * Failure handling (this is the site's entire commercial purpose -- an
 * application must never silently vanish):
 *   - Missing config in development: log the full application to the server
 *     console and report `kind: "dev-logged"` so local testing still works
 *     without real credentials.
 *   - Missing config in production: report `kind: "unconfigured"`. The route
 *     handler turns this into a 503 with fallback guidance.
 *   - Resend returns a non-2xx: report `kind: "provider-error"`, after
 *     logging the provider's status/body (never the API key) server-side.
 *     The route handler turns this into a 502 with the same fallback
 *     guidance.
 *
 * There is no best-effort "thank you" acknowledgement email to the
 * applicant here -- it was deliberately left out to keep this path small and
 * to avoid a second point of failure. If one is added later, its failure
 * must not affect the result of `sendMembershipApplicationEmail`.
 */
import { getSiteConfig } from "@/lib/content";
import { sendEmailViaResend } from "./resend";

export interface MembershipApplicationInput {
  fullName: string;
  email: string;
  phone: string;
  dob?: string;
  icOrPassport?: string;
  address?: string;
  club?: string;
  handicap?: string;
  referrer?: string;
  message?: string;
}

type FieldKey = keyof MembershipApplicationInput;

const FIELD_ORDER: FieldKey[] = [
  "fullName",
  "email",
  "phone",
  "dob",
  "icOrPassport",
  "address",
  "club",
  "handicap",
  "referrer",
  "message",
];

const FIELD_LABELS: Record<FieldKey, string> = {
  fullName: "Full name",
  email: "Email address",
  phone: "Phone number",
  dob: "Date of birth",
  icOrPassport: "IC or passport number",
  address: "Home address",
  club: "Home golf club",
  handicap: "Golf handicap",
  referrer: "Referred by",
  message: "Additional message",
};

/** Escapes user-supplied text before it is interpolated into the HTML email body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function buildMembershipEmail(input: MembershipApplicationInput): RenderedEmail {
  const subject = `New SGSM membership application — ${input.fullName}`;

  const rows = FIELD_ORDER.filter((key) => input[key]).map((key) => ({
    label: FIELD_LABELS[key],
    value: input[key] as string,
  }));

  const htmlRows = rows
    .map(
      (row) =>
        `<tr><td style="padding:6px 12px 6px 0;font-weight:600;color:#1f2d20;white-space:nowrap;vertical-align:top;">${escapeHtml(
          row.label
        )}</td><td style="padding:6px 0;color:#1f2d20;white-space:pre-wrap;">${escapeHtml(row.value)}</td></tr>`
    )
    .join("\n");

  const html = `<!doctype html>
<html>
  <body style="font-family:Georgia,'Times New Roman',serif;background:#faf7f0;padding:24px;margin:0;">
    <table role="presentation" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px;border:1px solid #e5decf;">
      <tr>
        <td>
          <h1 style="font-size:20px;color:#1f2d20;margin:0 0 16px;">New membership application</h1>
          <p style="color:#3f4a3f;margin:0 0 16px;">A new online application was submitted via the SGSM website.</p>
          <table role="presentation" style="border-collapse:collapse;width:100%;">
            ${htmlRows}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "New SGSM membership application",
    "",
    ...rows.map((row) => `${row.label}: ${row.value}`),
  ].join("\n");

  return { subject, html, text };
}

export type SendMembershipEmailResult =
  | { kind: "sent" }
  | { kind: "dev-logged" }
  | { kind: "unconfigured" }
  | { kind: "provider-error"; status: number };

function defaultToEmail(): string {
  try {
    return getSiteConfig().email;
  } catch {
    return "golf@sgsm.com.my";
  }
}

export async function sendMembershipApplicationEmail(
  input: MembershipApplicationInput
): Promise<SendMembershipEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.MEMBERSHIP_FROM_EMAIL;
  const toEmail = process.env.MEMBERSHIP_TO_EMAIL?.trim() || defaultToEmail();

  const { subject, html, text } = buildMembershipEmail(input);

  if (!apiKey || !fromEmail) {
    if (process.env.NODE_ENV !== "production") {
      console.log(
        "[membership] RESEND_API_KEY and/or MEMBERSHIP_FROM_EMAIL are not set -- " +
          "email was NOT sent. Logging the application so local testing still works:\n" +
          `${text}`
      );
      return { kind: "dev-logged" };
    }
    console.error(
      "[membership] RESEND_API_KEY and/or MEMBERSHIP_FROM_EMAIL are not configured in production; " +
        "an application could not be emailed."
    );
    return { kind: "unconfigured" };
  }

  const result = await sendEmailViaResend({
    apiKey,
    from: fromEmail,
    to: toEmail,
    replyTo: input.email,
    subject,
    html,
    text,
  });

  if (!result.ok) {
    console.error(
      `[membership] Resend API rejected the application email: status=${result.status} body=${result.body}`
    );
    return { kind: "provider-error", status: result.status };
  }

  return { kind: "sent" };
}
