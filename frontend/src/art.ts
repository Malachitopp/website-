import { useCallback, useEffect, useState } from 'react'

// My paintings, through the backend's /api/art routes. The wall of them hangs on the easel's
// canvas in the studio (see Easel.tsx).
//
// The routes are:
//   GET  /api/art            public: every painting, newest first
//   GET  /api/art/signature  mine: what the browser needs to upload straight to Cloudinary
//   POST /api/art            mine: the row for a painting that has just been uploaded
// The two of mine are behind a secret sent as x-art-secret, which is kept for this tab only —
// there is no users table, by design. Until those routes exist GET /api/art 404s, which is not an
// error here: it just means nothing has been hung up yet.

export type Painting = {
  id: string
  publicId?: string
  url: string
  title?: string
  year?: number
  medium?: string
  width: number // of the image, so the wall can lay it out before it loads
  height: number
}

export type ArtState = {
  paintings: Painting[]
  status: 'loading' | 'ready' | 'unreachable' // unreachable: the backend isn't answering yet
  reload: () => void
}

// enabled is false until the paintings are actually wanted — walking round the studio shouldn't
// fetch them, and standing at the easel should have them ready before the canvas is pressed.
export function useArt(enabled = true): ArtState {
  const [paintings, setPaintings] = useState<Painting[]>([])
  const [status, setStatus] = useState<ArtState['status']>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let ignore = false
    fetch('/api/art')
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((data: { art?: Painting[] } | Painting[]) => {
        if (ignore) return
        setPaintings(Array.isArray(data) ? data : (data.art ?? []))
        setStatus('ready')
      })
      .catch(() => {
        if (!ignore) setStatus('unreachable')
      })
    return () => {
      ignore = true
    }
  }, [attempt, enabled])

  return { paintings, status, reload: useCallback(() => setAttempt((n) => n + 1), []) }
}

// A Cloudinary delivery URL with a transformation spliced in, so a wall of thumbnails doesn't pull
// down full-size photographs of paintings. Anything that isn't one is left alone.
export function sized(url: string, width: number) {
  const mark = '/image/upload/'
  const at = url.indexOf(mark)
  if (at < 0) return url
  return `${url.slice(0, at + mark.length)}w_${width},q_auto,f_auto/${url.slice(at + mark.length)}`
}

// The secret that lets me add a painting. sessionStorage, so it is gone when the tab closes and
// never written to disk; reading it can throw in a private window, hence the try.
const SECRET_KEY = 'malachi-art-secret'
export function readSecret() {
  try {
    return sessionStorage.getItem(SECRET_KEY) ?? ''
  } catch {
    return ''
  }
}
export function rememberSecret(secret: string) {
  try {
    sessionStorage.setItem(SECRET_KEY, secret)
  } catch {
    // a private window won't have it; the upload still works for this one go
  }
}

// Is this the word? Asks for an upload signature, which only my own secret gets one of — so the
// wall can put the "add one" button away until it knows it is me, and nobody else is shown a
// button they can't use. Throws if the backend can't be reached at all.
export async function verifySecret(secret: string) {
  const res = await fetch('/api/art/signature', { headers: { 'x-art-secret': secret } })
  if (res.ok) return true
  if (res.status === 401 || res.status === 403) return false
  throw new Error(res.status === 404 ? 'the upload route isn’t built yet' : `couldn’t check that (${res.status})`)
}

export type NewPainting = { title: string; year: string; medium: string }

// Uploads one painting: ask the backend to sign the upload, send the file straight to Cloudinary
// (the bytes never go through my own server, so there's no multipart parser or body limit in the
// way), then hand the backend the row. Throws with something worth reading on the way.
export async function uploadPainting(file: File, fields: NewPainting, secret: string): Promise<Painting> {
  const headers = { 'x-art-secret': secret }
  const signed = await fetch('/api/art/signature', { headers })
  if (signed.status === 401 || signed.status === 403) throw new Error("that isn't the right word")
  if (signed.status === 404) throw new Error('the upload route isn’t built yet')
  if (!signed.ok) throw new Error(`couldn’t start the upload (${signed.status})`)
  const { cloudName, apiKey, timestamp, folder, signature } = await signed.json()

  const form = new FormData()
  form.append('file', file)
  form.append('api_key', apiKey)
  form.append('timestamp', String(timestamp))
  if (folder) form.append('folder', folder)
  form.append('signature', signature)
  const sent = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form })
  if (!sent.ok) throw new Error(`the image store turned it down (${sent.status})`)
  const image = await sent.json()

  const saved = await fetch('/api/art', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({
      publicId: image.public_id,
      url: image.secure_url,
      width: image.width,
      height: image.height,
      title: fields.title.trim() || undefined,
      year: fields.year.trim() ? Number(fields.year) : undefined,
      medium: fields.medium.trim() || undefined,
    }),
  })
  if (!saved.ok) throw new Error(`it uploaded, but saving it failed (${saved.status})`)
  return saved.json()
}
