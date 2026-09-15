// Renders the studio warehouse with tools/studio-render/index.html in headless Chrome and
// writes everything the studio page uses, once per framing (landscape for wide screens,
// portrait for phones):
//
//   studio-<framing>.jpg / .mp4           the overview: a still, and a seamless loop of the same
//                                         frame in which the letters sway, the record turns and
//                                         the candle flickers
//   studio-music-<framing>.jpg / .mp4     the same for the close-up of the music corner
//   studio-walk-in-<framing>.mp4          the camera walking from the overview to the close-up
//   studio-walk-out-<framing>.mp4         ...and back
//   studio-scene.json                     every camera (frame by frame for the walks) and the
//                                         points in the scene the page pins its live overlays to
//
// Loops only re-render the patches of the frame that move (see loopFrame in index.html); walk
// frames are whole renders. Run from the repo root:
//
//   node tools/studio-render/render.mjs                        everything, full quality, into frontend/src/assets
//   node tools/studio-render/render.mjs --stills               just the two stills per framing (loops and walks take minutes)
//   node tools/studio-render/render.mjs --preview              small, fast stills, into this folder
//   node tools/studio-render/render.mjs --preview --frames 24 --walk-fps 10   plus rough loops and walks
//
// --only overview,music,walk    render just those (the scene JSON is always rewritten)
// --framing landscape|portrait  just one framing
// --frames N                    video frames per loop (default 144: 24 fps for the 6 s loop)
// --walk-fps N                  frames per second of the walks (default 30)
// --debug board|letters         write the chalk textures or the letters' distance field and stop
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
const only = option('--only')?.split(',') ?? ['overview', 'music', 'walk']
const loopFrames = option('--frames') ? Number(option('--frames')) : preview || stills ? 0 : 144
const walkFps = option('--walk-fps') ? Number(option('--walk-fps')) : preview && !option('--frames') ? 0 : stills ? 0 : 30
const chromePath = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const outDir = preview ? here : join(here, '../../frontend/src/assets')
const name = (file) => (preview ? `preview-${file}` : file)

// ---- the shots ----
// Metres, in the scene's frame: x across the hall (right is +), y up, z down the hall away
// from the front wall. fov is vertical, in degrees.
const EYE = 1.6
const framings = {
  landscape: {
    size: preview ? [960, 600] : [2400, 1500],
    row: 2, // the row of tubes the name hangs from: the first inside this frame
    overview: { pos: [0, EYE, 0], target: [0, EYE, 1], fov: 58 },
    music: { pos: [2.0, 1.6, 6.0], target: [2.451, 1.05, 9.936], fov: 30.47 },
  },
  portrait: {
    size: preview ? [390, 780] : [1170, 2340],
    row: 3, // one row further back: at this fov the front row's frame is too narrow for the name
    overview: { pos: [0, EYE, 0], target: [0, EYE, 1], fov: 80 },
    music: { pos: [1.6, 1.6, 6.0], target: [2.67, 1.233, 9.837], fov: 51.53 },
  },
}
const SPP = preview ? 64 : 1024
// The walks are over in 2 s and the camera never stops moving, so they get fewer samples and
// two thirds of the resolution (the page scales them up): about a third of the download.
const WALK_SPP = preview ? 32 : 512
const WALK_SCALE = 2 / 3

// The walk from the overview to the close-up: WALK_SECONDS long, easing off and in, the head
// turning a little ahead of the body and bobbing gently with each step.
const WALK_SECONDS = 2
const STEPS = 4
const BOB = 0.018 // metres
function walk(from, to, fps) {
  const n = Math.round(WALK_SECONDS * fps) + 1
  const yawPitch = ({ pos, target }) => {
    const d = target.map((v, i) => v - pos[i])
    return [Math.atan2(d[0], d[2]), Math.atan2(d[1], Math.hypot(d[0], d[2]))]
  }
  const [yaw0, pitch0] = yawPitch(from), [yaw1, pitch1] = yawPitch(to)
  const lerp = (a, b, k) => a + (b - a) * k
  const smootherstep = (t) => t * t * t * (t * (6 * t - 15) + 10)
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1)
    const body = smootherstep(t)
    const head = smootherstep(Math.min(1, t * 1.25))
    const pos = from.pos.map((v, j) => lerp(v, to.pos[j], body))
    pos[1] -= BOB * Math.sin(Math.PI * t) * 0.5 * (1 - Math.cos(2 * Math.PI * STEPS * t))
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
const scene = { ...previous, walk: { seconds: WALK_SECONDS, fps: walkFps || previous.walk?.fps || 30 } }

