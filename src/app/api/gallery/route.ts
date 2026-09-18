import { z } from "zod";
import { jsonNoStore, jsonResponse } from "../_lib/http";
import { listAlbums } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  per: z.coerce.number().int().min(1).max(60).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return jsonNoStore({ error: "Invalid query parameters", issues: parsed.error.flatten().fieldErrors }, 400);
  }

  const result = await listAlbums(parsed.data);
  return jsonResponse(request, result);
}
