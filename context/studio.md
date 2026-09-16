# The studio — overlays, scene and renderer

Read this only when the task touches `/studio…`, `tools/studio-render/`, or the studio assets.
Project overview and working style: `context/PROJECT.md`.

**The core rule:** the studio's pictures are **build outputs of the shader** (`tools/studio-render/index.html`).
Re-render after every scene change and **commit the renders together with the shader** — otherwise the
committed JPEGs drift from the code. Everything live (Spotify data, laptop screen, gallery) is HTML laid over
the renders using the renderer's own camera maths, so overlay changes need **no render**.

## The page (`frontend/src/Studio.tsx` + `Studio.css`)
- **Shots**: `overview` (from the door) and the close-ups `music`, `laptop`, `easel`. Each is a `<picture>`
  still (portrait render via `<source media="(orientation: portrait)">`) with a seamless 6 s loop `<video>`
  over it (`autoPlay muted loop playsInline`); frame 0 of each loop is its still. Framing is chosen in JS with
  `useMediaQuery()`; tall screens get separately framed portrait renders, not crops. Layers are `.studio-shot`
  with `object-fit: cover`.
- **Swipe to look around (phones, 2026-09-17)**: the portrait overview still + loop are rendered **wide**
  (`portrait.overviewSize` = 3324×2340, 100° across; `render.mjs` `across()`), drawn at the normal frame's
  cover scale so the middle is pixel-identical to the walks' first/last frame, and panned by `usePan()` in
  `Studio.tsx` (pointer drag, 6 px press-vs-drag threshold, light coast unless reduced motion; `<main>` is
  `.is-wide`). `Lens.pan` (px) is subtracted in `project()`/`planeTransform()`, so hotspots and overlays
  follow. Tapping an item `settle()`s the pan to 0 in 250 ms, then the walk plays unchanged. Only active when
  the loaded still really is wider than the frame (`wideStill` from `naturalWidth`), so an old 1170-px still
  degrades to the plain page. Hint reads "swipe to look around, press things" there. Known: the hologram keeps
  its stay-on-screen clamp, so panned away from the corner it sits at the screen edge. Desktop doesn't pan.
- **Walks**: the URL is the truth. `PATHS` maps paths to `CloseUp`s; a state machine (`view` = settled shot,
  `walk` = `{ from, to, framing, playing, ended }`, adjusted *during render* so `set-state-in-effect` stays
  happy) starts a walk when path and view disagree. **Every walk starts or ends at the overview** (close-up →
  close-up is two walks). One persistent preloaded `<video class="studio-walk">` per close-up holds the next
  possible walk; it plays, covers everything once `playing`, and on `ended` waits for the destination still's
  `onLoad`. Can't play / not playing after 4 s → cut straight there. "← back" and Escape → `history.back()` if
  we walked in from `/studio`, else `navigate('/studio')`. Reduced motion: no loops or walks, a 0.35 s fade.
- **Overlays follow the video frame by frame**: `followFrames()` (`requestVideoFrameCallback`, rAF fallback)
  gives `mediaTime`; `round(mediaTime × fps)` indexes per-frame cameras in `studio-scene.json` (walking out plays
  them backwards). The music candle's flicker follows too: `--flicker = candleFlicker(scene time)` written on
  `.studio`'s style. Scene time: overview loop = `mediaTime`; close-up loop = walk `seconds + mediaTime`; walk
  in = `mediaTime`; walk out = `mediaTime − seconds`.
- **"explore by pressing on things" note**: `.studio-hint` pill with a × button; shows the first time the
  overview is settled, closes on × or when you set off towards an item, not remembered between visits. At
  ≤ 520 px it sits under the back button.
- **`studioScene.ts`**: types for `studio-scene.json` + projection identical to the shader's camera
  (`k = coverScale × renderHeight / (2·tanY)`); `planeTransform()` → a `matrix3d` laying a W×H px element
  (`transform-origin: 0 0`) onto a world quad; `visiblePart()` finds which part of a quad is on screen;
  `candleWarmth(point, normal)` computes each candle's light share like the shader, summed over both candles,
  against `TUBE_LIGHT = 0.45`.
