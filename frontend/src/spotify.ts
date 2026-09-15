import { useEffect, useState } from 'react'

// Live data from my Spotify, through the backend's /api routes. Shared by the Spotify page
// and the music corner in the studio.

export type NowPlayingData = {
  is_playing: boolean
  track?: string
  artist?: string
  albumArt?: string
  songUrl?: string
}

export type Artist = {
  name: string
  image?: string
  genres?: string[]
  spotifyUrl: string
}

export type TimeRange = 'short_term' | 'medium_term'

// What's playing right now, checked every 10 s. null until the first answer; a failed
// request counts as nothing playing.
export function useNowPlaying() {
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

  return data
}

// My top five artists over a time range. artists is null while that range is loading and []
// if it couldn't be loaded; latest is whatever loaded last, for any range, so a page can keep
// showing the old list while a new one loads.
export function useTopArtists(timeRange: TimeRange) {
  const [result, setResult] = useState<{ timeRange: TimeRange; artists: Artist[] } | null>(null)

  useEffect(() => {
    let ignore = false
    fetch(`/api/top/artists?time_range=${timeRange}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((artists: Artist[]) => {
        if (!ignore) setResult({ timeRange, artists })
      })
      .catch(() => {
        if (!ignore) setResult({ timeRange, artists: [] })
      })
    return () => {
      ignore = true
    }
  }, [timeRange])

  return { artists: result?.timeRange === timeRange ? result.artists : null, latest: result?.artists ?? null }
}
