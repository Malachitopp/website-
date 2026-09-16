import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent, type PointerEvent, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import './Studio.css'
import studioEaselLandscape from './assets/studio-easel-landscape.jpg'
import studioEaselLandscapeLoop from './assets/studio-easel-landscape.mp4'
import studioEaselPortrait from './assets/studio-easel-portrait.jpg'
import studioEaselPortraitLoop from './assets/studio-easel-portrait.mp4'
import studioEaselWalkInLandscape from './assets/studio-easel-walk-in-landscape.mp4'
import studioEaselWalkInPortrait from './assets/studio-easel-walk-in-portrait.mp4'
import studioEaselWalkOutLandscape from './assets/studio-easel-walk-out-landscape.mp4'
import studioEaselWalkOutPortrait from './assets/studio-easel-walk-out-portrait.mp4'
import studioLandscape from './assets/studio-landscape.jpg'
import studioLandscapeLoop from './assets/studio-landscape.mp4'
import studioLaptopLandscape from './assets/studio-laptop-landscape.jpg'
import studioLaptopLandscapeLoop from './assets/studio-laptop-landscape.mp4'
import studioLaptopPortrait from './assets/studio-laptop-portrait.jpg'
import studioLaptopPortraitLoop from './assets/studio-laptop-portrait.mp4'
import studioLaptopWalkInLandscape from './assets/studio-laptop-walk-in-landscape.mp4'
import studioLaptopWalkInPortrait from './assets/studio-laptop-walk-in-portrait.mp4'
import studioLaptopWalkOutLandscape from './assets/studio-laptop-walk-out-landscape.mp4'
import studioLaptopWalkOutPortrait from './assets/studio-laptop-walk-out-portrait.mp4'
import studioMusicLandscape from './assets/studio-music-landscape.jpg'
import studioMusicLandscapeLoop from './assets/studio-music-landscape.mp4'
import studioMusicPortrait from './assets/studio-music-portrait.jpg'
import studioMusicPortraitLoop from './assets/studio-music-portrait.mp4'
import studioMusicWalkInLandscape from './assets/studio-music-walk-in-landscape.mp4'
import studioMusicWalkInPortrait from './assets/studio-music-walk-in-portrait.mp4'
import studioMusicWalkOutLandscape from './assets/studio-music-walk-out-landscape.mp4'
import studioMusicWalkOutPortrait from './assets/studio-music-walk-out-portrait.mp4'
import studioPortrait from './assets/studio-portrait.jpg'
import studioPortraitLoop from './assets/studio-portrait.mp4'
import Easel from './Easel'
import MusicCorner from './MusicCorner'
import Workstation from './Workstation'
import { isModifiedClick, navigate, usePathname } from './router'
import { candleFlicker, scene, type CloseUp, type Lens } from './studioScene'

type View = 'overview' | CloseUp
type FramingName = 'landscape' | 'portrait'

const CLOSE_UPS: CloseUp[] = ['music', 'laptop', 'easel']
// which shot each path is standing at. /studio/easel/gallery is the easel shot too: the gallery
// wall is its canvas filled out to the screen, drawn over the same render.
const PATHS: Partial<Record<string, CloseUp>> = {
  '/studio/music': 'music',
  '/studio/laptop': 'laptop',
  '/studio/easel': 'easel',
  '/studio/easel/gallery': 'easel',
}
const GALLERY = '/studio/easel/gallery'

const SHOTS = {
  landscape: {
    overview: { still: studioLandscape, loop: studioLandscapeLoop },
    music: { still: studioMusicLandscape, loop: studioMusicLandscapeLoop },
    laptop: { still: studioLaptopLandscape, loop: studioLaptopLandscapeLoop },
    easel: { still: studioEaselLandscape, loop: studioEaselLandscapeLoop },
    walks: {
      music: { in: studioMusicWalkInLandscape, out: studioMusicWalkOutLandscape },
      laptop: { in: studioLaptopWalkInLandscape, out: studioLaptopWalkOutLandscape },
      easel: { in: studioEaselWalkInLandscape, out: studioEaselWalkOutLandscape },
    },
  },
  portrait: {
    overview: { still: studioPortrait, loop: studioPortraitLoop },
    music: { still: studioMusicPortrait, loop: studioMusicPortraitLoop },
    laptop: { still: studioLaptopPortrait, loop: studioLaptopPortraitLoop },
    easel: { still: studioEaselPortrait, loop: studioEaselPortraitLoop },
    walks: {
      music: { in: studioMusicWalkInPortrait, out: studioMusicWalkOutPortrait },
      laptop: { in: studioLaptopWalkInPortrait, out: studioLaptopWalkOutPortrait },
      easel: { in: studioEaselWalkInPortrait, out: studioEaselWalkOutPortrait },
    },
  },
}

