# malachitopp.com — project context

Last updated: 2026-09-17

**How these notes are split** (trimmed 2026-09-16 to save tokens; the pre-trim 169 KB version is in git
history as `context/PROJECT.md` at `57a7b8b`, if an old detail is ever needed):
- **This file**: what the project is, stack, backend, schema, general gotchas, local dev, remaining
  work, file map, working style. Read it to get caught up.
- **`context/studio.md`**: the studio page's overlays, the scene's contents and the path-traced
  renderer (commands, costs, cameras, renderer gotchas). Read only when the task touches the studio.
- **`context/deployment.md`**: Vercel, Neon, DNS, env vars on the host, live checks. Read only for
  deploy/hosting/domain work.
- `CLAUDE.md` (repo root) tells sessions to use the graphify graph for code navigation.

## What this is
Personal site, **live since 2026-09-16 at https://www.malachitopp.com** (Vercel + Neon; every push
to `main` deploys). An "amalgamation" of whatever — art, links, animations, Spotify data. The
user's goal is practising web dev for interviews, so plain fundamentals over frameworks.

**The concept:** the home page is a full-bleed baby photo of the user with a thought bubble saying
"click me!". Clicking dives into a black-and-white warehouse studio (the look of Frank Ocean's
*Endless*), filled object by object. The point of the studio, in the user's words: press an item and
"have the user almost walk towards it and focus in on it in a larger size that allows you to
interact with it properly" — "sort of like a video game but less complex". The studio is
pre-rendered path-traced photos and camera-walk videos with live HTML overlaid.

Items so far (details in `context/studio.md`):
1. **Music corner** (`/studio/music`): record player on a crate, a blackboard showing top artists as
   prints, a now-playing hologram and album cover, lit warm by a Carby Musk candle.
2. **Work station** (`/studio/laptop`): a crate of books with an open laptop whose screen wakes to a
   home screen of shortcuts (GitHub, Email; the user names the rest), a second candle, physics papers.
