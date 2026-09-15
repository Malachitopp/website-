import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import './Home.css'
import babyMe1200 from './assets/baby-me-1200.jpg'
import babyMe2000 from './assets/baby-me-2000.jpg'
import ThoughtCloud from './ThoughtCloud'
import { isModifiedClick, navigate } from './router'

// Keep in sync with the .thought-cloud transform transition in Home.css
const ZOOM_MS = 800

type Zoom = { x: number; y: number; scale: number }

function goToStudio() {
  // Cross-fade from the zoomed-in cloud to the studio page where the browser supports
  // it; the leftover bits of cloud and photo in the corners melt away
  if ('startViewTransition' in document) {
    document.startViewTransition(() => flushSync(() => navigate('/studio')))
  } else {
    navigate('/studio')
  }
}

function Home() {
  const cloudRef = useRef<HTMLAnchorElement>(null)
  const [zoom, setZoom] = useState<Zoom | null>(null)
  // The bubble waits for the photo, so it doesn't pop out of an empty dark screen
  const [photoReady, setPhotoReady] = useState(false)

  useEffect(() => {
    if (!zoom) return
    const timer = setTimeout(goToStudio, ZOOM_MS)
    return () => clearTimeout(timer)
  }, [zoom])

  function enterStudio(event: MouseEvent<HTMLAnchorElement>) {
    if (isModifiedClick(event)) return
    event.preventDefault()
    if (zoom) return

    const cloud = cloudRef.current
    const drawing = cloud?.querySelector('svg')
    if (!cloud || !drawing || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigate('/studio')
      return
    }

    // Blow the cloud up until its solid middle covers the whole screen, so the page
    // swap happens on plain cream. The biggest rectangle inside the cloud's central
    // ellipse is about half the drawing's width and 0.44 of its height.
    const { innerWidth: vw, innerHeight: vh } = window
    const box = cloud.getBoundingClientRect()
    const svg = drawing.getBoundingClientRect()
    const scale = Math.max(vw / (svg.width * 0.5), vh / (svg.height * 0.44))

    // The zoom scales around the link's centre, but the drawing's centre can be a few
    // pixels off it (the bob animation), so solve for the shift that lands it mid-screen.
    const boxX = box.left + box.width / 2
    const boxY = box.top + box.height / 2
    const svgX = svg.left + svg.width / 2
    const svgY = svg.top + svg.height / 2
    setZoom({
      x: vw / 2 - boxX - scale * (svgX - boxX),
      y: vh / 2 - boxY - scale * (svgY - boxY),
      scale,
    })
  }

  const zoomStyle = zoom
    ? ({
        '--zoom-x': `${zoom.x}px`,
        '--zoom-y': `${zoom.y}px`,
        '--zoom-scale': zoom.scale,
      } as CSSProperties)
    : undefined

  return (
    <main className={['home', photoReady && 'photo-ready', zoom && 'is-entering'].filter(Boolean).join(' ')}>
      <img
        className="home-photo"
        src={babyMe2000}
        srcSet={`${babyMe1200} 1200w, ${babyMe2000} 2000w`}
        sizes="max(100vw, 134vh)"
        alt="Me as a baby, grinning in a red car seat"
        onLoad={() => setPhotoReady(true)}
        onError={() => setPhotoReady(true)}
      />

      <div className="thought">
        <span className="thought-dot thought-dot--1" />
        <span className="thought-dot thought-dot--2" />
        <span className="thought-dot thought-dot--3" />
        <a
          ref={cloudRef}
          href="/studio"
          className="thought-cloud"
          style={zoomStyle}
          onClick={enterStudio}
          aria-label="Step inside my studio"
        >
          <span className="thought-cloud__pop">
            <ThoughtCloud />
          </span>
        </a>
      </div>
    </main>
  )
}

export default Home
