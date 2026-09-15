import { useEffect, useState } from 'react'
import SnoopyLedge from './SnoopyLedge'

type NowPlayingData = {
  is_playing: boolean
  track?: string
  artist?: string
  albumArt?: string
  songUrl?: string
}

function NowPlaying() {
  const [data, setData] = useState<NowPlayingData | null>(null)

  useEffect(() => {
    const fetchNowPlaying = () => {
      fetch('/api/now-playing')
        .then((res) => {
          if (!res.ok) throw new Error(res.statusText)
          return res.json()
        })
        .then(setData)
        .catch(() => setData({ is_playing: false }))
    }

    fetchNowPlaying()
    const interval = setInterval(fetchNowPlaying, 10000)

    return () => clearInterval(interval)
  }, [])

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
