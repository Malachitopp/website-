# malachitopp.com — project context

Last updated: 2026-09-14

## What this is
Personal site on a domain the user already owns. Not a single-purpose portfolio —
intended as an "amalgamation" of whatever: art, random links, animations, Spotify
data, etc. Primary goal is practicing web design/dev for interviews, so preference
is for plain fundamentals over frameworks doing the work automatically.

## Stack decisions made so far
- **Frontend**: React via Vite (`react-ts` template), lives in `frontend/` with its
  own `package.json`/`tsconfig.json`/`src/`. Kept fully separate from the backend's
  TypeScript config (different environments — browser/DOM vs Node).
- **Backend**: Node + TypeScript + Express, in `src/backend/`. Compiled with `tsc`
  (root `tsconfig.json`, `rootDir: ./src`, `outDir: ./dist`).
- **Database**: Postgres. Local dev via Docker Compose (`docker-compose.yaml`) —
  chosen over a hosted DB for development because hosted free tiers (Supabase) have
  project limits and a live DB isn't needed until actual deployment. Hosted DB
  (Supabase or Neon) to be wired up only at deploy time.
- **DB access**: raw SQL via the `pg` package (`Pool` + `pool.query`), deliberately
  **no ORM** — schema is small/simple enough that an ORM would add ceremony without
  benefting. `db.ts` exports a `Pool` built from `DATABASE_URL`.
- **Migrations**: plain `.sql` files in `src/migrations/` (currently just an empty
  placeholder, `migrations_001.sql` — schema not written yet).
- **Module system**: `package.json` at root is `"type": "module"` (ESM), tsconfig
  uses `"module": "nodenext"` + `"verbatimModuleSyntax": true`. Reminder: relative
  imports between own files need explicit `.js` extensions even though source is
  `.ts` (nodenext resolution quirk).
- **Backend framework**: Express added (`src/backend/index.ts` has a minimal app
  with one `GET /` "Hello World" route, `app.listen(3000)`). No real routes built
  yet — Spotify relay route and any data routes are still just planned.

## Config bugs already hit and fixed (don't reintroduce)
- Root `package.json` had a duplicate `"scripts"` key (two separate blocks) —
  merged into one. Watch for this if scripts get edited again.
- Root `tsconfig.json` had a trailing comma (invalid JSON), `rootDir: "/src"`
  (leading slash made it absolute/drive-root instead of project-relative — caused
  TS to try pulling in `frontend/` files too), and `"types": []` (silently blocked
  `@types/node` globals like `process` even though the package was installed).
  Fixed: `rootDir: "./src"`, added `include: ["src/**/*"]` /
  `exclude: ["node_modules","dist","frontend"]`, removed the `types` override.
- `package.json`'s `"type"` was `"commonjs"` while tsconfig used `"module":
  "nodenext"` + `"verbatimModuleSyntax": true` — caused TS1295 on plain `import`
  syntax. Fixed by setting `"type": "module"`.
- `pg-pool` got added to `dependencies` unnecessarily — `pg` already exports
  `Pool` itself. Harmless if left, but not needed.
- `.env`/Compose `$` confusion: Docker Compose auto-expands `${VAR}` in
  `docker-compose.yaml` by reading `.env` in the same folder, but Node's `dotenv`
  does NOT expand `${VAR}` references written inside `.env` values. So
  `POSTGRES_USER`/`PASSWORD`/`DB` are referenced as `${...}` in the compose file,
  while `DATABASE_URL` in `.env` has to be spelled out as a literal full string.

## Schema philosophy (important, keep revisiting this)
- **No `users` table** — it's a single-user site. Auth for write actions (uploading
  art, etc.) should just be a secret checked against an env var, not a real
  auth/users system.
- **No `artists` table** — decided against persisting Spotify data as relational
  rows. Current plan is a **live fetch, no storage** approach (see below). If
  caching is ever wanted later, the fallback design discussed was a single loose
  `spotify_cache` table (id, kind, spotify_id, name, image_url, metadata jsonb,
  fetched_at) — NOT separate `artists`/`tracks`/join tables. Don't over-normalize
  this until there's an actual relational need.
- General bias: one flexible table over several premature normalized ones, until a
  real pattern forces a split.

## Spotify integration plan
- Goal: show currently-playing and/or top tracks/artists on the site.
- User has an existing registered Spotify app (client ID/secret) from a prior
  project — reusable, but will likely need a fresh one-time OAuth consent to get a
  refresh token scoped for `user-read-currently-playing` / `user-top-read` (old
  refresh token's scopes probably don't cover these).
- **Security constraint**: the frontend must NOT call Spotify's private endpoints
  directly — that would require exposing the client secret/access token in browser
  JS. Instead: frontend → own backend route (e.g. `GET /api/now-playing`) → backend
  exchanges stored refresh token for an access token → calls Spotify → returns just
  the display JSON to the frontend.
- Refresh token storage: plan is an env var (`.env`), not a DB row — it's a single
  static secret, no table needed for it.
- Current decision: fetch live on each request, no persistence/caching yet.

## Local dev environment
- `docker-compose.yaml`: single `db` service, `postgres:17` image, persisted via a
  named volume (`pgdata`), port `5432:5432`.
- Compose reads `.env` automatically (same directory) for `POSTGRES_USER` /
  `POSTGRES_PASSWORD` / `POSTGRES_DB`, referenced in the compose file as
  `${POSTGRES_USER}` etc.
- `.env` also separately holds a fully-written-out `DATABASE_URL` — Node's `dotenv`
  does NOT expand `${VAR}` references inside `.env` values (that's a Compose-only
  feature), so `DATABASE_URL` has to be spelled out literally rather than composed
  from the other vars.
- Local Postgres only needs to run while actively developing — it's irrelevant to
  the eventual live site, which will point at its own separately-hosted DB.

## Deployment plan (not started yet)
- Static-ish deploy target in mind: something like Vercel/Netlify — frontend built
  via Vite, backend as serverless functions (their `api/` convention).
- DNS: point malachitopp.com at whichever host is chosen once there's something
  worth deploying. No hosting cost expected beyond the domain itself (free tiers
  suffice at this scale).
- Hosted Postgres: Supabase (already used before, but free tier project slots are
  currently maxed out — either free one up or use Neon instead) vs Neon (no project
  cap, same "just a connection string" experience since raw SQL is used, not
  Supabase's client library).

## Current file structure (as of last update)
```
my website/
├── .env                  (POSTGRES_USER/PASSWORD/DB + DATABASE_URL, values unset in template)
├── docker-compose.yaml
├── package.json / package-lock.json / tsconfig.json     (backend)
├── src/
│   ├── backend/
│   │   ├── db.ts        (Pool from DATABASE_URL)
│   │   └── index.ts     (Express app, currently just a "Hello World" GET /)
│   └── migrations/
│       └── migrations_001.sql   (empty — schema not written yet)
├── frontend/             (Vite React app, own package.json/tsconfig)
├── context/              (this folder)
└── .claude/skills/update/SKILL.md   (the /update skill that maintains this file)
```

## Working style notes for this project
- User wants to write the code themselves — I should explain concepts, fix actual
  bugs when asked, and give example snippets, but default to NOT scaffolding
  whole files/features unprompted. (Early in the project I built a full static
  site unprompted; user asked to delete it and do it themselves.)
- User is fairly new to some of this (first time using Supabase/backends
  properly, dictates via voice-to-text so messages can be garbled — read typos
  charitably, e.g. "Yamu file" → "YAML file", "pool dot Paul" → "connection pool").
- Has prior experience with Postgres via Docker migrations specifically; Postgres
  is the only database they've used.
