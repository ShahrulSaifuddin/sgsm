import { z } from "zod";
import { jsonNoStore, jsonResponse } from "../_lib/http";
import { listEvents } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per: z.coerce.number().int().min(1).max(60).optional(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
  category: z.string().trim().min(1).max(100).optional(),
  when: z.enum(["upcoming", "past", "all"]).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return jsonNoStore({ error: "Invalid query parameters", issues: parsed.error.flatten().fieldErrors }, 400);
  }

  const result = await listEvents(parsed.data);
  return jsonResponse(request, result);
}
