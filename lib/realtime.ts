import "server-only";
import { Client } from "pg";
import { listenConnectionString } from "@/lib/db";

type Listener = (payload: string) => void;

/**
 * One LISTEN connection per function instance, shared by every open SSE
 * stream on it (Fluid compute runs many requests per instance).
 */
class Hub {
  private client: Client | null = null;
  private connecting: Promise<void> | null = null;
  private subs = new Map<string, Set<Listener>>();
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  async subscribe(spaceId: string, fn: Listener) {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    let set = this.subs.get(spaceId);
    if (!set) this.subs.set(spaceId, (set = new Set()));
    set.add(fn);
    await this.connect();
    return () => {
      set!.delete(fn);
      if (!set!.size) this.subs.delete(spaceId);
      if (!this.subs.size) this.scheduleClose();
    };
  }

  private async connect() {
    if (this.client) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const client = new Client({ connectionString: listenConnectionString() });
      client.on("notification", (msg) => {
        if (!msg.payload) return;
        let space: string | undefined;
        try {
          space = JSON.parse(msg.payload).space;
        } catch {
          return;
        }
        const set = space ? this.subs.get(space) : undefined;
        set?.forEach((fn) => fn(msg.payload!));
      });
      const reset = () => {
        if (this.client === client) this.client = null;
        client.removeAllListeners();
        client.end().catch(() => {});
        // Tell streams to drop; EventSource reconnects and refetches.
        this.subs.forEach((set) => set.forEach((fn) => fn('{"reset":true}')));
      };
      client.on("error", reset);
      client.on("end", reset);
      await client.connect();
      await client.query("LISTEN ours");
      this.client = client;
    })().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private scheduleClose() {
    this.closeTimer = setTimeout(() => {
      if (this.subs.size || !this.client) return;
      const c = this.client;
      this.client = null;
      c.removeAllListeners();
      c.end().catch(() => {});
    }, 30_000);
  }
}

const g = globalThis as unknown as { oursHub?: Hub };
export const hub = (g.oursHub ??= new Hub());