- **`MusicCorner.tsx`** (one `.studio-overlay`, `pointer-events: none`):
  - *Board*: 2000×1000 px element (1 px = 1 mm) on the music slate via `planeTransform`, `inert` unless at the
    close-up. Five prints across (`.is-compact` three-and-two fallback). Chalk buttons "past 4 weeks" /
    "past 6 months"; A4 prints with a magnet and tilt, link to Spotify, "1. Name" in chalk (Kalam +
    `feTurbulence` speckle via `background-clip: text`). Old list at 35 % while loading; "couldn't reach
    spotify" on failure.
  - *Notes*: six SVG notes rising off the record, sized in `--cm` (px per cm at the record).
  - *Hologram*: when something plays (polled 10 s), a cyan see-through "NOW PLAYING" panel (Michroma, equaliser
    bars) on a light beam; 30 cm above the record up close, rising to 1.45 m from across the hall.
  - *Album cover*: a 314 mm sleeve on `anchors.albumCover` leaning 14° against the crate's right side, with a
    shadow on `anchors.albumShadow`; not rendered, pure overlay.
  - *Candlelight*: a layout effect sets `--warm` on every `[data-lit]` element from its board position. CSS:
    `grayscale((1 − warm)²)` on images, a soft-light warm wash at `opacity: warm × flicker`. Hover pop: full
    colour, `saturate(1.4) contrast(1.08) brightness(1.06)`, lift 10 px, scale 1.06. **The light never depends
    on the candle being on screen.**
  - *Hotspot*: transparent button over the corner's projected box from the overview.
- **`Workstation.tsx`**: the screen (1192×745 px, 4 px = 1 mm) on `anchors.laptopScreen`, mounted only while
  settled at `/studio/laptop`: a `.lock-screen` matching the render fades away after 0.4 s to a `.home-screen`
  (overview still as wallpaper, menu bar "malachi's laptop" + clock, tiles from `SHORTCUTS` =
  `{ name, href, mark, title? }` — GitHub `https://github.com/Malachitopp`, Email
  `mailto:malachi.topp@malachitopp.com`; `target="_blank"` except `mailto:`). Sizes are `calc(Npx / var(--px))`
  so tiles are 84 real px on any screen. Hotspot over `anchors.workstation`.
- **`Easel.tsx` + `art.ts`**:
  - *Canvas* (`CanvasFace`, 700×900 px on `anchors.easelCanvas`): the first six images fade on 0.35 s after
    arriving as a two-across contact sheet (grid `grid-auto-rows: 1fr` + `object-fit: cover`), labelled
    "gallery"; the whole thing is `<a href="/studio/easel/gallery">`.
  - *Wall* (`Wall`): `position: fixed` canvas-coloured surface with an oak border, masonry via
    `columns: 250px 5` + `break-inside: avoid`, each pin with its own `aspect-ratio`. It **grows out of the
    canvas** (`canvasOnScreen(lens)` → `transform-origin` + starting scale) and stays mounted while at the easel,
    hidden with `visibility` in the transition list, so it animates both ways.
  - `/studio/easel/gallery` = easel shot with the wall up; back closes it. Escape closes the add form, then the wall.
  - *Adding*: visitors see no way in. A faint `+` (22 % opacity, 30 px target) or **shift+A** opens `Unlock`,
    which checks the word via `verifySecret` (a signature request) and keeps it in `sessionStorage`; then an
    "add one" button. `uploadPainting`: signature → file straight to Cloudinary → POST the row. If `/api/art`
    fails, the wall says "nothing up here yet".
  - `art.ts`: `useArt(enabled)` (no fetch until wanted), `sized(url, width)` splices `w_<n>,q_auto,f_auto`,
    `verifySecret`, secret helpers. Code names (`Painting`, `art` table) stay; **visible wording says "gallery"**.
  - Hotspot over `anchors.artCorner`, never smaller than 44 px.

