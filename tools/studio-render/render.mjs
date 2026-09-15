// Renders the studio warehouse with tools/studio-render/index.html in headless Chrome and
// writes what the studio page uses: a JPEG still of each framing and, unless --stills is
// given, a short seamless MP4 loop of the same frame in which the hanging letters sway
// (only the patch of the frame the letters can reach is re-rendered per video frame; see
// renderFrame in index.html). Run from the repo root:
//
//   node tools/studio-render/render.mjs                        full quality, into frontend/src/assets
//   node tools/studio-render/render.mjs --stills               just the JPEGs (each loop takes minutes)
//   node tools/studio-render/render.mjs --preview              small, fast stills, into this folder
//   node tools/studio-render/render.mjs --preview --frames 24  plus a rough loop, to check the motion
//
// --frames N is the number of video frames per loop (default 144: 24 fps for the page's
// 6 s loop). The MP4 is encoded by the ffmpeg binary of the ffmpeg-static dev dependency,
// or by whatever FFMPEG points at. Set CHROME to a Chrome/Edge executable if it isn't at
// the default Windows path, and ANGLE to pick the graphics backend. Vulkan is the default:
// Chrome's D3D11 backend fails to compile this shader, and swiftshader (software) works
// but is ~20× slower.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const preview = process.argv.includes('--preview')
const option = (name) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const frames = option('--frames') ? Number(option('--frames')) : preview || process.argv.includes('--stills') ? 0 : 144
const chromePath = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const outDir = preview ? here : join(here, '../../frontend/src/assets')

const renders = preview
  ? [
      { file: 'preview-landscape.jpg', loop: 'preview-landscape.mp4', w: 960, h: 600, fov: 58, spp: 64, row: 2 },
      { file: 'preview-portrait.jpg', loop: 'preview-portrait.mp4', w: 390, h: 780, fov: 80, spp: 64, row: 3 },
    ]
  : [
      { file: 'studio-landscape.jpg', loop: 'studio-landscape.mp4', w: 2400, h: 1500, fov: 58, spp: 1024, row: 2 },
      { file: 'studio-portrait.jpg', loop: 'studio-portrait.mp4', w: 1170, h: 2340, fov: 80, spp: 1024, row: 3 },
    ]

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const decode = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64')

// H.264 in an MP4 plays everywhere; one keyframe per loop keeps it small (the page only
// ever plays it from the start), and yuv420p limited range is what browsers expect.
async function encode(dir, fps, out) {
  const ffmpeg = process.env.FFMPEG ?? (await import('ffmpeg-static')).default
  const args = [
    '-y', '-loglevel', 'error',
    '-framerate', String(fps), '-i', join(dir, 'f%03d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-profile:v', 'high',
    '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-g', String(frames), '-keyint_min', String(frames), '-sc_threshold', '0',
    '-movflags', '+faststart', '-an', out,
  ]
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { stdio: 'inherit' })
    child.on('error', reject)
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`))))
  })
}

// Each framing gets its own Chrome: after a couple of minutes of full-tilt GPU work the
// browser has been seen to die on the next navigation, which would otherwise leave the
// script waiting forever on a reply that never comes.
async function renderInChrome(file, loop, settings) {
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
      for (const { reject } of pending.values()) reject(new Error(`Chrome went away while rendering ${file}`))
      pending.clear()
    })
    const send = (method, params = {}) =>
      new Promise((resolve, reject) => {
        const id = nextId++
        pending.set(id, { resolve, reject })
        socket.send(JSON.stringify({ id, method, params }))
      })
    const evaluate = async (expression) => {
      const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (reply.result?.exceptionDetails) throw new Error(reply.result.exceptionDetails.exception?.description ?? JSON.stringify(reply.result.exceptionDetails))
      return reply.result?.result?.value
    }
    await send('Log.enable')
    await send('Runtime.enable')

    const page = pathToFileURL(join(here, 'index.html'))
    page.search = new URLSearchParams(Object.entries(settings).map(([k, v]) => [k, String(v)])).toString()
    await send('Page.navigate', { url: page.href })
    await sleep(500)
    const result = await evaluate('window.renderResult')
    if (!result || result.error) throw new Error(result?.error ?? 'no render result')
    writeFileSync(join(outDir, file), decode(result.jpeg))
    console.log(`${file}: ${settings.w}×${settings.h}, ${settings.spp} spp in ${result.renderMs} ms on ${result.gpu}`)
    if (process.argv.includes('--stats')) console.log(result.stats)

    if (frames > 0) {
      // the loop: every frame is the still with the letters' patch re-rendered at that moment
      const dir = mkdtempSync(join(tmpdir(), 'studio-frames-'))
      const started = Date.now()
      for (let i = 0; i < frames; i++) {
        writeFileSync(join(dir, `f${String(i).padStart(3, '0')}.png`), decode(await evaluate(`window.renderFrame(${i}, ${frames})`)))
        process.stdout.write(`\r${loop}: frame ${i + 1}/${frames} (${result.crop.w}×${result.crop.h} patch)`)
      }
      process.stdout.write('\n')
      await encode(dir, frames / result.loopSeconds, join(outDir, loop))
      rmSync(dir, { recursive: true, force: true })
      console.log(`${loop}: ${frames} frames, ${result.loopSeconds} s loop, in ${Math.round((Date.now() - started) / 1000)} s`)
    }
    socket.close()
  } finally {
    chrome.kill()
  }
}

for (const { file, loop, ...settings } of renders) await renderInChrome(file, loop, settings)
