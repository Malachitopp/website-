import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent } from 'react'
import { readSecret, rememberSecret, sized, uploadPainting, useArt, verifySecret, type ArtState, type NewPainting, type Painting } from './art'
import { isModifiedClick, navigate } from './router'
import { planeTransform, project, scene, type Lens } from './studioScene'

const PAINTINGS = '/studio/easel/paintings'

// The canvas on the easel is 700 × 900 mm, and its face is laid out at 1 px = 1 mm
const CANVAS_W = 700
const CANVAS_H = 900
const FACE_PREVIEW = 6 // how many paintings fit on the canvas itself before you open it out

type Props = {
  lens: Lens // the camera the page shows right now (it moves during a walk)
  closeUp: Lens // the easel close-up's camera: the canvas's own text is sized to how big it shows it
  focused: boolean // standing at the easel: the canvas can be pressed
  overview: boolean // standing at the door: the whole corner is something to press
  paintings: boolean // the canvas is open out to the screen, as a wall of paintings
  onEnter: () => void
}

// The art corner's live part: the canvas on the easel. In the render it is blank; walk up to it and
// what I have painted fades onto it, laid onto the canvas through the camera. Press it and the
// canvas opens out to fill the screen as a wall you scroll down — the same canvas, just big enough
// to see. From the door the whole corner is a button that walks you over.
function Easel({ lens, closeUp, focused, overview, paintings, onEnter }: Props) {
  const art = useArt(focused || paintings)
  // opening the wall pushes a history entry, so closing it goes back — unless the wall is where
  // this visit started (a link straight to it), when there is nothing to go back to
  const openedHere = useRef(false)
  const open = (event: MouseEvent) => {
    if (isModifiedClick(event)) return
    event.preventDefault()
    openedHere.current = true
    navigate(PAINTINGS)
  }
  const close = (event: MouseEvent) => {
    if (isModifiedClick(event)) return
    event.preventDefault()
    if (openedHere.current) {
      openedHere.current = false
      history.back()
    } else {
      navigate('/studio/easel')
    }
  }
  return (
    <>
      <div className="studio-overlay">
        {(focused || paintings) && <CanvasFace lens={lens} closeUp={closeUp} art={art} open={paintings} onOpen={open} />}
        {overview && <Hotspot lens={lens} onEnter={onEnter} />}
      </div>
      {(focused || paintings) && <Wall lens={lens} art={art} open={paintings} onClose={close} />}
    </>
  )
}

// The paintings on the canvas as it stands on the easel, laid onto the render's blank canvas by the
// camera. Pressing it opens the wall. Sizes come from how big a millimetre of the canvas is on the
// real screen at the close-up, so the caption reads on a phone as well as a monitor.
function CanvasFace({
  lens,
  closeUp,
  art,
  open,
  onOpen,
}: {
  lens: Lens
  closeUp: Lens
  art: ArtState
  open: boolean
  onOpen: (event: MouseEvent) => void
}) {
  const { easelCanvas } = scene.anchors
  const left = project(closeUp, easelCanvas[0]), right = project(closeUp, easelCanvas[1])
  const px = Math.max(0.04, Math.hypot(right.x - left.x, right.y - left.y) / CANVAS_W)
  const shown = art.paintings.slice(0, FACE_PREVIEW)
  return (
    <div
      className={`easel-canvas${open ? ' is-open' : ''}`}
      style={{ transform: planeTransform(lens, easelCanvas, CANVAS_W, CANVAS_H), '--px': px } as CSSProperties}
    >
      <a className="easel-press" href={PAINTINGS} onClick={onOpen}>
        {shown.length > 0 && (
          <span className="easel-face-grid" aria-hidden="true">
            {shown.map((painting) => (
              <span className="easel-face-item" key={painting.id}>
                <img src={sized(painting.url, 400)} alt="" />
              </span>
            ))}
          </span>
        )}
        <span className="easel-press-label">{shown.length > 0 ? 'see them all' : 'what I’ve painted'}</span>
      </a>
    </div>
  )
}

