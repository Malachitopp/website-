// Renders the studio warehouse with tools/studio-render/index.html in headless Chrome and
// writes everything the studio page uses, once per framing (landscape for wide screens,
// portrait for phones):
//
//   studio-<framing>.jpg / .mp4               the overview: a still, and a seamless loop of the same
//                                             frame in which the letters sway, the record turns, the
//                                             candles flicker and the dog breathes
//   studio-music-<framing>.jpg / .mp4         the same for the close-up of the music corner
//   studio-laptop-<framing>.jpg / .mp4        ...and of the laptop on the work station
//   studio-easel-<framing>.jpg / .mp4         ...and of the blank canvas on the easel
//   studio-<shot>-walk-in-<framing>.mp4       the camera walking from the overview to that close-up
//   studio-<shot>-walk-out-<framing>.mp4      ...and back
//   studio-scene.json                         every camera (frame by frame for the walks) and the
//                                             points in the scene the page pins its live overlays to
//
// The portrait overview (still and loop) is rendered wider than the phone's frame — the same
// camera and height, about 100° across instead of the frame's 46° — so the page can be swiped to
// look along the walls; the close-ups and the walks stay at the frame's size, and the middle of
// the wide picture is exactly the frame. The scene file says how wide under that framing's
// overviewSize (absent where the overview is just the frame).
//
// Loops only re-render the patches of the frame that move (see loopFrame in index.html); walk
// frames are whole renders. Run from the repo root:
//
//   node tools/studio-render/render.mjs                        everything, full quality, into frontend/src/assets
//   node tools/studio-render/render.mjs --stills               just the stills per framing (loops and walks take minutes)
//   node tools/studio-render/render.mjs --preview              small, fast stills, into this folder
//   node tools/studio-render/render.mjs --preview --frames 24 --walk-fps 10   plus rough loops and walks
//
// --only overview,music,laptop,easel,walk   render just those; walk means every walk, or
//                                     walk-music / walk-laptop / walk-easel just that one's; none
//                                     renders nothing (the scene JSON is always rewritten)
// --framing landscape|portrait  just one framing
// --frames N                    video frames per loop (default 144: 24 fps for the 6 s loop)
// --walk-fps N                  frames per second of the walks (default 30)
// --debug board|letters|desk    write the chalk textures, the letters' distance field, or the
//                               laptop's screen and the papers, and stop
// --stats                       print exposures and patch sizes
//
// The MP4s are encoded by the ffmpeg binary of the ffmpeg-static dev dependency, or by
// whatever FFMPEG points at. Set CHROME to a Chrome/Edge executable if it isn't at the
// default Windows path, and ANGLE to pick the graphics backend. Vulkan is the default:
// Chrome's D3D11 backend fails to compile this shader, and swiftshader (software) works but
// is ~20× slower.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const option = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const preview = flag('--preview')
const stills = flag('--stills')
const only = option('--only')?.split(',') ?? ['overview', 'music', 'laptop', 'easel', 'walk']
const loopFrames = option('--frames') ? Number(option('--frames')) : preview || stills ? 0 : 144
const walkFps = option('--walk-fps') ? Number(option('--walk-fps')) : preview && !option('--frames') ? 0 : stills ? 0 : 30
const chromePath = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const outDir = preview ? here : join(here, '../../frontend/src/assets')
const name = (file) => (preview ? `preview-${file}` : file)

