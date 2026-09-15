import { useSyncExternalStore } from 'react'
import './Studio.css'
import studioLandscape from './assets/studio-landscape.jpg'
import studioLandscapeLoop from './assets/studio-landscape.mp4'
import studioPortrait from './assets/studio-portrait.jpg'
import studioPortraitLoop from './assets/studio-portrait.mp4'
import { isModifiedClick, navigate } from './router'

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

// The studio is a rendered photo (see tools/studio-render): a JPEG still that paints at
// once, and on top of it a short seamless video loop of the same frame, in which the
// hanging name sways, that plays once it has loaded. Its first frame is the still, so the
// hand-over is invisible. Tall screens get a separate render framed for portrait rather
// than a crop of the wide one. People who asked for reduced motion just get the still.
function Studio() {
  const portrait = useMediaQuery('(orientation: portrait)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  return (
    <main className="studio">
      <picture>
        <source media="(orientation: portrait)" srcSet={studioPortrait} />
        <img
          className="studio-photo"
          src={studioLandscape}
          alt="An empty warehouse studio in black and white: rows of fluorescent tubes hanging from a dark beamed ceiling, a bare stud wall down one side, a stained white wall down the other, and a lit loading door at the far end"
        />
      </picture>
      {!reducedMotion && (
        <video
          // a fresh element per framing, so the other file loads cleanly when a phone turns
          key={portrait ? 'portrait' : 'landscape'}
          className="studio-photo studio-loop"
          src={portrait ? studioPortraitLoop : studioLandscapeLoop}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          aria-hidden="true"
        />
      )}
      <a
        href="/"
        className="studio-back"
        onClick={(event) => {
          if (isModifiedClick(event)) return
          event.preventDefault()
          navigate('/')
        }}
      >
        ← back
      </a>
    </main>
  )
}

export default Studio
