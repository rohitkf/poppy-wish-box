// Black-box tests against a running build, with Node's built-in test runner:
//   APP_PIN=135790 TRUSTED_IP_HEADER=x-real-ip npm start   (needs DATABASE_URL; run `npm run setup` first)
//   BASE_URL=http://localhost:3000 APP_PIN=135790 npm test
// CI runs them against `next start` and against the Docker image, each on a fresh database.
// The last test pauses unlocking for everyone for 15 minutes, so a rerun needs a fresh
// database (or `delete from unlock_attempts`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PIN = process.env.APP_PIN;
if (!PIN) throw new Error("Set APP_PIN to the code the server under test uses");
const WRONG = PIN === "000000" ? "111111" : "000000";

// Every test unlocks from its own client IP, so lockouts never leak between tests.
let ips = 0;
const freshIp = () => `10.200.${Math.floor(ips / 250)}.${(ips++ % 250) + 1}`;

const request = (path, { method = "GET", body, cookie, ip } = {}) =>
  fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: {
      ...(body !== undefined && { "content-type": "application/json" }),
      ...(cookie && { cookie }),
      ...(ip && { "x-real-ip": ip }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const tryCode = (code, ip) => request("/api/unlock", { method: "POST", body: { code }, ip });

async function unlock() {
  const res = await tryCode(PIN, freshIp());
  assert.equal(res.status, 200);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("ours_session="));
  assert.ok(cookie, "sets the session cookie");
  return cookie.split(";")[0];
}

const mutate = async (cookie, m) => {
  const res = await request("/api/mutate", { method: "POST", body: m, cookie });
  assert.equal(res.status, 200, `${m.op} → ${res.status}`);
  return (await res.json()).row;
};

test("liveness and readiness checks answer without signing in", async () => {
  const live = await request("/api/health");
  assert.equal(live.status, 200);
  assert.equal(typeof (await live.json()).uptime, "number");
  const ready = await request("/api/health/ready");
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).ok, true);
});

test("pages send security headers", async () => {
  const res = await request("/unlock");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
});

test("everything is locked without the cookie", async () => {
  const home = await request("/");
  assert.equal(home.status, 307);
  assert.equal(new URL(home.headers.get("location"), BASE).pathname, "/unlock");
  assert.equal((await request("/unlock")).status, 200);
  assert.equal((await request("/api/data")).status, 401);
  assert.equal((await request("/api/events")).status, 401);
  assert.equal((await request("/api/mutate", { method: "POST", body: { op: "space.update", patch: {} } })).status, 401);
  assert.equal((await request("/api/presence", { method: "POST", body: { deviceId: "d" } })).status, 401);
  assert.equal((await request(`/api/photos/${randomUUID()}`)).status, 401);
});

test("the unlock form only accepts digits and reports tries left", async () => {
  const ip = freshIp();
  const letters = await tryCode("abc", ip);
  assert.equal(letters.status, 400);
  const wrong = await tryCode(WRONG, ip);
  assert.equal(wrong.status, 401);
  const body = await wrong.json();
  assert.match(body.error, /4 tries left/);
  assert.equal(body.length, PIN.length);
});

test("the right code sets a long-lived, httpOnly cookie", async () => {
  const res = await tryCode(PIN, freshIp());
  assert.equal(res.status, 200);
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("ours_session="));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Lax/i);
  assert.match(cookie, /Max-Age=5184000/);
});

test("an unlocked device can read and change the space", async () => {
  const cookie = await unlock();
  assert.equal((await request("/", { cookie })).status, 200);
  assert.equal((await request("/unlock", { cookie })).status, 307);

  const data = await (await request("/api/data", { cookie })).json();
  assert.ok(data.space.id);
  assert.ok(Array.isArray(data.lists) && data.lists.length > 0, "starter lists exist");

  const listId = randomUUID();
  const itemId = randomUUID();
  await mutate(cookie, { op: "list.create", list: { id: listId, name: "CI list", emoji: "icon:star", color: "sky", position: 99 } });
  const item = await mutate(cookie, { op: "item.create", item: { id: itemId, list_id: listId, title: "CI item" }, actor: "CI" });
  assert.equal(item.title, "CI item");
  const updated = await mutate(cookie, { op: "item.update", id: itemId, patch: { status: "done", custom: { mood: "cosy" } }, actor: "CI" });
  assert.equal(updated.status, "done");
  assert.ok(updated.done_at);
  assert.deepEqual(updated.custom, { mood: "cosy" });

  const after = await (await request("/api/data", { cookie })).json();
  assert.ok(after.items.some((i) => i.id === itemId));
  await mutate(cookie, { op: "list.delete", id: listId });
  const gone = await (await request("/api/data", { cookie })).json();
  assert.ok(!gone.items.some((i) => i.id === itemId), "deleting a list deletes its items");
});