// ---- the shots ----
// Metres, in the scene's frame: x across the hall (right is +), y up, z down the hall away
// from the front wall. fov is vertical, in degrees. The overview is the view from the door;
// music, laptop and easel are the close-ups you walk up to.
//
// The easel's camera stands on the canvas's own normal 1.55 m out at eye height, so the canvas is
// face on — the site lays a scrolling wall of my paintings straight onto it, and an oblique canvas
// would read badly for that. Its lens is then the narrowest that keeps the canvas (and a little of
// the easel above and below it) inside what every likely screen shows under object-fit: cover,
// widened a touch from that so the crate of brushes and paint comes into the bottom left. Solved
// with a scratch solve.mjs like the laptop's; checked by drawing the projected easelCanvas anchor
// on the render (it lands exactly on the rendered canvas, which is what the overlay needs).
const EYE = 1.6
const framings = {
  landscape: {
    size: preview ? [960, 600] : [2400, 1500],
    row: 2, // the row of tubes the name hangs from: the first inside this frame
    overview: { pos: [0, EYE, 0], target: [0, EYE, 1], fov: 58 },
    music: { pos: [2.0, 1.6, 6.0], target: [2.451, 1.05, 9.936], fov: 30.47 },
    laptop: { pos: [-0.764, 1.4, 10.708], target: [-1.6966, 0.4231, 12.1826], fov: 30.75 },
    easel: { pos: [-3.3659, 1.55, 9.3384], target: [-3.6431, 1.1075, 10.8561], fov: 54 },
  },
  portrait: {
    size: preview ? [390, 780] : [1170, 2340],
    row: 3, // one row further back: at this fov the front row's frame is too narrow for the name
    overview: { pos: [0, EYE, 0], target: [0, EYE, 1], fov: 80 },
    music: { pos: [1.6, 1.6, 6.0], target: [2.67, 1.233, 9.837], fov: 51.53 },
    laptop: { pos: [-0.739, 1.56, 10.609], target: [-1.5424, 0.4413, 12.0592], fov: 52.23 },
    easel: { pos: [-3.3659, 1.55, 9.3384], target: [-3.6378, 1.3, 10.8808], fov: 58 },
  },
}
// The phone's overview is rendered wider than its frame, 100° across, for looking around (see
// usePan in Studio.tsx): the same height and vertical fov, so the frame is exactly its middle.
const across = (size, fov, degrees) => [Math.round((size[1] * Math.tan((degrees * Math.PI) / 360)) / Math.tan((fov * Math.PI) / 360) / 2) * 2, size[1]]
framings.portrait.overviewSize = across(framings.portrait.size, framings.portrait.overview.fov, 100) // 3324 × 2340
// The close-ups, and how long the walk from the overview to each takes: the laptop and the easel
// are both about eleven metres from the door, the music corner about six.
const CLOSE_UPS = { music: { seconds: 2 }, laptop: { seconds: 2.6 }, easel: { seconds: 2.8 } }
const SPP = preview ? 64 : 1024
// The walks are over in a couple of seconds and the camera never stops moving, so they get fewer
// samples and two thirds of the resolution (the page scales them up): about a third of the download.
const WALK_SPP = preview ? 32 : 512
const WALK_SCALE = 2 / 3

// The walk from the overview to a close-up: seconds long, easing off and in, the head turning
// a little ahead of the body and bobbing gently with each step.
const STEPS = 4
const BOB = 0.018 // metres
function walk(from, to, seconds, fps) {
  const n = Math.round(seconds * fps) + 1
  const yawPitch = ({ pos, target }) => {
    const d = target.map((v, i) => v - pos[i])
    return [Math.atan2(d[0], d[2]), Math.atan2(d[1], Math.hypot(d[0], d[2]))]
  }
  const [yaw0, pitch0] = yawPitch(from), [yaw1, pitch1] = yawPitch(to)
  const lerp = (a, b, k) => a + (b - a) * k
  const smootherstep = (t) => t * t * t * (t * (6 * t - 15) + 10)
  const steps = Math.round((STEPS * seconds) / 2)
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const body = smootherstep(t)
    const head = smootherstep(Math.min(1, t * 1.25))
    const pos = from.pos.map((v, j) => lerp(v, to.pos[j], body))
    pos[1] -= BOB * Math.sin(Math.PI * t) * 0.5 * (1 - Math.cos(2 * Math.PI * steps * t))
    const yaw = lerp(yaw0, yaw1, head), pitch = lerp(pitch0, pitch1, head)
    const target = [pos[0] + Math.sin(yaw) * Math.cos(pitch), pos[1] + Math.sin(pitch), pos[2] + Math.cos(yaw) * Math.cos(pitch)]
    return { pos, target, fov: lerp(from.fov, to.fov, body), t: body }
  })
}

// ---- Chrome ----
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const decode = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64')