3. **Art corner** (`/studio/easel`): an easel whose canvas opens into the **gallery** wall
   (`/studio/easel/gallery`, the user's uploads — "gallery", not "paintings").

Scenery: the tagline blackboard ("A theoretical / physics student"), the name hanging letter by
letter from the tubes, the user's dog asleep on a sofa (breathing in the loops, not clickable), oak
crates and coloured paint (colour against the grey hall is deliberate), a 6 m **Miles Morales spider
rug** on the floor, and an **armour row** by the left wall: three glass cases with Iron Man Mark VII,
Miles Morales and Batman, framed by climbing roses cascading from the ceiling (scenery; "maybe zoom in
later"). A dismissible "explore by pressing on things" note shows on arrival; on phones the overview
is a wide picture you **swipe to look around** (the note says so). The old name +
Spotify page lives at `/spotify` (nothing links to it yet).

## Stack
- **Frontend**: React 19 via Vite 8 (`react-ts`), TypeScript ~6.0, in `frontend/` with its own
  `package.json`/tsconfigs/`eslint.config.js`. Plain CSS (`index.css` global tokens, one CSS file per
  page), no CSS framework. Dev proxy `server.proxy['/api']` → `http://127.0.0.1:3000`.
- **Routing**: no react-router. `frontend/src/router.ts` (~35 lines on the History API):
  `usePathname()` (`useSyncExternalStore` on `popstate` + a custom `app:navigate` event),
  `navigate(to)`, `isModifiedClick(event)`. `App.tsx` switches on the pathname: the five `/studio…`
  paths → `Studio` (one element, so it keeps state and walks between shots), `/spotify` →
  `SpotifyPage`, else `Home`.
- **Backend**: Node + TypeScript **7.0** + Express 5 in `src/backend/`, compiled by `tsc` (root
  `tsconfig.json`, `rootDir ./src`, `outDir ./dist`) — entry is `dist/backend/index.js`. ESM
  (`"type": "module"`, `nodenext`, `verbatimModuleSyntax`), so relative imports need `.js`
  extensions. `app.ts` builds and exports the app; `index.ts` only listens on 3000 (Vercel runs the
  app through `api/index.js`).
- **Env**: `node --env-file=.env` in the `start` script (no dotenv).
- **Database**: Postgres. Local: Docker Compose (Postgres 17, host port 5433). Production: Neon
  (London, Postgres 18). Separate databases. Access via `pg` (`Pool` in `db.ts`), **no ORM**.
- **Migrations**: plain `.sql` in `src/migrations/` (`001` spotify_cache, `002` art), both applied
  locally and on Neon 2026-09-16, **by hand** — no runner or tracking table, so a new migration must be
  run on both databases, and re-running one errors on `CREATE TABLE`.
- **Hosting**: Vercel (frontend + backend function in `lhr1`), Neon, DNS on Cloudflare
  (`context/deployment.md`).
- **Studio renderer**: `tools/studio-render/` (WebGL2 path tracer in headless Chrome + ffmpeg-static),
  not part of the site build (`context/studio.md`).

## Backend
**Wiring (`src/backend/app.ts`)**
- `authRouter` (`auth/auth.ts`: `/login`, `/callback`) is mounted **only if
  `ENABLE_SPOTIFY_LOGIN === 'true'`** — fail-closed; the flag is only in the local `.env`, so the live
  site 404s those routes. The import stays unconditional because `get_accessToken` lives there.
- `app.use(express.json())`: Express 5 parses no body without it, and only `application/json` ones.
- `spotifyRouter` (from `spotify/getCurrent.ts`) at `/api` → `/api/now-playing`, `/api/top/:type`.
  `spotify/getTop.ts` is imported **for its side effect** (adds a route to the shared router) — a new
  route-adding file must be imported somewhere or it never runs.
- `artRouter` (`art/art.ts`) at **`/api/art`**, deliberately not behind a flag.

**Spotify (live-fetch, nothing stored)**
- `/login` → random `state` in a module-level `pendingStates` Set (10-min expiry), scopes
  `user-read-currently-playing user-read-private user-top-read`. `/callback` validates state (one-time)
  and `code`, exchanges it, appends `SPOTIFY_REFRESH_TOKEN=…` to `.env` only if a refresh token came
  back. Restart after re-consenting (writing `.env` doesn't update `process.env`). Scopes are locked
  into the refresh token; changing them means redoing `/login`. No login button, by design.
- `get_accessToken()` caches the access token until 60 s before expiry; concurrent callers share one
  in-flight refresh; throws if the refresh isn't ok.
- `GET /api/now-playing`: 204 → `{ is_playing: false }`; returns `is_playing, track, artist, albumArt,
  songUrl`. No guard for `data.item === null` (ads/podcast episodes → 500); the user is fine leaving
  it. Local files work.
- `GET /api/top/:type`: only `artists`; `time_range` ∈ `short_term|medium_term|long_term`, validated
  before fetching a token; `limit=5`; returns `name, image, genres, spotifyUrl`. Spotify ranks by
  "affinity", not minutes played.

**Art (`art/art.ts`) — live, no real upload tested yet.** The server never calls Cloudinary; it signs,
the browser uploads.
- `GET /api/art` (public): newest first, `{ art: [...] }` with **camelCase** keys.
- `GET /api/art/signature` (secret): `{ timestamp, signature, cloudName, apiKey, folder }`.
- `POST /api/art` (secret): `{ publicId, url, width, height, title?, year?, medium?, metadata? }`,
  `ON CONFLICT (public_id) DO UPDATE`, 201. **The camelCase contract is the frontend's** — a drift
  shows as a 400 "missing fields" on a request that visibly has them.
- `requireSecret`: `x-art-secret` header vs `ART_SECRET` (500 if unset, 401 if absent), length check
  then `timingSafeEqual` (which throws on unequal lengths).
- `art/config.ts`: `cloudinary.config()` once at import, each var through `required()` which throws
  naming it — **a missing Cloudinary var 500s every /api route**.
- `auth/cloudinary_auth.ts` `signuploadform()` signs `{ timestamp, folder: 'art' }`. **Sign exactly the
  params the browser sends** (excluding file, api_key, signature, resource_type, cloud_name). Sizes
  come from URL transforms (`sized()`), not eager ones. **Don't cache the signature** — it's a local
  SHA-1, and Cloudinary rejects timestamps ~1 h old.
- Open: the first real upload will show whether `public_id` comes back folder-prefixed (`art/abc`) or
  bare (dynamic folders — likely, since assets carry `asset_folder`). Cloudinary creates the `art`
  folder on first upload; its `samples` demo content is unused and deletable.
- Only whoever knows `ART_SECRET` can add; changing it means `.env` **and** Vercel, then redeploy.

## Schema
- **No `users` table** — single-user; writes are gated by a shared secret (`requireSecret`).
- **`spotify_cache`** (exists, **unused**): `id uuid PK`, `kind text`, `spotify_id text`, `name`,
  `image_url`, `metadata jsonb`, `fetched_at timestamptz`, `UNIQUE (kind, spotify_id)`.
- **`art`**: `id uuid PK`, `public_id text NOT NULL UNIQUE` (makes re-posts idempotent), `url NOT
  NULL`, `title`, `year int`, `medium`, `width/height int NOT NULL` (the wall needs the aspect ratio
  before the image loads), `metadata jsonb DEFAULT '{}'`, `created_at timestamptz DEFAULT now()`.
- Bias: one flexible table over premature normalisation; `art` is separate from `spotify_cache`
  (own content vs cached third-party data).

## Frontend
- **Global** (`index.css`, `index.html`): Bodoni Moda (Google Fonts) via `--sans`/`--heading`
  (buttons need `font-family: var(--sans)`); bone-white `--bg: #e3dac9`, forced light; SVG noise paper
  texture on `body`; `.card-page` = the bordered column (Spotify page only); view transitions 0.45 s.
- **`/` Home** (`Home.tsx`/`.css`, `ThoughtCloud.tsx`): `baby-me-1200/2000.jpg` under `object-fit:
  cover`; the bubble is anchored to a photo point with container-query maths (`--head-x/y`, different
  in portrait); dots and cloud pop in after the photo loads, then bob; clicking zooms the cloud to fill
  the screen (`ZOOM_MS` 800 must match the CSS) then `navigate('/studio')` inside
  `document.startViewTransition`. Reduced motion → no animations.
- **`/studio…`** (`Studio.tsx`/`.css`, `MusicCorner.tsx`, `Workstation.tsx`, `Easel.tsx`, `art.ts`,
  `studioScene.ts`): see `context/studio.md`.
- **`/spotify`** (`SpotifyPage.tsx`, `NowPlaying.tsx` with `SnoopyLedge.tsx` peeking over the album
  art on hover, `TopArtists.tsx` with short/medium term only — `long_term` removed by the user).
  `spotify.ts` has `useNowPlaying()` (polls 10 s) and `useTopArtists(range)` → `{ artists, latest }`,
  shared with the studio.
- Checks: `npx tsc -b`, `npx eslint src/`, `npm run build` in `frontend/`; backend `tsc --noEmit`.

## Gotchas (general — studio/renderer ones are in `context/studio.md`)
- **CommonJS pasted into ESM** (`require(...)`, `exports.x`) throws at import, but **`tsc --noEmit`
  passes** (`@types/node` declares them) and `tsc` still emits — only running the built file catches
  it. Cloudinary's docs are CommonJS; translate as you paste.
- Node's `--env-file` doesn't expand `${VAR}`; `DATABASE_URL` must be literal. It does trim keys, so
  `KEY =value` loads — grep with `'^KEY *='`.
- Spotify needs `https://` endpoints and a loopback `REDIRECT_URI` `http://127.0.0.1:3000/callback`.
- Missing `user-top-read` → 403 on top items.
- On Windows a stopped `npm start` can leave `node` holding port 3000: `Get-NetTCPConnection
  -LocalPort 3000` → `Stop-Process`.
- `:root { font: 18px/145% … }` gives every element an absolute 26.1 px line-height; resized text
  needs a unitless `line-height`.
- Inline `<svg>` is `overflow: hidden` by default — drifting animations need `overflow: visible`.
- **A missing asset import blanks the whole Vite dev app** (home page too). Keep files at imported
  paths while regenerating them.
- Swapping a file under the running Vite server with a shell redirect can serve a half-written module;
  write to a temp file and `mv`.
- **Git Bash rewrites args starting with `/`** into Windows paths: set `MSYS_NO_PATHCONV=1` (then use
  `C:/…` paths). Affects `vercel api /v9/…`, `curl -w "…/api/…"`, `shoot.mjs /studio/music`.
- Windows PowerShell 5.1 strips double quotes from JSON args to native programs — pass JSON from Bash
  or a file. Claude Code's PowerShell check blocks `Remove-Item -Force a, b, c`; use `rm -f`.
- **Never put Markdown with backticks in a double-quoted shell string** — Bash runs each fragment
  (it happened to this file). Use Write/Edit.
- **Line endings**: working tree is CRLF (`core.autocrlf=true`). `sed -i` and the Write tool write LF;
  Edit keeps CRLF. Git normalises either way; convert with Node if consistency matters.
- **Don't run `prettier`** — no config, and its defaults are the opposite of the code style.
- **`.env` has secrets in comment lines** (Neon URLs, Vercel recovery codes). Print key names only:
  `sed -nE 's/^[[:space:]]*(#?)[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=.*/\1\2/p' .env`.
- `vercel link` appends `.env*` to `.gitignore`, cancelling `!.env.example` — keep `.vercel`, drop that.
- `pg-pool` in dependencies is redundant (`pg` exports `Pool`); harmless.

## Local dev
- **Postgres is on host port 5433.** A native Windows Postgres owns 5432 and silently took connections
  (showed as `password authentication failed` with correct credentials) — if that returns, check
  `netstat -ano | grep :5432`. `POSTGRES_PASSWORD` only applies when the `pgdata` volume is first
  created; later changes need `ALTER USER` or a new volume.
- `docker-compose.yaml`: `db`, `postgres:17`, volume `pgdata`, `5433:5432`, container `mywebsite-db-1`.
- `.env` (gitignored; names only here): `POSTGRES_USER/PASSWORD/DB`, `DATABASE_URL` (local Docker),
  `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`, `SPOTIFY_REFRESH_TOKEN` (**twice** — last wins, should
  be one), `ENABLE_SPOTIFY_LOGIN=true`, `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`, `ART_SECRET`, and
  comment lines with Neon's URLs and the user's Vercel recovery codes. `.env.local` (from `vercel link`)
  holds only `VERCEL_OIDC_TOKEN`, unused.
- **Run**: `docker compose up -d`; `npm run build && npm start` at the root (backend on
  `127.0.0.1:3000`; **rebuild after every backend change**); `npm run dev` in `frontend/` (open
  `http://localhost:5173/studio`).
- **On the user's phone**: `npm run dev -- --host` in `frontend/`, then `http://<PC LAN IP>:5173/studio`
  on the same Wi-Fi (the desktop was `192.168.0.100`). Firewall rules for Node already allow it.
- Machines: a laptop (Intel Iris Xe — stills only) and the desktop (RX 6950 XT, Node 24, npm 11,
  Docker Desktop, Vercel CLI and `gh` logged in as `Malachitopp`, no `psql` — run SQL via a `pg`
  script).
- `.gitignore`: `.env`, `.env.*` (not `.env.example`), `*.png`, `/pictures/` (dog photos),
  `dist/`, `tools/studio-render/preview-*`, `.vercel`, `/Website Vault/` (the Obsidian vault, **deleted
  by the user 2026-09-16**; the ignore line is harmless), `graphify-out/`. The studio JPEGs, MP4s and
  `studio-scene.json` **are** committed. VS Code may hide gitignored previews — open them for the user
  (`Invoke-Item`) and send with SendUserFile.
- **graphify**: `graphify-out/` is a knowledge graph of the repo (built 2026-09-16, ≈ 1.2 M tokens;
  511 nodes). Use `graphify query "…" --budget 1500` for navigation questions (see `CLAUDE.md`);
  `/graphify --update` after big changes (code re-parse is free, docs/images cost tokens). The user
  views it via `graphify-out/graph.html`. Not read automatically by any session.

## Remaining work
- **Rug, armour row, vines and phone swipe: rendered and committed on branch `armour-stands` (2026-09-17),
  not pushed.** The user decides: push the branch for a Vercel preview (behind Vercel login), or merge into
  `main` and push (deploys). Renders: rug run 2026-09-16 (landscape all, portrait overview) + combined run
  17:40–00:03 (`--only overview,easel,walk` landscape; `overview,music,easel,walk` portrait, 6 h 20 min).
  Details and costs in `context/studio.md`. Suggest `/graphify --update` after it lands.
- **Armour follow-ups the user may want**: Iron Man's panel lines are painted seams, not bevels (slightly
  toy-like face-on); roses read as five-petal blossoms up close; the phone hologram stays clamped at the
  screen edge when swiped away from the music corner (could slide off with it instead); phone overview loop
  is now 2.9 MB (was 1.1 MB). A "zoom in on the suits" close-up would be a new studio item (checklist in
  `context/studio.md`) and a walk render. Any change the overview sees is now ≈ 8 h to re-render fully.
- **How the armour row was decided (2026-09-16)**: brief "not a circle; stack them on the left side of the
  wall in the background; decorations, maybe zoom in later; Mark 7, Miles, Batman — just let me have a
  look". Rough previews → user chose glass cases; three positions previewed from the door (13.5 / 16.6 /
  18.2 m; 26 m rejected, "behind the canvas") → 16.6 m, and the phone problem (row off the phone's frame at
  any position) solved with swipe-to-look rather than by moving it. Modelling and the swipe feature were done
  by two parallel subagents at the user's request to keep this chat's context small. `tools/studio-render/
  peek.mjs <design> <spp> name:w:h:px,py,pz:tx,ty,tz:fov[:exposure]` renders quick stills from `index.html`
  next to it (the `design` arg is now ignored). Old design page: https://claude.ai/artifact/6RPzXMT1jaJYRLFvQUivn7
- **More laptop shortcuts** — the user names them; add to `SHORTCUTS` in `Workstation.tsx`, no render.
- **Don't populate the studio unprompted.** A new item's checklist is in `context/studio.md`.
- **Commit state (2026-09-17):** `main` = `8ce8c73` (live). Branch **`armour-stands`** (local, not pushed)
  holds everything since: the rug + armour + vines renders (20 assets), `index.html` with the row and
  vines, `render.mjs` with the wide phone overview, the swipe code (`Studio.tsx`, `Studio.css`,
  `studioScene.ts`), `studio-scene.json` with `portrait.overviewSize`, `tools/studio-render/peek.mjs`, and
  the `context/` notes. Shader and renders are in step. **Pushing `main` deploys.**
- **First real upload through the live gallery** — the one untested step (Cloudinary secret,
  `public_id` shape). The gallery's error text says which step failed.
- **`.env` tidy-ups**: the Vercel recovery codes were printed once in a session — the user was advised
  to regenerate them and keep them in a password manager. Remove the duplicate `SPOTIFY_REFRESH_TOKEN`.
- **Backend leftovers** (the user fixes these themselves): optional `data.item === null` guard;
  optionally make `/callback` log the token instead of appending to `.env`; drop `pg-pool`; backend
  tsconfig has `declaration`/`jsx` it doesn't need.
- **Maybes, not asked for**: swipe to pan the studio on phones (must not bring back black bars);
  floating Zs over the dog (`anchors.dogHead`); the dog as a walk-up item (ask for a photo of him
  asleep first); hide the music notes when nothing plays; bring the phone hologram down by the player;
  judge board legibility on the real phone (prints 32×44 px); a faster laptop loop (tighter `dogBox`).
- **Idea, undecided**: music video for the playing track via the YouTube Data API (backend route the
  user writes; 100 quota units per search, so search on track change and cache — a use for
  `spotify_cache`; embed rules ≥ 200×200 px, not covered). Open question: where it plays.
- Unused Vite leftovers: `frontend/src/assets/hero.png`, `react.svg`, `vite.svg`,
  `frontend/public/icons.svg`, `frontend/README.md`.

## File structure
```
website-/                        (repo root; GitHub Malachitopp/website-, public)
├── CLAUDE.md                    (graphify-first navigation + where the context files are)
├── .env / .env.local            (gitignored; names in Local dev)
├── vercel.json / .vercelignore  (see context/deployment.md)
├── api/index.js                 (Vercel function: re-exports dist/backend/app.js — plain JS on purpose)
├── docker-compose.yaml          (local Postgres 17 on 5433)
├── package.json / tsconfig.json (backend; TypeScript 7; devDependency ffmpeg-static)
├── pictures/                    (gitignored: dog photos)
├── graphify-out/                (gitignored: knowledge graph)
├── src/
│   ├── backend/
│   │   ├── app.ts / index.ts / db.ts
│   │   ├── art/art.ts, art/config.ts
│   │   ├── auth/auth.ts, auth/cloudinary_auth.ts
│   │   └── spotify/getCurrent.ts, spotify/getTop.ts
│   └── migrations/migrations_001.sql (spotify_cache), migrations_002.sql (art)
├── tools/studio-render/
│   ├── index.html               (WebGL2 path tracer: the whole scene, post, overlay anchors)
│   ├── render.mjs               (headless-Chrome driver: stills, loops, walks, studio-scene.json)
│   ├── Michroma-Regular.ttf     (font for the hanging name; committed)
│   └── preview-*                (gitignored quick renders)
├── frontend/
│   ├── index.html, vite.config.ts, public/favicon.svg
│   └── src/
│       ├── main.tsx, index.css, router.ts, App.tsx, App.css
│       ├── Home.tsx / Home.css, ThoughtCloud.tsx
│       ├── Studio.tsx / Studio.css, studioScene.ts
│       ├── MusicCorner.tsx, Workstation.tsx, Easel.tsx, art.ts
│       ├── spotify.ts, SpotifyPage.tsx, NowPlaying.tsx, TopArtists.tsx, SnoopyLedge.tsx
│       └── assets/              (baby-me-*.jpg; studio-{,music-,laptop-,easel-}{landscape,portrait}.jpg/.mp4;
│                                 studio-{music,laptop,easel}-walk-{in,out}-{landscape,portrait}.mp4; studio-scene.json)
├── context/PROJECT.md, studio.md, deployment.md
└── .claude/skills/update/SKILL.md   (the /update skill)
```
Reference photos (baby HEIC, bedroom JPEG) live outside the repo in `../png files to ignore/`.

## Working style notes for this project
**Who does what**
- **Backend: the user writes it.** Explain the concept, point to exact lines, give small snippets,
  review when they say they're done. Don't edit backend files unprompted; when a message could be
  "here's my plan" or "do this", assume the plan. (Unprompted code was backed out twice.) When they
  explicitly ask ("finish and fix the router"), do it. Reviews go as a numbered list, one item at a
  time.
- **Backend wording must be precise**, with the *why* and the concrete failure or attack. Say when
  something is cleanup rather than security.
- **Frontend: write it for them** (they read it). Requests arrive mid-turn — fold them in.
- **Don't commit or push unless asked.** Pushing `main` deploys — say so whenever offering. A branch
  gets a Vercel preview; suggest one for big visual changes. **Their first branch flow (2026-09-16)
  worked**: branch → push → preview → merge → push. They're new to git beyond that (asked checkout vs
  switch — recommend `switch`/`restore`), so give exact commands, and check real state with `git`/`gh`
  before answering ("do I need to check out the branch?" — it was already merged). When the live site
  "hasn't changed" after a deploy, confirm the build is live (compare the served `assets/index-*.js`
  with a local `vite build`) and then suggest a hard refresh — it was their browser cache.
