import { z } from "zod";
import { jsonNoStore } from "../_lib/http";
import { checkRateLimit, getClientIp } from "../_lib/rate-limit";
import { sendMembershipApplicationEmail } from "@/lib/email/membership";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  fullName: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(6).max(30),
  dob: z.string().trim().max(20).optional(),
  icOrPassport: z.string().trim().max(50).optional(),
  address: z.string().trim().max(500).optional(),
  club: z.string().trim().max(200).optional(),
  handicap: z.string().trim().max(20).optional(),
  referrer: z.string().trim().max(200).optional(),
  message: z.string().trim().max(2000).optional(),
});

/**
 * Shown to the applicant whenever the email genuinely could not be delivered
 * (missing production config, or the provider rejected the send) so they are
 * never left believing an application went in when it didn't -- this is the
 * site's entire commercial purpose.
 */
const FALLBACK_MESSAGE =
  "We couldn't send your application right now. Please email your details to golf@sgsm.com.my, " +
  "or download the membership form at /files/new-application-membership-2024.pdf and send it to the Society office.";

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`membership:${ip}`, { max: 5, windowMs: 10 * 60 * 1000 });

  if (!rateLimit.allowed) {
    return jsonNoStore(
      {
        error: "Too many applications from this address. Please try again later.",
        retryAfterMs: rateLimit.retryAfterMs,
      },
      429
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonNoStore({ error: "Request body must be valid JSON." }, 400);
  }

  const parsed = BodySchema.safeParse(payload);
  if (!parsed.success) {
    return jsonNoStore({ error: "Invalid membership application", issues: parsed.error.flatten().fieldErrors }, 400);
  }

  const result = await sendMembershipApplicationEmail(parsed.data);

  switch (result.kind) {
    case "sent":
      return jsonNoStore({ status: "sent", sentAt: new Date().toISOString() }, 201);

    case "dev-logged":
      // Development-only path: no RESEND_API_KEY/MEMBERSHIP_FROM_EMAIL is
      // configured locally. The application was logged to the server
      // console instead of being emailed -- this response is success-shaped
      // (so local testing of the form's happy path still works) but is
      // explicitly marked as not actually sent.
      return jsonNoStore(
        {
          status: "dev-logged",
          sentAt: new Date().toISOString(),
          note: "Email is not configured in this environment. The application was logged to the server console instead of being sent.",
        },
        201
      );

    case "unconfigured":
      return jsonNoStore({ error: FALLBACK_MESSAGE }, 503);

    case "provider-error":
      return jsonNoStore({ error: FALLBACK_MESSAGE }, 502);
  }
}