### Adding a new studio item (the easel is the worked example)
A camera per framing + a `CLOSE_UPS` entry in `render.mjs`; anchors out of `info()` in the shader; a `CloseUp`
in `studioScene.ts`; assets / `SHOTS` / `ALT` entries and a `PATHS` route in `Studio.tsx`; a case in `App.tsx`;
an overlay component. **Assets must exist as files before `Studio.tsx` imports them** (stand-ins from another
shot are fine during the render), and **new `studio-scene.json` fields must be patched into the committed file
(same maths as `info()`) before code that reads them ships** — the renderer only rewrites the JSON at the end of
a run, and there's no error boundary.

## What's in the scene (metres; z runs from the door down the hall)
- **Hall**: 16 m wide, 55 m long, 6.4 m high; 16 × 4 rows of hanging fluorescent tubes; stud framing on the
  right wall, stained white wall with painted-over doorways on the left; glowing roller door at z = 52
  (`DOOR_H` 4 m); sealed concrete with a narrow glossy reflection. Only tubes, door, candles and the laptop
  screen emit.
- **Tagline board** `BOARD_POS (0.1, 0, 12)` yawed 10°: 2×1 m slate on a wheeled stand, chalk tray, chalk dust
  on the floor; writing is a canvas texture (`boardTexture()`, "A theoretical / physics student"). At 12 m the
  door glow pokes over its top — for more door light the lever is `DOOR_H`, not board distance.
- **Hanging name** "Malachi Topp": 11 letters extruded from a glyph signed distance field (Michroma, stroked
  to look bold), each on a cord tied to the glyph's ink (the "M" gets a bridle), each word from its own tube
  (why the name sits ~0.5 m left of centre). In the loops each letter twists/swings with per-letter phase,
  every term zero at t = 0. The layout **throws** if a wire misses a tube. Portrait uses tube row 3
  (`row` param).
- **Music corner**: crate + turntable `TABLE_POS (1.81, 0, 10.98)` yawed 30° (record spins 3× per 6 s loop);
  second board `BOARD2_POS (3.25, 0, 12.55)` yawed 20°, blank slate the site writes on; vinyl reflections capped
  at 3 per sample (uncapped looked like glitter).
- **Music candle**: a real-size Carby Musk jar (Better World Fragrance House: navy glass, gold print) on a plywood
  crate at (1.30, −0.50) in the music board's frame.
- **Sofa + dog** `SOFA_POS (-2.35, 0, 11.1)` yawed −16°: 1.64 m fleece loveseat and the user's black
  schnauzer-type dog lying along it, chin on the right arm, all one SDF (`sofaSDF`, `dogSDF`; 192 steps + a
  3 mm acceptance). He breathes in the loops (`uBreath`, patch `dogBox`). Modelled from `pictures/` (all photos
  show him awake — ask for an asleep one before refining). `anchors.sofa`, `anchors.dogHead` exist, unused.
- **Work station** `DESK_POS (−1.15, 0, 11.3)` yawed −25°: 50 × 40 × 90 cm crate of books, a 14" laptop (SDF,
  lid open 110°) whose screen is emissive (`screenLight()`, texture = GitHub mark in neutral grey), the second
  candle on its *left* (on the right it flooded the tagline slate), a pencil, and physics/system-design papers on
  the floor (`paperTexture()`: Dirac equation, Lorentz boost, a system diagram, the site's now-playing sequence).
  Bezel albedo 0.02 (at 0.05 it rendered tan next to the candle).
- **Art corner** `ART_POS (-3.62, 0, 10.78)` yawed −10°, at the sofa's front-left: a lyre easel (mast leans 6°
  as one piece in `easelLocal`), canvases in one table (`CANVAS_POS` + `CANVAS_FORM`; a 90° lean lays one flat),
  all but the easel's splattered (`CSPLAT`), a fourth oak crate with a tin of brushes, paint tubes, a rag; a
  palette leaning on it. Floor/sofa paint is colour only (`SPLAT`, `splatMask` with drips and droplets). Its
  position is pinned by the phone's portrait crop (the canvas's left corner must stay inside 0.88 of the half-width).
