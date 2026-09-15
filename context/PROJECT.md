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
  TypeScript config (different environments — browser/DOM vs Node). Dev server has
  a proxy config (`frontend/vite.config.ts`, `server.proxy['/api']` →
  `http://127.0.0.1:3000`) so the frontend's `fetch('/api/...')` calls don't hit
  CORS during dev (Vite runs on a different port than the backend). No CSS
  framework — plain CSS files (`index.css` global tokens, `App.css` components).
- **Backend**: Node + TypeScript + Express 5, in `src/backend/`. Compiled with `tsc`
  (root `tsconfig.json`, `rootDir: ./src`, `outDir: ./dist`) — so the real entry
  point after build is `dist/backend/index.js`, **not** `dist/index.js`.
- **Env vars**: loaded via Node's built-in `node --env-file=.env` flag in the
  `start` script (no `dotenv` dependency). Without this flag nothing populates
  `process.env`.
- **Database**: Postgres. Local dev via Docker Compose (`docker-compose.yaml`) —
  chosen over a hosted DB for development because hosted free tiers (Supabase) have
  project limits and a live DB isn't needed until actual deployment. Hosted DB
  (Supabase or Neon) to be wired up only at deploy time.
- **DB access**: raw SQL via the `pg` package (`Pool` + `pool.query`), deliberately
  **no ORM** — schema is small/simple enough that an ORM would add ceremony without
  benefiting. `db.ts` exports a `Pool` built from `DATABASE_URL`.
- **Migrations**: plain `.sql` files in `src/migrations/`. `migrations_001.sql`
  defines the `spotify_cache` table (see Schema section) — written but **not yet
  run against the actual local Postgres DB**.
- **Module system**: root `package.json` is `"type": "module"` (ESM), tsconfig
  uses `"module": "nodenext"` + `"verbatimModuleSyntax": true`. Relative imports
  between own files need explicit `.js` extensions even though source is `.ts`.
- **Backend wiring** (`src/backend/index.ts`):
  - `authRouter` (default export from `src/backend/auth/auth.ts`, routes `/login`
    and `/callback`) is mounted **only if `process.env.ENABLE_SPOTIFY_LOGIN ===
    'true'`**. Deliberately fail-closed: the flag lives only in the local `.env`
    and is never set on the host, so the live site 404s those routes. Chosen over
    `NODE_ENV !== 'production'` because forgetting to set a var should hide the
    routes, not expose them. The `authRouter` import stays unconditional because
    `get_accessToken` (same file) is needed by the Spotify routes.
  - `spotifyRouter` (named export from `src/backend/spotify/getCurrent.ts`) mounted
    at `/api`, giving `/api/now-playing` and `/api/top/:type`.
  - `src/backend/spotify/getTop.ts` is imported for its **side effect only**
    (`import './spotify/getTop.js'`) — it adds a route onto the shared
    `spotifyRouter` instance. Any new route-adding file like this must be imported
    somewhere or its `router.get(...)` never runs.
  - The old `GET /` "Hello World" placeholder route has been removed.

## Config bugs already hit and fixed (don't reintroduce)
- Root `package.json` had a duplicate `"scripts"` key — merged into one.
- Root `tsconfig.json` had a trailing comma, `rootDir: "/src"` (leading slash made
  it drive-root absolute, pulling in `frontend/`), and `"types": []` (silently
  blocked `@types/node` globals). Fixed: `rootDir: "./src"`,
  `include: ["src/**/*"]` / `exclude: ["node_modules","dist","frontend"]`, removed
  the `types` override.
- `package.json` `"type": "commonjs"` vs tsconfig `nodenext` +
  `verbatimModuleSyntax` caused TS1295 — fixed with `"type": "module"`.
- `pg-pool` got added to `dependencies` unnecessarily — `pg` already exports
  `Pool`. Still present; harmless, removable.
- `.env`/Compose `$` confusion: Compose expands `${VAR}` in `docker-compose.yaml`
  from `.env`, but Node's `--env-file` does NOT expand `${VAR}` inside `.env`
  values — so `DATABASE_URL` must be a literal full string.
