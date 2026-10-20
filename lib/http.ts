import "server-only";
import { ipAddress } from "@vercel/functions";
import { HttpError } from "@/lib/server-data";

/** A body with no declared size that ran past the limit while it streamed. */
class CutOff extends HttpError {}

/**
 * Reads a request body of at most `maxBytes` without buffering anything larger
 * (Vercel caps bodies at its edge; a container has no such limit).
 */
async function readBody(req: Request, maxBytes: number): Promise<Buffer> {
  if (Number(req.headers.get("content-length")) > maxBytes) throw new HttpError(413, "That's too much data");
  if (!req.body) throw new HttpError(400, "Bad request");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      reader.cancel().catch(() => {});
      throw new CutOff(413, "That's too much data");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** A JSON body of at most `maxBytes`. Requiring a JSON content type also stops cross-site form posts. */
export async function readJson(req: Request, maxBytes: number): Promise<unknown> {
  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "Send JSON");
  }
  const body = await readBody(req, maxBytes);
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new HttpError(400, "Bad request");
  }
}

/** A multipart form body of at most `maxBytes`. */
export async function readForm(req: Request, maxBytes: number): Promise<FormData> {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("multipart/form-data")) throw new HttpError(415, "Send a form");
  const body = await readBody(req, maxBytes);
  try {
    return await new Response(new Uint8Array(body), { headers: { "content-type": type } }).formData();
  } catch {
    throw new HttpError(400, "Bad request");
  }
}

/**
 * Headers for an error reply. A body cut off part-way is never read to the end, so the
 * connection must close, or the client's next request would land in the leftovers.
 * (A body refused for its declared size is discarded by Node, keeping the connection.)
 */
export const errorHeaders = (e: HttpError): HeadersInit | undefined =>
  e instanceof CutOff ? { Connection: "close" } : undefined;

/**
 * The caller's IP, for per-IP limits. On Vercel the platform supplies it. Elsewhere only a
 * header your own reverse proxy overwrites can be trusted; name it in TRUSTED_IP_HEADER
 * (e.g. "x-real-ip" with nginx `proxy_set_header X-Real-IP $remote_addr;`). Without one,
 * every caller shares one bucket: stricter, but impossible to dodge by forging headers.
 */
export function clientIp(req: Request) {
  if (process.env.VERCEL) return ipAddress(req) ?? "unknown";
  const header = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  // The last entry is the one your proxy added; earlier ones came from the client.
  const value = header ? req.headers.get(header)?.split(",").pop()?.trim() : "";
  return value || "untrusted";
}
