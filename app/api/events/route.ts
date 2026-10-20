import type { NextRequest } from "next/server";
import { currentSpaceId, noSpace } from "@/lib/space";
import { hub } from "@/lib/realtime";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Streams end a little before maxDuration; EventSource reconnects on its own
// and the client refetches to fill any gap.
const STREAM_MS = 270_000;
const HEARTBEAT_MS = 20_000;

export async function GET(req: NextRequest) {
  const spaceId = await currentSpaceId();
  if (!spaceId) return noSpace();

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        cleanup();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      let unsubscribe = () => {};
      const heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);
      const timeout = setTimeout(close, STREAM_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        clearTimeout(timeout);
        unsubscribe();
      };
      req.signal.addEventListener("abort", close);

      try {
        unsubscribe = await hub.subscribe(spaceId, (payload) => {
          if (payload === '{"reset":true}') return close();
          send(`data: ${payload}\n\n`);
        });
        if (closed) return unsubscribe();
      } catch (e) {
        console.error("Realtime connect failed", e);
        send(`event: error\ndata: {}\n\n`);
        return close();
      }
      send(`retry: 1500\nevent: ready\ndata: {}\n\n`);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