- **Colour**: `M_WOOD`/`M_EASEL` × `OAK (1, 0.74, 0.46)` on **all** crates; paint, tubes, palette, brushes in
  colour; hall, boards, letters, concrete, sofa, dog stay grey. Warm crates bounce warm light — levers are `OAK`
  and `grade.candle2`.
- **Miles Morales rug (in the shader, not rendered)**: the *Across the Spider-Verse* emblem traced into an SVG
  path (`RUG`, via a scratch `trace-logo.mjs`) → distance field on texture unit 9 (`uRug`). **6 m long, 4.95 m
  across**, `RUG_POS (0.15, 7.6)`, `RUG_LEN 6.0`, head end 1.4 m before the tagline board. Floor hits inside
  become `M_RUG = 50` (matt pile, `rugSurface()`, `RUG_RED`), with a contact shadow outside the edge. Noise
  inputs are relative to `RUG_POS` (`hash2` degenerates on big floats). Approved at 6 m and rendered 2026-09-16.
- **Armour row** (2026-09-16/17, scenery for now; "maybe zoom in later"): three all-glass display cases
  (`DESIGN = 2`; 0 = open alcoves and 1 = steel-fronted cases are still in the code) in a row against the
  **left wall**, `ROW_Z = 16.6`, row frame `rowLocal()` (x along the wall, + towards the door; z out into the
  hall), bay pitch 1.1 m. Each: thin steel frame, base and lid, lit two-step plinth (`M_LED`), light strips up
  the front posts, lit slats in the back panel (emissive `M_BAY_BACK`), a header light panel sampled directly
  by `bayLight()` (`M_DOWNLIGHT`, `BAY_LE`), glass `M_PANE` (fresnel reflect / tinted pass-through; shadow
  rays skip panes via `skipPanes`). Suits are SDF mannequins (`mannequin()`, 180-step march, sofa-style
  3 mm acceptance) + per-suit extras: **Iron Man Mark VII** (bay 2, nearest the door: `ironPlates()`,
  reactor well and eye slits `M_SUIT_GLOW`, painted seams), **Miles Morales** (bay 1: red `webbing()`,
  the rug's spider field on the chest, red fingertips/soles), **Batman** (bay 0: `batExtras()`, `suitCape()`
  with folds, `batShape` emblem). Materials `M_BAY … M_CAPE` (51–59). Colour zones in `suitSurface()`.
