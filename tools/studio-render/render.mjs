// Renders the studio warehouse with tools/studio-render/index.html in headless Chrome and
// writes the JPEGs the studio page uses. Run from the repo root:
//
//   node tools/studio-render/render.mjs            full quality, into frontend/src/assets
//   node tools/studio-render/render.mjs --preview  small and fast, into this folder
//
// Set CHROME to a Chrome/Edge executable if it isn't at the default Windows path, and
// ANGLE to pick the graphics backend. Vulkan is the default: Chrome's D3D11 backend
// fails to compile this shader, and swiftshader (software) works but is ~20× slower.
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const preview = process.argv.includes('--preview')
const chromePath = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const outDir = preview ? here : join(here, '../../frontend/src/assets')

const renders = preview
  ? [
      { file: 'preview-landscape.jpg', w: 960, h: 600, fov: 58, spp: 64 },
      { file: 'preview-portrait.jpg', w: 390, h: 780, fov: 80, spp: 64 },
    ]
  : [
      { file: 'studio-landscape.jpg', w: 2400, h: 1500, fov: 58, spp: 1024 },
      { file: 'studio-portrait.jpg', w: 1170, h: 2340, fov: 80, spp: 1024 },
    ]

const port = 9400 + Math.floor(Math.random() * 400)
const chrome = spawn(
  chromePath,
  [
    '--headless=new',
    `--use-angle=${process.env.ANGLE ?? 'vulkan'}`,
    '--ignore-gpu-blocklist',
    '--enable-unsafe-swiftshader',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${mkdtempSync(join(tmpdir(), 'studio-render-'))}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
      pending.get(message.id)?.(message)
      pending.delete(message.id)
    } else if (message.method === 'Log.entryAdded') {
      console.log(`[browser ${message.params.entry.level}] ${message.params.entry.text}`)
    } else if (message.method === 'Runtime.consoleAPICalled') {
      console.log(`[console.${message.params.type}]`, message.params.args.map((a) => a.value ?? a.description).join(' '))
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = nextId++
      pending.set(id, resolve)
      socket.send(JSON.stringify({ id, method, params }))
    })
  await send('Log.enable')
  await send('Runtime.enable')

  for (const { file, ...settings } of renders) {
    const page = pathToFileURL(join(here, 'index.html'))
    page.search = new URLSearchParams(Object.entries(settings).map(([k, v]) => [k, String(v)])).toString()
    await send('Page.navigate', { url: page.href })
    await sleep(500)
    const reply = await send('Runtime.evaluate', {
      expression: 'window.renderResult',
      awaitPromise: true,
      returnByValue: true,
    })
    const result = reply.result?.result?.value
    if (!result || result.error) throw new Error(result?.error ?? JSON.stringify(reply))
    writeFileSync(join(outDir, file), Buffer.from(result.jpeg.split(',')[1], 'base64'))
    console.log(`${file}: ${settings.w}×${settings.h}, ${settings.spp} spp in ${result.renderMs} ms on ${result.gpu}`)
    if (process.argv.includes('--stats')) console.log(result.stats)
  }
  socket.close()
} finally {
  chrome.kill()
}
