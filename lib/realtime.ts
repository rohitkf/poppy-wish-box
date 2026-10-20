import "server-only";
import { Client } from "pg";
import { connectionOptions, listenConnectionString } from "@/lib/db";

type Listener = (payload: string) => void;

/** Closes a connection we no longer use. A late 'error' from it must not crash the process. */
function discard(client: Client) {
  client.removeAllListeners();
  client.on("error", () => {});
  client.end().catch(() => {});
}

/**
 * One LISTEN connection per function instance, shared by every open SSE
 * stream on it (Fluid compute runs many requests per instance).
 */
class Hub {
  private client: Client | null = null;
  private connecting: Promise<void> | null = null;
  private subs = new Map<string, Set<Listener>>();
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    // On shutdown (Docker, Kubernetes, a redeploy) end the open streams, or the server
    // waits on them until it's killed. EventSource reconnects to the next instance.
    process.once("SIGTERM", () => this.endStreams());
  }

  private endStreams() {
    this.subs.forEach((set) => set.forEach((fn) => fn('{"reset":true}')));
  }

  async subscribe(spaceId: string, fn: Listener) {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    let set = this.subs.get(spaceId);
    if (!set) this.subs.set(spaceId, (set = new Set()));
    set.add(fn);
    const unsubscribe = () => {
      set!.delete(fn);
      if (!set!.size) this.subs.delete(spaceId);
      if (!this.subs.size) this.scheduleClose();
    };
    try {
      await this.connect();
    } catch (e) {
      unsubscribe();
      throw e;
    }
    return unsubscribe;
  }

  private async connect() {
    if (this.client) return;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const client = new Client({ ...connectionOptions, connectionString: listenConnectionString() });
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
        discard(client);
        // Tell streams to drop; EventSource reconnects and refetches.
        this.endStreams();
      };
      client.on("error", reset);
      client.on("end", reset);
      try {
        await client.connect();
        await client.query("LISTEN ours");
      } catch (e) {
        discard(client);
        throw e;
      }
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
      discard(c);
    }, 30_000);
  }
}

const g = globalThis as unknown as { oursHub?: Hub };
export const hub = (g.oursHub ??= new Hub());
