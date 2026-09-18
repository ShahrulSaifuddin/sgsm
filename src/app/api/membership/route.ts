import { z } from "zod";
import { jsonNoStore } from "../_lib/http";
import { checkRateLimit, getClientIp } from "../_lib/rate-limit";
import { createMembershipApplication } from "@/lib/db/queries";

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

  const result = createMembershipApplication(parsed.data);
  return jsonNoStore({ id: result.id, createdAt: result.createdAt }, 201);
}
