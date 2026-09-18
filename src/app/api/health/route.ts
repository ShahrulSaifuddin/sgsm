import { jsonNoStore } from "../_lib/http";
import { getHealth } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** For the load balancer: 200 when the DB answers, 503 otherwise. Never cached. */
export async function GET(): Promise<Response> {
  const health = await getHealth();
  return jsonNoStore(health, health.ok ? 200 : 503);
}