// Each job gets its own Chrome: after a couple of minutes of full-tilt GPU work the browser
// has been seen to die on the next navigation, which would otherwise leave the script waiting
// forever on a reply that never comes. fn gets call(method, ...args) for window.studio.
async function withStudio({ size: [w, h], row }, spp, fn) {
  const port = 9400 + Math.floor(Math.random() * 400)
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--allow-file-access-from-files', // the page loads the font file beside it
      `--use-angle=${process.env.ANGLE ?? 'vulkan'}`,
      '--ignore-gpu-blocklist',
      '--enable-unsafe-swiftshader',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${mkdtempSync(join(tmpdir(), 'studio-render-'))}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  try {
    let socketUrl
    for (let i = 0; i < 50 && !socketUrl; i++) {
      try {
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
        socketUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl
      } catch {
        // Chrome is still starting
      }
      if (!socketUrl) await sleep(200)
    }
    if (!socketUrl) throw new Error('Chrome did not start')

    const socket = new WebSocket(socketUrl)
    await new Promise((resolve) => socket.addEventListener('open', resolve))
    let nextId = 1
    const pending = new Map()
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id) {
        pending.get(message.id)?.resolve(message)
        pending.delete(message.id)
      } else if (message.method === 'Log.entryAdded') {
        console.log(`[browser ${message.params.entry.level}] ${message.params.entry.text}`)
      } else if (message.method === 'Runtime.consoleAPICalled') {
        console.log(`[console.${message.params.type}]`, message.params.args.map((a) => a.value ?? a.description).join(' '))
      }
    })
    socket.addEventListener('close', () => {
      for (const { reject } of pending.values()) reject(new Error('Chrome went away while rendering'))
      pending.clear()
    })
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { resolve, reject })
        socket.send(JSON.stringify({ id, method, params }))
      })
    const call = async (method, ...params) => {
      const expression = `window.studio.then((s) => s.${method}(...${JSON.stringify(params)}))`
      const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (reply.result?.exceptionDetails) throw new Error(reply.result.exceptionDetails.exception?.description ?? JSON.stringify(reply.result.exceptionDetails))
      return reply.result?.result?.value
    }
    await send('Log.enable')
    await send('Runtime.enable')

    const page = pathToFileURL(join(here, 'index.html'))
    page.search = new URLSearchParams({ w, h, spp, row }).toString()
    await send('Page.navigate', { url: page.href })
    await sleep(500)
    const result = await fn(call)
    socket.close()
    return result
  } finally {
    chrome.kill()
  }
}

// H.264 in an MP4 plays everywhere; one keyframe per video keeps it small (the page only
// ever plays them from the start), and yuv420p limited range is what browsers expect.
async function encode(dir, frames, fps, out, crf) {
  const ffmpeg = process.env.FFMPEG ?? (await import('ffmpeg-static')).default
  const params = [
    '-y', '-loglevel', 'error',
    '-framerate', String(fps), '-i', join(dir, 'f%03d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high',
    '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-g', String(frames), '-keyint_min', String(frames), '-sc_threshold', '0',
    '-movflags', '+faststart', '-an', out,
  ]
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, params, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))))
  })
}

// Renders frames one by one into a temp folder with render(i) and encodes them.
async function video(file, count, fps, crf, render) {
  const dir = mkdtempSync(join(tmpdir(), 'studio-frames-'))
  const started = Date.now()
  for (let i = 0; i < count; i++) {
    writeFileSync(join(dir, `f${String(i).padStart(3, '0')}.png`), decode(await render(i)))
    process.stdout.write(`\r${file}: frame ${i + 1}/${count}`)
  }
  process.stdout.write('\n')
  await encode(dir, count, fps, join(outDir, file), crf)
  rmSync(dir, { recursive: true, force: true })
  console.log(`${file}: ${count} frames in ${Math.round((Date.now() - started) / 1000)} s`)
}

// ---- the scene file ----
const round = (v) => (Array.isArray(v) ? v.map(round) : typeof v === 'number' ? +v.toFixed(5) : v)
const lookAt = ({ pos, target, fov }) => {
  const norm = (a) => a.map((v) => v / Math.hypot(...a))
  const fwd = norm(target.map((v, i) => v - pos[i]))
  const right = norm([fwd[2], 0, -fwd[0]]) // up × fwd, with up = y
  const up = [fwd[1] * right[2] - fwd[2] * right[1], fwd[2] * right[0] - fwd[0] * right[2], fwd[0] * right[1] - fwd[1] * right[0]]
  return round({ pos, right, up, fwd, tanY: Math.tan((fov * Math.PI) / 360) })
}
const sceneFile = join(outDir, name('studio-scene.json'))
const previous = existsSync(sceneFile) ? JSON.parse(readFileSync(sceneFile, 'utf8')) : {}

// ---- go ----
const chosen = option('--framing') ? [option('--framing')] : Object.keys(framings)
const fps = walkFps || previous.walkFps || 30
const scene = { ...previous, walkFps: fps }

if (option('--debug')) {
  const kind = option('--debug')
  await withStudio(framings.landscape, 1, async (call) => {
    if (kind === 'letters') {
      const { layout, jpeg } = await call('letters')
      writeFileSync(join(here, 'preview-debug-letters.jpg'), decode(jpeg))
      console.log(layout)
    } else if (kind === 'desk') {
      writeFileSync(join(here, 'preview-debug-screen.jpg'), decode((await call('screen')).jpeg))
      writeFileSync(join(here, 'preview-debug-paper.jpg'), decode((await call('paper')).jpeg))
    } else {
      writeFileSync(join(here, 'preview-debug-board.jpg'), decode((await call('board', true)).jpeg))
      writeFileSync(join(here, 'preview-debug-board2.jpg'), decode((await call('board', false)).jpeg))
    }
  })
  process.exit(0)
}