const ALT: Record<View, string> = {
  overview:
    'An empty warehouse studio in black and white: rows of fluorescent tubes hanging from a dark beamed ceiling with my name hanging off them letter by letter, a blackboard mid-hall reading "A theoretical physics student", a record player on a wooden box in front of a second blackboard to its right with a candle glowing warm on a crate, and to its left my dog asleep on a small sofa beside a tall crate of books with an open laptop and a second candle on it, scribbled sheets of paper on the floor around it',
  music: 'Close up on the record player spinning on its wooden box, in front of a blackboard with my top artists pinned up on it, lit warm from the right by a Carby Musk candle burning in its navy glass on a little crate',
  laptop: 'Close up on an open laptop on a tall wooden crate of books, its screen showing the GitHub mark, a Carby Musk candle burning beside it and a sheet of scribbled diagrams under its front edge',
  easel: 'Close up on a blank canvas on a wooden easel, spare canvases leaning behind it, an oak crate beside it with a tin of painty brushes and tubes of oil paint on top, and oil paint flicked over the concrete floor',
}

// Whether a media query matches right now; re-renders when that changes.
function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight })
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}

// Calls onFrame with the media time of each frame a video presents, until the returned function
// is called. Where requestVideoFrameCallback isn't supported, reads currentTime every animation frame.
function followFrames(video: HTMLVideoElement, onFrame: (time: number) => void) {
  if (typeof video.requestVideoFrameCallback === 'function') {
    let handle = 0
    const next: VideoFrameRequestCallback = (_now, frame) => {
      onFrame(frame.mediaTime)
      handle = video.requestVideoFrameCallback(next)
    }
    handle = video.requestVideoFrameCallback(next)
    return () => video.cancelVideoFrameCallback(handle)
  }
  let handle = 0
  const tick = () => {
    onFrame(video.currentTime)
    handle = requestAnimationFrame(tick)
  }
  handle = requestAnimationFrame(tick)
  return () => cancelAnimationFrame(handle)
}

// Looking around on a phone. Its overview is rendered wider than the frame (overviewSize in the
// scene: the same camera and height, more of the hall either side) and is shown at the size the
// frame alone would be under object-fit: cover, so its middle is exactly what the walks leave
// from and come back to, with the rest hanging off the screen either side. A drag with a finger
// or the mouse slides it along (the pan, in px: positive is looking right), coasting a little
// when let go and never past its edge; limit is how far it can go each way, 0 when there is
// nothing more to see (a wide screen, a walk underway). settle() glides it back to the middle
// and then calls back — a walk sets off from there.
function usePan(limit: number, reducedMotion: boolean) {
  const [pan, setPan] = useState(0)
  // the press under way: where it started, the pan then, and the last move's pan, time and speed
  const drag = useRef<{ x: number; pan: number; last: number; t: number; v: number; moved: boolean } | null>(null)
  const dragged = useRef(false) // the last press was a drag: the click it ends with isn't a press on anything
  const motion = useRef(0) // the animation frame of a coast or a glide
  const clamp = (value: number) => Math.max(-limit, Math.min(limit, value))
  if (limit === 0 && pan !== 0) setPan(0)

  const stop = () => cancelAnimationFrame(motion.current)
  // moves the pan frame by frame for as long as step says to
  const animate = (step: (now: number) => boolean) => {
    stop()
    const tick = (now: number) => {
      if (step(now)) motion.current = requestAnimationFrame(tick)
    }
    motion.current = requestAnimationFrame(tick)
  }
  // let go at speed (px per ms): on it goes, slowing, until it stops or meets the edge
  const coast = (from: number, speed: number) => {
    let at = from, v = speed, last = performance.now()
    animate((now) => {
      const dt = Math.min(50, now - last)
      last = now
      at += v * dt
      v *= Math.pow(0.9, dt / 16)
      const next = clamp(at)
      setPan(next)
      return next === at && Math.abs(v) > 0.01
    })
  }
  const settle = (done: () => void) => {
    if (pan === 0 || reducedMotion) {
      stop()
      setPan(0)
      done()
      return
    }
    const start = performance.now()
    animate((now) => {
      const t = Math.min(1, (now - start) / 250)
      setPan(pan * (1 - t) ** 3)
      if (t < 1) return true
      done()
      return false
    })
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    dragged.current = false
    if (limit === 0 || !event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    stop()
    drag.current = { x: event.clientX, pan, last: pan, t: event.timeStamp, v: 0, moved: false }
  }
  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || !event.isPrimary) return
    const dx = event.clientX - d.x
    if (!d.moved) {
      if (Math.abs(dx) < 6) return // a press, not a drag, until the finger has clearly moved
      d.moved = true
      dragged.current = true
      event.currentTarget.setPointerCapture(event.pointerId) // keep the moves even off the page
    }
    const next = clamp(d.pan - dx)
    const dt = event.timeStamp - d.t
    if (dt > 0) d.v = 0.6 * d.v + (0.4 * (next - d.last)) / dt
    d.last = next
    d.t = event.timeStamp
    setPan(next)
  }
  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current
    if (!d || !event.isPrimary) return
    drag.current = null
    // a finger that had stopped before it lifted off leaves the picture where it is
    if (d.moved && !reducedMotion && event.type === 'pointerup' && event.timeStamp - d.t < 80) coast(d.last, d.v)
  }
  const onClickCapture = (event: MouseEvent<HTMLElement>) => {
    if (!dragged.current) return
    event.stopPropagation()
    event.preventDefault()
  }
  return { pan: clamp(pan), settle, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onClickCapture } }
}