- **Obsidian/graphify (2026-09-16)**: they deleted the in-repo Obsidian vault after learning no session reads
  it; graphify's `graph.html` is how they view the graph. Advice given: one personal notes vault outside
  code projects (OneDrive is fine, set to "Always keep on this device"), graph exports in per-project
  subfolders only.
- **Live actions** (Neon migrations, Vercel domains) get blocked by auto mode unless asked for
  specifically. Finish local work, then ask with a concrete checklist (AskUserQuestion worked well). A
  question ("how come it isn't at my domain") is not a request to change things.
- **Secrets**: never print values (comment lines too), pipe them via stdin, and flag it plainly if one
  was exposed.

**How they think about the studio**
- **Scenes, vibes and reference images.** They send photos and links (Pinterest, eBay, Google Images
  URLs — extract `imgurl=`). Download and compare, render, check desktop, phone and transitions before
  reporting. "Realistic / more depth" meant a photographic render. Real products they name get looked
  up and modelled from photos.
- **A simple game**: press an item, walk up, use it. They place things in metres relative to other
  objects and think about what's visible from where. Their reference is the **committed JPEG** they're
  looking at, not the shader constants.
- **Direct it like a set**: preview a few candidates, pick one, say the trade-off, offer the
  alternative. **Literal sizes can still be wrong** (an 11 m rug was "obnoxious", 2 m "too small"):
  preview from the door on desktop and phone, say how big it will look, offer a middle size.