- `start` script pointed at `dist/index.js`; real entry is `dist/backend/index.js`.
- Nothing loaded `.env` at all (vars silently `undefined`, hidden by `!`
  assertions) — fixed with `--env-file=.env`.
- Spotify's `/authorize` and `/api/token` require `https://` — a typo once caused
  a silent failure.
- `REDIRECT_URI` must use loopback IP `http://127.0.0.1:3000/callback`, not
  `localhost` (Spotify policy for non-HTTPS local dev).
- `.env` accumulated duplicate `SPOTIFY_REFRESH_TOKEN` lines after `/callback` was
  hit repeatedly ("last one wins" made the real token unusable). `/callback` now
  only writes when `data.refresh_token` exists. **As of this update `.env` again
  contains two `SPOTIFY_REFRESH_TOKEN` lines** — works because the last is valid,
  but should be cleaned to one.
- Missing `user-top-read` scope caused 403s on top-items. Scopes are locked into
  the refresh token at consent time — changing scope requires redoing `/login`.
- On Windows, stopping a background `npm run start` may leave the child `node`
  holding port 3000 (`EADDRINUSE`) — find/kill via `Get-NetTCPConnection
  -LocalPort 3000` → `Stop-Process`.
- **Frontend line-height gotcha**: `:root { font: 18px/145% ... }` computes
  line-height to an absolute 26.1px that every element inherits, so big text
  (e.g. 56px `h1`) overflows its line box and vertical alignment math goes wrong.
  Set an explicit unitless `line-height` on anything resized where alignment
  matters (done on `.card-name`: `line-height: 1.2`).
- Inline `<svg>` defaults to `overflow: hidden` — animations that move past the
  viewBox (bounce overshoot, floating Zs) need `overflow: visible`.
- An earlier absolutely-positioned Snoopy over the name popped up off the top of
  the page; fixed by making the name's Snoopy an in-flow block (it reserves its
  own space) — see Frontend section.

## Schema philosophy (important, keep revisiting this)
- **No `users` table** — single-user site. Auth for write actions (uploading art,
  etc.) should be a secret checked against an env var, not a real auth system.
  **Not built yet.**
- **`spotify_cache` table exists in the migration file but is NOT used.** Spotify
  features are live-fetch-only. Columns: `id uuid PK (gen_random_uuid())`,
  `kind text`, `spotify_id text`, `name text`, `image_url text`,
  `metadata jsonb`, `fetched_at timestamptz`, `UNIQUE (kind, spotify_id)`. `kind`
  distinguishes row type (`'artist'` vs `'track'`); `metadata jsonb` is a
  catch-all.
- General bias: one flexible table over several premature normalized ones, until a
  real pattern forces a split. Planned art-upload feature gets a **separate**
  table (own content vs cached third-party data), something like
  `id, url, caption, uploaded_at, metadata jsonb`.

