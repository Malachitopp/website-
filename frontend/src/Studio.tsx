import './Studio.css'
import studioLandscape from './assets/studio-landscape.jpg'
import studioPortrait from './assets/studio-portrait.jpg'
import { isModifiedClick, navigate } from './router'

// The studio is a rendered photo (see tools/studio-render). Tall screens get a
// separate render framed for portrait rather than a crop of the wide one.
function Studio() {
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