test("oversized, non-JSON and oversized-photo requests are refused before they're read", async () => {
  const cookie = await unlock();
  const big = await request("/api/mutate", { method: "POST", cookie, body: { op: "space.update", patch: { name: "x".repeat(300_000) } } });
  assert.equal(big.status, 413);
  const plain = await fetch(`${BASE}/api/mutate`, { method: "POST", headers: { cookie, "content-type": "text/plain" }, body: "{}" });
  assert.equal(plain.status, 415);
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(5 * 1024 * 1024)], { type: "image/jpeg" }), "big.jpg");
  const photo = await fetch(`${BASE}/api/photos`, { method: "POST", headers: { cookie }, body: form });
  assert.equal(photo.status, 413);

  // The same without a Content-Length (a chunked upload) is cut off while it streams, and the
  // connection is closed (the client may see that before the 413). The next request still works.
  const multipart = new Response(form);
  const chunked = await fetch(`${BASE}/api/photos`, {
    method: "POST",
    headers: { cookie, "content-type": multipart.headers.get("content-type") },
    body: multipart.body,
    duplex: "half",
  }).then(
    (r) => r.status,
    () => "closed",
  );
  assert.ok(chunked === 413 || chunked === "closed", `chunked upload → ${chunked}`);
  assert.equal((await request("/api/health")).status, 200);

  // A small chunked upload is still read: it gets as far as checking the item.
  const small = new FormData();
  small.set("file", new Blob([new Uint8Array(1000)], { type: "image/jpeg" }), "small.jpg");
  small.set("id", randomUUID());
  small.set("itemId", randomUUID());
  const smallBody = new Response(small);
  const missing = await fetch(`${BASE}/api/photos`, {
    method: "POST",
    headers: { cookie, "content-type": smallBody.headers.get("content-type") },
    body: smallBody.body,
    duplex: "half",
  });
  assert.equal(missing.status, 404);
});

test("a tampered cookie is refused and locking clears the cookie", async () => {
  const cookie = await unlock();
  assert.equal((await request("/api/data", { cookie: `${cookie}x` })).status, 401);
  const res = await request("/api/lock", { method: "POST", cookie });
  const cleared = res.headers.getSetCookie().find((c) => c.startsWith("ours_session="));
  assert.match(cleared, /Max-Age=0/);
});

test("five wrong tries pause entry, even for the right code", async () => {
  const ip = freshIp();
  for (let i = 1; i <= 4; i++) assert.equal((await tryCode(WRONG, ip)).status, 401);
  assert.equal((await tryCode(WRONG, ip)).status, 429);
  assert.equal((await tryCode(PIN, ip)).status, 429);
});

test("a burst of parallel guesses can't get past five tries", async () => {
  const ip = freshIp();
  const statuses = await Promise.all(
    Array.from({ length: 40 }, (_, i) => tryCode(i === 25 ? PIN : WRONG, ip).then((r) => r.status)),
  );
  const compared = statuses.filter((s) => s === 401 || s === 200).length;
  assert.ok(compared <= 5, `${compared} codes were compared`);
  assert.ok(statuses.filter((s) => s === 429).length >= 35);
});

test("live sync reports the build and streams changes", async () => {
  const cookie = await unlock();
  const lists = (await (await request("/api/data", { cookie })).json()).lists;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${BASE}/api/events`, { headers: { cookie }, signal: controller.signal });
    assert.equal(res.status, 200);
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let text = "";
    const until = async (pattern) => {
      while (!pattern.test(text)) {
        const { value, done } = await reader.read();
        if (done) throw new Error("stream ended early");
        text += value;
      }
    };
    await until(/event: ready\ndata: (.*)\n/);
    const ready = JSON.parse(text.match(/event: ready\ndata: (.*)\n/)[1]);
    assert.equal(typeof ready.build, "string");

    const itemId = randomUUID();
    await mutate(cookie, { op: "item.create", item: { id: itemId, list_id: lists[0].id, title: "Live item" }, actor: "CI" });
    await until(new RegExp(itemId));
    await mutate(cookie, { op: "item.delete", id: itemId });
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
});

// Keep this last: it pauses unlocking for everyone.
test("many wrong codes from many networks pause entry for everyone, not for unlocked devices", async () => {
  const cookie = await unlock();
  let paused = null;
  for (let i = 0; i < 60 && !paused; i++) {
    const res = await tryCode(WRONG, freshIp());
    if (res.status === 429) paused = await res.json();
  }
  assert.ok(paused, "a pause for everyone kicked in");
  assert.match(paused.error, /paused/);
  assert.equal((await tryCode(PIN, freshIp())).status, 429, "even the right code waits");
  assert.equal((await request("/api/data", { cookie })).status, 200, "unlocked devices keep working");
});
