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
  the studio page's background is a *rendered photo* plus a 6 s video loop of the
  same frame in which the hanging name sways — not hand-drawn SVG or CSS. The
  loops are encoded with the `ffmpeg-static` root devDependency. See the Frontend
  section for details.

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
- **`.env` keys written with a space before `=`** (`CLIENT_ID =…`) still load:
  Node's `--env-file` trims keys. But `grep '^CLIENT_ID='` misses them, which led
  an earlier session to wrongly record that those vars were missing from the
  desktop's `.env`. Grep with `'^KEY *='`.

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
- **The name moves (added 2026-09-15, after the user asked "how come you didn't
  make them move a little bit?"):** over the still sits a `<video
  class="studio-photo studio-loop">` (same `inset: 0; object-fit: cover`,
  `pointer-events: none`, `autoPlay muted loop playsInline`, `aria-hidden`)
  playing `studio-landscape.mp4` / `studio-portrait.mp4`: a 6 s seamless loop of
  the *same frame* in which only the letters sway. Frame 0 of the loop is the
  still, so the hand-over from JPEG to video is invisible, and if the video never
  loads the still simply stays. Orientation is picked in JS with a tiny
  `useMediaQuery()` (`useSyncExternalStore` on `matchMedia`, same style as the
  router) and the element gets a `key` per framing so a rotated phone loads the
  other file cleanly; `prefers-reduced-motion: reduce` renders no video at all.
  The video is a whole frame rather than a small patch positioned over the letters
  because a patch would need sub-pixel alignment with the JPEG under `object-fit:
  cover`, and browsers scale and colour-convert `<video>` and `<img>` differently,
  so any seam would show. Cost: 1.45 MB (landscape) / 1.09 MB (portrait) per
  loop; the JPEG still paints first regardless. Verified in headless Chrome
  against the production build: both framings autoplay, loop and report no media
  error.
- **What's in the scene (as of 2026-09-15):** a school blackboard on casters
  parked mid-hall reading "A theoretical / physics student" in chalk, the glow of
  the far loading door showing over its top, and the name "Malachi Topp" hanging
  letter by letter on cords from a row of the fluorescent tubes near the top of
  the frame, in an *Endless*-style extended sans, swaying gently in the video
  loop. Both are **rendered into the photo** (lit by the tubes, reflected in the
  floor), not HTML overlaid on it — see the renderer section for how. The name
  used to be on the board; the user moved it to the ceiling and gave the board
  the tagline.
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
  protocol and writes the JPEG stills **and the MP4 loops** the studio page uses.
  Run from the repo root:
  - `node tools/studio-render/render.mjs` → `frontend/src/assets/studio-landscape.jpg`
    (2400×1500, vertical FOV 58°, 1024 spp, `row=2`) and `studio-portrait.jpg`
    (1170×2340, FOV 80°, 1024 spp, `row=3`), each followed by its 144-frame
    `studio-*.mp4` loop. **Stills ~10 s each on the AMD RX 6950 XT desktop, each
    loop ~4–5 minutes there** (the Iris Xe laptop would take hours for the loops:
    use `--stills` on it). `--stills` skips the videos; `--frames N` changes the
    frame count (the loop is always 6 s, so N sets the fps).
  - `--preview` (64 spp, small) takes a few seconds and writes `preview-*.jpg`
    next to the script (gitignored); add `--frames 24` for rough `preview-*.mp4`
    loops too (also gitignored). The loop is: edit → preview → look at both JPEGs
    (and a few video frames, e.g. with ffmpeg's `select`/`tile` filters) → full
    render. For A/B comparisons, copy `index.html` + `render.mjs` into scratch
    folders with different constants and run each copy's `render.mjs` (it renders
    whatever `index.html` sits beside it, previews into its own folder).
  - **How the loops are made:** after the still, the page keeps its GL state and
    `render.mjs` calls `window.renderFrame(i, n)` for each frame. That re-poses
    the letters at time `i/n` of the loop (`pose(t)` in `hangingLetters`),
    re-renders **only the patch of the frame the letters can reach** (their padded
    world box projected to pixels plus a 40 px margin, at the same 1024 spp with
    the same per-pixel seeds), drops those samples into the still's sample buffer
    and runs the identical film look over the whole frame, so everything outside
    the patch is pixel-identical to the still and the patch's edges never show.
    Frames go to a temp dir as PNGs and are encoded by **ffmpeg-static** (root
    devDependency; the `FFMPEG` env var overrides it) as H.264 High / yuv420p
    limited-range BT.709, CRF 20, preset slow, one keyframe per loop (`-g N`),
    `+faststart`, no audio. The grain seed is fixed, so the grain is identical in
    every frame: that is what keeps the files small (only the letters change
    between frames). Sizes on 2026-09-15: landscape 1.45 MB, portrait 1.09 MB
    (about 1.9 / 1.4 Mb/s).
  - `--stats` prints GL error / exposure diagnostics; env `CHROME` overrides the
    browser path, `ANGLE` the backend (default `vulkan`; see config bugs).
  - Page query params (`render.mjs` sets them): `w`, `h`, `fov`, `spp`, `row`
    (which row of tubes the name hangs from). Debug: `?board` returns just the
    chalk texture, `?letters` just the letters' distance field (with `--stats`,
    where each letter ties on and its resting angles).
- **The scene** (metres, camera at eye level 1.6m looking down the hall): 16m wide,
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
  tone curve → extra contrast (0.45) → gamma → vignette → grain → greyscale JPEG
  q0.84. Tweak the look here, not in the shader, when possible. Everything after
  exposure is one function, `filmLook(lum, exposure)`, used for the still and for
  every video frame with the still's exposure, so a frame can never be graded
  differently from the still.
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
  choose the contents; don't populate it unprompted. The precedent so far
  (board, hanging name) is to **render objects into the scene**; making one
  clickable will mean an invisible HTML hit area positioned over the photo with
  the same fractional-coordinate trick the home-page bubble uses (separately for
  the landscape and portrait renders, whose framings differ). The video loop now
  sits over the still with `pointer-events: none`, so hit areas go above it.
- **Floating Zs (snoring) and music notes — discussed 2026-09-15, not started,
  blocked on the user.** They asked whether the renderer can do these too.
  Recommended split, which they haven't answered yet: render the *object* making
  the sound into the scene, and draw the Zs / notes as an animated SVG or CSS
  overlay positioned over the photo with the home-page bubble's
  fractional-coordinate trick. The overlay is free to iterate on and can be live:
  notes could float only while `/api/now-playing` says something is playing. The
  alternative, rendering them into the loop like the name, works technically
  (extruded glyphs, a patch covering their whole rise) but their rise needs a far
  bigger patch than the swaying letters, so loops render longer and the MP4s get
  heavier, and anything that glows would relight the whole frame and break the
  patch trick. **Open question for the user:** nothing in the studio sleeps or
  plays music yet — what would be snoring, and where does the music come from (a
  record player, a speaker…)? Don't invent it. Remember inline SVG needs
  `overflow: visible` for Zs that drift past the viewBox (see config bugs).
- **Commit the studio work from 2026-09-15**: the board move, the hanging name
  (3D letters, ink tie points, bridle, motion), `tools/studio-render/
  Michroma-Regular.ttf`, the two re-rendered JPEGs, the two new MP4 loops
  (`frontend/src/assets/studio-*.mp4`), the `ffmpeg-static` devDependency in the
  root `package.json`/lock, the `.gitignore` line for `preview-*.mp4` and the
  `Studio.tsx`/`Studio.css` video layer were all left uncommitted.
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
- Idea discussed earlier: **video background** (full-bleed `<video autoplay
  muted loop playsinline>`, `object-fit: cover`, poster + reduced-motion
  fallback). The studio now uses exactly this pattern for the letter loop; still
  an option for other pages.

## Local dev environment
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
- `.gitignore` ignores `*.png` (so reference photos can sit in the repo folder
  without being committed), `dist/`, and `tools/studio-render/preview-*.jpg` /
  `preview-*.mp4`. The JPEGs **and MP4s** in `frontend/src/assets/` are **meant**
  to be committed — the site needs them.
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
  into a render, crop and upscale with PowerShell `System.Drawing`.

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
├── .gitignore                   (*.png, tools/studio-render/preview-*.{jpg,mp4}, …)
├── docker-compose.yaml
├── dist/                        (gitignored backend build output from `npm run build`)
├── package.json / package-lock.json / tsconfig.json     (backend; devDependency ffmpeg-static for tools/studio-render)
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
│       ├── index.html           (WebGL2 path tracer: hall, blackboard, hanging name; film post)
│       ├── render.mjs           (headless-Chrome driver; writes the studio JPEGs and MP4 loops)
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
│       ├── Studio.tsx / Studio.css   (rendered warehouse photo, video loop on top, back button)
│       ├── SpotifyPage.tsx      (name + NowPlaying + TopArtists)
│       ├── NowPlaying.tsx       (album art with SnoopyLedge hover)
│       ├── TopArtists.tsx       (time-range buttons + ranked table)
│       ├── SnoopyLedge.tsx      (peek-over-ledge Snoopy on album hover)
│       └── assets/
│           ├── baby-me-1200.jpg / baby-me-2000.jpg   (home photo)
│           ├── studio-landscape.jpg / studio-portrait.jpg   (from tools/studio-render)
│           ├── studio-landscape.mp4 / studio-portrait.mp4   (6 s loops of the same frames, letters swaying)
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
- **They like adding small bits of life to scenes** (sleeping Snoopy's Zs
  earlier; now asking for floating Zs and music notes in the studio). Lay out how
  it could work and ask what the source object is, rather than placing one.
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
