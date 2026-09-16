// node peek.mjs <design> <spp> name:w:h:px,py,pz:tx,ty,tz:fov[:exposure] ...
import { spawn } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const [design, spp, ...shots] = process.argv.slice(2)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

for (const shot of shots) {
  const [name, w, h, pos, target, fov, exposure] = shot.split(':')
  const port = 9800 + Math.floor(Math.random() * 150)
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--allow-file-access-from-files', '--use-angle=vulkan', '--ignore-gpu-blocklist',
    `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'peek-'))}`, 'about:blank',
  ], { stdio: 'ignore' })
  try {
    let url
    for (let i = 0; i < 50 && !url; i++) {
      try { url = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl } catch {}
      if (!url) await sleep(200)
    }
    const ws = new WebSocket(url)
    await new Promise((r) => ws.addEventListener('open', r))
    let id = 1
    const pending = new Map()
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data)
      if (m.id) { pending.get(m.id)(m); pending.delete(m.id) }
      else if (m.method === 'Runtime.consoleAPICalled' || m.method === 'Log.entryAdded') console.log(JSON.stringify(m.params).slice(0, 2000))
    })
    const send = (method, params = {}) => new Promise((r) => { const i = id++; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
    await send('Runtime.enable')
    await send('Log.enable')
    const page = pathToFileURL(join(here, 'index.html'))
    page.search = new URLSearchParams({ w, h, spp, row: Number(h) > Number(w) ? 3 : 2, design }).toString()
    await send('Page.navigate', { url: page.href })
    await sleep(500)
    const camera = { pos: pos.split(',').map(Number), target: target.split(',').map(Number), fov: Number(fov) }
    const args = JSON.stringify({ camera, time: 0, ...(exposure ? { exposure: Number(exposure) } : {}) })
    const reply = await send('Runtime.evaluate', { expression: `window.studio.then((s) => s.still(${args}))`, awaitPromise: true, returnByValue: true })
    if (reply.result?.exceptionDetails) throw new Error(reply.result.exceptionDetails.exception?.description)
    const v = reply.result.result.value
    writeFileSync(join(here, `${name}.jpg`), Buffer.from(v.jpeg.split(',')[1], 'base64'))
    console.log(name, 'exposure', v.exposure.toFixed(3), 'in', v.renderMs, 'ms')
    ws.close()
  } finally {
    chrome.kill()
  }
}
