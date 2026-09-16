import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useNowPlaying, useTopArtists, type TimeRange } from './spotify'
import { candleWarmth, planeTransform, project, quadNormal, quadPoint, scene, visiblePart, type Lens } from './studioScene'

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'short_term', label: 'past 4 weeks' },
  { value: 'medium_term', label: 'past 6 months' },
]

// The music board's slate is 2 × 1 m, laid out at 1 px = 1 mm
const BOARD_W = 2000
const BOARD_H = 1000
// and so are the 12" sleeve by the box and the floor under it
const SLEEVE = 314
const SHADOW_W = 394
const SHADOW_H = 196
const SHEET_GAP = 40
// small turns for the pinned sheets, so they look put up by hand
const TILTS = [-2.2, 1.4, -0.8, 2, -1.5]

type Props = {
  lens: Lens // the camera the page shows right now (it moves during a walk)
  closeUp: Lens // the music close-up's camera: the board is laid out to fit what it sees
  focused: boolean // standing at the music corner: the board can be used
  overview: boolean // standing at the overview: the corner is something to click
  onEnter: () => void
}

// Everything live in the music corner, drawn over the rendered studio and pinned to the
// scene through the camera: my top artists on the music board (A4 prints held up by magnets,
// ranked and named in chalk, with chalk buttons for the time range), cartoon notes coming
// off the record, and what I'm listening to as a hologram above the player with its album
// cover leaning against the box. The candle burning beside the board is in the render; its
// warm light falls on these too. From the overview the whole corner is a button that walks
// you over.
function MusicCorner({ lens, closeUp, focused, overview, onEnter }: Props) {
  const [timeRange, setTimeRange] = useState<TimeRange>('short_term')
  const { artists, latest } = useTopArtists(timeRange)
  const nowPlaying = useNowPlaying()
  const { anchors } = scene
  const boardRef = useRef<HTMLDivElement>(null)

  // The board is written on to suit the close-up: only the part of the slate it shows (all
  // of it on a wide screen, the left end on a phone), five across or three and two.
  const area = visiblePart(closeUp, anchors.musicBoard, BOARD_W, BOARD_H, 12)
  const columns = area.width - 80 >= 5 * 300 + 4 * SHEET_GAP ? 5 : 3
  const inset = columns === 5 ? 40 : 20 // two rows only just fit the height
  const columnWidth = Math.min(340, (area.width - 2 * inset - (columns - 1) * SHEET_GAP) / columns)
  const shown = artists ?? latest ?? []

  // Candlelight on what's on the board: each thing marked data-lit gets --warm, how much of the
  // light on it is the candle's, from where its middle is on the slate (1 px = 1 mm). The
  // layout moves only when the list or the space for it does.
  useLayoutEffect(() => {
    const board = boardRef.current
    if (!board) return
    const normal = quadNormal(anchors.musicBoard)
    for (const element of board.querySelectorAll<HTMLElement>('[data-lit]')) {
      let x = element.offsetWidth / 2, y = element.offsetHeight / 2
      for (let node: Element | null = element; node instanceof HTMLElement && node !== board; node = node.offsetParent) {
        x += node.offsetLeft
        y += node.offsetTop
      }
      element.style.setProperty('--warm', candleWarmth(quadPoint(anchors.musicBoard, x / BOARD_W, y / BOARD_H), normal).toFixed(3))
    }
  }, [anchors.musicBoard, artists, latest, columns, area.left, area.top, area.width, area.height])

  // Notes and hologram are sized from how big a centimetre is at the record, but never so
  // small that they can't be seen or read from across the hall.
  const record = project(lens, anchors.record)
  const cm = Math.max(record.pxPerMetre / 100, 2.4)
  const playing = nowPlaying?.is_playing && nowPlaying.track ? nowPlaying : null
  // None of this is drawn while the corner is behind the camera: at the laptop and the easel your
  // back is to it, and a point behind the lens projects to a mirrored place on screen — which used
  // to leave the hologram, its beam and the notes stuck to the edge of those shots, labelling a
  // record player nobody could see.
  const boardMiddle = project(lens, quadPoint(anchors.musicBoard, 0.5, 0.5))
  const behind = record.z <= 0

  return (
    <div className="studio-overlay">
      {boardMiddle.z > 0 && (
      <div ref={boardRef} className="board-plane" style={{ transform: planeTransform(lens, anchors.musicBoard, BOARD_W, BOARD_H) }} inert={!focused}>
        <div
          className={`board-area${columns === 5 ? "" : " is-compact"}`}
          style={{ left: area.left + inset, top: area.top + inset, width: area.width - 2 * inset, height: area.height - 2 * inset }}
        >
          <div className="board-ranges" role="group" aria-label="Top artists from the">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                type="button"
                className="chalk board-range"
                data-lit
                aria-pressed={range.value === timeRange}
                onClick={() => setTimeRange(range.value)}
              >
                {range.label}
                <svg className="chalk-ring" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M10 25 C 4 9, 58 1, 91 9 C 104 15, 99 35, 52 37 C 17 38, 1 31, 13 13" pathLength="1" />
                </svg>
              </button>
            ))}
          </div>
          {artists?.length === 0 ? (
            <p className="chalk board-message" data-lit>couldn't reach spotify</p>
          ) : (
            <ol className={`board-artists${artists ? '' : ' is-loading'}`} style={{ '--column': `${columnWidth}px` } as CSSProperties}>
              {shown.map((artist, i) => (
                <li key={artist.spotifyUrl} className="board-artist" data-lit style={{ '--tilt': `${TILTS[i % TILTS.length]}deg` } as CSSProperties}>
                  <a className="board-sheet" href={artist.spotifyUrl} target="_blank" rel="noreferrer" aria-label={`${artist.name} on Spotify`}>
                    {artist.image && <img src={artist.image} alt="" />}
                    <span className="board-magnet" />
                  </a>
                  <p className="chalk board-caption">
                    <span className="board-rank">{i + 1}.</span> {artist.name}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
      )}

      {!behind && playing?.albumArt && <AlbumCover key={playing.albumArt} lens={lens} art={playing.albumArt} track={playing.track!} artist={playing.artist} songUrl={playing.songUrl} focused={focused} />}

      {!behind && <Notes x={record.x} y={record.y} cm={cm} />}

      {!behind && playing && <Hologram lens={lens} cm={cm} track={playing.track!} artist={playing.artist} songUrl={playing.songUrl} focused={focused} onEnter={overview ? onEnter : undefined} />}

      {overview && <Hotspot lens={lens} onEnter={onEnter} />}
    </div>
  )
}

// A button over the whole music corner as the overview camera sees it
function Hotspot({ lens, onEnter }: { lens: Lens; onEnter: () => void }) {
  const points = scene.anchors.musicCorner.map((p) => project(lens, p))
  const left = Math.min(...points.map((p) => p.x)), right = Math.max(...points.map((p) => p.x))
  const top = Math.min(...points.map((p) => p.y)), bottom = Math.max(...points.map((p) => p.y))
  return (
    <button
      type="button"
      className="studio-hotspot"
      style={{ left, top, width: right - left, height: bottom - top }}
      aria-label="Walk over to the record player and my top artists"
      onClick={onEnter}
    />
  )
}

type AlbumCoverProps = {
  lens: Lens
  art: string
  track: string
  artist?: string
  songUrl?: string
  focused: boolean
}

// The sleeve of what I'm playing, stood on the floor and leaning back against the right side
// of the box, with its shadow on the floor between them. It faces the candle, and like the
// prints it shows as much of its colour as the candlelight on it brings out, all of it under the
// pointer. Up close it links to the song.
function AlbumCover({ lens, art, track, artist, songUrl, focused }: AlbumCoverProps) {
  const { albumCover, albumShadow } = scene.anchors
  const label = `${track}${artist ? ` by ${artist}` : ''} on Spotify`
  const image = <img src={art} alt="" draggable={false} />
  const warm = candleWarmth(quadPoint(albumCover, 0.5, 0.5), quadNormal(albumCover))
  return (
    <>
      <div className="album-shadow" style={{ transform: planeTransform(lens, albumShadow, SHADOW_W, SHADOW_H) }} aria-hidden="true" />
      <div className="album-plane" style={{ transform: planeTransform(lens, albumCover, SLEEVE, SLEEVE), '--warm': warm.toFixed(3) } as CSSProperties} inert={!focused}>
        {songUrl ? (
          <a className="album-sleeve" href={songUrl} target="_blank" rel="noreferrer" aria-label={label}>
            {image}
          </a>
        ) : (
          <div className="album-sleeve">{image}</div>
        )}
      </div>
    </>
  )
}

// Cartoon notes floating up off the record, one after another
function Notes({ x, y, cm }: { x: number; y: number; cm: number }) {
  return (
    <div className="notes" style={{ left: x, top: y, '--cm': `${cm}px` } as CSSProperties} aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="note">
          {i % 2 === 0 ? (
            <svg viewBox="0 0 48 64">
              <ellipse cx="16" cy="50" rx="11" ry="8" transform="rotate(-22 16 50)" />
              <path d="M23 50 V8 H28 C29 20 44 22 40 42 C37 31 33 27 28 26 V50 Z" />
            </svg>
          ) : (
            <svg viewBox="0 0 56 64">
              <ellipse cx="13" cy="52" rx="11" ry="8" transform="rotate(-22 13 52)" />
              <ellipse cx="41" cy="45" rx="11" ry="8" transform="rotate(-22 41 45)" />
              <path d="M20 52 V13 L52 4 V45 H47 V14 L25 20 V52 Z" />
            </svg>
          )}
        </span>
      ))}
    </div>
  )
}

