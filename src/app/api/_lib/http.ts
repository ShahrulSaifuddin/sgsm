/**
 * Shared response helpers for the route handlers under `src/app/api/*`.
 * Not a route itself (no `route.ts`/`page.tsx` export), so Next.js does not
 * treat this file or its `_lib` folder as routable.
 *
 * Every list/detail GET response goes through `jsonResponse`, which:
 *  - computes a strong ETag over the serialized payload,
 *  - returns 304 when the request's `If-None-Match` matches it,
 *  - gzips the body via `CompressionStream` when the client sent
 *    `Accept-Encoding: gzip`, and
 *  - sets the given `Cache-Control` (defaulting to the shared list-endpoint
 *    policy).
 */
import { createHash } from "node:crypto";

export const LIST_CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=86400";
export const NO_STORE_CACHE_CONTROL = "no-store";

function computeEtag(body: string): string {
  const hash = createHash("sha256").update(body).digest("base64url");
  return `"${hash}"`;
}

async function gzip(body: string): Promise<ArrayBuffer> {
  const stream = new Blob([body]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

export interface JsonResponseInit {
  status?: number;
  cacheControl?: string;
}

/**
 * Serializes `data`, attaches an ETag + Cache-Control, honors
 * `If-None-Match` with a 304, and gzips the body when the client accepts it.
 */
export async function jsonResponse(request: Request, data: unknown, init: JsonResponseInit = {}): Promise<Response> {
  const body = JSON.stringify(data);
  const etag = computeEtag(body);
  const cacheControl = init.cacheControl ?? LIST_CACHE_CONTROL;
  const status = init.status ?? 200;

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": cacheControl, Vary: "Accept-Encoding" },
    });
  }

  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheControl,
    ETag: etag,
    Vary: "Accept-Encoding",
  });

  const acceptEncoding = request.headers.get("accept-encoding") ?? "";
  if (acceptEncoding.toLowerCase().includes("gzip")) {
    const compressed = await gzip(body);
    headers.set("Content-Encoding", "gzip");
    return new Response(compressed, { status, headers });
  }

  return new Response(body, { status, headers });
}

/** For mutating/health endpoints that must never be cached or ETag'd. */
export function jsonNoStore(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": NO_STORE_CACHE_CONTROL,
    },
  });
}