- **Visual fidelity and defects**: they spot defects precisely — zoom in at native resolution and check
  every instance, not only the one named. It must read as the *Endless* warehouse.
- **Motion words mean real motion** ("sway", "rotate"). If a still can't do it, say so and build the loop.
- **Lighting must be consistent**: driven by where the source is, never by whether it's on screen;
  say when strength is cheated. **They want the site less grey** — colour motivated by the scene is
  welcome; keep hover pops noticeable.
- **They add small bits of life and their own life** (dog from their photos; offered more photos).
  State the reading you took; when photos don't show what's asked (him asleep), ask rather than guess.
- **Scope flags** ("NOT NOW", "write that in as a maybe", "design it, don't add it yet", "leave it
  blank") — respect them and record in Remaining work. "Design it" = a design page with options and
  their open questions, no scene changes.
- **"Is it possible to…"** → what's possible, the route, the catches, and the one decision that's
  theirs. Don't start building.
- **They ask what a change costs** ("would that take a full render?") — answer with what re-renders and
  how long (`context/studio.md`); prefer overlays (no render).
- **They start long renders as soon as they see the command** — only give it after approval, ask them
  to say when it's running. During a render, tell them which shots are still old and that overlays are
  off until `studio-scene.json` is written.
- **They test on their real phone** — portrait is first-class, and hot reload reaches their open tab.
- Notices on the site: a dismissible ×, not timed. Small UI one-liners: match the existing pattern,
  verify desktop and phone. Keep naming broad ("gallery").

**Working with them**
- **Voice-to-text**: read charitably ("dog hot" = doghouse, "Yamu file" = YAML, "pool dot Paul" =
  connection pool); ask only when genuinely ambiguous.
- **New to running and shipping a site.** Plain terms; keep **content** (gallery items, added on the
  live site) apart from **code** (push to `main`). Check dashboards' real state from here (APIs,
  DNS-over-HTTPS, CLIs). They do dashboard steps themselves and report mid-turn — give exact values,
  then verify before saying it works.
- **They check claims against what they've seen** — notes here can be wrong; verify before stating a
  failure mode, and fix the note when corrected.
- **Token-conscious and exploring tools around Claude Code** (Obsidian, graphify, `/update`): explain
  plainly what each reads/writes and whether a new session uses it. They asked for this file to be
  trimmed and graphify used via `CLAUDE.md` to stretch their token limit — keep notes lean.
- **They sometimes run parallel Claude sessions** on this repo: before big edits to files with
  uncommitted changes, check `ListAgents` and whether the file changed since you read it.
- **They leave prompts running unattended** and come back asking what changed: transcripts are in
  `~/.claude/projects/C--StartUp-apps-my-website/*.jsonl`; compare with mtimes and `git status`.
  Before they clear a conversation they ask "are there any processes running" — check renders, headless
  Chrome, background agents and their dev servers.
- Still learning Claude Code's controls (Esc stops a prompt) — answer briefly.
