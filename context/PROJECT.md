# malachitopp.com — project context

Last updated: 2026-09-16

## What this is
Personal site on a domain the user already owns. Not a single-purpose portfolio —
intended as an "amalgamation" of whatever: art, random links, animations, Spotify
data, etc. Primary goal is practicing web design/dev for interviews, so preference
is for plain fundamentals over frameworks doing the work automatically.

**The concept (decided 2026-09-15):** the home page is a full-bleed baby photo of
the user with a thought bubble popping off their head that says "click me!".
Clicking it dives into a black-and-white warehouse studio (the look of Frank
Ocean's *Endless* visual album). The user fills the studio object by object.
**The main point of the studio (in the user's words, 2026-09-15): press on one of
the items in it and "have the user almost walk towards it and focus in on it in a
larger size that allows you to interact with it properly"** — "sort of like a video
game but less complex". The first such item is the **music corner** (record player,
top-artists board, now-playing hologram and album cover; built 2026-09-15), lit warm
by a burning Carby Musk candle on a crate beside the board (added the same day — the
one thing in the black-and-white hall with colour). On the other side of the tagline
board the user's dog sleeps on a small fleece-covered sofa (added 2026-09-15; rendered
into the shots, breathing in the loops; not a clickable item yet). The second item is the
**work station** (built 2026-09-15, the same afternoon): between the sofa and the tagline
board, a tall crate of books with an open laptop on it (its screen shows GitHub's mark), a
second Carby Musk candle burning beside it, and scribbled sheets of physics on the floor;
press it to walk up (`/studio/laptop`) and the screen wakes to a home screen of shortcuts
("all my links and academic stuff" — GitHub and email so far, the user names the rest).
The third item is the **art corner** (built 2026-09-16), on the left of the sofa: a wooden
easel with a blank canvas, spare canvases leaning behind it and one lying face up on the
floor in front of the sofa, an oak crate with a tin of painty brushes, tubes of oil paint
and a palette, and oil paint flicked over the concrete and onto the sofa. Press it to walk
up (`/studio/easel`); press the canvas and it opens out to fill the screen as a scrolling
wall of the user's work — shown as the **gallery** (`/studio/easel/gallery`). **This is where the colour came
in**: the user asked for the paint and the wood to be in real colour against the grey hall
(see *Colour* below), so every crate is oak now, not grey.
On arriving in the studio a dismissible note at the top says "explore by pressing on
things" (added 2026-09-15). The name + Spotify content that used to be the whole site
still lives on its own page.

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
  new tabs. `App.tsx` is a `switch` on the pathname: `/studio`, `/studio/music`,
  `/studio/laptop`, `/studio/easel` and `/studio/easel/gallery` → `Studio` (the same element,
  so it keeps its state and walks between them), `/spotify` → `SpotifyPage`, anything else →
  `Home`.
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
  defines the `spotify_cache` table (see Schema section). `migrations_002.sql`
  defines the `art` table. **Both applied 2026-09-16** — the first time anything in
  this project successfully reached Postgres. Applied by hand (read the file, run it
  through `pool.query`); there's still no migration runner or tracking table, so
  re-running one would error on the `CREATE TABLE`.
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
  - `app.use(express.json())` (added 2026-09-16 for the art POST). Express 5
    parses **no** body without it, and only parses requests whose `content-type`
    is `application/json` — a POST missing that header arrives with `req.body`
    unset and fails validation as though the fields were missing.
  - `spotifyRouter` (named export from `src/backend/spotify/getCurrent.ts`) mounted
    at `/api`, giving `/api/now-playing` and `/api/top/:type`.
  - `artRouter` (named export from `src/backend/art/art.ts`) mounted at
    **`/api/art`** (not `/api`), so its own paths are `'/'` and `'/signature'`.
    Deliberately **not** behind an `ENABLE_…` flag — unlike the Spotify login
    routes, the gallery has to work in production.
  - `src/backend/spotify/getTop.ts` is imported for its **side effect only**
    (`import './spotify/getTop.js'`) — it adds a route onto the shared
    `spotifyRouter` instance. Any new route-adding file like this must be imported
    somewhere or its `router.get(...)` never runs.
  - The old `GET /` "Hello World" placeholder route has been removed.
- **Studio image renderer** (`tools/studio-render/`, not part of the site build):
  the studio page is *rendered photos* (a still + a 6 s loop per shot) and
  pre-rendered camera walks between shots — not hand-drawn SVG or CSS, and not a
  real-time 3D engine. Live data is HTML laid over the renders with the renderer's
  own camera maths. Videos are encoded with the `ffmpeg-static` root devDependency.
  See the Frontend section for details.

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
- **CommonJS syntax pasted from docs into ESM files** (2026-09-16, hit twice):
  `const cloudinary = require('cloudinary').v2` and `exports.myconfig = …` both
  throw `ReferenceError: … is not defined in ES module scope` at import time. The
  trap is that **`tsc --noEmit` passes clean** — `@types/node` declares `require`
  and `exports` as globals — so this is only caught by running the built file.
  `tsc` also has no `noEmitOnError`, so a broken build still produces a runnable
  `dist`. Cloudinary's docs are CommonJS throughout; translate as you paste.
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
  both machines used so far (Intel Iris Xe laptop, AMD RX 6950 XT desktop);
  `swiftshader` also works but is ~20× slower.
- **The committed studio JPEGs can drift from the shader.** The "touches" commit
  had `BOARD_POS` z = 15 in `index.html` while its JPEGs showed the board at
  ~6 m (rendered from an uncommitted state), so the door was hidden even though
  the code said otherwise. The JPEGs are build outputs of the shader: re-render
  after every scene change and commit both together.
- **`@font-face` from a `file://` page is blocked by Chrome** (each file is its
  own origin, fonts need CORS). `render.mjs` passes
  `--allow-file-access-from-files` so `index.html` can load
  `Michroma-Regular.ttf` from beside it; without the flag the letters silently
  fall back to a default font (the page now throws if the font didn't load).
- **`sed -i` in Git Bash rewrites this repo's CRLF files as LF** (the working
  tree is CRLF via `core.autocrlf=true`). Git normalises either way, so nothing
  breaks, but keep files consistent: convert back with a Node one-liner or edit
  with a script that preserves `\r\n`.
- **`Studio.tsx` imports the MP4 loops** the same way as the JPEGs, so the "a
  missing asset import blanks the whole dev app" rule applies to them too: if the
  loops are deleted or regenerated, keep files at those paths (the `--preview`
  MP4s work as stand-ins) until the real ones are written.
- **npm 11 warns that `ffmpeg-static`'s install script is "not yet covered by
  allowScripts"** on `npm install`. On 2026-09-15 the script still ran and
  `node_modules/ffmpeg-static/ffmpeg.exe` was downloaded. If a fresh install ever
  leaves that file missing, run `npm install-scripts approve ffmpeg-static` and
  reinstall, or point the `FFMPEG` env var at any ffmpeg binary.
- **`flat` is a reserved word in GLSL ES 3.00** (an interpolation qualifier):
  naming a local `bool flat` fails to compile with "'flat' : syntax error".
- **Close-up renders lost the WebGL context** (`GL error 37442`,
  CONTEXT_LOST_WEBGL) with the old fixed 400 000-pixel draw bands: close up, most
  rays hit the detailed objects, a band ran past the ~2 s Windows GPU watchdog.
  `accumulate()` now sizes bands from how long the previous band took (starts at
  100 000 px, halves over 200 ms, grows under 50 ms).
- **SVG `vector-effect: non-scaling-stroke` breaks `pathLength`-based dash
  animation** (the chalk ring drew half-way on both buttons). The ring uses a
  plain scaled stroke instead.
- **Studio on phones: don't fit the render to the screen height.** A version that
  made the portrait render always full-height and scrolled sideways when wider
  showed **black bars on nearly every phone** — with the browser's toolbars
  showing, a phone's visible area (e.g. 393×660) is *wider* than the 1:2 portrait
  render, so it never overflowed sideways. The user called the bars horrible and it
  was reverted to `object-fit: cover` (which trims a little top and bottom). See
  Remaining work for the swipe idea.
- **`.env` keys written with a space before `=`** (`CLIENT_ID =…`) still load:
  Node's `--env-file` trims keys. But `grep '^CLIENT_ID='` misses them, which led
  an earlier session to wrongly record that those vars were missing from the
  desktop's `.env`. Grep with `'^KEY *='`.
- **New overlay fields vs Vite hot reload.** Code that reads a new
  `studio-scene.json` field (e.g. `anchors.albumCover`) hot-reloads into every
  open browser at once, but the renderer only writes the field when a render
  finishes. On 2026-09-15 the user's open page (something was playing) crashed
  in `planeTransform` and stayed blank until refreshed — there's no error
  boundary. Add the new fields to the existing JSON first (same maths as
  `info()`; the render overwrites them with identical values), then the code.
- **Git Bash rewrites arguments that start with `/`** into Windows paths (MSYS
  path conversion): `node shoot.mjs … /studio/music` became
  `C:/Program Files/Git/studio/music` and Chrome said "Cannot navigate to invalid
  URL". Set `MSYS_NO_PATHCONV=1` and then give script paths as `C:/…` (with it
  set, `/c/Users/…` paths break instead).
- **Windows PowerShell 5.1 strips the double quotes out of JSON arguments** to
  native programs (`node x.mjs '[{"name":…}]'` arrives as `[{name:…}]`). Pass JSON
  from Bash, or via a file.
- **Don't edit `tools/studio-render/index.html` while a render runs.** `render.mjs`
  starts a fresh Chrome for every job and reloads the page from disk each time, so an
  edit mid-run changes every job after it (`render.mjs` itself is safe — Node loaded
  it once).
- **`studio-scene.json` fields the site reads must come from `info()`.** The render's
  last step rewrites the file with `info()`'s answer, so a field added to the JSON by
  hand but not to `info()` is dropped at the end of the run. On 2026-09-15
  `candle.jar` was lost that way (the site's `candleWarmth` reads it); fixed by adding
  it to `info()` and running `--only none`.
- **Watching render logs:** `render.mjs` prints progress with `\r`, and
  `tail -f log | tr '\r' '\n' | grep --line-buffered …` delivers nothing because `tr`
  buffers. Use `sed -u 's/\r/\n/g'`.
- **One non-finite sample blackens most of a frame.** The first full render with two
  candles came out black in a staircase from a few pixels down and to the right: post's
  box blurs carry running sums along rows then columns, so one `Inf`/`NaN` pixel poisons
  everything after it. The cause was the two-candle picker: `rnd()` is
  `float(uint) / 4294967295.0`, which rounds to exactly 1.0 for the top 128 values, so a
  candle with zero weight (out of reach) could still be picked and its zero share divided
  by. Fixed (a zero-weight candle is never picked), and guarded twice so it can't recur:
  the shader zeroes a sample whose sums aren't finite before adding them, and `mix()` in
  post zeroes non-finite pixels (with a `console.warn`, which render.mjs prints). The tube
  picker always had a `!found` guard for the same reason. Check a render's first still
  by file size: a good 2400×1500 still is ≈ 450 KB, that bad one was 165 KB.
- **A render overwrites the uncommitted assets in place**, so a bad run costs the last
  good files (the sofa/dog overview still was lost to the black one above until the
  re-render). Frame 0 of the matching loop MP4 is the same picture at video quality, if a
  stand-in is ever needed. Commit renders promptly.
- **The Write tool writes LF, the Edit tool keeps CRLF.** After writing a whole file,
  convert with a Node one-liner (`s.replace(/\r?\n/g, '\r\n')`); `file` shows which it is.
- **A thing drawn inside another's bounding slab must fit in it.** The laptop is traced
  inside the crate's slab, whose top was `DESK_H + JAR_H + 0.04` (1.05 m) from the
  candle-crate code it was copied from; the lid's top is at 1.11 m, so its top 6 cm never
  rendered. The user spotted it from the site: "the screen extends upwards but the bezels
  don't" — the overlay uses the true geometry (`anchors.laptopScreen`), so it showed the
  screen where the render had cut the lid off. Now `DESK_H + 0.24`. The check that would
  have caught it: draw the projected anchor quad on a peek (done since, `solve`/`peek`
  scratch scripts) — the quad must sit *inside* a rendered bezel.
- **A "black" surface next to a candle isn't black.** The laptop's bezel at albedo 0.05
  rendered tan on the lid's top (lit by the candle 25 cm away; the jar's rim clears the
  flame for the top of the lid but shades the bottom bezel, which stayed dark), so on the
  phone the lid's top edge vanished against the floor and the dark home-screen overlay
  looked like it stuck up past the lid — the user reported "the screen still protrudes
  above the bezels" after the lid was fixed. Diagnosed by re-rendering a peek with the
  bezel at albedo 0 (it went black, so the material path was right). Now 0.02: a dark
  brown band, darker than the floor, lighter than the screen glass. The overlay got the
  same warm wash the render's screen has (`.home-screen::after` / `.lock-screen::after`
  in Studio.css) so it doesn't look cut out of the picture.
- **`yawWorld(pos, c, s, [x, y, z])` takes y as it is** (it ignores `pos[1]`; every crate
  and board has its origin on the floor). Passing the jars' origins (at crate-top height)
  with flame heights relative to them put both candles' loop patches at floor level, so
  the flames were not re-rendered in that run's loops (only post's brightness flicker
  moved). Caught from `--stats`/the peek's `patches` list: a close-up of a candle listed no
  patch for its flame. Put the height into the corners, not the origin.
- **Vite reloads the studio page whenever a render rewrites an imported asset**, so a
  headless-Chrome check run while a render is writing files can be cut mid-flow. But the
  timeouts seen in the scratch `site.mjs` check on 2026-09-15 were the check's own
  race: right after Escape, `location` is already `/studio`, the laptop screen is
  already unmounted and `.is-walking` isn't set until the walk video *plays*, so a
  "settled" test on those three passed during the setting-off gap and the click on the
  music hotspot found no button. A settled test must also require a hotspot to exist
  (or `.studio` not to have `is-setting-off`). A half-second-by-half-second state probe
  (`chain-probe.mjs` in the scratchpad) showed every walk arriving on time.

- **Material names in the shader are one flat namespace.** Adding `M_TUBE` for a tube of oil
  paint failed to compile with `'M_TUBE' : redefinition` — the fluorescent tubes already had it.
  It is now `M_PAINT_TUBE`, and its constants are `PAINT_TUBE_*` (note `TUBE_LE`, `TUBE_Y`,
  `TUBE_T`… belong to the lights). Grep the `M_` list before naming a new material.
- **Don't run `prettier` on this repo.** There is no prettier config, so its defaults
  (double quotes, semicolons) are the opposite of the code's style and it reformatted all of
  `MusicCorner.tsx` in one go. `npx eslint src/` and `npx tsc -b` are the checks; formatting is
  by hand, matching the file.
