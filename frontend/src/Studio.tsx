import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { flushSync } from 'react-dom'
import './Studio.css'
import studioLandscape from './assets/studio-landscape.jpg'
import studioLandscapeLoop from './assets/studio-landscape.mp4'
import studioMusicLandscape from './assets/studio-music-landscape.jpg'
import studioMusicLandscapeLoop from './assets/studio-music-landscape.mp4'
import studioMusicPortrait from './assets/studio-music-portrait.jpg'
import studioMusicPortraitLoop from './assets/studio-music-portrait.mp4'
import studioPortrait from './assets/studio-portrait.jpg'
import studioPortraitLoop from './assets/studio-portrait.mp4'
import studioWalkInLandscape from './assets/studio-walk-in-landscape.mp4'
import studioWalkInPortrait from './assets/studio-walk-in-portrait.mp4'
import studioWalkOutLandscape from './assets/studio-walk-out-landscape.mp4'
import studioWalkOutPortrait from './assets/studio-walk-out-portrait.mp4'
import MusicCorner from './MusicCorner'
import { isModifiedClick, navigate, usePathname } from './router'
import { candleFlicker, scene, type Lens } from './studioScene'

type View = 'overview' | 'music'
type FramingName = 'landscape' | 'portrait'

const SHOTS = {
  landscape: {
    overview: { still: studioLandscape, loop: studioLandscapeLoop },
    music: { still: studioMusicLandscape, loop: studioMusicLandscapeLoop },
    walkIn: studioWalkInLandscape,
    walkOut: studioWalkOutLandscape,
  },
  portrait: {
    overview: { still: studioPortrait, loop: studioPortraitLoop },
    music: { still: studioMusicPortrait, loop: studioMusicPortraitLoop },
    walkIn: studioWalkInPortrait,
    walkOut: studioWalkOutPortrait,
  },
}