## Spotify integration — DONE (live-fetch, no persistence)
- **OAuth bootstrap** (`auth.ts`, local-only via `ENABLE_SPOTIFY_LOGIN`):
  - `GET /login` generates a random `state` (`crypto.randomBytes`), stores it in a
    module-level `pendingStates` Set with a 10-minute `setTimeout` expiry (cleanup
    so abandoned logins don't grow memory, and stale links stop working), and
    redirects to Spotify `/authorize` with scope
    `user-read-currently-playing user-read-private user-top-read`.
  - `GET /callback` checks `typeof state === 'string'` and that it's in
    `pendingStates` (400 otherwise), deletes it (one-time use), requires
    `typeof code === 'string'` (400 + `return` otherwise — e.g. user hit Cancel),
    exchanges the code, guards a missing `refresh_token`, appends
    `SPOTIFY_REFRESH_TOKEN=...` to `.env`, and redirects to
    `http://localhost:5173`. The `as string` cast on `code` was removed on purpose
    so TypeScript narrowing catches a missing `return`.
  - The in-memory Set is server-wide (not per-browser) and wouldn't survive
    serverless; acceptable only because the routes are local-only. If they ever
    needed to run deployed, switch to an httpOnly cookie for `state` and gate
    behind a secret.
  - Writing to `.env` doesn't update `process.env` — restart after re-consenting.
  - No UI login button, by design. Re-run `/login` by hand only if the token is
    revoked or scopes change.
- `get_accessToken(refreshToken)` (exported from `auth.ts`): refresh-token grant,
  now **throws if `!response.ok`** (Express 5 turns that into a 500) instead of
  silently returning `undefined`. Called fresh per request; nothing cached.
- `GET /api/now-playing` (`getCurrent.ts`): handles 204 (nothing playing) →
  `{ is_playing: false }`, 400 on other non-OK, returns reshaped
  `is_playing, track, artist, albumArt, songUrl`. **Still missing**: a guard for
  `data.item === null` (ads, some podcasts, local files) — currently would throw.
- `GET /api/top/:type` (`getTop.ts`): validates `type === 'artists'` (400
  otherwise — `tracks` would need `item.album.images`) and `time_range` against
  `short_term | medium_term | long_term` (400 otherwise) **before** fetching a
  token; `limit=5`; returns `name, image, genres, spotifyUrl`.
  **Known limitation**: Spotify top-items ranks by an undocumented "affinity"
  algorithm, not minutes played — can disagree with stats.fm. Real "most minutes"
  needs the Extended Streaming History export aggregated manually.

## Frontend — design & components
- **Aesthetic**: "business card" (Patrick Bateman / American Psycho card) look.
  - Font: **Bodoni Moda** (Google Fonts `<link>` in `frontend/index.html`) used
    everywhere via `--sans` and `--heading` in `index.css` (`--mono` left as a
    monospace stack). Buttons need `font-family: var(--sans)` explicitly (UA
    styles don't inherit).
  - Background: bone white `--bg: #e3dac9`, **forced** — the
    `prefers-color-scheme: dark` block was removed and `color-scheme: light`.
  - Paper texture: inline SVG `feTurbulence` noise data-URI on `body`,
    `background-blend-mode: multiply`, ~35% opacity (5% was invisible).
  - Unused Vite template CSS removed from `App.css`; tab title "Malachi Topp".
- **Name** (`App.tsx` → `.card-name-wrapper` > `SnoopySleeping` + `p.card-name`):
  "MALACHI TOPP", uppercase, `letter-spacing: 0.2em`. Font size is set on the
  **wrapper** (40px, 28px at ≤1024px) so Snoopy's `em`-based width/offset scale
  with the text.
- **`SnoopySleeping.tsx`** (on the name, permanent, no hover): line-art Snoopy
  lying **on his back** on top of the letters — snout up, black ear flopped down,
  paw on chest, oval feet up. Three identical Z paths float up-right from the nose
  with staggered negative `animation-delay`s; body group "breathes" (`scaleY`
  from the bottom), all on a 3.6s cycle. In-flow `display: block` SVG with
  negative `margin-bottom` so he rests exactly on the cap tops. Under
  `prefers-reduced-motion`, animations stop and the Zs show as a static trail.
  Drawn from memory of the classic Peanuts pose (the user's Instagram reference
  was a multi-image post whose other images need a login).
- **`SnoopyLedge.tsx`** (on the now-playing album art, hover): side-profile Snoopy
  peeking over a ledge, traced from an eBay sticker image. On `.peek-wrapper:hover`
  the ledge line draws out, paws drop on, head rises from behind a `clipPath`
  (overshoot easing), eyes blink; hovering him keeps him up
  (`pointer-events` enabled only while hovered); reverses on leave. Positioned
  with `translate(-50%, 12.57%)` so the ledge line sits on the image's top edge;
  `width: 100%` of the album. Uses `useId()` for the clip id. Album wrapper has
  `margin-top: 20px` so his head clears the "Now playing" descenders.
- **History of Snoopy iterations** (so they aren't re-proposed): front-facing
  peeker (deleted) → ledge profile (now album-only) → curled-up sleeping on a
  cushion (replaced) → on-his-back sleeping (current, name).
- **`NowPlaying.tsx`**: polls `/api/now-playing` every 10s; checks `res.ok`. All
  states (Loading / "Not listening to anything right now" / playing) render inside
  one `.now-playing` div so they share styling. Track line is 24px `--text-h`;
  links (here and top-artist names) share one rule: no underline, underline on
  hover.
- **`TopArtists.tsx`**: buttons for `short_term` / `medium_term` only (`long_term`
  deliberately removed by the user). Renders a simple bordered `<table>`:
  rank | 80px image | name (28px, near-black). Fetch effect uses an `ignore` flag
  to drop stale responses when switching ranges, checks `res.ok`, keys rows by
  `spotifyUrl`; `setArtists(null)` happens in the click handler (ESLint
  `react-hooks/set-state-in-effect` flagged it inside the effect).
- Frontend `tsc -p tsconfig.app.json` and `eslint .` both pass clean; backend
  `tsc --noEmit` passes.

## Remaining work
- **Backend review leftovers** (user is fixing these themselves, walking through
  together):
  - `getCurrent.ts`: guard `data.item === null` → return `{ is_playing: false }`.
  - Optional: replace `/callback`'s `appendFileSync` with `console.log` of the
    token and paste it into `.env` by hand (kills the duplicate-lines bug class;
    matches how the token gets onto the host anyway).
  - Clean the duplicate `SPOTIFY_REFRESH_TOKEN` line in `.env`.
  - Minor: drop redundant `pg-pool`; backend `tsconfig` has `declaration`/`jsx`
    options a server doesn't need.
- **Art upload feature** (not started): write-auth check (secret vs env var), file
  storage (recommendation: **Cloudinary** free tier over raw S3; Supabase Storage
  also an option), and a DB table for metadata.
- `spotify_cache` migration never applied — fine while unused.
- Leftover Vite template assets are unused: `frontend/src/assets/hero.png`,
  `react.svg`, `vite.svg`, `frontend/public/icons.svg`, `frontend/README.md`
  (`public/favicon.svg` is still referenced by `index.html`).
- Ideas discussed, not started: **video background** (full-bleed
  `<video autoplay muted loop playsinline>` behind content, `object-fit: cover`,
  poster + `prefers-reduced-motion` fallback, keep file small / CDN-hosted) —
  waiting on the user to pick a video. Optional red cushion under the name's
  Snoopy was offered.

## Local dev environment
- `docker-compose.yaml`: single `db` service, `postgres:17`, named volume
  `pgdata`, port `5432:5432`, `restart: unless-stopped`.
- `.env` (gitignored) holds: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
  (read by Compose), `DATABASE_URL`, `CLIENT_ID`, `CLIENT_SECRET`,
  `REDIRECT_URI`, `SPOTIFY_REFRESH_TOKEN`, and `ENABLE_SPOTIFY_LOGIN=true`
  (local-only flag). Names only here — never copy values into this doc.
- Run: `npm run build && npm run start` from the repo root (backend,
  `http://127.0.0.1:3000`), and `npm run dev` inside `frontend/` (Vite,
  `http://localhost:5173` — open this one). Postgres (`docker compose up`) only
  needed once DB-backed features exist.
- UI verification used in sessions: headless Chrome
  (`C:/Program Files/Google/Chrome/Application/chrome.exe`) driven over the
  DevTools protocol from small Node scripts kept in the session scratchpad (not
  the repo) — hover elements, screenshot, measure positions, and intercept
  `/api/now-playing` with a mock response when nothing is playing.

## Deployment plan (not started yet)
- Target: something like Vercel/Netlify — frontend built via Vite, backend as
  serverless functions.
- Env vars on the host: `SPOTIFY_REFRESH_TOKEN`, `CLIENT_ID`, `CLIENT_SECRET`
  (plus DB URL once used). **Do not set `ENABLE_SPOTIFY_LOGIN`** — `/login` and
  `/callback` stay local-only. The refresh token is tied to the Spotify app, not
  the machine, so the locally-obtained token works on the host. Serverless can't
  write to the project's `.env`, which is another reason the callback flow stays
  local.
- The Vite `/api` proxy is dev-only; production needs the API on the same origin
  (host rewrites / functions) or CORS.
- DNS: point malachitopp.com at the host once there's something worth deploying.
- Hosted Postgres: Supabase (free project slots currently maxed) vs Neon (no
  project cap; same connection-string experience since raw SQL is used).

## Current file structure (as of last update)
```
website-/                        (repo root)
├── .env                         (gitignored; see Local dev for var names)
├── .gitignore
├── docker-compose.yaml
├── package.json / package-lock.json / tsconfig.json     (backend)
├── src/
│   ├── backend/
│   │   ├── db.ts                (Pool from DATABASE_URL)
│   │   ├── index.ts             (Express app; authRouter behind ENABLE_SPOTIFY_LOGIN, spotifyRouter at /api)
│   │   ├── auth/
│   │   │   └── auth.ts          (/login, /callback, get_accessToken)
│   │   └── spotify/
│   │       ├── getCurrent.ts    (spotifyRouter, GET /now-playing)
│   │       └── getTop.ts        (adds GET /top/:type to spotifyRouter)
│   └── migrations/
│       └── migrations_001.sql   (spotify_cache table, not yet applied)
├── frontend/                    (Vite React app, own package.json/tsconfigs/eslint.config.js)
│   ├── index.html               (Google Fonts link for Bodoni Moda, title)
│   ├── vite.config.ts           (dev proxy: /api → http://127.0.0.1:3000)
│   ├── public/                  (favicon.svg used; icons.svg unused)
│   └── src/
│       ├── main.tsx
│       ├── index.css            (global tokens: bone bg, fonts, paper texture)
│       ├── App.css              (name, table, now-playing, Snoopy styles/animations)
│       ├── App.tsx              (name + SnoopySleeping, NowPlaying, TopArtists)
│       ├── NowPlaying.tsx       (album art with SnoopyLedge hover)
│       ├── TopArtists.tsx       (time-range buttons + ranked table)
│       ├── SnoopySleeping.tsx   (on-his-back snoring Snoopy on the name)
│       ├── SnoopyLedge.tsx      (peek-over-ledge Snoopy on album hover)
│       └── assets/              (unused Vite template images)
├── context/                     (this folder)
└── .claude/skills/update/SKILL.md   (the /update skill that maintains this file)
```

## Working style notes for this project
- **Backend: the user writes it.** Explain concepts, point to exact lines, give
  small example snippets, and review their code when they say they've done it —
  don't edit backend files unprompted. (Early on a full static site was built
  unprompted; they asked to delete it and do it themselves.) This session they
  explicitly asked to "go through the backend together": a numbered review list,
  then one item at a time — concept → snippet → they implement → I check.
- **Be precise with wording on the backend.** Saying "remove the routes" when the
  plan was "don't mount them in production" confused them ("so we don't change
  the code?"). They also asked follow-ups like "what does the timer actually do"
  and "what sets the flag to false" — they want the *why* and the concrete attack
  or failure scenario, stated plainly. Be honest when a piece (e.g. the state
  expiry timer) is cleanup rather than security.
- **Frontend: write it for them.** They've said they're not really interested in
  writing frontend and want it done directly (they read through it). Iterative
  visual requests arrive in quick succession (fonts, colors, table layout, hover
  effects, character art).
- **Visual fidelity matters.** They pushed back when Snoopy didn't "actually look
  like Snoopy" and send reference images (Google Images / eBay / Instagram links).
  Download references and trace/compare side-by-side, render with headless Chrome,
  and check the result in the real page (including hover states and phone width)
  before reporting. Instagram multi-image posts only expose the first image without
  login — if the needed image isn't accessible, say so and offer that they save it
  locally.
- Dictates via voice-to-text, so messages can be garbled — read charitably
  ("dog hot" = doghouse, "snorting" = snoring, "Yamu file" = YAML file, "pool dot
  Paul" = connection pool); ask only when genuinely ambiguous.
- Fairly new to backends/Supabase; Postgres (via Docker migrations) is the only
  database they've used.
- Sessions started with `website-/` as the working directory pick up the
  project-scoped `/update` skill correctly (an earlier session rooted at the parent
  `my website/` folder didn't see it).
