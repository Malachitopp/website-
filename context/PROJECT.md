# malachitopp.com — project context

Last updated: 2026-09-15

## What this is
Personal site on a domain the user already owns. Not a single-purpose portfolio —
intended as an "amalgamation" of whatever: art, random links, animations, Spotify
data, etc. Primary goal is practicing web design/dev for interviews, so preference
is for plain fundamentals over frameworks doing the work automatically.

**The concept (decided 2026-09-15):** the home page is a full-bleed baby photo of
the user with a thought bubble popping off their head that says "click me!".
Clicking it dives into a black-and-white warehouse studio (the look of Frank
Ocean's *Endless* visual album). The studio is deliberately mostly empty for now —
the user will decide how to fill it — and the plan is for things in it to become
clickable and lead to different areas of their life (Spotify, art, etc.). The
name + Spotify content that used to be the whole site now lives on its own page.

## Stack decisions made so far
- **Frontend**: React via Vite (`react-ts` template), lives in `frontend/` with its
  own `package.json`/`tsconfig.json`/`src/`. Kept fully separate from the backend's
  TypeScript config (different environments — browser/DOM vs Node). Dev server has
  a proxy config (`frontend/vite.config.ts`, `server.proxy['/api']` →
  `http://127.0.0.1:3000`) so the frontend's `fetch('/api/...')` calls don't hit
  CORS during dev (Vite runs on a different port than the backend). No CSS
  framework — plain CSS files (`index.css` global tokens, one CSS file per page).
- **Client-side routing**: no react-router. `frontend/src/router.ts` is ~35 lines
  on the History API: `usePathname()` (via `useSyncExternalStore`, listening to
  `popstate` plus a custom `app:navigate` event because `pushState` fires nothing),
  `navigate(to)`, and `isModifiedClick(event)` so ctrl/middle-clicks still open
  new tabs. `App.tsx` is a `switch` on the pathname: `/studio` → `Studio`,
  `/spotify` → `SpotifyPage`, anything else → `Home`.
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
  run against the actual local Postgres DB**. `migrations_002.sql` exists but is
  **empty** (the user created it; nothing decided about what goes in it).
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
- **Studio image renderer** (`tools/studio-render/`, not part of the site build):
  the studio page's background is a *rendered photo*, not hand-drawn SVG. See the
  Frontend section for details.

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
  only writes when `data.refresh_token` exists. **`.env` still contains two
  `SPOTIFY_REFRESH_TOKEN` lines** (checked 2026-09-15) — works because the last is
  valid, but should be cleaned to one.
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
- **Vite dev + a missing asset import**: while `Studio.tsx` imported
  `studio-*.jpg` files that didn't exist yet, Vite's import analysis failed and
  the *whole app* (home page included) went blank. If the studio renders are ever
  regenerated, keep the old JPEGs in place until the new ones are written.
- **Chrome D3D11 can't compile the studio path-tracer shader** ("Error compiling
  dynamic pixel executable", `GL_INVALID_OPERATION` on every draw, output all
  black). The renderer launches Chrome with `--use-angle=vulkan`, which works on
  the Intel Iris Xe here; `swiftshader` also works but is ~20× slower.

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
  **throws if `!response.ok`** (Express 5 turns that into a 500) instead of
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

## Frontend — pages & components