// A walk between the overview and a close-up: where from and to, which framing it started in,
// and how far it's got. Between two close-ups you walk out to the overview and then in again.
type Walk = { from: View; to: View; framing: FramingName; playing: boolean; ended: boolean }
const walkShot = (walk: Walk): CloseUp => (walk.to === 'overview' ? walk.from : walk.to) as CloseUp

// The studio is a rendered photo (see tools/studio-render): a JPEG still that paints at
// once, and on top of it a short seamless video loop of the same frame (the hanging name
// sways, the record turns, the candles flicker) that plays once it has loaded. Its first frame
// is the still, so the hand-over is invisible. Tall screens get separate renders framed for
// portrait rather than crops of the wide ones.
//
// Things in the studio can be walked up to. /studio is the view from the door; clicking the
// music corner goes to /studio/music and the laptop to /studio/laptop, and a pre-rendered
// video walks the camera over to the close-up (and another walks back when you leave). The
// live parts of each are HTML drawn over the render by MusicCorner and Workstation, placed
// with the camera each frame was rendered from, so they stay put in the scene while the camera
// moves. People who asked for reduced motion get the stills and a cut instead of the loops and
// walks.
function Studio() {
  const pathname = usePathname()
  const target: View = PATHS[pathname] ?? 'overview'
  const framing: FramingName = useMediaQuery('(orientation: portrait)') ? 'portrait' : 'landscape'
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const rootRef = useRef<HTMLElement>(null)
  const walkRefs = useRef<Record<CloseUp, HTMLVideoElement | null>>({ music: null, laptop: null, easel: null })
  const loopRef = useRef<HTMLVideoElement>(null)
  const walkedIn = useRef(false) // whether /studio is the history entry before this one
  const { width, height } = useSize(rootRef)

  const [view, setView] = useState<View>(target) // the shot underneath, when not walking
  const [walk, setWalk] = useState<Walk | null>(null)
  const [walkFrame, setWalkFrame] = useState(0)
  const [loadedStill, setLoadedStill] = useState<string | null>(null)
  const [wideStill, setWideStill] = useState(false) // the still on screen is wider than the frame (see usePan)
  const [hint, setHint] = useState<'unseen' | 'showing' | 'closed'>('unseen')

  const shots = SHOTS[framing]
  const still = shots[view].still

  // Follow the URL, one walk at a time (state adjusted while rendering, React's pattern for
  // reacting to a change in something outside it)
  if (walk && (walk.framing !== framing || reducedMotion)) {
    // the screen turned (or motion was turned off) mid-walk: skip to where it was going
    setWalk(null)
    setView(walk.to)
  } else if (walk?.ended && loadedStill === still) {
    // arrived, and the still of this spot is ready underneath the video's last frame
    setWalk(null)
  } else if (!walk && target !== view) {
    if (reducedMotion) {
      setView(target)
    } else {
      // every walk starts or ends at the overview: from one close-up to the other, out first
      const to: View = view === 'overview' || target === 'overview' ? target : 'overview'
      setWalk({ from: view, to, framing, playing: false, ended: false })
      setWalkFrame(0)
    }
  }

  // Set off: the walk video has been preloading since we got here (see its src below). If it
  // can't play, or is still not going after a few seconds on a slow connection, cut straight
  // to where we were going.
  useEffect(() => {
    const video = walk ? walkRefs.current[walkShot(walk)] : null
    if (!walk || walk.playing || walk.ended || !video) return
    let waiting = true
    const cut = () => {
      if (!waiting) return
      setWalk(null)
      setView(walk.to)
    }
    video.currentTime = 0
    video.play().catch(cut)
    const timer = setTimeout(cut, 4000)
    return () => {
      waiting = false
      clearTimeout(timer)
    }
  }, [walk])

  // While walking, keep track of which frame is on screen, so the overlays use its camera. The
  // update is flushed straight away so the overlays move in the same paint as the video frame.
  const walking = walk?.playing ? walkShot(walk) : null
  const walkingTo = walk?.playing ? walk.to : null
  useEffect(() => {
    const video = walking && walkRefs.current[walking]
    if (!video) return
    const { fps, cameras } = scene[framing].walks[walking]
    const last = cameras.length - 1
    return followFrames(video, (time) => flushSync(() => setWalkFrame(Math.min(last, Math.round(time * fps)))))
  }, [walking, framing])

  // The candles in the render flicker; the light the music candle throws on the live overlays
  // (--flicker, see Studio.css) follows it frame by frame, at the moment of the scene the video
  // on screen shows: the loops start at their still's moment (the overview's is 0, a close-up's
  // the end of its walk in), a walk in runs from 0 and a walk out ends at 0. Without video, the
  // still's.
  const settled = !walk
  const overview = settled && view === 'overview'
  const stillTime = (at: View) => (at === 'overview' ? 0 : scene[framing].walks[at].seconds)
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const light = (t: number) => root.style.setProperty('--flicker', candleFlicker(t).toFixed(3))
    const video = walking && walkRefs.current[walking]
    if (walking && walkingTo && video) {
      const { seconds } = scene[framing].walks[walking]
      return followFrames(video, (time) => light(walkingTo === 'overview' ? time - seconds : time))
    }
    if (settled && loopRef.current) return followFrames(loopRef.current, (time) => light(stillTime(view) + time))
    light(stillTime(view))
  })

  // Warm up the other shots' stills, so one is ready by the end of a walk
  useEffect(() => {
    for (const other of ['overview', ...CLOSE_UPS] as View[]) {
      if (other !== view) new Image().src = shots[other].still
    }
  }, [shots, view])

  // On a phone the overview is wider than the screen (see usePan): how it's drawn, slid along
  // by the pan, and how far it can slide each way — only while stood there, not on the walks
  const framingScene = scene[framing]
  const { size: [frameW, frameH], overviewSize } = framingScene
  const scale = Math.max(width / frameW, height / frameH) // what object-fit: cover makes of the frame
  // ...and only once the still that loaded really is wide: the scene file can say so before the
  // renders have caught up, and stretching the frame to that width would be worse than no panning
  const wide = view === 'overview' && overviewSize && wideStill ? { width: overviewSize[0] * scale, height: frameH * scale } : null
  const reach = wide && overview ? Math.max(0, (wide.width - width) / 2) : 0
  const { pan, settle, handlers } = usePan(reach, reducedMotion)
  const wideStyle = wide ? { width: wide.width, height: wide.height, left: (width - wide.width) / 2 - pan, top: (height - wide.height) / 2 } : undefined

  const enter = (shot: CloseUp) =>
    // looking to one side, first glide back to the middle: the walk video sets off from there
    settle(() => {
      walkedIn.current = true
      navigate(`/studio/${shot}`)
    })
  const leave = () => {
    if (walkedIn.current) {
      walkedIn.current = false
      history.back()
    } else {
      navigate('/studio')
    }
  }

  // Escape leaves a close-up — unless the gallery wall is up over the easel's canvas, where
  // it closes that first (Easel listens for it)
  const paintings = pathname === GALLERY
  useEffect(() => {
    if (view === 'overview' || !settled || paintings) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') leave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  let camera = framingScene[view]
  if (walk?.playing) {
    const { cameras } = framingScene.walks[walkShot(walk)]
    camera = cameras[walk.to === 'overview' ? cameras.length - 1 - walkFrame : walkFrame]
  }
  const lens: Lens = { camera, size: framingScene.size, width, height, pan }
  const closeUp = (shot: CloseUp): Lens => ({ camera: framingScene[shot], size: framingScene.size, width, height })

  // The first time you're stood at the door, a note at the top says what to do. It stays until
  // it's closed, or you walk up to something.
  if (overview && hint === 'unseen') setHint('showing')
  else if (!overview && hint === 'showing') setHint('closed')

  return (
    <main className={`studio${walk && !walk.playing ? " is-setting-off" : ""}${reach > 0 ? " is-wide" : ""}`} ref={rootRef} {...handlers}>
      <picture key={view}>
        <source media="(orientation: portrait)" srcSet={SHOTS.portrait[view].still} />
        <img
          className="studio-shot studio-still"
          src={SHOTS.landscape[view].still}
          alt={ALT[view]}
          style={wideStyle}
          // a still that fails to load mustn't hold a finished walk on its last frame for ever
          onLoad={({ currentTarget: { naturalWidth, naturalHeight } }) => {
            setWideStill(naturalWidth * frameH > naturalHeight * frameW * 1.01)
            setLoadedStill(SHOTS[framing][view].still)
          }}
          onError={() => {
            setWideStill(false)
            setLoadedStill(SHOTS[framing][view].still)
          }}
        />
      </picture>
      {!reducedMotion && settled && (
        <video
          // a fresh element per shot and framing, so the other file loads cleanly
          key={`${framing}-${view}`}
          ref={loopRef}
          className="studio-shot studio-loop"
          src={shots[view].loop}
          style={wideStyle}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          aria-hidden="true"
        />
      )}
      {!reducedMotion &&
        CLOSE_UPS.map((shot) => {
          const mine = walk !== null && walkShot(walk) === shot
          // between walks each holds the next walk you could take with its close-up from here,
          // so it's loaded before it's wanted: out of it if you're there, else in to it
          const src = mine ? (walk.to === 'overview' ? shots.walks[shot].out : shots.walks[shot].in) : view === shot ? shots.walks[shot].out : shots.walks[shot].in
          return (
            <video
              key={shot}
              ref={(element) => {
                walkRefs.current[shot] = element
              }}
              className={`studio-shot studio-walk${mine && walk.playing ? ' is-walking' : ''}`}
              src={src}
              preload="auto"
              muted
              playsInline
              disablePictureInPicture
              aria-hidden="true"
              onPlaying={() => {
                if (!walk || walk.playing || walkShot(walk) !== shot) return
                setWalk({ ...walk, playing: true })
                setView(walk.to)
              }}
              onEnded={() => {
                if (walk && walkShot(walk) === shot) setWalk({ ...walk, ended: true })
              }}
              onError={() => {
                if (!walk || walkShot(walk) !== shot) return
                setWalk(null)
                setView(walk.to)
              }}
            />
          )
        })}
      <MusicCorner lens={lens} closeUp={closeUp('music')} focused={settled && view === 'music'} overview={overview} onEnter={() => enter('music')} />
      <Workstation lens={lens} closeUp={closeUp('laptop')} focused={settled && view === 'laptop'} overview={overview} onEnter={() => enter('laptop')} />
      <Easel
        lens={lens}
        closeUp={closeUp('easel')}
        focused={settled && view === 'easel'}
        overview={overview}
        paintings={paintings}
        onEnter={() => enter('easel')}
      />
      <a
        href={view === 'overview' ? '/' : '/studio'}
        className="studio-back"
        hidden={paintings}
        onClick={(event) => {
          if (isModifiedClick(event)) return
          event.preventDefault()
          if (view === 'overview') navigate('/')
          else leave()
        }}
      >
        ← back
      </a>
      {hint === 'showing' && (
        <div className="studio-hint" role="status">
          {reach > 0 ? 'swipe to look around, press things' : 'explore by pressing on things'}
          <button type="button" className="studio-hint-close" aria-label="Close" onClick={() => setHint('closed')}>
            <svg viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" />
            </svg>
          </button>
        </div>
      )}
    </main>
  )
}

export default Studio