- **An overlay must not be drawn for a point behind the camera.** `project()` happily returns a
  mirrored position for one, so from the laptop and the easel close-ups — where your back is to
  the music corner — the now-playing hologram, its light beam and the notes were stuck to the
  edge of the frame labelling a record player nobody could see. `MusicCorner` now checks
  `record.z > 0` (and the board's middle separately) before drawing any of it. Any new overlay
  pinned to a fixed point in the scene needs the same guard.
- **CSS `columns` inside a fixed-height box doesn't balance**, it fills the first column to that
  height and then starts the second — which left the contact sheet on the easel's canvas with one
  column full and the other nearly empty on a phone. Use a grid with `grid-auto-rows: 1fr` and
  `object-fit: cover` where the box has a definite height; keep `columns` for the wall, which is
  free to grow.
- **ANGLE compiles the path tracer on the first draw, not on link**, so the first still of a run
  can report tens of seconds (46 s was seen at 960×600, 64 spp) while every still after it in the
  same browser takes well under a second. Don't read that first number as the scene having got
  slow — `render.mjs` starts a fresh Chrome per job, so it pays this once per job.

## Schema philosophy (important, keep revisiting this)
- **No `users` table** — single-user site. Auth for write actions is a shared
  secret checked against an env var, not a real auth system. **Built 2026-09-16**
  as `requireSecret` in `src/backend/art/art.ts` (see the art backend section).
- **`spotify_cache` table exists in the migration file but is NOT used.** Spotify
  features are live-fetch-only. Columns: `id uuid PK (gen_random_uuid())`,
  `kind text`, `spotify_id text`, `name text`, `image_url text`,
  `metadata jsonb`, `fetched_at timestamptz`, `UNIQUE (kind, spotify_id)`. `kind`
  distinguishes row type (`'artist'` vs `'track'`); `metadata jsonb` is a
  catch-all.
- **`art` table (`migrations_002.sql`, written 2026-09-16, not yet applied).**
  `id uuid PK (gen_random_uuid())`, `public_id text NOT NULL UNIQUE`,
  `url text NOT NULL`, `title text`, `year int`, `medium text`,
  `width int NOT NULL`, `height int NOT NULL`, `metadata jsonb DEFAULT '{}'`,
  `created_at timestamptz DEFAULT now()`. `public_id` is Cloudinary's id: `UNIQUE`
  is what makes a re-upload idempotent (via `ON CONFLICT`) and a future delete
  reachable. `width`/`height` are `NOT NULL` because the wall's masonry needs the
  aspect ratio before the image loads; `year` is nullable, which is why the POST
  validates it only when present.
  (The file originally said `TIMESTAMPZ` — a typo Postgres would have rejected
  outright. Fixed to `TIMESTAMPTZ`.)
- General bias: one flexible table over several premature normalized ones, until a
  real pattern forces a split. The art table is **separate** from `spotify_cache`
  on purpose: own content vs cached third-party data.

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
- `get_accessToken(refreshToken)` (exported from `auth.ts`): **caches the access
  token** (the user added this, committed in `213ab43`): module-level `cachedToken` +
  `expiresAt` (from `expires_in`), reused until 60 s before it expires; otherwise
  `refresh_accessToken()` does the refresh-token grant, and concurrent callers share
  one in-flight `refreshing` promise (cleared in `.finally`) so a burst of requests
  refreshes once. The refresh **throws if `!response.ok`** (Express 5 turns that into
  a 500) instead of silently returning `undefined`. In-memory, so per server process
  (a serverless host would refresh per cold start — fine).
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

## Art backend — WRITTEN 2026-09-16 (routes + auth verified; DB path unproven)

Three routes on `artRouter`, mounted at `/api/art` in `index.ts`. **No `fetch` anywhere in
these** — the server never talks to Cloudinary. It signs locally; the *browser* uploads.

- **`GET /api/art`** — public (it's the gallery). Selects newest-first and returns
  **`{ art: [...] }`** with **camelCase** keys (`publicId`, `createdAt` via SQL `AS "publicId"`).
- **`GET /api/art/signature`** — behind `requireSecret`. Returns
  `{ timestamp, signature, cloudName, apiKey, folder }`. Synchronous; no network call.
- **`POST /api/art`** — behind `requireSecret`. Takes `{ publicId, url, width, height, title?,
  year?, medium?, metadata? }`, validates, and inserts with **`ON CONFLICT (public_id) DO
  UPDATE`** so re-posting the same image edits the row instead of tripping the unique index.
  Returns `201` with the row.

**The contract is camelCase, and it is the frontend's, not the backend's.** `frontend/src/.../art.ts`
was written first and sends `publicId`/`url`. The backend was initially written with Cloudinary's
own `public_id`/`secure_url` spellings and **would have 400'd every upload**; it was realigned to
the frontend. If these ever drift again the symptom is a 400 saying the fields are missing on a
request that visibly contains them.

**`requireSecret`** (in `art.ts`): reads `x-art-secret`, 500s if `ART_SECRET` is unset (server
misconfig, not a caller error), 401s if absent, then `timingSafeEqual` on Buffers — with a length
check first, because `timingSafeEqual` **throws** on mismatched lengths rather than returning
false. Constant-time so the secret can't be walked one character at a time. The length leak is
accepted.

**`src/backend/art/config.ts`** — calls `cloudinary.config()` once at import (global singleton
state) with `secure: true`, and exports the configured `cloudinary`. Each env var goes through a
`required()` helper that **throws at startup naming the missing var**. This replaced
`` `${process.env.X}` `` template literals, which turn a missing var into the literal string
`"undefined"` and surface much later as an unexplained Cloudinary 401. It also no longer exports
the return of `config()`, which contains `api_secret`.

**`src/backend/auth/cloudinary_auth.ts`** — `signuploadform()`: SHA-1s `{ timestamp, folder: 'art' }`
via `cloudinary.utils.api_sign_request`, reading the secret straight from `process.env` (typed,
because `config()` returns everything as optional). Returns the signed pair plus `cloudName`,
`apiKey` and `folder` so the browser can build the upload URL — a deliberate departure from
Cloudinary's docs, which hardcode those client-side. Sending them keeps `.env` the single source
of truth.

**The signing rule, which is the source of nearly every bug here:** sign *exactly* the params the
browser will send (excluding `file`, `api_key`, `signature`, `resource_type`, `cloud_name`).
Cloudinary re-hashes **what it receives** and compares. The docs' demo `eager:` transformation and
`folder: 'signed_upload_demo_form'` were both copy-pasted in early and both had to go — sizes are
done with URL transforms (`w_`,`q_auto`,`f_auto`, see `sized()`), not eager ones.

**Don't cache the signature.** Considered and rejected 2026-09-16: it's a local SHA-1 over ~40
bytes, no network call and no quota, so caching saves nothing measurable and reintroduces the
expiry bug. Cloudinary rejects a `timestamp` more than ~1 hour off its clock — which is why an
early version that signed once at module load was fatal (every upload would fail an hour after
boot). Unlike the Spotify access token, where caching avoids a real HTTP round-trip. The frontend
already fetches the signature when the file is picked, so the hour never matters.

**Verified end-to-end against the real database** (2026-09-16, router on a spare port since 3000
was occupied): signature route 401s with no header and with a wrong one, 200s with the right one
and returns real hex; POST 401s without the header, 400s on a bad body; `GET` returns
`{"art":[]}` when empty; a full insert returns 201 with the row; **re-posting the same `publicId`
returned the same `uuid` with the updated title**, confirming `ON CONFLICT` rather than a
duplicate-key error; a POST with no `year`/`title`/`medium` inserted nulls correctly. Test rows
were deleted afterwards — the table is empty.

**Not verified:** no real Cloudinary upload has been performed, so the `public_id`
folder-prefix question is still open: with `folder: 'art'`, older accounts return a path-prefixed
`public_id` (`art/abc`) while dynamic-folder accounts leave it bare and set `asset_folder`. Log
the first upload response and see which shape arrives.

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

### `/studio`, `/studio/music` and `/studio/laptop` — `Studio.tsx` + `Studio.css` (the warehouse)
- **Shots.** Each shot (`overview` = the view from the door, `music` = the
  close-up of the music corner) is a `<picture>` still (`<source media=
  "(orientation: portrait)">` for the portrait render) with a seamless 6 s loop
  `<video>` of the same frame over it (`autoPlay muted loop playsInline`,
  `aria-hidden`). Frame 0 of each loop is its still, so the hand-over is
  invisible and a video that never loads just leaves the still. All layers are
  `.studio-shot` (`position: absolute; inset: 0; object-fit: cover;
  pointer-events: none`). Framing is picked in JS with `useMediaQuery()`
  (`useSyncExternalStore` on `matchMedia`); tall screens get separately framed
  portrait renders rather than crops. Whole-frame videos rather than patches over
  the JPEG: a patch would need sub-pixel alignment under `object-fit: cover`, and
  browsers scale and colour-convert `<video>` and `<img>` differently.
- **Walking between shots (added 2026-09-15; three shots since the laptop).** The
  URL is the truth: clicking an item calls `navigate('/studio/music')` or
  `navigate('/studio/laptop')` (`PATHS` maps paths to the `CloseUp`s); a state
  machine in `Studio` (`view` = the settled shot, `walk` = `{ from, to, framing,
  playing, ended }`, adjusted *during render* — React's pattern for following an
  outside change — so the `set-state-in-effect` lint rule stays happy) starts a walk
  whenever the path and the settled view disagree. **Every walk starts or ends at
  the overview**: from one close-up to the other it walks out first, settles, then
  the next render sees the path still disagrees and walks in (two walks, no special
  case). There is one persistent `<video class="studio-walk">` *per close-up*
  (`walkRefs`), each holding the next walk you could take with that close-up from
  here (out of it if you're there, else in to it) with `preload="auto"`, so both
  possible walks from the overview are loaded before they're wanted; the one for the
  walk in progress (`walkShot(walk)`) `play()`s, stays `opacity: 0` until `playing`
  (then covers everything and `view` switches underneath), and on `ended` waits for
  the destination still's `onLoad` before letting go. If it can't play, or isn't
  playing after 4 s, it cuts straight there (`cursor: progress` meanwhile). The loop
  of a shot is only mounted while settled. Leaving: "← back" (and Escape) in a
  close-up call `history.back()` if we walked in from `/studio`, else
  `navigate('/studio')`; browser back/forward walk too. A rotated phone mid-walk
  skips to the destination. `prefers-reduced-motion`: no loops, no walks, just a
  cut (the still fades in over 0.35 s), static notes, the laptop's home screen
  without its wake-up. Checked in headless Chrome on 2026-09-15: overview → laptop
  → Escape → overview → music → (pushState to /studio/laptop) → out and in again,
  on a 1920×950 window and a 390×844 phone, no console errors.
- **Overlays follow the camera frame by frame.** While a walk plays,
  `requestVideoFrameCallback` (rAF + `currentTime` fallback, both in `followFrames()`)
  gives the presented frame's `mediaTime`; `round(mediaTime × fps)` indexes the
  per-frame cameras in `studio-scene.json` (walking out plays them backwards).
  Otherwise the shot's camera is used. **The candle's flicker follows the video too**:
  another effect runs `followFrames` on whichever video is on screen (the walk, or
  the settled shot's loop via `loopRef`) and writes `--flicker` =
  `candleFlicker(scene time)` straight onto `.studio`'s style (no React state).
  Scene time: overview loop = `mediaTime`, close-up loop = that close-up's walk
  `seconds + mediaTime`, walk in = `mediaTime`, walk out = `mediaTime − seconds` —
  the same times the renderer used for those frames (music walks are 2 s, the
  laptop's 2.6 s: `scene[framing].walks[shot].seconds`). No video (reduced motion,
  or still loading) → the still's moment. Only the music candle's flicker is
  followed (`scene.candle.flicker`): the overlays it lights are all in the music
  corner; the work station's candle flickers on its own in the render.
- **The "explore by pressing on things" note (2026-09-15).** User: "a little message
  that appears at the top when you enter the studio", then mid-turn "it should be one
  of those things that you can press an x on and it disappears". A `.studio-hint`
  `role="status"` pill styled like "← back" (cream `#fbfbf8`, 3 px ink border, 3 px
  drop shadow, `var(--sans)` 16 px), top-centre, with a `.studio-hint-close` × button
  (an SVG cross, `aria-label="Close"`). State `hint: 'unseen' | 'showing' | 'closed'`
  in `Studio`, adjusted during render like the walk: it shows the first time the
  overview is *settled* (so landing on `/studio/laptop` and walking out still shows it),
  stays until the × is pressed, and also closes for good once you set off towards an
  item (it isn't brought back on returning). Not remembered between visits (no
  storage). Drops in 12 px with a fade after 0.6 s (`studio-hint-in`; reduced motion:
  fade only, `studio-hint-fade`). At ≤ 520 px wide it sits under the back button
  (`top: 68px`), since centred it would overlap it. Checked in headless Chrome at
  1440×900 (hint 579–861 px, back 16–111 px) and a 400×860 phone; clicking × unmounts
  it. The first version faded out by itself after ~7 s; replaced by the × at the
  user's request.
- **`studioScene.ts`** — types for `assets/studio-scene.json` (written by the
  renderer) and the projection maths, identical to the shader's camera: a point
  lands at `(w/2 + k·(v·right)/z, h/2 − k·(v·up)/z)` with `k = coverScale ×
  renderHeight / (2·tanY)` (the render covers the viewport, centred).
  `planeTransform()` returns the `matrix3d` that lays a W×H px element (with
  `transform-origin: 0 0`) onto a world quad in perspective (each column is the
  projective image of the element's x, y and origin); `visiblePart()` samples a
  quad to find which part of it is on screen. Checked by drawing the projected
  slate outline onto renders: it lands exactly on the rendered slate.
- **`MusicCorner.tsx`** — everything live in the corner, in one
  `.studio-overlay` (`pointer-events: none`; interactive children opt back in):
  - *The board*: a 2000×1000 px element (1 px = 1 mm) laid onto the music
    board's slate with `planeTransform`, `inert` unless standing at the close-up.
    Its layout fits what the close-up camera shows of the slate
    (`visiblePart`): five across when it shows the whole slate, three-and-two
    (`.is-compact`) when it only shows part. Both close-ups show the whole board
    now, so it's five across on phones too; the compact branch is a fallback.
    Chalk buttons "past 4 weeks" / "past 6 months" (`short_term` / `medium_term`,
    default 4 weeks; `aria-pressed`, the chosen one gets a chalk ring that draws
    in); five A4 prints (210×297 mm, image `object-fit: cover`, coloured by the
    candlelight on them — see *Candlelight on the overlays* — and full colour with a
    lift/grow/brighten pop on hover, slight hand-pinned tilt, a magnet on top, link to the artist on
    Spotify); under each "1. Name" in chalk. Chalk = Google font **Kalam** filled
    with an SVG `feTurbulence` speckle via `background-clip: text`. While a new
    range loads the old list stays up at 35 % opacity; a failed load chalks
    "couldn't reach spotify".
  - *Notes*: six cartoon SVG notes (white, black outline, `paint-order:
    stroke`) rising and swaying off the record on staggered CSS loops, sized in
    `--cm` = px per centimetre at the record (min 2.4 px).
  - *Hologram*: when `/api/now-playing` says something is playing (polled every
    10 s; nothing rendered otherwise), a see-through cyan-tinted panel ("NOW
    PLAYING" in **Michroma** with tiny equaliser bars, track — a Spotify link at
    the close-up — and artist) on a gradient light beam from the record. It
    floats 30 cm above the record up close and rises to 1.45 m from across the
    hall (so it labels the corner without covering the boards), sliding between
    with distance (`near` = px-per-metre at the record, 150 → 400); width
    `clamp(min(180, 36vw), 46 cm, 340)`; kept 12 px inside the screen. On a phone
    the close-up is far enough back that `near` ≈ 0.16, so the panel floats ~1.3 m
    up at the top-left, clamped to the edge, and its faint beam crosses the first
    print (see Remaining work). Bobs, flickers, has drifting scanlines.
  - *Album cover* (user, 2026-09-15: "leaning against the right side of the box
    … on the floor, propped up against the box's right side"): while something is
    playing and the track has `albumArt`, a 314 mm square sleeve laid with
    `planeTransform` onto `anchors.albumCover` (standing on the floor, leaning 14°
    back against the box's +x side), over a blurred gradient shadow on
    `anchors.albumShadow`. Coloured by the candlelight like the prints (≈ half colour
    at its distance), full colour on hover; links to the
    song when focused (`inert` otherwise). Remounts (fades in) per album. Nothing
    is rendered there, so no re-render is needed to change how it looks.
  - *Hotspot*: from the settled overview, a transparent `<button>` over the
    projected bounding box of the whole corner (now including the candle's crate;
    faint glow on hover); clicking the hologram there walks in too.
  - *Candlelight on the overlays* (2026-09-15): the user wanted the candle to light
    "all the album arts", which are HTML. `candleWarmth(point, normal)` in
    `studioScene.ts` works out each candle's light the way the shader does (strength,
    soft fall-off, the fade over the last 40 % of its reach, facing, and how much of
    the flame clears its jar's rim from that point, from `scene.candle.jars`), summed
    over both candles since 2026-09-15 (the work station's adds a little to the music
    board's left prints from 5 m away), against `TUBE_LIGHT = 0.45` (the tubes' light on an
    upright surface there: 0.18 direct, integrated in a scratch script exactly as
    `directLight` does, plus about as much bounced), giving the share of the light
    that's the candle's (≈ 0.41 on the left print → 0.87 on the right one, 0.29 on the
    album cover). A layout effect in `MusicCorner` sets `--warm` on every `[data-lit]`
    element on the board (the range buttons, each artist `li`, the error message) from
    its layout position (`offsetLeft/Top` up to the board plane, 1 px = 1 mm) — deps
    are the artist lists and area, not every walk frame. The album cover gets it
    inline. CSS: **the light decides how much colour each picture shows** —
    `grayscale((1 − warm)²)` on the img (so ≈ 65 % colour on the far-left print, ≈ 98 %
    on the one by the candle, ≈ 50 % on the album cover); it isn't flickered, because
    the img's `filter` transition would re-run every frame. Prints and the sleeve also
    get a warm gradient `::after`/`::before` with `mix-blend-mode: soft-light` at
    `opacity: var(--warm) × var(--flicker)` (both elements `isolation: isolate` so it
    blends only with the picture). **Hover pop** (kept at the user's request): full
    colour `saturate(1.4) contrast(1.08) brightness(1.06)`, the wash drops to 35 %, and
    a print lifts 10 px and grows to 1.06. Chalk gets `filter: sepia()`. `--flicker` is
    set on `.studio` by `Studio` every video frame (see the Studio bullet). **The light
    never depends on the candle being on screen** (the user checked: "it doesn't make
    sense if the light disappears"): the glow on the board/player is in the render, and
    `--warm` comes from the candle's position — verified in a 1000×980 window where the
    candle is half cropped off the right edge.
- **`Workstation.tsx`** (2026-09-15) — the laptop's live part, in its own
  `.studio-overlay`:
  - *The screen*: mounted only while settled at `/studio/laptop` (`focused`). A
    1192×745 px element (4 px = 1 mm of the 298×186 mm screen inside the bezel)
    laid onto `anchors.laptopScreen` with `planeTransform`. It holds a `.lock-screen`
    (the same dark screen and GitHub mark the render shows, drawn again exactly over
    it) that fades and scales away after 0.4 s, and under it the `.home-screen`
    that wakes: the studio's own overview still as a dimmed wallpaper, a menu bar
    ("malachi's laptop", a live clock updated every 10 s), and desktop-style
    shortcut tiles from the `SHORTCUTS` list (`{ name, href, mark, title? }`, `mark` an
    SVG path on a 16×16 grid) — **GitHub** (`https://github.com/Malachitopp`, octicon
    mark) and **Email** (added 2026-09-15: `mailto:malachi.topp@malachitopp.com`,
    GitHub's `mail` octicon envelope as the mark, `title` = the address so hovering
    shows it); the user names the rest. Each is an `<a>` with the mark on a rounded
    tile and a label; `target="_blank"` except for `mailto:` links (a mail link only
    launches the mail app, so a new tab would be left empty). **Sizing**: `--px`
    on the screen element = how many real px one of its px is at the close-up
    (from the projected width of the screen's top edge), and every size in the home
    screen is `calc(Npx / var(--px))`, so tiles are 84 real px and labels 12 real px
    on a 1920×950 window (screen ≈ 728 px wide) and on a 390×844 phone (≈ 241 px
    wide) alike. Verified with the screen outlined: it sits exactly on the rendered
    screen.
  - *Hotspot*: from the overview a transparent `<button>` (`.studio-hotspot`, the
    class the music corner's uses too) over the projected box of `anchors.workstation`
    — crate, laptop, candle and papers — "Walk over to the laptop and my links".
- **`Easel.tsx` + `art.ts`** (2026-09-16) — the art corner's live part, in its own
  `.studio-overlay` plus one full-screen layer:
  - *The canvas* (`CanvasFace`): mounted while settled at `/studio/easel` or with the wall up.
    A 700×900 px element (1 px = 1 mm of the 0.70×0.90 m canvas) laid onto
    `anchors.easelCanvas` with `planeTransform`, `--px` sized like the laptop's screen. The
    render leaves the canvas blank; the first six paintings fade onto it 0.35 s after you arrive
    (`easel-show`, the same trick as the laptop waking) as a **two-across contact sheet of
    square-ish crops** — `grid-auto-rows: 1fr` + `object-fit: cover`, because `columns: 2` in a
    fixed-height box fills the first column and leaves the second half empty (it looked broken
    on a phone). Their true proportions are on the wall, where there's room. A label along the
    bottom over a soft wash says "gallery"; the whole thing is an
    `<a href="/studio/easel/gallery">` so ctrl-click still opens a tab. **Visible wording is
    "gallery", not "paintings"** (the user, 2026-09-16: "just say gallery. I dont want to just upload
    paintings and stuff") — the heading, labels and alt text say gallery, the add form's medium starts
    empty and asks for "an image". Code names (`Painting`, `paintings`, the `art` table) were left as they were.
  - *The wall* (`Wall`): the canvas opened out to the screen — a `position: fixed` surface in
    canvas colours (a warm off-white with a woven texture and an oak stretcher border round the
    whole screen, `z-index` above the sticky bar or it would paint out the top edge), scrolled
    down like a board of pins. Masonry is plain CSS `columns: 250px 5` with
    `break-inside: avoid`; every pin carries the painting's own `width`/`height` as an
    `aspect-ratio`, so nothing jumps as the images load. Each pin links to the full-size image.
    **It grows out of the canvas rather than opening on top of it**: `canvasOnScreen(lens)` gives
    the middle of the canvas on screen and how much of the screen's height it fills, which become
    `transform-origin` and the starting `scale`. It is **mounted the whole time you stand at the
    easel**, shrunk onto the canvas with `visibility: hidden; pointer-events: none` and
    `visibility` in the `transition` list — so it grows shut as well as open (unmounting it on
    close made it snap).
  - *The URL is still the truth*: `/studio/easel/gallery` is the easel shot with the wall up,
    so browser back closes the wall and `PATHS` maps both easel paths to the `easel` close-up.
    Escape closes the add-form first, then the wall; `Studio`'s own Escape stands down while the
    wall is up, and its "← back" is `hidden`.
  - *Who can add one* (the user asked, 2026-09-16: "Do i have admin permissions or something? will
    there be an add button only fo rme"). There is no account to log in to — the word in
    `ART_SECRET` is the whole of it — so **a visitor is shown no way to add anything at all**,
    not even a button that would turn them away. The way in is a faint `+` in the bar (22 %
    opacity, full on hover/focus, a 30 px target so it works on a phone) or **shift+A**; either
    opens `Unlock`, which checks the word with `verifySecret` (a `GET /api/art/signature` — only
    the real secret gets a signature back) and on success remembers it in `sessionStorage` for the
    tab and swaps the `+` for a real "add one" button. The empty-state line "press 'add one' to
    hang the first" only shows once unlocked, for the same reason.
  - *Adding one* (`AddPainting`): a file picker and title/year/medium — the word has already been
    checked, so it is only sent, never asked for twice. `uploadPainting` asks
    `/api/art/signature` for a signed Cloudinary upload, sends the file **straight to Cloudinary**
    (so no image bytes go through the backend — no multipart parser, no `express.json` limit) and
    then POSTs the row to `/api/art`. If `GET /api/art` ever 404s or fails, `useArt` reports
    `unreachable` and the wall says "nothing up here yet" rather than erroring.
  - *`art.ts`*: `useArt(enabled)` (skips the fetch until the paintings are wanted, so walking
    round the studio doesn't ask for them), `sized(url, width)` which splices
    `w_<n>,q_auto,f_auto` into a Cloudinary delivery URL so a wall of thumbnails doesn't pull
    full-size photographs, `verifySecret`, and the secret helpers.
  - *Hotspot*: from the overview, a `<button>` over the projected box of `anchors.artCorner`,
    **never smaller than 44 px** either way — on a phone the corner is a narrow sliver at the
    left edge of the frame and the raw projected box is too small to hit.
- **`spotify.ts`** — `useNowPlaying()` and `useTopArtists(range)` (returns
  `{ artists, latest }`: the list for this range or null while loading, and
  whatever loaded last), shared by the studio and the Spotify page.
- **What's in the scene (as of 2026-09-15):** the tagline blackboard on casters
  mid-hall ("A theoretical / physics student", door glow over its top); the name
  "Malachi Topp" hanging letter by letter from the tubes, swaying in the loops;
  and the **music corner**: a little plywood crate (records filed spine-out
  inside, one leaning) standing 50 cm right of and 50 cm in front of that board,
  turned 30°, with a turntable on it (black plinth, strobe-dotted platter, vinyl
  with a glossy reflection and a two-tone label so the spin shows, tonearm in the
  grooves) that turns in the loops; and behind it, off to the right so the player
  doesn't hide it, a second board of the same model (blank slate with wipe haze —
  the site writes on it). All rendered into the photos; only the live data is HTML
  (including the now-playing album cover leaning on the box — nothing is rendered
  there).
  The user placed the box relative to the board ("half a meter to the right … 50cm
  in front so it's diagonal") and asked for the board "not directly behind it, but
  behind it so that the board is visible".
  **The candle (added 2026-09-15).** The user asked for "a candle from Drake's candle
  company, maybe a Carby Musk candle, that shines a soft yellow light over the music
  board and illuminates the record player and the table and all the album arts … look
  realistic … prop it up on another little table like how the record player sits … on
  the right side of the chalk board". Drake's brand is Better World Fragrance House; the
  Carby Musk candle is a 10.5 oz navy glass tumbler with "Carby Musk" in a gold serif,
  a seven-ring mark and "BETTER WORLD FRAGRANCE HOUSE" in small caps (product photos
  from `betterworldfragrancehouse.co/cdn/shop/files/CM_Shopify.jpg` etc. — a plain curl
  with a browser User-Agent works). Modelled at real size (8.2 cm × 11 cm, wax 6 mm
  under the rim, 2.6 cm flame) on a plywood crate stood on end (34 × 30 × 66 cm, a shelf,
  three hardbacks lying in the bottom, a box of matches and a spent match on top), at
  (1.30, −0.50) in the music board's frame, squared up with it, just clear of its right
  leg. **It is the only colour in the renders** besides what the site overlays: navy
  glass, gold printing, and warm yellow light (`CANDLE_RGB` 1, 0.76, 0.42). On screen it
  is small (≈ 35 px wide in the 2400 px close-up): the label reads as gold specks, the
  flame as a bright point with a halo.
  **The sofa and the dog (added 2026-09-15).** The user asked for their dog "on a
  chair, just to the left of the chalk board, sleeping how he does in the pictures …
  like a chair sofa, in fact you can even render the sofa from the pictures … he would
  sleep on the edge propping his head up like that". The pictures are three JPEGs in
  `pictures/` at the repo root (gitignored via `/pictures/`): a black schnauzer-type
  dog with a beard, folded ears and greyer legs — on a bed with his head propped on a
  fleece pillow and a paw over it, standing in snow, and lying on the user's grey
  fleece-covered two-seater with his front paws over the front edge. "The chalk board"
  was read as the *tagline* board (the music board's left is the record box). Modelled
  as one signed distance field sphere-traced in the sofa's frame (`sofaSDF`, `dogSDF`,
  `sofa()` in the shader; rounded boxes, ellipsoids, capsules and polynomial `smin`,
  normals from the gradient, roughened for fleece and a wiry coat): a 1.64 m loveseat in
  a fleece cover (base to the floor, seat cushion with a lip, rolled arms topping out at
  0.675 m, back leaning 8° with a roll along its top, two back cushions, a patterned
  square pillow and a fluffy one in the left corner) at `SOFA_POS (-2.35, 0, 11.1)`
  yawed −16° — its right arm ≈ 0.6 m left of the board's left leg, its front a little
  ahead of the board's face, like the record box on the other side. The dog lies along
  the seat at 30° (`DOG_POS`), back end by the pillows, chest at the front-right corner,
  chin on the right arm (`HEAD_C`, nose pointing at the board), near front paw hanging
  over the front edge, far one along the seat by the arm, near hind leg sprawled flat
  with the foot beside his belly, a short tail on the cushion. Head: a dome flattened on
  top, capsule muzzle, a deep block of beard, two brow tufts, ears folded down the sides
  with a ridge at the fold, a nose. Materials `M_SOFA` (fleece, albedo 0.48), `M_PILLOW`
  (cream with a grey print), `M_DOG` (0.055, beard/brows/legs a shade greyer as in the
  snow photo), `M_NOSE`; all grey, so the black-and-white look is untouched. **He
  breathes in the loops**: `uBreath` swells the ribs, two breaths per 6 s loop, ±4.5 %;
  `dogBox` is a loop patch (≈ 185×130 px in the landscape overview, so cheap). In the
  overview he is ≈ 70 px long: a black dog on a grey sofa, head up on the arm, no more
  detail than that; the model was judged in close-up scratch renders (a `peek.mjs` in the
  session scratchpad with `sofa`/`dog`/`side`/`face` cameras — worth recreating for any
  change to him). Sphere tracing needed 192 steps and a 3 mm "near enough" acceptance
  when it runs out, otherwise rays creeping along a silhouette missed and the bright sofa
  showed through his outline. `anchors.sofa` (box corners) and `anchors.dogHead` are in
  the scene JSON for a hotspot or Zs one day; nothing on the site reads them yet. Only
  the overview stills/loops and the walks were re-rendered (`--only overview,walk`): the
  sofa is 47°/53° outside the landscape/portrait close-up frames, so the music files
  are unchanged.
  **The work station (added 2026-09-15).** The user asked for "a little wooden table
  with a laptop on it … to the right of my dog … towards the left side of the chalk
  board … a little taller than the other wooden blocks, like the one with the vinyl
  player since it'll resemble me standing at the chalk board with the laptop open …
  the laptop screen should display the github logo … inside of the storage
  containers should be books … scribbled paper on the floor with arbitrary sketches
  of system design and equations like the dirac equation, or matrices from special
  relativity … without covering my dog up", then mid-turn "add another candle, same
  as the one in the music section, and have the same lighting effects". Placement:
  the sofa's front-right corner is at (−1.41, 10.88) and the board's left post at
  (−1.03, 11.9), so the crate stands at `DESK_POS (−1.15, 0, 11.3)` yawed −25°
  (`DESK_C/S`; its front turned a little right, towards the board and the door), 0.35 m
  in front of the post, 0.23 m from the sofa's corner; in the landscape overview it
  spans x ≈ 1030–1090 of 2400 between the sofa's arm (ends ≈ 1024) and the board's
  post (1082), 35 px clear of the dog's head (990). A plywood crate like the candle's
  but 50 × 40 × 90 cm (`DESK_HW/HD/H`; wider than first planned so the jar fits beside
  the laptop), stood on end, open to the front, two shelves (`DESK_S1/S2`): books on
  every shelf — four rows standing spine-out (`DBOOK`, spines shaded per book with a
  paler title band, page edges pale along the top), three flat in a stack at the
  bottom, one flat on the top shelf, and one leaning 28° from the middle row to the
  crate's side (`DBOOK_LEAN`). On top: the **laptop** (a 14" machine at `LAP_C`, base
  31 × 21.6 × 1.6 cm with 4 mm rounded corners, lid 20.6 cm tall open 110° i.e. leaning
  back 20° — `LID_C/S` — on a hinge along the base's back; sphere-traced as an SDF
  of two rounded slabs, `laptopSDF`; brushed aluminium 0.5, a black bezel, a keyboard
  of black keys in a dark well and a trackpad drawn in albedo by position), the
  **second candle** (the same `jar()` at `DESK_JAR (−0.175, 0)`, i.e. the laptop's
  *left*; it was first put on the right and flooded the tagline board's slate so the
  chalk was unreadable in the overview — on the left it is 1 m from the slate's end
  and the laptop's lid shadows the lower left of the board from it; the warm light
  on the board's left end now mirrors the music board's right), a pencil in front of
  the jar (`M_PENCIL`), and an A4 sheet half under the laptop's front edge. **The
  screen** (`M_SCREEN`, inside `BEZEL_X/LO/HI`, 298 × 186 mm = 16:10) is *light*:
  `screenLight()` adds `SCREEN_LE (0.9) × texture^2.2` to the path's radiance on every
  bounce and the surface goes on as dark matt glass (albedo 0.012 — at 0.04 the candle
  30 cm away washed it gold), so the mark glows and blooms a little; `uScreen` is a
  1600×1000 canvas (`screenTexture()`: `#111` with GitHub's octicon mark, the
  `GITHUB_MARK` path, 36 % of the height, in `#f4f4f4`; neutral grey, not GitHub's
  navy, to keep the hall black and white). **The papers** (`PAPER`: x, z, yaw, drawing;
  `PAPER_HW/HL/T`, 0.3 mm thick boxes turned to their yaws, laid one over another by
  index where they overlap): four on the floor round the crate's feet — one beside
  the sofa's arm, two in front, one further out — and the one on the desk. Their
  drawings are `uPaper`, a 2×2 atlas of A4 sheets at 3 px/mm (`paperTexture()`,
  pencil in white on black, red = ink): the Dirac equation boxed with its γ matrices,
  `{γ^μ, γ^ν} = 2η^μν`, `E = ±√(p²c² + m²c⁴)` → "antimatter!", a crossed-out
  wrong-sign version, "spin ½"; a Lorentz boost along x as a 4×4 matrix with
  `γ = 1/√(1 − β²)`, `η = diag(+, −, −, −)`, `x'^μ = Λ^μ_ν x^ν`, `ds²`, and a light-cone
  sketch; a system design (client → CDN → load balancer → api ×3 → cache/postgres,
  queue → worker, "stateless!", "ttl 10 s", "idempotent", "retry w/ backoff"); and a
  sequence diagram of this site's now-playing fetch (browser → api → spotify) with
  `iħ ∂ₜψ = Ĥψ`, `[x̂, p̂] = iħ`, `∂_μ F^μν = μ₀ J^ν`, `∇·B = 0`. Handwriting is "Segoe
  Print" (has Greek); lines wander with a seeded jitter; `write()` handles `^{}` and
  `_{}`; `matrix()` draws square brackets. From the overview the sheets are light
  slivers on the floor; the laptop close-up can't see the floor (the camera looks
  down 28° at the laptop), which is why one sheet is on the desk. Materials `M_LAPTOP`,
  `M_SCREEN`, `M_DBOOK`, `M_PAPER`, `M_PENCIL`; `M_WOOD` now picks the nearest of three
  crates. `anchors.laptopScreen` (the screen's corners, from `LAP_C`, `HINGE_Z`,
  `LID_C/S` and the bezel), `anchors.workstation` (a box round all of it) and
  `candle.jars[1]` are in the scene JSON. Judged in scratch peeks (a `peek.mjs` in the
  session scratchpad like the dog's, taking a JSON of cameras; worth recreating) and
  the two full-resolution stills above.
- **History (don't re-propose):** the first version was a hand-drawn colour SVG
  cartoon of the user's actual bedroom (from their photo `IMG_2886.jpeg`: green
  bed, wall of paintings, desk with monitor/laptop/white PC, mesh chair). The user
  then asked for an *Endless*-style studio warehouse instead, first tried as a
  flat black-and-white SVG, then — because they wanted it "realistic, more depth,
  look larger" — replaced with a path-traced render. The SVG scenes are deleted.

### `tools/studio-render/` — how the studio images are made
- `index.html` is a self-contained **WebGL2 path tracer** (one big fragment
  shader, progressive accumulation into ping-pong RGBA32F textures — two per buffer
  since the candle, see *Colour, and the candle's light kept apart* — one sample per
  pixel per frame). The camera is uniforms (`uCamPos/Right/Up/Fwd`, `uTanY`), so
  any shot can be rendered. `render.mjs` loads it in headless Chrome (query params
  `w`, `h`, `spp`, `row`), waits for `window.studio` and calls its API over the
  DevTools protocol: `still({camera, time, exposure})`, `loopFrame(i, n)`,
  `frame({camera, time, spp, exposure})`, `info()` (GPU, loop length, anchors, and
  `candle`: flicker, strength, soft, reach, rgb, radius, jars), plus debug
  `letters()` / `board(writing)` / `screen()` / `paper()` / `grade(changes)` +
  `regrade()` (re-grade the last still without rendering). Loop patches: the
  letters' box, the record, each candle's flame (`candleBoxes`) and the dog's chest,
  wherever they are in view — so the laptop close-up's loop has just its flame. Cameras are `{ pos, target, fov }`
  (vertical fov; `lookAt` with no roll). `--only none` renders nothing and just
  rewrites `studio-scene.json` from `info()` (about 10 s). Run from the repo root:
  - `node tools/studio-render/render.mjs` → for each framing (landscape
    2400×1500 / portrait 1170×2340) into `frontend/src/assets/`:
    `studio-<framing>.jpg/.mp4` (overview, 1024 spp, 144-frame loop),
    `studio-music-<framing>.jpg/.mp4` and `studio-laptop-<framing>.jpg/.mp4` (the
    close-ups, each with its loop), `studio-<shot>-walk-in-<framing>.mp4` and
    `studio-<shot>-walk-out-<framing>.mp4` (music 2 s = 61 frames, laptop 2.6 s =
    79 frames, at 30 fps, 512 spp, ⅔ resolution, CRF 24; the music walks were
    renamed from `studio-walk-in/out-<framing>` when the laptop came), then
    `studio-scene.json`. The close-ups are the `CLOSE_UPS` table (`{ music: {
    seconds: 2 }, laptop: { seconds: 2.6 } }`) — a new item is a camera per framing
    and an entry there. Options: `--stills` (no videos), `--only
    overview,music,laptop,walk` (`walk` = every walk, `walk-music` / `walk-laptop`
    one of them, `none` = just the JSON), `--framing landscape|portrait`, `--frames
    N` (loop frames), `--walk-fps N`, `--debug board|letters|desk` (desk = the
    screen and paper textures), `--stats`. A walk needs the overview's and its
    close-up's exposures (taken from the run, or from the existing scene JSON when
    using `--only walk`).
  - **`studio-scene.json` shape (changed 2026-09-15 for the laptop):** top level
    `loopSeconds`, `walkFps`, `anchors`, `candle` (`flicker`, `strength`, `soft`,
    `reach`, `rgb`, `radius`, `jars: [{ flame, rim, light }]` — index 0 the music
    candle, 1 the work station's), and per framing `{ size, exposure: { overview,
    music, laptop }, overview, music, laptop, walks: { music: { seconds, fps,
    cameras[] }, laptop: {...} } }`. The old top-level `walk` and per-framing `walk[]`
    are gone (`delete scene.walk` in render.mjs drops it from a previous file).
  - **The easel shot** (2026-09-16) stands **on the canvas's own normal**, 1.55 m out at eye
    height (both framings share the position: `pos [-3.5459, 1.55, 10.7084]`), so the canvas is
    face on — the site lays a scrolling wall of paintings straight onto it and an oblique canvas
    would read badly for that. Landscape `target [-3.8231, 1.1075, 12.2261]` fov 54; portrait
    `target [-3.8178, 1.3, 12.2508]` fov 58. Solved with a scratch `solve.mjs` (the narrowest lens
    keeping the canvas plus a little easel inside every `cover` crop, aspect 1.4–2.1 / 0.44–0.6,
    3 % margin), then **widened from that answer** so the crate of brushes and paint comes into the
    bottom left; the aim is as low as it can go with the canvas still inside the 2.1-aspect
    vertical crop (y 126–570 of 800 against a safe 95–705). Note that the canvas's size on screen
    barely depends on the distance — fitting the lens to it cancels that out — so the distance is
    chosen for how much of the corner comes in around it, not for how big the canvas is. Checked
    by drawing the projected `easelCanvas` anchor on a peek: it lands exactly on the rendered
    canvas, which is what the overlay needs. Walk 2.8 s (it is about as far from the door as the
    laptop). **Its loop has no patches** — nothing in the corner moves and the letters, record,
    flames and dog are all behind the camera — so only the candles' flicker in post changes
    between frames, which makes it the cheapest loop in the set.
  - **Shots** (in `render.mjs`, metres): overview `pos [0, 1.6, 0]` looking down
    +z (fov 58 landscape / 80 portrait); music close-up landscape `pos [2.0, 1.6,
    6.0] → target [2.451, 1.05, 9.936]`, fov 30.47; portrait `pos [1.6, 1.6, 6.0] →
    [2.67, 1.233, 9.837]`, fov 51.53; **laptop close-up** (2026-09-15) landscape
    `pos [-0.764, 1.4, 10.708] → [-1.6966, 0.4231, 12.1826]`, fov 30.75; portrait
    `pos [-0.739, 1.56, 10.609] → [-1.5424, 0.4413, 12.0592]`, fov 52.23. Solved the
    same way (a scratch `solve.mjs`: a standing point in the crate's frame in front
    of and 28° above the laptop, 0.85 m off for landscape and 1.0 m for portrait; the
    aim re-centred on the must-see points' projected extents and the narrowest fov
    that keeps them inside every `cover` crop, aspect 1.4–2.1 / 0.44–0.6, 4 %
    margin). Must-see: the laptop's base and lid corners, and the whole jar with its
    flame on landscape; on portrait only the jar's axis and flame, so the jar's far
    side may go off the edge on the narrowest phones but the laptop stays big
    (screen ≈ 240 px wide on 390×844 instead of 179). The crate's front edge was
    dropped from the set: with it the fov went to 42°/67° and the screen shrank a
    third. Result: screen ≈ 715 px wide on a 1920×950 window. The walk in passes
    close by the sleeping dog on the sofa (he fills the left of the frame for a few
    frames), which reads as walking past him. **Re-aimed again for the candle (2026-09-15)**
    with the same kind of solver, adding the candle's crate (with the flame) to the
    must-see points: landscape turned right a little at about the same size (slate
    ≈ 660 px on 1920×950); portrait had to widen (fov 47 → 51.5, slate ≈ 288 → 259 px on
    390×844, about 10 % smaller). Putting the crate beside the board's right leg rather
    than further out kept that loss down (0.35 m further right would have cost 15 %).
    The earlier cameras: landscape `→ [2.06, 1.06, 9.96]` fov 31.5, portrait
    `→ [2.56, 1.1, 9.85]` fov 47. Re-framed 2026-09-15 because the user asked to
    "zoom in a little less so that we can see the full chalk board since later I
    might add something to the right", and the album cover on the floor had to be
    in shot. Each was solved (scratch script) as the narrowest lens that keeps the
    whole board on its stand, the cover and its shadow (and on wide screens the
    whole box and player) inside what every likely screen shows under `cover`:
    aspect 1.4–2.1 for landscape, 0.44–0.6 for portrait, 2 % margin; portrait also
    centred vertically. Slate ≈ 670 px wide on a 1920×950 window (was ≈ 850), ≈ 295
    px on a 390×844 phone (was 575 showing only the left ~1.1 m, prints then ≈
    55×78 px). Before this, the portrait close-up was chosen for legibility: a
    wider phone framing that also showed the player made the prints hard to read,
    and now they are 32×44 px with 9 px-high captions on a 390×844 phone (55×80 px
    on a 1600×900 window) — the user chose seeing the whole board. Both
    close-ups are longer lenses than the overview, so the walk also zooms (the user
    literally asked for the camera to "zoom in").
  - **Walks** (`walk()` in `render.mjs`): 2 s to the music corner, 2.6 s to the
    laptop (it is nearly twice as far from the door; `CLOSE_UPS[shot].seconds`),
    smootherstep ease for the body, the head (yaw/pitch interpolated, not the target
    point) turning a little ahead, fov interpolated, a 1.8 cm head bob over 2 steps
    per second, exposure interpolated in log space between the two stills'. Time
    keeps running forwards both ways and each walk ends on exactly the moment of
    the still it arrives at: in runs t = 0 → seconds (a close-up's still is rendered
    at its walk's seconds), out runs t = −seconds → 0 (the overview still). The
    record turns 3 times per 6 s loop = once per 2 s, so the spin matches at both
    ends of the music walks; the laptop can't see the record, so its 2.6 s doesn't
    matter there. Only the letters (and the flames' flicker phase) can jump a little
    when a walk starts at an arbitrary moment of a loop. The per-frame cameras go
    into the scene JSON for the overlays.
  - `--preview` (64 spp stills, 32 spp walks, 960×600 / 390×780) writes
    `preview-studio-*` next to the script (gitignored, with `preview-*.json`); add
    `--frames 24` / `--walk-fps 12` for rough videos. Workflow: edit → preview →
    look (tile video frames with ffmpeg `select`/`tile`) → full render. To try
    cameras, a scratch driver that calls `studio.still()` with candidate cameras
    and draws the projected anchors on top is quicker than editing `render.mjs`.
  - **How the loops are made:** after a still, the page keeps its samples and
    `loopFrame(i, n)` re-poses everything that moves at time `still time + 6·i/n`
    (`setTime()`: the letters' `pose(t)` and the record's `uSpin`), re-renders
    **only the patches of the frame that move** — the letters' padded box and the
    record's box, each projected to pixels (clipped against the near plane, so a
    box partly behind the close-up camera doesn't become the whole frame) plus a 40
    px margin, at the same spp with the same per-pixel seeds — drops those samples
    into the still's buffer and runs the identical film look over the whole frame,
    so everything outside the patches is pixel-identical to the still.
    Frames go to a temp dir as PNGs and are encoded by **ffmpeg-static** (root
    devDependency; the `FFMPEG` env var overrides it) as H.264 High / yuv420p
    limited-range BT.709, preset slow, one keyframe per video (`-g N`),
    `+faststart`, no audio; CRF 20 for loops, 24 for walks. The grain seed is
    fixed, so the grain is identical in every frame: that is what keeps the loops
    small (only the patches change between frames).
  - **Render times with the art corner (RX 6950 XT, 2026-09-16, everything, four shots):
    ≈ 3 h per full run** (02:0x → 05:04). Stills 18–39 s (laptop longest). Loops: landscape
    overview 1041 s, music 419, laptop 932, **easel 815**; portrait 747 / 355 / 269 / **174**.
    Walks: landscape music 403 + 398, laptop 690 + 673, easel 616 + 617; portrait 278 + 281,
    486 + 477, 520 + 481. Exposures: landscape 1.877 / 1.831 / 1.759 / **1.446**, portrait
    1.996 / 1.941 / 1.842 / **1.464** (overview / music / laptop / easel).
    Two things to know about the easel shot: its **exposure is much lower** than the others
    because the big white canvas dominates the frame and auto-exposure answers to the median
    pixel, so its walk ramps 1.88 → 1.45, a bigger swing than any other walk (it reads as the
    eye adjusting, but it is the first place to look if a walk ever seems to darken oddly). And
    its landscape loop is **815 s, not the ~200 s it should be** for a shot where nothing moves:
    the sofa is in the right of that frame, so `dogBox` is a live patch and the dog's chest
    re-renders 144 times. Tightening `dogBox` further, or clipping `screenRect` against the frame
    (see Remaining work), would win that back.
    **One whole run was thrown away** that day: the corner was modelled at z = 12.15, the render
    was started, and the user then asked for the easel to come forward — which invalidated every
    shot, since the corner is in all of them. Get the placement agreed from a `--preview` of
    *both framings* before starting a full run.
  - **Render times with the work station and two candles (RX 6950 XT, evening of
    2026-09-15, everything): ≈ 2 h 30 min per full run** (four were started that
    evening: the first was black from the non-finite bug, the second had the clipped
    lid and the flames not re-rendered, the third the glare, the fourth was cut at the
    portrait walks for the bezel; then `--only laptop,walk-laptop --framing landscape`
    and `--only laptop,walk --framing portrait` for the bezel). Stills 17–36 s (the
    laptop close-up longest: its SDF and the candle fill the frame). Loops: landscape
    overview 1010 s, music 414 s, laptop 1554 s with the old `dogBox` and 948 s with
    the tightened one (see Remaining work); portrait overview 753 s, music 356 s,
    laptop 299 s. Walks: landscape music 355 s each (61 frames), laptop 620–640 s
    (79 frames); portrait music 268 s, laptop 452 s. Exposures: landscape 1.869 /
    1.828 / 1.750, portrait 1.979 / 1.937 / 1.832 (overview / music / laptop). Sizes:
    landscape overview 0.45 MB + 1.57 MB loop, music 0.45 + 1.41, laptop 0.41 + 1.36,
    music walks 1.06 + 1.05, laptop walks 1.53 + 1.57; portrait overview 0.34 + 1.12,
    music 0.33 + 0.98, laptop 0.33 + 1.04, music walks 0.74 + 0.71, laptop walks
    1.14 + 1.15; the scene JSON is 132 KB now (two walks per framing). A landscape
    visit that walks to the laptop and back is ≈ 6.9 MB. **Where a run dies the JSON
    keeps the previous exposures**; the fourth run's overview and music exposures
    were written into it by hand before the partial re-render, so the walks ramp from
    the right level.
  - **Render times with the sofa and the dog (RX 6950 XT, 2026-09-15, `--only
    overview,walk` for both framings: 44 min wall clock):** stills 18 s landscape / 14 s
    portrait; overview loops 859 s / 642 s (were 644 / 485 — the sofa's sphere tracing
    costs about a third more where rays reach it); walks 310 + 308 s landscape, 226 +
    228 s portrait. Exposures 1.862 / 1.966 (the sofa hardly moves the median). Sizes
    unchanged within a few KB (landscape overview 0.45 MB + 1.55 MB loop, portrait
    0.34 + 1.12). The music close-ups were not re-rendered (see the sofa bullet).
  - **Render times with the candle (RX 6950 XT, 2026-09-15): full render ≈ 50 min**
    (48 min of rendering): stills 11–17 s; overview loops 644 s landscape / 485 s
    portrait; close-up loops 409 / 354 s; walks ≈ 260 s each landscape, ≈ 196 s
    portrait. Post is now ≈ 1.4 s a frame at 2400×1500 (per-channel bloom), which is
    much of the loops' time. Sizes: landscape overview 0.45 MB + 1.54 MB loop, close-up
    0.45 + 1.41, walks 1.06 + 1.04; portrait 0.34 + 1.12, 0.32 + 1.01, 0.75 + 0.71.
    Exposures: landscape 1.847 / 1.825, portrait 1.938 / 1.934. Tuning the candle's
    strength, colour or flicker is post-only but still needs every frame re-made, i.e.
    a full render (`studio.grade` previews it on a still in seconds). The numbers below
    are from before the candle.
  - **Render times on the RX 6950 XT desktop (2026-09-15).** Full render ~38 min:
    stills 8–13 s; overview loops ~11 min each (landscape 694 s, portrait 662 s) —
    most of the time. With the re-framed close-ups: close-up loops ~3 min
    (landscape 181 s, portrait 157 s), walks ~2.5–3 min (landscape 187 s, portrait
    138 s), so **`--only music,walk` for both framings ≈ 18 min**. What a change
    costs: the walk's path/easing/bob → `--only walk` (~11 min, ~5 with
    `--framing`); where the close-up ends up, or `WALK_SECONDS` (the music still is
    rendered at t = `WALK_SECONDS` and the record spin is timed to it) →
    `--only music,walk`; anything that is an overlay (HTML/CSS) → no render. On the
    Iris Xe laptop use `--stills` (and don't expect to render walks). **Sizes:**
    landscape overview 0.45 MB still + 1.45 MB loop, close-up 0.46 + 1.19, walks
    1.07 + 1.05 (5.7 MB for a landscape visit that walks in and out); portrait
    0.33 + 1.09, 0.32 + 0.87, 0.78 + 0.74 (4.1 MB). `studio-scene.json` is 52 KB
    (bundled into the JS). Exposures (auto, from the stills): landscape 1.84 / 1.78,
    portrait 1.93 / 1.83.
  - **Mid-render the site is inconsistent:** stills and videos are written as they
    finish, but `studio-scene.json` only at the very end, so during a re-render the
    dev site shows new images with old cameras (overlays off). Don't judge
    alignment until the run exits.
  - `--stats` prints exposures and loop patch rectangles; env `CHROME` overrides
    the browser path, `ANGLE` the backend (default `vulkan`; see config bugs).
- **The music corner** (added 2026-09-15): `TABLE_POS (1.81, 0, 10.98)` yawed 30°
  (`TABLE_C/S`) and `BOARD2_POS (3.25, 0, 12.55)` yawed 20° (`BOARD2_C/S`). The
  boards share one `blackboard(o, d, pos, c, s, slateMaterial, litter)` (only the
  tagline board gets floor chalk); `nearestBoardLocal()` picks the frame for the
  shared rail/stand/wheel materials; the music board's slate (`M_BOARD2`) samples
  `uBoard2` = `boardTexture({ writing: false })` (mirrored, fainter haze, no
  writing). `musicTable()` works in the box's frame: crate 52×42×50 cm of 18 mm
  boards (grain along each board, joints in albedo), records as one spine block
  plus a leaning sleeve (a rotated box), plinth 45×35 cm on rubber feet, platter
  with strobe dots, record (`REC_C`, `REC_R`, `REC_Y`; label pattern rotated by
  `uSpin`, clockwise from above), spindle, tonearm (pivot, tube, counterweight,
  headshell, cartridge), arm rest, buttons. Vinyl outside the label takes the
  floor's glossy branch (`vinyl()`, stronger Fresnel), with each sample's mirrored
  light capped at 3 — uncapped, the black record showed every overbright sample as
  a white speck and looked like glitter even at 1024 spp. `info().anchors` (from the
  shader constants): the music slate's corners, the record's centre, the
  corners of the whole corner (for the hotspot), and `albumCover` / `albumShadow`
  (a 12" sleeve against the box's right side and the floor under it — computed in
  the page's JS from `BOX_HW` and the table's frame, not modelled in the shader).
- **The art corner (added 2026-09-16).** The user asked for "a wooden easel with a blank canvas
  on it, and then some more blank canvas scattered behind it, maybe have one infront of the sofa
  thats lying flat on the floor, have some paint splatters around, on the floor, maybne some even
  on the sofa too. I paint in oils … one of those wooden boxes that we have in the other
  sections, have a pot with painty brushes and paints too", to the left of the sofa. Everything is
  in the corner's frame at `ART_POS (-3.62, 0, 10.78)` yawed −10° (`ART_C/S`). **The first version
  put it at z = 12.15, level with the tagline board, and the user said the easel itself had to come
  forward** — "i want the actual easel to be like 25-50cm to the left and infront of the sofa, but
  the mess can extend behind the sofa … dont have the easel pushed in the backgroudn" — so the easel
  now stands in the open floor at the sofa's front-left corner with about 30 cm between them, and
  the mess runs from in front of it back past the sofa instead. Where it stands is pinned between
  two limits: the gap to the sofa wants it further left, and a phone's `cover` crop of the
  **portrait** overview wants it further right and deeper (the canvas's left corner has to stay
  inside 0.88 of the render's half-width — at z = 10.78 that is 3.97 m, and the corner sits at
  3.97). At z = 10.52, which read best, a 0.44-aspect phone cut 20 % off the canvas. Check that
  with the scratch snippet that projects `easelCanvas` through `portrait.overview` and compares it
  with each aspect's crop. The whole corner is one `artCorner()` behind an outer slab, with inner
  slabs round the easel and the canvases stacked just behind it, round the two further back by the
  sofa, and round the one lying flat in front of it, so rays that only cross part of it don't pay
  for all of it.
  - **The easel** is a lyre easel. Its *mast* — two uprights 29 cm apart, two cross braces, the
    ledge the canvas stands on with a lip along its front, and the clamp bar and pad over the
    canvas's top edge — leans back 6° **as one piece**, so all of it is axis-aligned in the
    mast's own frame (`easelLocal`, pivoting on the floor) and is just boxes there. The two front
    feet lie flat on the floor and the rear leg props it from behind, so those are in the
    corner's frame (a foot tipped 6° would float 3.6 cm off the floor at one end).
  - **The canvases** are one table, `CANVAS_POS` (x, y, z of the middle of the bottom edge, and a
    yaw) + `CANVAS_FORM` (lean back from upright, width, height), traced by `tiltedBox` and found
    again by `canvasLocal`. In a canvas's own frame x runs across it, y up it and z into it from
    the face — so **a lean of a right angle lays one face up on the floor**, which is how the one
    in front of the sofa is done, with no special case. (A *negative* lean is one with its back to
    the door, leaning away from you; its base y is 0, where a positive lean's is
    `sin(lean)·CANVAS_T`.) Index 0 is the easel's (its place comes from the mast, not a guess:
    mast (0, 0.745, −0.039) → corner (0, 0.745, 0.0391)); then three stacked in a loose rack just
    behind it, each stepping back along its own normal, the third turned round so that one shows
    its stretcher; a small one out to the left; one further back level with the sofa, stretcher
    out; **one behind the sofa with only its top showing over the back** (0.95 m tall for that
    reason — shorter and it disappears entirely); and the flat one. `canvasSurface()` draws the
    face (gesso, a shade warm, uneven, darker where the cloth folds over the edge), the sides, the
    back (a pale wooden bar round the border, slack cloth inside) — **and the paint on it**: every
    canvas but the easel's takes a window of four of `CSPLAT`, chosen by its index so no two are
    alike (the user, 2026-09-16: "Make some of the canvas have paint splatters on them, just make
    it look messy"). The easel's is left clean; the site hangs the paintings on that one.
  - **The crate** is a fourth plywood crate, 42 × 35 × 62 cm on end with a shelf, sharing the
    corner's yaw (as the candle's crate shares its board's) at `ART_BOX (0.44, 0, -0.54)` — ahead
    of the easel and on the sofa's side, where a painter's hand goes. It was on the easel's *left*
    while the corner sat further back; once the easel came forward that put it off the left edge of
    a phone's portrait crop, so it swapped sides. Its rear corner clears the sofa's front face by
    10 cm (at −0.46 it was 1 cm, which is asking for trouble). On top: a tin (`M_POT`, paint run down it) with
    nine brushes fanned out of it bristle-up (handle, ferrule, bristles still loaded with
    whatever they last painted), six tubes of oil paint (`PAINT_TUBE`: a tin body, a band of the
    colour it holds round the middle, a crimped tail, a cap) four on top and two on the shelf, and
    a folded rag; two spare canvas boards stacked in the bottom. The **palette** stands on the
    floor leaning against the crate's front (its top has to reach the crate's face or it looks
    like it's falling over), with a blob of each colour round its top edge and what has been mixed
    from them dragged across the middle.
  - **The paint** is colour only, no geometry: `SPLAT` (x, z, radius, which colour) with the first
    38 in the corner's frame for the floor — clustered where you stand, round the crate, back among
    the canvases and on past the sofa — and the last 10 in the sofa's frame, plus `CSPLAT` for the
    canvases, all through `paintOn`/`canvasPaint` in `surface()`. Dabs in the sofa's *footprint* are
    wasted (the floor under it is never seen), so they stop short of it.
    `splatMask` stretches each mark up to 3× along an angle of its own, breaks up its
    edge with noise, runs a tapering drip off one end and throws three droplets clear — the first
    version was plain circles and looked like confetti. The big ones (r > 6 cm) are old and
    trodden, so they show the concrete through them; dust is mixed into every mark. **The floor is
    the most-hit surface in the hall**, so `surface()` does one box test on the corner's local xz
    before the dabs' loop.
- **Colour, and oak (2026-09-16).** Asked whether the paint should stay greyscale the user said "I
  want the colour to pop and stand out contrasting the grayscale. Everything that has colour should
  have colour. The paint should have colour, if theres paint anywhere, on the floor, sofa, that
  should have colour. the wood should also be wooden coloured. Oak, not gray." So `surface()` is
  no longer "grey unless it's the candle": `M_WOOD` and `M_EASEL` are multiplied by `OAK`
  (1, 0.74, 0.46) — **all four crates, not just the new one** — the canvases are warm primed
  cotton, the brush handles varnished, and `M_PALETTE`, `M_PAINT_TUBE`, `M_BRISTLE`, `M_POT` and
  `M_RAG` compute their colour directly (they never reach `albedo()`, which is only called by
  `surface()`). Still grey by nature: the hall shell, the boards, the card letters, the concrete,
  the fleece sofa, the dog. **Watch the knock-on**: `throughput *= a`, so warm crates bounce warm
  light, and the candle beside the music board now reads noticeably more golden on its slate than
  it did when the crate was grey. The levers if it's ever too much are `OAK` itself and
  `grade.candle2`, not the geometry.
- **The scene** (metres, overview camera at eye level 1.6m looking down the hall): 16m wide,
  55m long, 6.4m high box. 16 rows × 4 columns of fluorescent tubes hanging 0.8m
  below a near-black ceiling with deep cross beams; bare stud framing (studs every
  1.22m, plates + two rows of blocking) on the right wall; a stained white wall
  with three painted-over doorways and conduit pipes on the left; a glowing
  roller door at the far end (`DOOR_H` 4 m, half-width 2.8 m, at z = 52);
  sealed-concrete floor with slab joints, stains and a narrow glossy reflection
  (Phong lobe, `GLOSS_N = 300`). Only the tubes and the door emit light.
- **The blackboard** (`BOARD_POS = (0.1, 0, 12)`, yawed 10° so it sits askew):
  2×1 m slate in an aluminium rail on a wheeled stand, chalk tray with stubs and
  an eraser, broken chalk and trodden chalk dust on the floor in front. All
  modelled in a board-local frame (`boardLocal` / `boardWorldDir`) so the parts
  are axis-aligned boxes and cylinders behind one bounding slab. The writing is a
  2D-canvas texture (`boardTexture()`: Windows handwriting fonts "Ink Free" /
  "Segoe Print" / …, two lines `'A theoretical'` / `'physics student'` sized to
  80% of the board, underline that trails off, stray strokes, wipe haze, roughed
  up with value noise) sampled by the shader as `uBoard` (red = chalk). **Board
  distance was moved 15 → 12 m on 2026-09-15** so the door glow pokes over its
  top: the door top is only 2.4 m above eye level at 52 m away, so the visible
  strip grows slowly as the board recedes — 10 m gave a sliver, 15 m shrank the
  board too much; 12 m chosen after previewing all three. If a bigger board *and*
  more door light are ever wanted, the lever is a taller door (`DOOR_H`), not
  board distance.
- **The hanging name** (`hangingLetters()` in JS, `letters()` in the shader):
  eleven letters cut from 7 cm card (`LETTER_T`, material `M_LETTER`, albedo
  0.86), each on an 8 mm white cord (`M_WIRE`, albedo 0.75) up to a tube's
  underside. **History:** the first version was flat zero-thickness cards tied at
  the top-centre of each glyph's bounding box, so the user said it "looks very
  flat" and that the "M" and "h" cords didn't reach the letters. A parallel
  Claude session added the extrusion and the fixed twist/swing/lean pose; this
  session added the ink tie points, the bridle and the motion. **Each cord ties
  onto the letter's ink, not its bounding box** (added 2026-09-15 after the
  user pointed out the "M" and "h" cords ended in mid-air): `inkAnalysis()`
  reads the glyph back out of the atlas canvas, takes
  the column through its centre of mass and the first ink down that column in
  the glyph's largest connected piece — so the "h" hangs from its shoulder, the
  "o" from its apex, and the "i" cord passes through the dot (its own piece) to
  the stem. A letter whose tie would land more than 40 % of the way down (the
  "M", open V at the top) gets a **bridle** instead: two legs (`uLetterLegs`)
  from the cord's end to the highest ink either side of the column, the ring
  0.42 × the leg span above them. Because the tie column isn't the bbox centre,
  `uLetterSize.zw` carries the card's offset from the cord (x of its centre, y
  of its top edge, in the letter frame). **They are real 3D extrusions, not
  quads**: the atlas is a signed distance field of each glyph (exact Euclidean
  distance transform, Felzenszwalb
  & Huttenlocher, computed in JS from the anti-aliased canvas mask; stored as an
  `R32F` texture, `LINEAR` if `OES_texture_float_linear` is available), and the
  shader sphere-traces `max(sdf2D, |z| − T/2)` inside each letter's box, taking
  side normals from the field's gradient — so undersides go dark and twisted
  letters show their edges, which is what made them stop looking flat. Each
  letter has its own frame with the origin *at the tube*: a twist about the
  wire (`twist`, ±4–15°), then a pendulum tilt back/forth (`swing`, ±1–4°) and
  side to side (`lean`, ±0.5–2.5°) applied to wire and letter together, plus a
  few cm of `slack` so the baseline isn't a ruler line — the user asked for
  "sway back and forth a tiny amount, rotate left to right a little, a bit more
  free flow" and for every wire to visibly reach the lights. **In the video loop
  each letter also moves** (`pose(t)`, `LOOP = 6` s): its twist wobbles ±5° once
  per loop (a slow turn on the wire), its swing ±2° and lean ±1.2° three times per
  loop (a 2 s pendulum period, about right for wires this long), each scaled by a
  per-letter `vigour` (0.7–1.3) and offset by per-letter `phase`s so nothing is
  in step; every term is `sin(ωt + φ) − sin(φ)`, zero at t = 0, so frame 0 is
  exactly the still, and whole cycles per loop make it seamless. Layout in metres:
  `CAP_H = 0.45`, `WIRE = 0.4` (tube to the tallest letters), tracking 0.06 em.
  **Each word hangs from its own tube** — the two either side of the hall's
  centre line — pushed together as far as the 0.8 m gap between tube ends
  allows (`inset`); that's why the name sits ~0.5 m left of centre ("Malachi" is
  longer than "Topp") and can't be centred without a wire landing in the gap.
  The layout **throws** if any wire would miss a tube, and checks `LETTER_N` in
  the shader equals the letter count. Per-letter uniform arrays carry the
  attachment point + wire length, half-width/height + card offset, atlas uv, a
  `mat3` rotation and the bridle legs (all 0 for a plain cord); `uLetterScale`
  is metres per atlas pixel; `uLetterMin/Max` is one bounding box (padded to
  cover the letters' whole range of motion) so rays that never go near skip the
  loop. The `row` param picks
  the tube row: 2 (first row inside the landscape frame) for landscape, **3 for
  portrait** because at FOV 80° the front row's frame is too narrow — the "M"
  landed on the edge and `object-fit: cover` would have cropped it. JS reads the
  scene constants it needs (`TUBE_Y`, `COL0`, …) out of the shader source with a
  regex so the two can't drift. To inspect the letters at native resolution,
  crop the JPEG (PowerShell `System.Drawing` `Bitmap.Clone` works with no
  extra tools) rather than eyeballing the downscaled whole.
- **Font for the name**: the *Endless* sleeve's "ENDLESS" wordmark is **Eurostile
  Bold Extended** — commercial, not installed on either machine. **Michroma**
  (Google Fonts, SIL OFL) is the open look-alike and is checked in as
  `tools/studio-render/Michroma-Regular.ttf` (64 KB, meant to be committed). It
  ships one weight only, so the canvas strokes the outline (`lineWidth = 0.05
  em`) to push it towards the sleeve's bold. Declared via `@font-face` in
  `index.html`, awaited with `document.fonts.load()` before drawing (throws if
  it didn't load); needs the Chrome flag noted in config bugs.
- **Rendering notes**: next-event estimation picks one tube per bounce, weighted
  by proximity/facing for diffuse surfaces and by a Gaussian around the mirror
  direction for the floor's glossy lobe (`glossyLight`) — this replaced a naive
  jittered-reflection bounce that produced fireflies. 4 bounces. Draws are split
  into bands with `gl.finish()` so no single GPU command trips the Windows
  watchdog.
- **Post (in JS)**: average samples → auto-exposure so the median pixel sits at
  0.34 → 3×3 firefly clamp → bloom (two box-blur radii on highlights) → ACES-style
  tone curve → extra contrast (0.45) → gamma → vignette → grain → JPEG
  q0.84. Tweak the look here, not in the shader, when possible. Everything after
  exposure is one function, `filmLook({ rgb, flame }, exposure)`, used for the still
  and for every video frame with the still's exposure, so a frame can never be graded
  differently from the still.
- **Colour, and the candle's light kept apart (2026-09-15).** Until the candle the
  path tracer carried one luminance per pixel and the JPEGs were greyscale; a yellow
  light needs colour, so it is now RGB throughout (`surface()` gives each material a
  colour — grey `vec3(albedo())` for everything but the jars and wax). The shader
  writes **three float targets per ping-pong buffer** (MRT, `layout(location =
  0/1/2)`, `drawBuffers`; texture units 0, 4 and 8 for the previous sums): target 0
  = light from the tubes and door (rgb); target 1 = light from the music candle
  (rgb, `CANDLE_RGB` baked in) + its flame seen straight on (a); target 2 = the same
  for the work station's candle. (Two candles since 2026-09-15: the second got its
  own channel so post can flicker each on its own — `FLICKERS[1]` is the same
  sines at phases shifted 2.7 rad, and its flame has its own sway in `uFlame[1]`.)
  **The work station's candle is graded at `candle2 = 12`, the music one at 22** (user,
  2026-09-15, of the overview: "make the glare on the theoretical physics ever so
  slightly less, it's quite hard to read the white text on a glared blackboard"). At 22
  the candle a metre from the slate lit its left half to a bright band; a `regrade`
  comparison of 22 / 16 / 12 / 9 on one 2400×1500 still (a scratch `regrade.mjs`:
  render once, `grade({ candle2 })` + `regrade()` per value, crop the board) showed 12
  keeps the chalk readable with a warm tint left on the slate and the desk still lit.
  Each jar's own strength is in `candle.jars[i].strength` for the site. The flames
  themselves (`grade.flame`) look the same on both.
  The shader picks *one* candle per shading point (`pickCandle`: chance ∝ its
  1/(d² + soft²) × reach fade, the answer divided by that chance; a candle with no
  weight is never picked, see config bugs) and its channel gets the light; the
  jars' `jarGlow` goes to the nearer jar's channel; both flames' `flameGlow` are
  summed on the first bounce. Clear colour is `(0,0,0,0)` — alpha is a sum now.
  `mix()` in post adds them: tubes' light as is + each candle × `grade.candle` ×
  its `flicker(t, i)`, and the flames go in **after** the firefly clamp (a
  few-pixel flame is exactly what the clamp removes), with one halo blur. Every step after exposure runs per channel with the same
  curve, so grey pixels come out exactly as the black-and-white look had them; grain
  is the same random value on all three channels. Auto-exposure is judged on the
  tubes' light only, so tuning the candle never moves it. `studio.grade({...})` +
  `studio.regrade()` re-grade the last still without rendering (`debugCandleOnly`
  shows just the candle's light) — how the numbers below were tuned.
  **The candle's light is deliberately unrealistic in strength:** a real candle
  (≈ 1 cd) is invisible against these tubes (the tubes alone put 0.18 on the board's
  face, the candle ~0.002), so `grade.candle = 22`, and its fall-off is softened
  close to it (`1 / (d² + CANDLE_SOFT²)`, `CANDLE_SOFT = 0.7` m) so the board beside it
  isn't burnt out while the record player 2.5 m away still warms up. It is only
  sampled for the first two bounces and fades out between 5.4 and 9 m
  (`CANDLE_REACH`). The jar's rim really does shade low things (the crate top, the
  floor round it, the album cover partly) — the wax was raised to 6 mm under the rim
  so the flame clears it for the record player. The floor's glossy reflection of the
  flame is scaled to 0.06 (full strength it was a big bright blob in the overview).
  The glass's own glow (`jarGlow`: the band above the wax lit through, fading below)
  is tuned for `grade.candle = 22` — change one, retune the other.
  **Flicker:** `FLICKER` = five sines, whole cycles per 6 s loop; post scales the
  candle's light by it frame by frame over the same samples, and `uFlame` stretches
  the flame and sways its tip. The light's *position* never moves (`flamePoint()`
  samples the rest pose), so loop frames only need the flame's patch (`candleBox`)
  re-rendered — everything else is the still's samples with a different scale. The
  site reads `scene.candle.flicker` to flicker its own candlelight in step.
- References the user gave: the Ithacan's *Endless* review still
  (`theithacan.org/.../endless.jpg`, front-on with big factory windows), a
  vinyl-sleeve photo (long hall, tubes receding, stud wall on the right — the
  render is closest to this one), and (2026-09-15, for the font) the Saint Marie
  Records *Endless* vinyl listing image (`saintmarierecords.com/cdn/shop/
  products/frank-ocean-endless-…jpg`, arrived as a Google Images result URL —
  take the `imgurl=` param). All of these 403 plain fetches; `curl` with a
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
- **`NowPlaying.tsx`**: polls `/api/now-playing` every 10s (via `useNowPlaying()`
  in `spotify.ts`); checks `res.ok`. All
  states (Loading / "Not listening to anything right now" / playing) render inside
  one `.now-playing` div. Track line 24px `--text-h`; links (here and top-artist
  names) share one rule: no underline, underline on hover.
- **`TopArtists.tsx`**: buttons for `short_term` / `medium_term` only (`long_term`
  deliberately removed by the user). Bordered `<table>`: rank | 80px image | name
  (28px). Data from `useTopArtists()` in `spotify.ts` (an `ignore` flag drops
  stale responses; "loading" is derived by comparing the loaded range with the
  requested one, so nothing sets state synchronously in the effect — ESLint's
  `react-hooks/set-state-in-effect` flags that). Rows keyed by `spotifyUrl`.
- Frontend `tsc -p tsconfig.app.json`, `eslint .` and `vite build` all pass;
  backend `tsc --noEmit` passes.

## Remaining work
- **More shortcuts on the laptop's home screen** (user, 2026-09-15: "all my links
  and academic stuff … The first shortcut can just be my github and that's it for
  now"; later that day "add an email link for malachi.topp@malachitopp.com … as one of
  the buttons"). Each is an entry in `SHORTCUTS` in `Workstation.tsx` (name, href, an
  SVG path for the tile, optional title); no render needed. Two tiles fit side by side
  with room for many more (they wrap from the top left). The user names them. The user still decides
  what else goes in the studio; don't populate it unprompted. A **fifth** item (after music, the
  laptop and the easel) is a camera per framing + a `CLOSE_UPS` entry in `render.mjs`, a `CloseUp`
  in `studioScene.ts`, its assets/`SHOTS`/`ALT` entries and `PATHS` route in `Studio.tsx`, a case
  in `App.tsx`'s switch, an anchor or two out of `info()` in the shader, and an overlay component.
  The easel (2026-09-16) is the worked example to copy; note that its assets have to exist as
  files before `Studio.tsx` imports them or Vite blanks the whole dev app (stand-ins from another
  shot will do while the render runs), and that new `studio-scene.json` fields must be patched
  into the committed file by hand before the code that reads them ships, because the renderer only
  rewrites that file when a whole run finishes.
- **MAYBE, low priority (user, 2026-09-15: "I don't believe it's important, it
  renders fine on my screen"): swipe to look around on phones.** When the render
  is wider than the screen, let the user swipe left/right to move the view "sort
  of like a video game but less complex". Must not bring back black bars (see
  config bugs). Would likely be a horizontal pan of the covered image (and the
  overlays with it) rather than a scroll container.
- **Floating Zs (snoring) — now has a sleeper: the dog on the sofa (2026-09-15),
  but not asked for since.** If wanted: an overlay like the music notes (see
  `MusicCorner`'s `Notes`), rising from `project(lens, scene.anchors.dogHead)`, sized
  by px-per-metre there. Remember inline SVG needs `overflow: visible` for things
  that drift past the viewBox.
- **The dog as an item (maybe, not asked for):** the studio's idea is things you walk
  up to, and `anchors.sofa` is there for a hotspot. A close-up would need a camera in
  `render.mjs` and `Studio`'s two-shot state machine generalised (see the computer
  bullet). The model holds up at about a metre, but before investing in that shot ask
  the user for a photo of him actually asleep (all three photos have him awake) to get
  the pose right; the user offered more photos.
- **Music corner polish, if the user wants it:** the notes always float (the
  record always spins in the renders) even when nothing is playing — they could
  be hidden then, but the spin is baked into the loop. The hologram is tinted cyan
  as the one coloured light in the scene; the user said "opaque hologram", read as
  see-through/glowing — adjust if they meant solid; the candle is now the second,
  warm light. (The prints and album cover used to be
  greyscale until hovered; the user found that "makes the website too gray" and asked
  for the candle's light to bring their colour to life, keeping the pop on hover —
  done 2026-09-15, so phones see colour too.) **On phones the hologram
  floats high at the top-left and its beam crosses the first print** (offered to
  bring it down by the player — e.g. base `near` on the close-up's own
  px-per-metre instead of an absolute one). **Phone legibility** since the
  whole-board framing: prints 32×44 px, captions 9 px; the user hasn't judged it on
  their real phone yet. If too small: bigger chalk/prints when the slate is small
  on screen (overlay only, no render), or a partial-board phone framing again.
- **IDEA, not decided (user asked 2026-09-15: "is it possible to fetch the music
  video from [the song URL]?").** Not from Spotify: the Web API has no video for a
  track, and Canvas clips are only on unofficial endpoints (fragile, against the
  terms). The workable route explained: a backend route (the user writes it,
  walked through step by step) that searches the **YouTube Data API** `search.list`
  for `"<artist> <track> official music video"` (music category, embeddable only),
  returns a video ID with the now-playing data, and the frontend plays it muted in a
  YouTube embed (optionally seeked to Spotify's `progress_ms`, which
  `/api/now-playing` doesn't return yet). Catches: a search costs 100 of the 10 000
  free daily units → search only when the track changes and cache it (a real use for
  `spotify_cache.metadata`); wrong matches (lyric/live/fan videos); songs with no
  video; embedding blocked or region-locked for some label videos; YouTube's player
  rules (at least 200×200 px, not covered, no downloading the video to render it into
  the scene) — which matters for putting it *in* the studio, especially on phones;
  the API key stays server-side. **Open question put to the user: where it plays** —
  in the hologram, on something new like a TV, or in a pop-up from the album cover.
- **Every studio asset on disk is from the one full run of 2026-09-16** (02:0x → 05:04, all four
  shots and both framings; `studio-scene.json` written 05:04 with every exposure). Nothing is
  stale — but **none of it is committed yet**: the 2026-09-15 set in `8e90425` is what git still
  has, so every JPEG/MP4 in `frontend/src/assets/` shows as modified. Commit the whole set with
  the shader (see the drift note in config bugs).
- **The laptop close-up's landscape loop is still the slow one (948 s):** `dogBox`
  was tightened to the dog's ribs, which cut its patch there from 353×1101 px to
  142×1135 (the box's corners still straddle the frame's left edge, and `screenRect`
  takes the bounding box of the projected corners). A `screenRect` that clipped the
  projected box against the frame properly, or a `dogBox` a few centimetres smaller,
  would drop it to the portrait loop's ≈ 5 min. Worth doing before the next full
  render; check the overview loop afterwards for a seam where the chest meets the
  patch's edge.
- **Uncommitted (as of 2026-09-16):** the whole art corner — the shader's geometry and colour
  (`tools/studio-render/index.html`), the easel shot (`render.mjs`), `Easel.tsx`, `art.ts`, the
  easel wiring in `Studio.tsx` / `App.tsx` / `studioScene.ts`, the art styles in `Studio.css`,
  the behind-the-camera guard in `MusicCorner.tsx`, **all the studio JPEGs/MP4s and
  `studio-scene.json`** (the whole set was re-rendered, since the corner is in every shot), and
  this file. Before that and also uncommitted: the "explore by pressing on things" note
  (`Studio.tsx`, `Studio.css`) and the laptop's Email shortcut (`Workstation.tsx`). Everything
  earlier — the sofa, the dog, the work station, its renders and the renamed music walks — was
  committed by the user as `8e90425` ("created computer for github"); the candle before that as
  `213ab43`. Keep committing JPEGs/MP4s together with the shader (see the drift note in config
  bugs). The `pictures/` folder stays out of git.
- **Backend review leftovers** (user is fixing these themselves, walking through
  together):
  - `getCurrent.ts`: guard `data.item === null` → return `{ is_playing: false }`.
  - Optional: replace `/callback`'s `appendFileSync` with `console.log` of the
    token and paste it into `.env` by hand (kills the duplicate-lines bug class;
    matches how the token gets onto the host anyway).
  - Clean the duplicate `SPOTIFY_REFRESH_TOKEN` line in `.env`.
  - Minor: drop redundant `pg-pool`; backend `tsconfig` has `declaration`/`jsx`
    options a server doesn't need.
- **The art backend — WRITTEN 2026-09-16, but never run against a database.** The user wrote
  most of it (`config.ts`, `cloudinary_auth.ts`, the route skeletons) and asked me to finish and
  fix the router at the end. It now type-checks and its auth/validation paths are verified; see
  the "Art backend" section below for the full state and what's still unproven.
- ~~Migrations never applied~~ — **done 2026-09-16**, see Local dev for the port-clash fix that
  unblocked it. Still no migration runner/tracking table; migrations are run by hand.
- Leftover Vite template assets are unused: `frontend/src/assets/hero.png`,
  `react.svg`, `vite.svg`, `frontend/public/icons.svg`, `frontend/README.md`
  (`public/favicon.svg` is still referenced by `index.html`).
- Idea discussed earlier: **video background** (full-bleed `<video autoplay
  muted loop playsinline>`, `object-fit: cover`, poster + reduced-motion
  fallback). The studio now uses exactly this pattern for the letter loop; still
  an option for other pages.

## Local dev environment

**Postgres is on host port 5433, not 5432** (changed 2026-09-16). A **native Windows Postgres
install** (`postgres.exe`, PID 7884 at the time) is also listening on 5432 and wins the
connection, so `DATABASE_URL` silently talked to that server instead of the container for as long
as the project has existed — presenting as `password authentication failed for user "Malachi"`
with credentials that were provably correct. Both `docker-compose.yaml` (`"5433:5432"`) and
`.env`'s `DATABASE_URL` now use 5433. If that error ever returns, check
`netstat -ano | grep :5432` for two listeners before touching any credentials.

Also worth knowing: the container's password comes from `POSTGRES_PASSWORD` **only when the
`pgdata` volume is first initialised**. Changing it in `.env` later has no effect on an existing
volume — fix with `ALTER USER`, or delete the volume to re-init (destroys the data).

- `docker-compose.yaml`: single `db` service, `postgres:17`, named volume
  `pgdata`, port `5432:5432`, `restart: unless-stopped`.
- `.env` (gitignored) var names — never copy values into this doc. On the laptop
  it held `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (read by Compose),
  `DATABASE_URL`, `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`,
  `SPOTIFY_REFRESH_TOKEN` and `ENABLE_SPOTIFY_LOGIN=true`. **On the desktop
  (re-checked 2026-09-15) it holds the same set**: the three `POSTGRES_*`,
  `DATABASE_URL`, `REDIRECT_URI`, `CLIENT_ID`, `CLIENT_SECRET`,
  `SPOTIFY_REFRESH_TOKEN` (still twice, see bugs) and `ENABLE_SPOTIFY_LOGIN`.
  Four of those keys have a space before `=`; Node trims it, and a check with
  `node --env-file=.env` confirmed all four load and that none of them is set in
  the Windows environment. This corrects an earlier note that said they were
  missing from the file. `ENABLE_SPOTIFY_LOGIN` loads as `true`, so `/login` and
  `/callback` are mounted on the desktop too.
- Two machines are used: a laptop (Intel Iris Xe; the earlier sessions) and a
  desktop (AMD Radeon RX 6950 XT, Node 24, npm 11; **no Docker installed** —
  `docker info` fails, so Postgres can't be started there until it is; nothing
  needs the DB yet).
- Run: `npm run build && npm run start` from the repo root (backend,
  `http://127.0.0.1:3000`), and `npm run dev` inside `frontend/` (Vite,
  `http://localhost:5173` — open this one; the studio is `/studio`). Postgres
  (`docker compose up`) only needed once DB-backed features exist.
- **On the user's phone** (they test there): `npm run dev -- --host` inside
  `frontend/`, then `http://<PC's LAN IP>:5173/studio` on the same Wi-Fi — Vite
  prints the address next to "Network:" (the desktop was `192.168.0.100` over
  Ethernet on 2026-09-15). The `/api` proxy runs on the PC, so Spotify data works
  on the phone too. The desktop's network profile is Public, but Windows Firewall
  already has inbound allow rules for Node.js on Public and Private. A connected
  phone shows up as a remote address in `Get-NetTCPConnection -LocalPort 5173`.
- `.gitignore` ignores `*.png` (so reference photos can sit in the repo folder
  without being committed), `/pictures/` (the user's dog photos, the reference for
  the dog on the sofa), `dist/`, and `tools/studio-render/preview-*.jpg` /
  `preview-*.mp4` / `preview-*.json`. The JPEGs, MP4s **and `studio-scene.json`**
  in `frontend/src/assets/` are **meant** to be committed — the site needs them.
- Checking the studio walks (2026-09-15): headless Chrome against the Vite dev
  server with `--autoplay-policy=no-user-gesture-required`; intercept
  `/api/now-playing` with `Fetch.enable` + `Fetch.fulfillRequest` to fake a playing
  track (the hologram and album cover only show when something plays; give
  `albumArt` an SVG `data:` URI so no network is needed); click the hotspot with
  `Input.dispatchMouseEvent`. To check the overlays line up with a walk, pause the
  walk video mid-walk and seek it (`requestVideoFrameCallback` still fires on
  seeks), with `.board-plane { outline: 5px solid red }` injected: the outline must
  sit on the rendered slate. Live screenshots mid-walk can look misaligned just from
  capture timing.
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
  shot. **Don't use Chrome's one-shot `--headless --screenshot` (with
  `--virtual-time-budget`) to check a CSS-animated element**: on 2026-09-15 the
  studio note was in the DOM (`--dump-dom` showed it) but never appeared in those
  screenshots, even with `--run-all-compositor-stages-before-draw`; a DevTools-protocol
  script that navigates, waits in real time and calls `Page.captureScreenshot`
  showed it at once.
- Checking the studio video (2026-09-15): `npm run build` in `frontend/`, serve
  `frontend/dist` from a tiny Node static server with an SPA fallback **and HTTP
  Range support** (video needs it), launch Chrome with
  `--autoplay-policy=no-user-gesture-required`, and read the `<video>`'s
  `readyState` / `currentTime` / `paused` / `error` twice a few seconds apart.
  Run the Chrome driver with async `execFile`, not `execFileSync`: a sync child
  call blocks the server's event loop and the page never loads. (`npx vite
  preview` spawned through a shell from Node didn't come up in 30 s.) To judge
  motion without playing video, tile a few frames into one image with
  ffmpeg-static, e.g. `-vf "select='not(mod(n\,36))',crop=W:H:X:Y,tile=1x4"`, or
  difference-blend two frames to confirm only the letters' patch changes. To zoom
  into a render, crop and upscale with PowerShell `System.Drawing`; to zoom into a
  small overlay on the live page, `Page.captureScreenshot` with a `clip` (with
  `scale`) around its `getBoundingClientRect()`, which also gives real on-screen
  sizes to report (e.g. the prints' px on a phone).
- **Framing a camera shot** (2026-09-15): rather than guessing values, a scratch
  Node solver over candidate positions found the yaw/pitch and narrowest fov that
  keep a list of must-see world points inside the region every likely screen
  shows under `object-fit: cover`, then `studio.still()` previews with the
  projected quads and those crop rectangles drawn on confirmed it. Long renders
  are best watched with a Monitor on the render log's "frames in" / "spp in"
  lines; process detection via `ps -W` / `wmic` from Git Bash doesn't work (it
  reported a running render as exited) — rely on the background task's own exit
  notification.

## Deployment — Vercel + Neon (config written 2026-09-16, not yet deployed)
The user asked to go live before deciding what else to add ("Im not sure what i want to add to it
yet"). One Vercel project (Hobby) from the GitHub repo `Malachitopp/website-`; pushes to `main`
redeploy. Gallery items are added on the live site, not through git.
- **`vercel.json`**: `framework: null`; `regions: ["lhr1"]` (London, next to the Neon database —
  Hobby allows one region, and the default `iad1` would put every query across the Atlantic);
  install root + `frontend/`; build `npm run build` (backend `tsc` → `dist/backend`) **then** the
  frontend; output `frontend/dist`; rewrites `/api/(.*)` → `/api` and everything else →
  `/index.html` (the SPA fallback for `/studio`, `/spotify`, …; real files such as the hashed
  assets are served before rewrites run).
- **`api/index.js`** just re-exports `dist/backend/app.js`. **It must stay plain JS importing the
  compiled output.** Vercel's `@vercel/node` compiles a `.ts` function with the *project's*
  `typescript` package (checked in the CLI source: `require.resolve('typescript', { paths: [project] })`),
  and the root's TypeScript **7.0.2 has no JS API** (`transpileModule` is undefined), so a `.ts`
  entry would break the build. It works because `vercel build` runs static/framework builds
  before `@vercel/node` (`sortBuilders` in the CLI), so `dist/` exists when the function is traced.
  Express sees the original path (`/api/art`), so the routes are unchanged.
- **`src/backend/app.ts`** builds the app and exports it; **`index.ts`** only `listen(3000)`s for
  `npm start`. Verified locally: `api/index.js` served through `http.createServer` with the real
  `.env` gave 200 for now-playing, top artists and `GET /api/art`, 401 for the signature route and
  POST without the secret, 404 for an unknown route.
- **`.vercelignore`** keeps `.env`, `pictures/`, `tools/` and local builds out of any upload.
- **Considered and not used:** Vercel *Services* (`services` in vercel.json: one project with a
  frontend service and a backend service) — newer, permission-gated, unclear on Hobby; and
  Express zero-config detection, which only looks at `src/index.ts`-style paths and would fight
  the Vite frontend.
- **Env vars on Vercel** (production): `CLIENT_ID`, `CLIENT_SECRET`, `SPOTIFY_REFRESH_TOKEN`,
  `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `ART_SECRET`, and
  `DATABASE_URL` = Neon's **pooled** URL. **Do not set `ENABLE_SPOTIFY_LOGIN`** (nor
  `REDIRECT_URI` or the `POSTGRES_*` Docker vars): `/login` and `/callback` stay local-only, and
  the refresh token is tied to the Spotify app, not the machine. `.env` defines
  `SPOTIFY_REFRESH_TOKEN` **twice**, so copy values as `node --env-file=.env` resolves them (that
  is what the working local server uses). `config.ts` throws at import if a Cloudinary var is
  missing, which 500s **every** /api route, not just the art ones.
- **Database:** Neon, created by the user directly (not through Vercel's Storage tab, so
  `DATABASE_URL` has to be added to Vercel by hand). Project in `eu-west-2` (London), Postgres 18,
  db `neondb`; the direct and pooled URLs are in a **comment** in `.env` (the live `DATABASE_URL`
  there is still the local Docker one). Both connect from `pg` (checked 2026-09-16; the DB was
  empty). `pg` warns that `sslmode=require` is treated as `verify-full` — use
  `sslmode=verify-full` in the URL to say so and silence it. **The two migrations still have to
  be run on Neon** (once, in order; there is no migration runner) — an attempt from this machine
  was stopped by Claude Code's auto-mode permission check as a production change, so either the
  user approves it or pastes both files into Neon's SQL Editor. Neon and the local Docker DB are
  separate: things added locally don't appear live. Cloudinary's `art` folder is shared by both.
- The Vite `/api` proxy is dev-only; production is same-origin through the rewrite, so no CORS.
- DNS: malachitopp.com can be added in Vercel's Domains settings later; the `*.vercel.app`
  address works meanwhile.

## Current file structure (as of last update)
```
website-/                        (repo root)
├── .env                         (gitignored; see Local dev for var names)
├── .gitignore                   (*.png, /pictures/, tools/studio-render/preview-*.{jpg,mp4}, …)
├── pictures/                    (gitignored: the user's three dog photos, reference for the dog on the sofa)
├── docker-compose.yaml
├── vercel.json                  (install/build/output + /api and SPA rewrites; see Deployment)
├── .vercelignore
├── api/
│   └── index.js                 (Vercel function: re-exports dist/backend/app.js — plain JS on purpose)
├── dist/                        (gitignored backend build output from `npm run build`)
├── package.json / package-lock.json / tsconfig.json     (backend; devDependency ffmpeg-static for tools/studio-render)
├── src/
│   ├── backend/
│   │   ├── db.ts                (Pool from DATABASE_URL)
│   │   ├── app.ts               (Express app, exported; express.json(); authRouter behind ENABLE_SPOTIFY_LOGIN, spotifyRouter at /api, artRouter at /api/art)
│   │   ├── index.ts             (local only: app.listen(3000) for npm start)
│   │   ├── art/
│   │   │   ├── art.ts           (artRouter: GET /, GET /signature, POST /; requireSecret)
│   │   │   └── config.ts        (cloudinary.config() once at import; required() env guard)
│   │   ├── auth/
│   │   │   ├── auth.ts          (/login, /callback, get_accessToken)
│   │   │   └── cloudinary_auth.ts (signuploadform(): signs { timestamp, folder:'art' })
│   │   └── spotify/
│   │       ├── getCurrent.ts    (spotifyRouter, GET /now-playing)
│   │       └── getTop.ts        (adds GET /top/:type to spotifyRouter)
│   └── migrations/
│       ├── migrations_001.sql   (spotify_cache table, APPLIED 2026-09-16)
│       └── migrations_002.sql   (art table, APPLIED 2026-09-16)
├── tools/
│   └── studio-render/
│       ├── index.html           (WebGL2 path tracer: hall, both blackboards, hanging name, music corner, the candle on its crate, the sofa with the dog asleep on it, the work station — crate of books, laptop, second candle, papers; colour film post with each candle's flicker; overlay anchors)
│       ├── render.mjs           (headless-Chrome driver; shot cameras for the overview and two close-ups; writes stills, loops, walks and studio-scene.json)
│       ├── Michroma-Regular.ttf (OFL font for the hanging name; commit it)
│       └── preview-*.jpg/.mp4   (gitignored quick renders)
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
│       ├── Studio.tsx / Studio.css   (four shots, loops, walks between them via the overview, --flicker in step with the video, the dismissible "explore by pressing on things" note; all studio + music corner + laptop screen + art corner styles incl. candlelight)
│       ├── MusicCorner.tsx      (live overlay: top-artists board, notes, now-playing hologram, album cover, hotspot; --warm per lit thing; nothing drawn while the corner is behind the camera)
│       ├── Workstation.tsx      (live overlay: the laptop's home screen with its shortcuts (GitHub, Email) and clock, the hotspot)
│       ├── Easel.tsx            (live overlay: the paintings on the easel's canvas, the wall they grow into, the add-a-painting form, the hotspot)
│       ├── art.ts              (useArt / sized / uploadPainting against /api/art — routes the user is writing)
│       ├── studioScene.ts       (types for studio-scene.json; projection + matrix3d maths; candleFlicker / candleWarmth over both candles)
│       ├── spotify.ts           (useNowPlaying / useTopArtists hooks)
│       ├── SpotifyPage.tsx      (name + NowPlaying + TopArtists)
│       ├── NowPlaying.tsx       (album art with SnoopyLedge hover)
│       ├── TopArtists.tsx       (time-range buttons + ranked table)
│       ├── SnoopyLedge.tsx      (peek-over-ledge Snoopy on album hover)
│       └── assets/
│           ├── baby-me-1200.jpg / baby-me-2000.jpg   (home photo)
│           ├── studio-landscape.jpg / studio-portrait.jpg   (overview stills, from tools/studio-render)
│           ├── studio-landscape.mp4 / studio-portrait.mp4   (6 s loops of the same frames: letters sway, record turns, candles flicker, dog breathes)
│           ├── studio-music-{landscape,portrait}.jpg/.mp4   (music corner close-up still + loop)
│           ├── studio-laptop-{landscape,portrait}.jpg/.mp4  (laptop close-up still + loop: its candle's flame)
│           ├── studio-{music,laptop}-walk-{in,out}-{landscape,portrait}.mp4 (2 s / 2.6 s camera walks between the overview and each close-up)
│           ├── studio-scene.json                             (cameras per shot and per walk frame, overlay anchors, the candles' light numbers)
│           └── hero.png, react.svg, vite.svg         (unused template leftovers)
├── context/                     (this folder)
└── .claude/skills/update/SKILL.md   (the /update skill that maintains this file)
```
Reference photos (the baby HEIC, the bedroom JPEG) live one level up in
`../png files to ignore/`, outside the repo.

## Working style notes for this project
- **Backend: the user writes it.** Explain concepts, point to exact lines, give
  small example snippets, and review their code when they say they've done it —
  don't edit backend files unprompted. On 2026-09-16 I misread "Im writing up the
  endpoints now" as a handoff and wrote the whole art router; they said "dont write
  it up for me" and I backed it out. **When a message could be "here's my plan" or
  "do this", assume the former on backend work.** They did later ask me to "finish
  and fix the router" once they'd written most of it — that ask is explicit, wait
  for it. (Early on a full static site was built
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
- **The studio is meant to feel like a simple game.** Items get pressed, the
  camera walks up, the item is shown big enough to use. They describe placement in
  metres relative to existing objects and think about what's visible from where
  ("not directly behind it, but behind it so that the board is visible"). They
  describe live data as game UI ("like how in a game when you hover over an item
  it displays it above it"). They flag scope explicitly ("NOT NOW", "write that
  into the plan as a maybe") — respect it and record it in Remaining work.
- **They direct the studio like a set** ("push the chalk board back a little
  more, I want to see the light from the door poking over the top", "hang my
  name as individual letters off the ceiling lights"). Their frame of reference
  is the *committed JPEG they're looking at*, not the shader constants — check
  the two agree before judging what "a little more" means. Work the physics of
  the shot (angles, what occludes what), preview a few candidate values, pick one,
  full-render, and say what the trade-off was; they accept a judgment call plus
  an offered alternative. Sizes in the scene are in metres — reason in those.
- **Visual fidelity matters.** They pushed back when Snoopy didn't "actually look
  like Snoopy". Same standard applies to the studio: it should read as the
  *Endless* warehouse, not a generic room.
- **They spot defects precisely from the picture** ("some of the letters aren't
  connected with the ceiling", then mid-turn "the H isn't connected either").
  Zoom into the render at native resolution and check every instance of the
  problem, not only the one they named.
- **Motion words mean real motion.** They asked for letters that "sway back and
  forth a tiny amount, and rotate left to right"; a still frozen mid-swing got
  "how come you didn't make them move a little bit?". When the medium can't do
  what they described (a JPEG can't move), say so up front and build the version
  that can (here the video loop) instead of quietly delivering the closest static
  thing.
- **They sometimes run two Claude Code sessions on this repo at once.** On
  2026-09-15 a second session got the same hanging-letters request and rewrote
  `tools/studio-render/index.html` and the JPEGs mid-task. Before a big edit to a
  file with uncommitted changes, check for peer sessions and whether the file
  changed since it was read; coordinate by message and build on what's on disk.
- **They look at the studio on their real phone** (asked for the command to run
  it there, then asked for changes based on what they saw). Treat the portrait
  framing as a first-class view, and remember a change that hot-reloads reaches
  their open phone tab immediately.
- **They ask what a change costs before asking for it** ("would that take a full
  40 minute render?"). Answer with what would re-render for which kind of change
  and the time (see Render times), then do the cheapest version that gets what
  they want. Prefer overlays (no render) for live or often-changing things.
- **They leave prompts running unattended** (overnight on 2026-09-15; the PC then
  crashed) and come back asking "what changed". The session transcripts in
  `~/.claude/projects/C--StartUp-apps-my-website/*.jsonl` show the prompt and how
  far it got; compare with file mtimes and `git status`, check nothing was left
  half-written, then summarise and get the site running for them.
- **They like adding small bits of life to scenes** (sleeping Snoopy's Zs
  earlier; now asking for floating Zs and music notes in the studio). Lay out how
  it could work and ask what the source object is, rather than placing one. When
  they *do* name the object, they name real things (a Carby Musk candle from Drake's
  Better World Fragrance House): look up the actual product and model it from its
  photos.
- **They put their own life into the studio from their own photos** (2026-09-15: "go
  through the pictures in pictures. That's my dog, can you render him on a chair …
  you can even render the sofa from the pictures I uploaded"), drop the photos into
  a folder at the repo root, describe the pose from memory of how he sleeps, and
  offer more: "If you need to ask me any more questions or have me upload more
  images I can". Build from what's there, state the reading taken ("the chalk
  board" = the tagline board; chin on the arm), and when a photo doesn't show the
  thing asked for (none shows him asleep), say so and take up the offer rather than
  guessing twice. They judge likeness ("looks like him") from those photos, so check
  the model at close range with scratch cameras, not just in the 70 px overview.
- **"Zoom into the screen" = walking into the close-up** (the camera walk they once
  asked to "zoom in"). They open the dev site while a long render is still running
  and report what they see ("right now it [the candle] disappears") — during a
  render, tell them up front which shots are still the old files and that the
  overlays are off until `studio-scene.json` is written at the end.
- **They care that the lighting is consistent, not just pretty**: "the candle doesn't
  have to show, but it doesn't make sense if the light disappears". Lights in the
  scene should be driven by where the source is, never by whether it's on screen, and
  a light should reach everything they named (board, player, album art) even if that
  means cheating its strength — say so when it's cheated.
- **They want the site less grey.** The *Endless* look is black and white, but they
  found greyscale-until-hover art "too gray" and asked for the candle's light to
  bring the colours to life while keeping the hover pop. Colour motivated by a light
  in the scene is welcome; keep hover effects noticeable when changing a base look.
- **They ask "is it possible to…" before committing to a feature** (fetching the
  music video from the song URL). Answer plainly — what's possible, the route, the
  catches — and ask the one decision that's theirs (e.g. where it would play); don't
  start building. A feature needing a new backend route falls under "the user writes
  the backend".
- **Notices on the site should be closed by the visitor, not timed.** Asked for a
  message at the top of the studio, a version that faded out after a few seconds got
  "it should be one of those things that you can press an x on and it disappears".
  Default to a dismissible × for hints/banners; say plainly any extra rule added on top
  (here: it also closes once you walk up to something, and returns on each visit).
- **Small UI additions arrive as one-liners** ("add an email link for … in the laptop as
  one of the buttons"): match the existing pattern (the `SHORTCUTS` tile, the "← back"
  pill), pick the sensible details (icon, `mailto:` without a new tab), verify in
  headless Chrome on desktop and phone, and report what they'll see.
- Still learning Claude Code's own controls (asked how to stop a running prompt —
  **Esc**; triggered `/claude-api` by accident). Answer those briefly and plainly.
- Dictates via voice-to-text, so messages can be garbled — read charitably
  ("dog hot" = doghouse, "snorting" = snoring, "Yamu file" = YAML file, "pool dot
  Paul" = connection pool, "open field" = the bubble *opens up* into the scene);
  ask only when genuinely ambiguous.
- Fairly new to backends/Supabase; Postgres (via Docker migrations) is the only
  database they've used.
- The repo is now cloned directly at `C:\StartUp apps\my website` (GitHub
  `Malachitopp/website-`, branch `main`); the working directory is the repo root,
  so the project-scoped `/update` skill in `.claude/skills/update/` is picked up.
  (Earlier the clone sat in a nested `website-/` folder and a session rooted one
  level up didn't see the skill.) "Clone the updated repo into this" meant
  `git pull` — the folder was already the clone, just behind.