type HologramProps = {
  lens: Lens
  cm: number
  track: string
  artist?: string
  songUrl?: string
  focused: boolean
  onEnter?: () => void
}

// What I'm listening to, projected above the record player like the label over an item in
// a game: a see-through panel on a beam of light, kept on screen even when the player isn't.
function Hologram({ lens, cm, track, artist, songUrl, focused, onEnter }: HologramProps) {
  const { record } = scene.anchors
  const base = project(lens, record)
  // Up close it floats a hand's width above the player; from across the hall it rises clear of
  // the boards behind, so it labels the corner without covering it. In between it slides.
  const near = Math.min(1, Math.max(0, (base.pxPerMetre - 150) / 250))
  const above = project(lens, [record[0], record[1] + 1.45 - 1.15 * near, record[2]])
  const width = Math.min(340, Math.max(Math.min(180, lens.width * 0.36), 46 * cm))
  const height = width * 0.4 // about what the panel's content makes it
  const margin = 12
  const x = Math.min(Math.max(above.x, margin + width / 2), lens.width - margin - width / 2)
  const y = Math.min(Math.max(above.y, margin + height), lens.height - margin)
  const beam = [
    [base.x - 0.03 * base.pxPerMetre, base.y],
    [base.x + 0.03 * base.pxPerMetre, base.y],
    [x + width * 0.3, y],
    [x - width * 0.3, y],
  ]
  const title = songUrl && focused ? (
    <a className="holo-track" href={songUrl} target="_blank" rel="noreferrer">
      {track}
    </a>
  ) : (
    <span className="holo-track">{track}</span>
  )

  return (
    <>
      <svg className="holo-beam" width={lens.width} height={lens.height} aria-hidden="true">
        <defs>
          <linearGradient id="holo-beam-fade" gradientUnits="userSpaceOnUse" x1={base.x} y1={base.y} x2={x} y2={y}>
            <stop offset="0" stopColor="rgb(190 240 255)" stopOpacity="0.5" />
            <stop offset="1" stopColor="rgb(190 240 255)" stopOpacity="0.06" />
          </linearGradient>
        </defs>
        <polygon points={beam.map((p) => p.join(',')).join(' ')} fill="url(#holo-beam-fade)" />
      </svg>
      <div
        className={`holo${onEnter ? ' is-clickable' : ''}`}
        style={{ left: x, top: y, width, '--w': `${width}px` } as CSSProperties}
        onClick={onEnter}
        role="status"
        aria-label={`Now playing: ${track}${artist ? ` by ${artist}` : ''}`}
      >
        <div className="holo-float">
          <p className="holo-label">
            <span className="holo-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>
            now playing
          </p>
          <p className="holo-title">{title}</p>
          {artist && <p className="holo-artist">{artist}</p>}
        </div>
      </div>
    </>
  )
}

export default MusicCorner