### Global (`index.css`, `index.html`)
- Font: **Bodoni Moda** (Google Fonts `<link>` in `frontend/index.html`) via
  `--sans` and `--heading` (`--mono` is a monospace stack). Buttons need
  `font-family: var(--sans)` explicitly (UA styles don't inherit). Tab title
  "Malachi Topp".
- Background: bone white `--bg: #e3dac9`, **forced light** (`color-scheme: light`,
  no dark-mode block). Paper texture: inline SVG `feTurbulence` noise data-URI on
  `body`, `background-blend-mode: multiply`, ~35% opacity (5% was invisible).
- The bordered 1126px "business card" column is now `.card-page` (used only by
  the Spotify page) instead of being on `#root`, because Home and Studio are
  full-bleed `position: fixed` pages.
- `::view-transition-old/new(root)` duration set to 0.45s — page swaps that go
  through `document.startViewTransition` cross-fade a bit slower than default.

### `/` — `Home.tsx` + `Home.css` (baby photo + thought bubble)
- `<img class="home-photo">` with `object-fit: cover`, `srcSet` of
  `assets/baby-me-1200.jpg` / `baby-me-2000.jpg` (made from the user's
  `IMG_2492.HEIC` — the originals live *outside* the repo in
  `../png files to ignore/`; conversion was done with .NET's HEIF decoder via
  PowerShell + Pillow). Alt text "Me as a baby, grinning in a red car seat".
- **Bubble anchoring math**: `.thought` computes where a fractional photo point
  (`--head-x: 0.655`, `--head-y: 0.3`) lands on screen under `object-fit: cover`
  using container-query units (`.home` has `container-type: size`):
  `--cover-w: max(100cqw, 100cqh * ratio)`, `--cover-h: max(100cqh, 100cqw /
  ratio)`, then `--anchor-x/y`. Cloud size `clamp(190px, 24cqw, 340px)`, placed
  up-right of the head and clamped to stay 16px inside the viewport. Under
  `@container (orientation: portrait)` the cloud is bigger (`48cqw`, up to 360px),
  the head point shifts (`0.6, 0.29`) and the cloud sits *above* the head.
- Three `.thought-dot`s are positioned along the line from the head to the cloud
  centre (`--t` = 0 / 0.18 / 0.38, sizes 14 / 22 / 34px). Dots pop in at 0.6s /
  0.8s / 1s, the cloud pops at 1.2s (`thought-pop` keyframes, overshoot easing),
  then the cloud bobs (`thought-bob`, 4s). Everything waits for the photo's
  `onLoad` (class `photo-ready`; `.thought` is `display: none` before that so the
  pop animations don't run on an empty dark screen). `prefers-reduced-motion`
  disables the animations.
- **`ThoughtCloud.tsx`**: an SVG (viewBox `-10 -10 320 230`) made of overlapping
  circles + an ellipse ("puffs") drawn twice — grown 7 units in ink for the
  outline, grown 3 in cream `#fffdf7` for the fill — with `<text>` "click me!"
  (italic Bodoni, 46 units) in the middle. It used to hold a clipped mini
  drawing of the room; the user asked for it to just say "click me!".
- **Click → studio transition** (`enterStudio` in `Home.tsx`): the cloud is an
  `<a href="/studio">`. On a plain click it sets a `Zoom` state that CSS turns
  into `translate(--zoom-x, --zoom-y) scale(--zoom-scale)` over 0.8s
  (`cubic-bezier(0.6, 0, 0.35, 1)`), moving the cloud to screen centre and
  scaling it until its solid middle (≈ 0.5 × width, 0.44 × height of the drawing)
  covers the viewport; the text fades, dots hide, the photo scales 1.08 and
  darkens/blurs. After `ZOOM_MS` (800, must match the CSS) it calls
  `navigate('/studio')` inside `document.startViewTransition` when available so
  the cream cross-fades into the studio photo. Reduced motion → straight
  `navigate`. Modified clicks fall through to the browser.

### `/studio` — `Studio.tsx` + `Studio.css` (the warehouse)
- `<picture>`: `<source media="(orientation: portrait)" srcset={studioPortrait}>`
  + `<img class="studio-photo" src={studioLandscape}>`, `position: fixed; inset:
  0; object-fit: cover`. Tall phones get a separately framed portrait render
  rather than a crop of the wide one. A "← back" pill button (top-left, uses
  `navigate('/')`).
- **Nothing in it is clickable yet, on purpose.** The user wants it mostly blank
  and will decide what goes in it. Future hotspots (Spotify, art, …) go here.
- **History (don't re-propose):** the first version was a hand-drawn colour SVG
  cartoon of the user's actual bedroom (from their photo `IMG_2886.jpeg`: green
  bed, wall of paintings, desk with monitor/laptop/white PC, mesh chair). The user
  then asked for an *Endless*-style studio warehouse instead, first tried as a
  flat black-and-white SVG, then — because they wanted it "realistic, more depth,
  look larger" — replaced with a path-traced render. The SVG scenes are deleted.

### `tools/studio-render/` — how the studio images are made
- `index.html` is a self-contained **WebGL2 path tracer** (one big fragment
  shader, progressive accumulation into ping-pong RGBA32F textures, one sample per
  pixel per frame). `render.mjs` drives it in headless Chrome over the DevTools
  protocol and writes JPEGs. Run from the repo root:
  - `node tools/studio-render/render.mjs` → `frontend/src/assets/studio-landscape.jpg`
    (2400×1500, vertical FOV 58°, 1024 spp) and `studio-portrait.jpg` (1170×2340,
    FOV 80°, 1024 spp). Roughly 10 minutes total on the Iris Xe.
  - `--preview` → small/fast `preview-*.jpg` next to the script (gitignored);
    `--stats` prints GL error / exposure diagnostics; env `CHROME` overrides the
    browser path, `ANGLE` the backend (default `vulkan`; see config bugs).
- **The scene** (metres, camera at eye level 1.6m looking down the hall): 16m wide,
  55m long, 6.4m high box. 16 rows × 4 columns of fluorescent tubes hanging 0.8m
  below a near-black ceiling with deep cross beams; bare stud framing (studs every
  1.22m, plates + two rows of blocking) on the right wall; a stained white wall
  with three painted-over doorways and conduit pipes on the left; a glowing
  roller door at the far end; sealed-concrete floor with slab joints, stains and a
  narrow glossy reflection (Phong lobe, `GLOSS_N = 300`). Only the tubes and the
  door emit light.
- **Rendering notes**: next-event estimation picks one tube per bounce, weighted
  by proximity/facing for diffuse surfaces and by a Gaussian around the mirror
  direction for the floor's glossy lobe (`glossyLight`) — this replaced a naive
  jittered-reflection bounce that produced fireflies. 4 bounces. Draws are split
  into bands with `gl.finish()` so no single GPU command trips the Windows
  watchdog.
- **Post (in JS)**: average samples → auto-exposure so the median pixel sits at
  0.34 → 3×3 firefly clamp → bloom (two box-blur radii on highlights) → ACES-style
  tone curve → extra contrast (0.45) → gamma → vignette → grain → greyscale JPEG
  q0.84. Tweak the look here, not in the shader, when possible.
- References the user gave: the Ithacan's *Endless* review still
  (`theithacan.org/.../endless.jpg`, front-on with big factory windows) and a
  vinyl-sleeve photo (long hall, tubes receding, stud wall on the right — the
  render is closest to this one). Both sites 403 plain fetches; `curl` with a
  browser User-Agent worked.

### `/spotify` — `SpotifyPage.tsx` (the old home page, unchanged look)
- `.card-page` wrapper > `.card-name-wrapper` (72px, `clamp(28px, 9vw, 44px)` at
  ≤1024px) > `p.card-name` "MALACHI TOPP" (uppercase, `letter-spacing: 0.2em`,
  `line-height: 1.2`), then `#center` with `h1` "Now playing" + `NowPlaying`, `h1`
  "My Top Artists" + `TopArtists`, then the `.ticks` rule and `#spacer`.
- **Nothing links to `/spotify` yet** — reachable only by typing the URL. Meant to
  become one of the studio hotspots.
- **`SnoopySleeping.tsx` no longer exists** — the user removed the sleeping
  Snoopy from the name before this session (the name is plain text now).
  `SnoopyLedge.tsx` (side-profile Snoopy peeking over the album art on hover,
  traced from an eBay sticker; ledge line draws out, paws drop, head rises from a
  `clipPath`, eyes blink; `useId()` for the clip id; `translate(-50%, 12.57%)` so
  the ledge sits on the image's top edge) is still used by `NowPlaying.tsx`.
- **`NowPlaying.tsx`**: polls `/api/now-playing` every 10s; checks `res.ok`. All
  states (Loading / "Not listening to anything right now" / playing) render inside
  one `.now-playing` div. Track line 24px `--text-h`; links (here and top-artist
  names) share one rule: no underline, underline on hover.
- **`TopArtists.tsx`**: buttons for `short_term` / `medium_term` only (`long_term`
  deliberately removed by the user). Bordered `<table>`: rank | 80px image | name
  (28px). Fetch effect uses an `ignore` flag to drop stale responses, checks
  `res.ok`, keys rows by `spotifyUrl`; `setArtists(null)` happens in the click
  handler (ESLint `react-hooks/set-state-in-effect` flagged it inside the effect).
- Frontend `tsc -p tsconfig.app.json`, `eslint .` and `vite build` all pass;
  backend `tsc --noEmit` passes.

## Remaining work
- **Studio hotspots** (the actual point of the studio): decide what objects go in
  the warehouse and where they link (Spotify page, art, etc.). The user wants to
  choose the contents; don't populate it unprompted. When objects are added they
  will need to be composited over the render (positioned with the same
  fractional-coordinate trick the bubble uses) or rendered into the scene.
- **Check the final renders** once `render.mjs` has been run at full quality
  (2026-09-15: a full render was in progress at the end of the session — the
  files in `assets/` may still be the 64-spp previews copied in as placeholders;
  rerun `node tools/studio-render/render.mjs` if they look noisy).
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
- `spotify_cache` migration never applied — fine while unused. `migrations_002.sql`
  is empty.
- Leftover Vite template assets are unused: `frontend/src/assets/hero.png`,
  `react.svg`, `vite.svg`, `frontend/public/icons.svg`, `frontend/README.md`
  (`public/favicon.svg` is still referenced by `index.html`).
- Ideas discussed earlier, not started: **video background** (full-bleed
  `<video autoplay muted loop playsinline>`, `object-fit: cover`, poster +
  reduced-motion fallback). Superseded in spirit by the photo home page but not
  ruled out for other pages.

## Local dev environment
- `docker-compose.yaml`: single `db` service, `postgres:17`, named volume
  `pgdata`, port `5432:5432`, `restart: unless-stopped`.
- `.env` (gitignored) holds: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
  (read by Compose), `DATABASE_URL`, `CLIENT_ID`, `CLIENT_SECRET`,
  `REDIRECT_URI`, `SPOTIFY_REFRESH_TOKEN` (twice, see bugs), and
  `ENABLE_SPOTIFY_LOGIN=true` (local-only flag). Names only here — never copy
  values into this doc.
- Run: `npm run build && npm run start` from the repo root (backend,
  `http://127.0.0.1:3000`), and `npm run dev` inside `frontend/` (Vite,
  `http://localhost:5173` — open this one). Postgres (`docker compose up`) only
  needed once DB-backed features exist.
- `.gitignore` ignores `*.png` (so reference photos can sit in the repo folder
  without being committed) and `tools/studio-render/preview-*.jpg`. The JPEGs in
  `frontend/src/assets/` are **meant** to be committed — the site needs them.
- UI verification used in sessions: headless Chrome
  (`C:/Program Files/Google/Chrome/Application/chrome.exe`) driven over the
  DevTools protocol from small Node scripts kept in the session scratchpad (not
  the repo): `Emulation.setDeviceMetricsOverride` with `mobile: true` for real
  phone layouts, `Emulation.setEmulatedMedia` for `prefers-reduced-motion`,
  `Input.dispatchMouseEvent` to click, and — to inspect a CSS transition
  frame-by-frame — stub `window.setTimeout`, then
  `document.getAnimations().forEach(a => { a.pause(); a.currentTime = T })` before
  each screenshot (`Page.captureScreenshot` is far too slow to catch frames live).
  First screenshot after a CSS edit can catch Vite mid-recompile — take a warm-up
  shot.

## Deployment plan (not started yet)
- Target: something like Vercel/Netlify — frontend built via Vite, backend as
  serverless functions.
- **SPA fallback required**: `/studio` and `/spotify` are client-side routes, so
  the host must serve `index.html` for them (rewrite rule). Vite's dev server
  already does.
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
├── .gitignore                   (*.png, tools/studio-render/preview-*.jpg, …)
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
│       ├── migrations_001.sql   (spotify_cache table, not yet applied)
│       └── migrations_002.sql   (empty)
├── tools/
│   └── studio-render/
│       ├── index.html           (WebGL2 path tracer + film post-processing)
│       ├── render.mjs           (headless-Chrome driver; writes the studio JPEGs)
│       └── preview-*.jpg        (gitignored quick renders)
├── frontend/                    (Vite React app, own package.json/tsconfigs/eslint.config.js)
│   ├── index.html               (Google Fonts link for Bodoni Moda, title)
│   ├── vite.config.ts           (dev proxy: /api → http://127.0.0.1:3000)
│   ├── public/                  (favicon.svg used; icons.svg unused)
│   └── src/
│       ├── main.tsx
│       ├── index.css            (global tokens, .card-page column, view-transition timing)
│       ├── router.ts            (usePathname / navigate / isModifiedClick)
│       ├── App.tsx              (pathname switch → Home / Studio / SpotifyPage)
│       ├── App.css              (Spotify page: name, table, now-playing, SnoopyLedge styles)
│       ├── Home.tsx / Home.css  (baby photo, thought bubble, zoom-in transition)
│       ├── ThoughtCloud.tsx     ("click me!" cloud SVG)
│       ├── Studio.tsx / Studio.css   (rendered warehouse photo + back button)
│       ├── SpotifyPage.tsx      (name + NowPlaying + TopArtists)
│       ├── NowPlaying.tsx       (album art with SnoopyLedge hover)
│       ├── TopArtists.tsx       (time-range buttons + ranked table)
│       ├── SnoopyLedge.tsx      (peek-over-ledge Snoopy on album hover)
│       └── assets/
│           ├── baby-me-1200.jpg / baby-me-2000.jpg   (home photo)
│           ├── studio-landscape.jpg / studio-portrait.jpg   (from tools/studio-render)
│           └── hero.png, react.svg, vite.svg         (unused template leftovers)
├── context/                     (this folder)
└── .claude/skills/update/SKILL.md   (the /update skill that maintains this file)
```
Reference photos (the baby HEIC, the bedroom JPEG) live one level up in
`../png files to ignore/`, outside the repo.

## Working style notes for this project
- **Backend: the user writes it.** Explain concepts, point to exact lines, give
  small example snippets, and review their code when they say they've done it —
  don't edit backend files unprompted. (Early on a full static site was built
  unprompted; they asked to delete it and do it themselves.) They asked to "go
  through the backend together": a numbered review list, then one item at a time
  — concept → snippet → they implement → I check.
- **Be precise with wording on the backend.** Saying "remove the routes" when the
  plan was "don't mount them in production" confused them ("so we don't change
  the code?"). They ask follow-ups like "what does the timer actually do" and
  "what sets the flag to false" — they want the *why* and the concrete attack or
  failure scenario, stated plainly. Be honest when a piece (e.g. the state expiry
  timer) is cleanup rather than security.
- **Frontend: write it for them.** They've said they're not really interested in
  writing frontend and want it done directly (they read through it). Requests
  arrive in quick succession, often *mid-turn* while work is in progress ("you
  can move the spotify stuff…", "change the bubble to just say click me!", "make
  the warehouse realistic") — fold them in rather than finishing the old plan.
- **They think in scenes and vibes, with reference images.** They describe a
  vision (photo background → thought bubble → their room → areas of their life),
  send photos of their own (the HEIC/JPEG in the ignored folder) and links to
  reference stills (Instagram, eBay, a news article, a Google Images result URL —
  extract the real `imgurl=` from those). Download references and compare
  side-by-side, render the result with headless Chrome, and check desktop, phone
  and transition frames before reporting. "Realistic / more depth / larger" meant
  a photographic render, not a nicer drawing.
- **They'll say "leave it blank, I'll decide how to fill it"** — when they do,
  build the empty stage well and don't invent contents.
- **Visual fidelity matters.** They pushed back when Snoopy didn't "actually look
  like Snoopy". Same standard applies to the studio: it should read as the
  *Endless* warehouse, not a generic room.
- Dictates via voice-to-text, so messages can be garbled — read charitably
  ("dog hot" = doghouse, "snorting" = snoring, "Yamu file" = YAML file, "pool dot
  Paul" = connection pool, "open field" = the bubble *opens up* into the scene);
  ask only when genuinely ambiguous.
- Fairly new to backends/Supabase; Postgres (via Docker migrations) is the only
  database they've used.
- Sessions started with `website-/` as the working directory pick up the
  project-scoped `/update` skill correctly (an earlier session rooted at the parent
  `my website/` folder didn't see it).