// The canvas opened out to the screen: a wall of everything I have painted, scrolled down like a
// board of pins. It grows out of wherever the canvas is in the shot, so it reads as that canvas
// getting big rather than a window opening over it.
function Wall({ lens, art, open, onClose }: { lens: Lens; art: ArtState; open: boolean; onClose: (event: MouseEvent) => void }) {
  const { paintings, status, reload } = art
  const [adding, setAdding] = useState(false)
  // There is no account to log into: the word in ART_SECRET is what says it's me. Until it has been
  // given (and checked against the backend), the wall has no way to add anything on it at all — a
  // visitor is never shown a button that would only turn them away. The way in is the faint + in
  // the bar, or shift+A.
  const [secret, setSecret] = useState(readSecret)
  const [asking, setAsking] = useState(false)
  const closeRef = useRef<HTMLAnchorElement>(null)
  const wallRef = useRef<HTMLDivElement>(null)

  // It is mounted the whole time you stand at the easel, shrunk onto the canvas and out of the way,
  // so it grows both ways rather than only opening smoothly and then snapping shut. Opening and
  // shutting puts the form away (adjusted while rendering, as Studio does for its walk, so it
  // doesn't take a second render to settle); each time it opens it starts at the top.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (adding) setAdding(false)
    if (asking) setAsking(false)
  }
  useEffect(() => {
    if (open) wallRef.current?.scrollTo(0, 0)
  }, [open])

  // Escape closes whatever is open, innermost first, and then the wall (Studio leaves its own
  // Escape alone while this is up). shift+A asks for the word.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (asking) setAsking(false)
        else if (adding) setAdding(false)
        else closeRef.current?.click()
      } else if (event.shiftKey && event.key.toLowerCase() === 'a' && !secret) {
        setAsking(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [adding, asking, open, secret])

  const box = canvasOnScreen(lens)
  return (
    <div
      ref={wallRef}
      className={`art-wall${open ? ' is-shown' : ''}`}
      style={{ '--grow-x': `${box.x}px`, '--grow-y': `${box.y}px`, '--grow-scale': box.scale } as CSSProperties}
      aria-hidden={!open}
    >
      <header className="art-bar">
        <h2 className="art-title">paintings</h2>
        <div className="art-bar-buttons">
          {secret ? (
            <button type="button" className="art-button" onClick={() => setAdding((was) => !was)} aria-expanded={adding}>
              {adding ? 'never mind' : 'add one'}
            </button>
          ) : (
            <button type="button" className="art-unlock" onClick={() => setAsking((was) => !was)} aria-label="Add a painting" aria-expanded={asking}>
              +
            </button>
          )}
          <a className="art-button art-close" href="/studio/easel" ref={closeRef} onClick={onClose} aria-label="Back to the easel">
            ✕
          </a>
        </div>
      </header>
      {asking && !secret && (
        <Unlock
          onUnlocked={(word) => {
            rememberSecret(word)
            setSecret(word)
            setAsking(false)
            setAdding(true)
          }}
        />
      )}
      {adding && secret && <AddPainting secret={secret} onAdded={reload} onDone={() => setAdding(false)} />}
      {paintings.length > 0 ? (
        <ul className="art-grid">
          {paintings.map((painting) => (
            <Pin key={painting.id} painting={painting} />
          ))}
        </ul>
      ) : (
        status !== 'loading' && (
          <p className="art-empty">
            nothing up here yet
            {status === 'unreachable' ? (
              <span>the paintings are served by /api/art, which isn’t answering</span>
            ) : (
              secret && <span>press “add one” to hang the first</span>
            )}
          </p>
        )
      )}
    </div>
  )
}

// One painting on the wall. Its own size is known before the image loads, so nothing jumps around
// as the wall fills in.
function Pin({ painting }: { painting: Painting }) {
  const { title, year, medium, url, width, height } = painting
  return (
    <li className="art-pin">
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={sized(url, 700)}
          alt={title ? `${title}, a painting of mine` : 'A painting of mine'}
          loading="lazy"
          style={{ aspectRatio: `${width} / ${height}` }}
        />
        {(title || year || medium) && (
          <span className="art-caption">
            {title && <strong>{title}</strong>}
            {(medium || year) && <em>{[medium, year].filter(Boolean).join(', ')}</em>}
          </span>
        )}
      </a>
    </li>
  )
}