const ALT = {
  overview:
    'An empty warehouse studio in black and white: rows of fluorescent tubes hanging from a dark beamed ceiling with my name hanging off them letter by letter, a blackboard mid-hall reading "A theoretical physics student", and beside it a record player on a wooden box in front of a second blackboard, with a candle glowing warm on a crate at its right',
  music: 'Close up on the record player spinning on its wooden box, in front of a blackboard with my top artists pinned up on it, lit warm from the right by a Carby Musk candle burning in its navy glass on a little crate',
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

// A walk between the two shots: where to, which framing it started in, and how far it's got
type Walk = { to: View; framing: FramingName; playing: boolean; ended: boolean }

// The studio is a rendered photo (see tools/studio-render): a JPEG still that paints at
// once, and on top of it a short seamless video loop of the same frame (the hanging name
// sways, the record turns) that plays once it has loaded. Its first frame is the still, so
// the hand-over is invisible. Tall screens get separate renders framed for portrait rather
// than crops of the wide ones.
//
// Things in the studio can be walked up to. /studio is the view from the door; clicking the
// music corner goes to /studio/music, and a pre-rendered video walks the camera over to the
// close-up (and another walks back when you leave). The live parts of the corner are HTML
// drawn over the render by MusicCorner, placed with the camera each frame was rendered from,
// so they stay put in the scene while the camera moves. People who asked for reduced motion
// get the stills and a cut instead of the loops and walks.
function Studio() {
  const pathname = usePathname()
  const target: View = pathname === '/studio/music' ? 'music' : 'overview'
  const framing: FramingName = useMediaQuery('(orientation: portrait)') ? 'portrait' : 'landscape'
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const rootRef = useRef<HTMLElement>(null)
  const walkRef = useRef<HTMLVideoElement>(null)
  const loopRef = useRef<HTMLVideoElement>(null)
  const walkedIn = useRef(false) // whether /studio is the history entry before this one
  const { width, height } = useSize(rootRef)

  const [view, setView] = useState<View>(target) // the shot underneath, when not walking
  const [walk, setWalk] = useState<Walk | null>(null)
  const [walkFrame, setWalkFrame] = useState(0)
  const [loadedStill, setLoadedStill] = useState<string | null>(null)

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
      setWalk({ to: target, framing, playing: false, ended: false })
      setWalkFrame(0)
    }
  }

  // Set off: the walk video has been preloading since we got here (see its src below). If it
  // can't play, or is still not going after a few seconds on a slow connection, cut straight
  // to where we were going.
  useEffect(() => {
    const video = walkRef.current
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
  useEffect(() => {
    const video = walkRef.current
    if (!video || !walk?.playing) return
    const { fps } = scene.walk
    const last = scene[walk.framing].walk.length - 1
    return followFrames(video, (time) => flushSync(() => setWalkFrame(Math.min(last, Math.round(time * fps)))))
  }, [walk?.playing, walk?.framing])

  // The candle in the render flickers; the light it throws on the live overlays (--flicker, see
  // Studio.css) follows it frame by frame, at the moment of the scene the video on screen shows:
  // the loops start at their still's moment (the overview's is 0, the close-up's the end of the
  // walk in), the walk in runs from 0 and the walk out ends at 0. Without video, the still's.
  const settled = !walk
  const walkingTo = walk?.playing ? walk.to : null
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const light = (t: number) => root.style.setProperty('--flicker', candleFlicker(t).toFixed(3))
    const stillTime = view === 'music' ? scene.walk.seconds : 0
    if (walkingTo && walkRef.current) {
      return followFrames(walkRef.current, (time) => light(walkingTo === 'music' ? time : time - scene.walk.seconds))
    }
    if (settled && loopRef.current) return followFrames(loopRef.current, (time) => light(stillTime + time))
    light(stillTime)
  }, [view, walkingTo, settled, framing, reducedMotion])

  // Warm up the other shot's still, so it's ready by the end of a walk
  useEffect(() => {
    new Image().src = shots[view === 'overview' ? 'music' : 'overview'].still
  }, [shots, view])

  const enter = () => {
    walkedIn.current = true
    navigate('/studio/music')
  }
  const leave = () => {
    if (walkedIn.current) {
      walkedIn.current = false
      history.back()
    } else {
      navigate('/studio')
    }
  }

  useEffect(() => {
    if (view !== 'music' || !settled) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') leave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const framingScene = scene[framing]
  const frames = framingScene.walk
  const camera = walk?.playing ? frames[walk.to === 'music' ? walkFrame : frames.length - 1 - walkFrame] : framingScene[view]
  const lens: Lens = { camera, size: framingScene.size, width, height }
  const closeUp: Lens = { camera: framingScene.music, size: framingScene.size, width, height }

  return (
    <main className={`studio${walk && !walk.playing ? " is-setting-off" : ""}`} ref={rootRef}>
      <picture key={view}>
        <source media="(orientation: portrait)" srcSet={SHOTS.portrait[view].still} />
        <img
          className="studio-shot studio-still"
          src={SHOTS.landscape[view].still}
          alt={ALT[view]}
          // a still that fails to load mustn't hold a finished walk on its last frame for ever
          onLoad={() => setLoadedStill(SHOTS[framing][view].still)}
          onError={() => setLoadedStill(SHOTS[framing][view].still)}
        />
      </picture>
      {!reducedMotion && settled && (
        <video
          // a fresh element per shot and framing, so the other file loads cleanly
          key={`${framing}-${view}`}
          ref={loopRef}
          className="studio-shot studio-loop"
          src={shots[view].loop}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          aria-hidden="true"
        />
      )}
      {!reducedMotion && (
        <video
          ref={walkRef}
          className={`studio-shot studio-walk${walk?.playing ? ' is-walking' : ''}`}
          // between walks this is the next walk from here, so it's loaded before it's wanted
          src={(walk ? walk.to : view === 'overview' ? 'music' : 'overview') === 'music' ? shots.walkIn : shots.walkOut}
          preload="auto"
          muted
          playsInline
          disablePictureInPicture
          aria-hidden="true"
          onPlaying={() => {
            if (!walk || walk.playing) return
            setWalk({ ...walk, playing: true })
            setView(walk.to)
          }}
          onEnded={() => {
            if (walk) setWalk({ ...walk, ended: true })
          }}
          onError={() => {
            if (!walk) return
            setWalk(null)
            setView(walk.to)
          }}
        />
      )}
      <MusicCorner lens={lens} closeUp={closeUp} focused={settled && view === 'music'} overview={settled && view === 'overview'} onEnter={enter} />
      <a
        href={view === 'music' ? '/studio' : '/'}
        className="studio-back"
        onClick={(event) => {
          if (isModifiedClick(event)) return
          event.preventDefault()
          if (view === 'music') leave()
          else navigate('/')
        }}
      >
        ← back
      </a>
    </main>
  )
}

export default Studio
