# Ours — a shared list for two

A private, live-synced list for a couple: places to go, things to buy, date ideas.
Either of you adds an idea in seconds and the other sees it instantly.

Runs entirely on **Vercel**: Next.js on Vercel Functions, **Neon Postgres** from the
Vercel Marketplace (provisioned and billed inside Vercel), and a **private Vercel Blob**
store for photos. No other services.

| Phone | Desktop |
|---|---|
| ![Lists](docs/screenshots/03-lists.png) | ![Desktop](docs/screenshots/06-desktop.png) |

## How it works

| Piece | Implementation |
|---|---|
| Access | A numeric code (`APP_PIN`) → `/api/unlock`, 5 wrong tries then a 15‑minute pause per IP → signed httpOnly cookie (60 days). A deployment holds one shared space |
| Data | Postgres (`db/schema.sql`). The browser never talks to the database: every route checks the cookie, validates input and scopes queries to the space |
| Live sync | Postgres triggers `pg_notify` on every change → `/api/events` (Server‑Sent Events, one shared `LISTEN` per function instance) → each device merges the row into its cache and highlights changes made by the other person |
| Conflicts | Only changed fields are sent; custom fields merge per key in `jsonb`, so edits to different fields never overwrite each other |
| Presence | 30 s heartbeat to `/api/presence`, broadcast the same way → "Jolsna is here" |
| Photos | Compressed on the phone (≤1600 px JPEG), uploaded to a **private** Blob store, served only through `/api/photos/[id]` after the cookie check |
| Offline | Last data cached on the device (readable offline); edits made offline queue in order and replay on reconnect; service worker caches the app shell and photos |
| UI | Tailwind CSS v4, Radix primitives (shadcn‑style), Framer Motion, TanStack Query. Light and dark themes (follows the system, with a manual override) |

## Deploy on Vercel (about 10 minutes)

1. **Import the repo** in Vercel → *Add New… → Project*.
2. **Add Postgres:** Project → *Storage* → *Create Database* → **Neon** (the free plan is fine).
   Connect it to the project. This adds `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. **Add Blob:** Project → *Storage* → *Create* → **Blob**, access **Private**. This adds `BLOB_READ_WRITE_TOKEN`.
4. **Set the unlock code:** Project → *Settings → Environment Variables* → `APP_PIN` = a 4–12 digit
   code, for Production and Preview. Changing it later signs every device out.
5. **Deploy** (or redeploy). Each production build applies the schema and, the first time, creates
   your space with three starter lists, so there's nothing to run by hand. Open the app on both
   phones, enter the code, pick your names, then *Share → Add to Home Screen*.

## Local development

```bash
npm install
cp .env.example .env.local   # point DATABASE_URL at any Postgres 14+, set APP_PIN
npm run setup                # schema + space (production builds do this themselves)
npm run dev
```

Photos need `BLOB_READ_WRITE_TOKEN`. Everything else works with a plain local Postgres.

Checks: `npm run typecheck`, `npm run lint`, `npm run build`.

## Project map

```
app/
  page.tsx                 the whole app (one document, views in ?list=&item=&view=)
  unlock/                  code screen
  api/unlock|lock          session cookie
  api/data                 full snapshot for the space
  api/mutate               all writes (validated, space-scoped)
  api/events               live changes (SSE)
  api/presence             who's here
  api/photos               upload (private Blob) / stream
components/app/            screens: Home, ListView, ItemDetail, Sidebar, Settings…
lib/session.ts             APP_PIN check + signed unlock cookie
lib/space.ts               the deployment's one space
lib/server-data.ts         validation + SQL for every mutation
lib/realtime.ts            shared LISTEN connection → subscribers
lib/client/store.ts        cache, optimistic updates, offline outbox, live merge
db/schema.sql              tables, triggers (idempotent)
scripts/setup.mjs          schema + space (run by production builds)
```

## Decisions on the PRD's open questions

| Question | Choice (easy to change) |
|---|---|
| Name | "Ours", as in the design |
| Currency | Per item, defaulting to a shared currency (GBP) set in Settings |
| Added by | Name picked once per device, from the names already used in the space |
| Deleting | Permanent, with a 5‑second Undo |
| Photo limits | 12 per item, compressed to ≤1600 px, 4 MB max after compression |
| Theme | Both, following the system, with a manual override |
| Hidden gift items, push notifications, reminders | Not built (P1/P2) |

## Limits

- Live sync streams restart every ~4.5 minutes (Vercel function duration). The client
  reconnects and refetches, so nothing is missed.
- Uploading photos needs a connection. Other edits queue offline.
- The code is the only key, and a short one: the lockout slows guessing but can't stop someone
  who keeps trying from many networks. Keep the app's address between the two of you.
  *Settings → Lock this device* signs one device out; changing `APP_PIN` signs out all of them.
