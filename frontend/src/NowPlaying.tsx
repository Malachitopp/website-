import { useEffect, useState } from 'react'

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
    fetch('/api/now-playing')
      .then((res) => res.json())
      .then(setData)
      .catch(() => setData({ is_playing: false }))
  }, [])

  if (!data) {
    return <p>Loading...</p>
  }

  if (!data.is_playing) {
    return <p>Not listening to anything right now</p>
  }

  return (
    <div className="now-playing">
      {data.albumArt && <img src={data.albumArt} width={120} alt={`${data.track} album art`} />}
      <p>
        <a href={data.songUrl} target="_blank" rel="noreferrer">
          {data.track}
        </a>
        {' — '}
        {data.artist}
      </p>
    </div>
  )
}

export default NowPlaying