if (option('--debug')) {
  const kind = option('--debug')
  await withStudio(framings.landscape, 1, async (call) => {
    if (kind === 'letters') {
      const { layout, jpeg } = await call('letters')
      writeFileSync(join(here, 'preview-debug-letters.jpg'), decode(jpeg))
      console.log(layout)
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
  const cameras = { overview: lookAt(framing.overview), music: lookAt(framing.music) }

  // a still, then its loop; exposure: the overview sets the level for the whole framing,
  // the close-up gets its own (the walk adapts from one to the other, as eyes do)
  const shot = (view, still, loop, level) =>
    withStudio(framing, SPP, async (call) => {
      const info = await call('still', { camera: framing[view], time: view === 'music' ? WALK_SECONDS : 0, exposure: level })
      writeFileSync(join(outDir, still), decode(info.jpeg))
      console.log(`${still}: ${framing.size.join('×')}, ${SPP} spp in ${info.renderMs} ms, exposure ${info.exposure.toFixed(3)} (auto ${info.autoExposure.toFixed(3)})`)
      if (flag('--stats')) console.log(info.patches)
      if (loopFrames > 0) await video(loop, loopFrames, loopFrames / 6, 20, (i) => call('loopFrame', i, loopFrames))
      return info
    })

  if (only.includes('overview')) exposure.overview = (await shot('overview', name(`studio-${key}.jpg`), name(`studio-${key}.mp4`))).exposure
  if (only.includes('music')) exposure.music = (await shot('music', name(`studio-music-${key}.jpg`), name(`studio-music-${key}.mp4`))).exposure

  const path = walk(framing.overview, framing.music, walkFps || scene.walk.fps)
  if (only.includes('walk') && walkFps > 0) {
    if (!exposure.overview || !exposure.music) throw new Error(`render the ${key} overview and music stills before its walks`)
    // Exposure follows the walk in log space. The letters and the record keep moving forwards in
    // time both ways, and each walk ends at exactly the moment of the still it arrives at: in runs
    // from 0 to WALK_SECONDS (the music still is rendered at WALK_SECONDS), out from -WALK_SECONDS
    // to 0 (the overview still). The record turns a whole number of times in WALK_SECONDS, so each
    // walk also starts where the still it leaves has the record.
    const level = (t) => Math.exp(Math.log(exposure.overview) + (Math.log(exposure.music) - Math.log(exposure.overview)) * t)
    const frames = path.length
    const small = { ...framing, size: framing.size.map((v) => Math.round((v * WALK_SCALE) / 2) * 2) }
    await withStudio(small, WALK_SPP, async (call) => {
      await video(name(`studio-walk-in-${key}.mp4`), frames, walkFps, 24, (i) =>
        call('frame', { camera: path[i], time: i / walkFps, spp: WALK_SPP, exposure: level(path[i].t) }))
    })
    await withStudio(small, WALK_SPP, async (call) => {
      await video(name(`studio-walk-out-${key}.mp4`), frames, walkFps, 24, (i) => {
        const c = path[frames - 1 - i]
        return call('frame', { camera: c, time: (i - (frames - 1)) / walkFps, spp: WALK_SPP, exposure: level(c.t) })
      })
    })
  }

  scene[key] = { size: framing.size, exposure, overview: cameras.overview, music: cameras.music, walk: path.map(lookAt) }
}

// the anchors come from the shader's constants, so ask the page for them, and the candle's
// flicker and strength, which the site lights its own things by
const { anchors, loopSeconds, candle } = await withStudio(framings.landscape, 1, (call) => call('info'))
scene.anchors = anchors
scene.loopSeconds = loopSeconds
scene.candle = candle
writeFileSync(sceneFile, JSON.stringify(scene, null, 1))
console.log(`${name('studio-scene.json')} written`)
