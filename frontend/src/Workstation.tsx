import { useEffect, useState, type CSSProperties } from 'react'
import studioLandscape from './assets/studio-landscape.jpg'
import { planeTransform, project, scene, type Lens } from './studioScene'

// The laptop's screen inside its bezel is 298 × 186 mm; the home screen is laid out at 4 px to the mm
const SCREEN_W = 1192
const SCREEN_H = 745

const GITHUB = 'https://github.com/Malachitopp'
// GitHub's mark (the octicon, on a 16 × 16 grid), the same one the render shows on the screen
const GITHUB_MARK =
  'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z'

// The shortcuts on the home screen: where they go and what to call them
const SHORTCUTS = [{ name: 'GitHub', href: GITHUB, mark: GITHUB_MARK }]

type Props = {
  lens: Lens // the camera the page shows right now (it moves during a walk)
  closeUp: Lens // the laptop close-up's camera: the home screen is sized to how big it shows the screen
  focused: boolean // standing at the laptop: its screen is on and can be used
  overview: boolean // standing at the overview: the work station is something to click
  onEnter: () => void
}

// The work station's live part: the laptop's screen. In the render it shows GitHub's mark; walk
// up to it and it wakes to a home screen laid over the render's screen through the camera, with
// a shortcut for every place my work lives (just GitHub so far). From the overview the whole
// table is a button that walks you over.
function Workstation({ lens, closeUp, focused, overview, onEnter }: Props) {
  return (
    <div className="studio-overlay">
      {focused && <Screen lens={lens} closeUp={closeUp} />}
      {overview && <Hotspot lens={lens} onEnter={onEnter} />}
    </div>
  )
}

// The screen, awake: it comes up from the mark the render shows (drawn again here, exactly over
// it, so nothing jumps) to the home screen. Text and icons are sized by how big a pixel of the
// screen is on the real screen at the close-up, so they read on a phone as well as a monitor.
function Screen({ lens, closeUp }: { lens: Lens; closeUp: Lens }) {
  const { laptopScreen } = scene.anchors
  const left = project(closeUp, laptopScreen[0]), right = project(closeUp, laptopScreen[1])
  const px = Math.max(0.05, Math.hypot(right.x - left.x, right.y - left.y) / SCREEN_W)
  return (
    <div className="laptop-screen" style={{ transform: planeTransform(lens, laptopScreen, SCREEN_W, SCREEN_H), '--px': px } as CSSProperties}>
      <div className="home-screen">
        <img className="home-wallpaper" src={studioLandscape} alt="" draggable={false} />
        <div className="home-bar">
          <span className="home-bar-name">malachi's laptop</span>
          <Clock />
        </div>
        <ul className="home-icons" aria-label="Shortcuts">
          {SHORTCUTS.map((shortcut) => (
            <li key={shortcut.href}>
              <a className="home-icon" href={shortcut.href} target="_blank" rel="noreferrer">
                <span className="home-tile" aria-hidden="true">
                  <svg viewBox="0 0 16 16">
                    <path d={shortcut.mark} />
                  </svg>
                </span>
                <span className="home-label">{shortcut.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <div className="lock-screen" aria-hidden="true">
        <svg viewBox="0 0 16 16">
          <path d={GITHUB_MARK} />
        </svg>
      </div>
    </div>
  )
}

// The time, as a laptop's menu bar shows it
function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000)
    return () => clearInterval(timer)
  }, [])
  const day = now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <time className="home-clock" dateTime={now.toISOString()}>
      {day}  {time}
    </time>
  )
}

// A button over the whole work station as the overview camera sees it
function Hotspot({ lens, onEnter }: { lens: Lens; onEnter: () => void }) {
  const points = scene.anchors.workstation.map((p) => project(lens, p))
  const left = Math.min(...points.map((p) => p.x)), right = Math.max(...points.map((p) => p.x))
  const top = Math.min(...points.map((p) => p.y)), bottom = Math.max(...points.map((p) => p.y))
  return (
    <button
      type="button"
      className="studio-hotspot"
      style={{ left, top, width: right - left, height: bottom - top }}
      aria-label="Walk over to the laptop and my links"
      onClick={onEnter}
    />
  )
}

export default Workstation