// The way in: the word, checked against the backend before the wall shows anything that can change
// it. Right for the tab, then it is remembered and the "add one" button appears.
function Unlock({ onUnlocked }: { onUnlocked: (secret: string) => void }) {
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!word || busy) return
    setBusy(true)
    setProblem(null)
    try {
      if (await verifySecret(word)) onUnlocked(word)
      else setProblem('that isn’t the word')
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'couldn’t check that')
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="art-add" onSubmit={submit}>
      <input
        className="art-field"
        type="password"
        value={word}
        onChange={(event) => setWord(event.target.value)}
        placeholder="the word"
        aria-label="The word that lets you add paintings"
        autoFocus
      />
      <button type="submit" className="art-button" disabled={!word || busy}>
        {busy ? 'checking…' : 'let me in'}
      </button>
      {problem && <p className="art-problem">{problem}</p>}
    </form>
  )
}

// Hanging a new one up: the file and what it is. The word has already been checked by Unlock, so it
// is only sent, never asked for again this tab.
function AddPainting({ secret, onAdded, onDone }: { secret: string; onAdded: () => void; onDone: () => void }) {
  const [fields, setFields] = useState<NewPainting>({ title: '', year: '', medium: 'Oil on canvas' })
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file || busy) return
    setBusy(true)
    setProblem(null)
    try {
      await uploadPainting(file, fields, secret)
      onAdded()
      onDone()
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'it didn’t work')
    } finally {
      setBusy(false)
    }
  }

  const set = (key: keyof NewPainting) => (event: { target: { value: string } }) => setFields((was) => ({ ...was, [key]: event.target.value }))
  return (
    <form className="art-add" onSubmit={submit}>
      <label className="art-file">
        <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        <span>{file ? file.name : 'choose a photograph'}</span>
      </label>
      <input className="art-field" value={fields.title} onChange={set('title')} placeholder="title" aria-label="Title" />
      <input className="art-field art-field-short" value={fields.year} onChange={set('year')} placeholder="year" inputMode="numeric" aria-label="Year" />
      <input className="art-field" value={fields.medium} onChange={set('medium')} placeholder="medium" aria-label="Medium" />
      <button type="submit" className="art-button" disabled={!file || busy}>
        {busy ? 'hanging it…' : 'hang it up'}
      </button>
      {problem && <p className="art-problem">{problem}</p>}
    </form>
  )
}

// Where the canvas sits on screen right now: the middle of it, and how much of the screen's height
// it takes. The wall grows from that point at that scale, so it looks like the canvas itself.
function canvasOnScreen(lens: Lens) {
  const points = scene.anchors.easelCanvas.map((p) => project(lens, p))
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y)
  const top = Math.min(...ys), bottom = Math.max(...ys)
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (top + bottom) / 2,
    scale: Math.max(0.05, Math.min(1, (bottom - top) / Math.max(1, lens.height))),
  }
}

// A button over the whole art corner as the overview camera sees it. On a phone the corner is a
// narrow sliver at the edge of the frame, so the button is never allowed to be too small to hit.
const TAP = 44
function Hotspot({ lens, onEnter }: { lens: Lens; onEnter: () => void }) {
  const points = scene.anchors.artCorner.map((p) => project(lens, p))
  const left = Math.min(...points.map((p) => p.x)), right = Math.max(...points.map((p) => p.x))
  const top = Math.min(...points.map((p) => p.y)), bottom = Math.max(...points.map((p) => p.y))
  const width = Math.max(TAP, right - left), height = Math.max(TAP, bottom - top)
  return (
    <button
      type="button"
      className="studio-hotspot"
      style={{ left: (left + right) / 2 - width / 2, top: (top + bottom) / 2 - height / 2, width, height }}
      aria-label="Walk over to the easel and my paintings"
      onClick={onEnter}
    />
  )
}

export default Easel
