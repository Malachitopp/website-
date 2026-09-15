import SnoopyLedge from './SnoopyLedge'
import { useNowPlaying } from './spotify'

function NowPlaying() {
  const data = useNowPlaying()

  return (
    <div className="now-playing">
      {!data && <p>Loading...</p>}
      {data && !data.is_playing && <p>Not listening to anything right now</p>}
      {data?.is_playing && (
        <>
          {data.albumArt && (
            <div className="peek-wrapper">
              <SnoopyLedge />
              <img src={data.albumArt} width={120} alt={`${data.track} album art`} />
            </div>
          )}
          <p>
            <a href={data.songUrl} target="_blank" rel="noreferrer">
              {data.track}
            </a>
            {' — '}
            {data.artist}
          </p>
        </>
      )}
    </div>
  )
}

export default NowPlaying