- **Vines** (ref: a Pinterest photo of climbing roses on a stone cottage): a heightfield relief on the left
  wall (`vineT`: woody stems `vineLane`, ovate leaves `vineLeaf` on three 5 cm grids, roses `vineRoseT` in
  cluster-noise patches), a mass at the ceiling, strands over the row stopping ≥ 10 cm above the cases,
  curtains to the floor either side (`vineFrameHW/Top/Front`). `M_VINE = 60`, one inlined march in `vines()`
  (the first version took the driver 11 min to compile; now ~4 min, then the AMD Vulkan pipeline cache makes
  it instant, so a run's first job can look stuck). Leaves are relief, nothing sticks out; fine from the door.

## The renderer (`tools/studio-render/`)
- `index.html`: one WebGL2 fragment shader path tracer, progressive accumulation into ping-pong float textures,
  1 spp per frame, 4 bounces, next-event estimation over the tubes (+ a glossy lobe sampler). Draws split into
  bands sized by the last band's time (starts 100 000 px) so the Windows GPU watchdog (~2 s) isn't tripped.
  The camera is uniforms (`uCamPos/Right/Up/Fwd`, `uTanY`); cameras are `{ pos, target, fov }` (vertical fov).
- **Three MRT targets per buffer**: 0 = tubes + door light; 1 = music candle light (+ flame in alpha);
  2 = work-station candle. `pickCandle` picks one candle per shading point (never one with zero weight).
- **Page API** (via DevTools protocol from `render.mjs`): `still({camera, time, exposure})`, `loopFrame(i, n)`,
  `frame(...)`, `info()` (GPU, loop length, anchors, candle data), debug `letters()` / `board()` / `screen()` /
  `paper()`, and `grade({...})` + `regrade()` to re-grade the last still without rendering.
- **Post (JS)**: average → auto-exposure (median pixel at 0.34, **judged on each pixel's brightest channel**
  and on the tubes' light only) → 3×3 firefly clamp → bloom → ACES-style curve → contrast 0.45 → gamma →
  vignette → fixed-seed grain → JPEG q0.84. Everything after exposure is `filmLook()`, shared by stills and
  every video frame. Candles are added per channel with `grade.candle` (music 22, work station `candle2` 12 —
  lowered so the tagline chalk stays readable) × `flicker(t, i)` (five sines, whole cycles per 6 s); flames go
  in after the firefly clamp. Candle light is deliberately far stronger than a real candle, with softened
  fall-off (`CANDLE_SOFT 0.7`) and a 5.4–9 m reach fade. `jarGlow` is tuned for `candle = 22`.
- **Loops**: after a still, `loopFrame(i, n)` re-poses moving things and re-renders **only patches** (letters'
  box, record, each flame, the dog's chest; projected, clipped to the near plane, +40 px) with the same seeds, so
  the rest is pixel-identical — that's what keeps loop MP4s small. Encoded with **ffmpeg-static** (or `FFMPEG`
  env): H.264 High yuv420p BT.709, preset slow, one keyframe, `+faststart`, CRF 20 loops / 24 walks.
- **Walks** (`walk()`): smootherstep body, head turning slightly ahead, fov and log-exposure interpolated,
  1.8 cm head bob. Music 2 s, laptop 2.6 s, easel 2.8 s (`CLOSE_UPS[shot].seconds`), 30 fps, 512 spp, ⅔
  resolution. Each walk ends exactly on its destination still's moment (close-up stills are rendered at
  t = walk seconds; walk out runs t = −seconds → 0).

### Running it (from the repo root, on the desktop — the laptop's Iris Xe can only do `--stills`)
- `node tools/studio-render/render.mjs` → for landscape (2400×1500) and portrait (1170×2340) into
  `frontend/src/assets/`: overview + each close-up still (1024 spp) and 144-frame loop, walk in/out per
  close-up, then `studio-scene.json`.
- Options: `--stills`, `--only overview,music,laptop,easel,walk` (`walk-music` etc. for one; `none` = only
  rewrite the JSON from `info()`, ~10 s), `--framing landscape|portrait`, `--frames N`, `--walk-fps N`,
  `--debug board|letters|desk`, `--stats` (exposures, patch rects), `--preview` (64 spp, small, writes gitignored
  `preview-studio-*` next to the script). Env `CHROME`, `ANGLE` (default `vulkan`).
- **Workflow**: edit → `--preview` of **both framings** → look (tile video frames with ffmpeg `select`/`tile`)
  → agree placement with the user → full render. (A whole 3 h run was thrown away when the user moved the easel
  after it started.)
- **Cost (RX 6950 XT). Before the armour row (2026-09-16): ≈ 3 h for everything.** Stills 18–39 s. Loops
  (landscape / portrait): overview 1041 / 747 s, music 419 / 355, laptop 932 / 269, easel 815 / 174. Walks
  ≈ 400 s (music), ≈ 680 s (laptop), ≈ 620 s (easel) each in landscape; ~70 % of that in portrait.
  **With the row + vines (2026-09-17) frames that see them cost ~2.5×**: overview still 80 s, loop 1979 s
  (wide portrait: 152 s + 2734 s), easel 106 s + 1116 s, walks 1097 (music) / 1610 (laptop) / 1903 (easel) s
  landscape, ~70 % in portrait; the run `--only overview,easel,walk` + portrait `overview,music,easel,walk`
  took **6 h 20 min**. A full re-render is now ≈ 8 h; budget accordingly. Exposures landscape
  1.976 / 1.831 / 1.759 / 1.631, portrait 1.988 / 1.970 / 1.842 / 1.491 (overview / music / laptop / easel).
  The laptop close-ups (both) and the landscape music close-up predate the row (they can't see it).
- **What a change costs**: overlay HTML/CSS → nothing. Walk path/easing → `--only walk`. A close-up's camera →
  `--only <shot>,walk-<shot>`. Candle strength/colour/flicker → post-only but every frame, i.e. a full render
  (preview with `studio.grade` in seconds). Something the overview sees → overview + walks + any close-up that
  sees it. The rug → `--only overview,music,walk` (the laptop close-up can't see the floor, the easel faces
  away). The armour row / vines → `--only overview,easel,walk` (the easel's landscape close-up has the row
  ~27° left of its axis; music and laptop close-ups can't see it).
- **Cameras** (`render.mjs`): overview `pos [0, 1.6, 0]` down +z, fov 58 landscape / 80 portrait. Music landscape
  `[2.0, 1.6, 6.0] → [2.451, 1.05, 9.936]` fov 30.47, portrait `[1.6, 1.6, 6.0] → [2.67, 1.233, 9.837]` fov
  51.53. Laptop landscape `[-0.764, 1.4, 10.708] → [-1.6966, 0.4231, 12.1826]` fov 30.75, portrait
  `[-0.739, 1.56, 10.609] → [-1.5424, 0.4413, 12.0592]` fov 52.23. Easel `pos [-3.5459, 1.55, 10.7084]` (on the
  canvas's normal, face-on for the wall), landscape `→ [-3.8231, 1.1075, 12.2261]` fov 54, portrait
  `→ [-3.8178, 1.3, 12.2508]` fov 58. **Framing method**: a scratch Node solver finds the narrowest fov keeping a
  list of must-see points inside every likely `cover` crop (aspect 1.4–2.1 landscape, 0.44–0.6 portrait, a few %
  margin), then preview with the projected anchors drawn on.
- **`studio-scene.json`**: top level `loopSeconds`, `walkFps`, `anchors`, `candle` (`flicker`, `strength`,
  `soft`, `reach`, `rgb`, `radius`, `jars: [{ flame, rim, light }]` — 0 music, 1 work station); per framing
  `{ size, exposure: {overview, music, laptop, easel}, overview, music, laptop, easel, walks: { <shot>: { seconds,
  fps, cameras[] } } }`. Where a run dies, the JSON keeps the previous exposures.

## Renderer and studio gotchas
- **Chrome's D3D11 can't compile the shader** (all black, `GL_INVALID_OPERATION`): `render.mjs` uses
  `--use-angle=vulkan` (swiftshader works, ~20× slower). ANGLE compiles on the first draw, so a job's first still
  can take tens of seconds.
- `@font-face` from `file://` is blocked — `render.mjs` passes `--allow-file-access-from-files`; the page throws
  if Michroma didn't load.
- **Don't edit `index.html` while a render runs** — each job reloads it from disk, so later jobs change. Check
  first: `Get-CimInstance Win32_Process` filtered on the command line for `render.mjs`. (`ps -W`/`wmic` from Git
  Bash misreport; rely on a background task's exit notification.)
- **Don't render anything else on the GPU while a full render runs.** Preview stills from a scratch copy
  (≈ 3 min each under contention) alongside the 2026-09-16 rug render ended it with `GL error 37442`
  (WebGL context lost) at the start of a job, ≈ 1½ h in. Each job is its own Chrome, so the finished
  files survived; the run's JSON rewrite didn't happen. Do preview work before or after, never during.
- **A render overwrites the uncommitted assets in place**, so a bad run costs the last good files; frame 0 of a
  loop MP4 is the still at video quality if a stand-in is needed. Commit renders promptly.
- **Mid-render the dev site is inconsistent**: new images with old cameras until `studio-scene.json` is written
  at the end. Vite also reloads the page whenever a render rewrites an imported asset.
- **Fields the site reads must come from `info()`** — the run's last step rewrites the JSON, dropping hand-added
  fields (`candle.jar` was lost that way).
- **One non-finite sample blackens most of a frame** (post's box blurs carry running sums). Guarded now; a good
  2400×1500 still is ≈ 450 KB — a much smaller one is suspect.
- `flat` is reserved in GLSL ES 3.00. **Material names are one flat namespace** (`M_TUBE` is the lights; the paint
  tube is `M_PAINT_TUBE`) — grep the `M_` list first.
- **A thing traced inside another's bounding slab must fit in it** (the laptop lid's top 6 cm was cut off). Check
  new geometry by drawing the projected anchor quad on a peek — it must sit inside the rendered object.
- A "black" surface next to a candle isn't black — test a material by rendering it at albedo 0.
- `yawWorld(pos, c, s, [x, y, z])` ignores `pos[1]` — put heights in the corners, not the origin (both flames'
  patches once landed at floor level).
- `rnd()` can return exactly 1.0 — never let a zero-weight choice be pickable.
- SVG `vector-effect: non-scaling-stroke` breaks `pathLength` dash animation.
- **Phones: don't fit the render to the screen height** — a phone's visible area is usually wider than 1:2, so
  that showed black bars the user called horrible. Keep `object-fit: cover`.
- **An overlay must not draw a point behind the camera** — `project()` returns a mirrored position. Guard with
  `z > 0` (`MusicCorner` checks the record and the board separately).
- **Effects that decorate DOM inside a conditionally drawn overlay need the condition in their deps** (the board
  remounts after being behind the camera; without `boardInView` in the deps the prints went grey; fixed in
  `8ce8c73`).
- CSS `columns` in a fixed-height box doesn't balance — use a grid with `grid-auto-rows: 1fr`.
- `render.mjs` progress uses `\r`: watch logs with `sed -u 's/\r/\n/g'`, not `tr`.
- `ffmpeg-static`'s install script may warn under npm 11's allowScripts; if `ffmpeg.exe` is missing, run
  `npm install-scripts approve ffmpeg-static` and reinstall, or set `FFMPEG`.

## Checking studio changes
- Headless Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`) driven over the DevTools protocol from
  small Node scripts in the session scratchpad: `Emulation.setDeviceMetricsOverride` (`mobile: true` for phones),
  `setEmulatedMedia` for reduced motion, `Input.dispatchMouseEvent` to click, `Page.captureScreenshot` (with `clip`
  to zoom an overlay). Take a warm-up shot after a CSS edit. **Don't use one-shot `--headless --screenshot`** for
  animated elements — they don't appear.
- Walks: `--autoplay-policy=no-user-gesture-required`; fake a playing track with `Fetch.enable` +
  `Fetch.fulfillRequest` on `/api/now-playing` (albumArt as an SVG `data:` URI). To check alignment, pause and seek
  the walk video with `.board-plane { outline: 5px solid red }` injected. A "settled" test must also require a
  hotspot to exist (right after Escape the old state briefly looks settled).
- Videos in a production build: serve `frontend/dist` with SPA fallback **and HTTP Range**; drive Chrome with async
  `execFile` (sync blocks the server). Crop/zoom renders with PowerShell `System.Drawing`.
- Scratch tools worth recreating: `peek.mjs` (close-up cameras on any object), `solve.mjs` (framing solver),
  `regrade.mjs` (compare grade values on one still), `debug-still.mjs`.