for (const key of chosen) {
  const framing = framings[key]
  const exposure = { ...previous[key]?.exposure }

  // a still, then its loop; exposure: the overview sets the level for the whole framing,
  // each close-up gets its own (the walk adapts from one to the other, as eyes do). A
  // close-up's still is taken at the moment its walk in arrives. The overview may be wider than
  // the frame (overviewSize); its loop is rendered in the same Chrome, so frame 0 is the still.
  const shot = (view, still, loop, level) => {
    const size = (view === 'overview' && framing.overviewSize) || framing.size
    return withStudio({ ...framing, size }, SPP, async (call) => {
      const info = await call('still', { camera: framing[view], time: CLOSE_UPS[view]?.seconds ?? 0, exposure: level })
      writeFileSync(join(outDir, still), decode(info.jpeg))
      console.log(`${still}: ${size.join('×')}, ${SPP} spp in ${info.renderMs} ms, exposure ${info.exposure.toFixed(3)} (auto ${info.autoExposure.toFixed(3)})`)
      if (flag('--stats')) console.log(info.patches)
      if (loopFrames > 0) await video(loop, loopFrames, loopFrames / 6, 20, (i) => call('loopFrame', i, loopFrames))
      return info
    })
  }

  if (only.includes('overview')) exposure.overview = (await shot('overview', name(`studio-${key}.jpg`), name(`studio-${key}.mp4`))).exposure
  for (const view of Object.keys(CLOSE_UPS)) {
    if (only.includes(view)) exposure[view] = (await shot(view, name(`studio-${view}-${key}.jpg`), name(`studio-${view}-${key}.mp4`))).exposure
  }

  const walks = {}
  for (const [view, { seconds }] of Object.entries(CLOSE_UPS)) {
    const path = walk(framing.overview, framing[view], seconds, fps)
    walks[view] = { seconds, fps, cameras: path.map(lookAt) }
    if ((only.includes('walk') || only.includes(`walk-${view}`)) && walkFps > 0) {
      if (!exposure.overview || !exposure[view]) throw new Error(`render the ${key} overview and ${view} stills before its walks`)
      // Exposure follows the walk in log space. Everything that moves keeps moving forwards in time
      // both ways, and each walk ends at exactly the moment of the still it arrives at: in runs from
      // 0 to the walk's seconds (the close-up's still is rendered at that moment), out from minus
      // that to 0 (the overview still). The record turns once every 2 s, so the music walks also
      // start where the still they leave has the record; the laptop can't see it.
      const level = (t) => Math.exp(Math.log(exposure.overview) + (Math.log(exposure[view]) - Math.log(exposure.overview)) * t)
      const frames = path.length
      const small = { ...framing, size: framing.size.map((v) => Math.round((v * WALK_SCALE) / 2) * 2) }
      await withStudio(small, WALK_SPP, async (call) => {
        await video(name(`studio-${view}-walk-in-${key}.mp4`), frames, walkFps, 24, (i) =>
          call('frame', { camera: path[i], time: i / walkFps, spp: WALK_SPP, exposure: level(path[i].t) }))
      })
      await withStudio(small, WALK_SPP, async (call) => {
        await video(name(`studio-${view}-walk-out-${key}.mp4`), frames, walkFps, 24, (i) => {
          const c = path[frames - 1 - i]
          return call('frame', { camera: c, time: (i - (frames - 1)) / walkFps, spp: WALK_SPP, exposure: level(c.t) })
        })
      })
    }
  }

  scene[key] = {
    size: framing.size,
    ...(framing.overviewSize && { overviewSize: framing.overviewSize }),
    exposure,
    overview: lookAt(framing.overview),
    ...Object.fromEntries(Object.keys(CLOSE_UPS).map((view) => [view, lookAt(framing[view])])),
    walks,
  }
}
delete scene.walk // the old shape of the file: one walk, its seconds and fps at the top level

// the anchors come from the shader's constants, so ask the page for them, and the candles'
// flicker and strength, which the site lights its own things by
const { anchors, loopSeconds, candle } = await withStudio(framings.landscape, 1, (call) => call('info'))
scene.anchors = anchors
scene.loopSeconds = loopSeconds
scene.candle = candle
writeFileSync(sceneFile, JSON.stringify(scene, null, 1))
console.log(`${name('studio-scene.json')} written`)
