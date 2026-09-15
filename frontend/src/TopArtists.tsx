import { useEffect, useState } from 'react'

type Artist = {
  name: string
  image?: string
  genres: string[]
  spotifyUrl: string
}

const TIME_RANGES = [
  { value: 'short_term', label: 'Last 4 weeks' },
  { value: 'medium_term', label: 'Last 6 months' },
]

function TopArtists() {
  const [artists, setArtists] = useState<Artist[] | null>(null)
  const [timeRange, setTimeRange] = useState('medium_term')

  useEffect(() => {
    let ignore = false
    fetch(`/api/top/artists?time_range=${timeRange}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.statusText)
        return res.json()
      })
      .then((data) => {
        if (!ignore) setArtists(data)
      })
      .catch(() => {
        if (!ignore) setArtists([])
      })
    return () => {
      ignore = true
    }
  }, [timeRange])

  const selectTimeRange = (value: string) => {
    setArtists(null)
    setTimeRange(value)
  }

  return (
    <div>
      <div className="time-range-buttons">
        {TIME_RANGES.map((range) => (
          <button
            key={range.value}
            type="button"
            disabled={range.value === timeRange}
            onClick={() => selectTimeRange(range.value)}
          >
            {range.label}
          </button>
        ))}
      </div>

      {!artists && <p>Loading...</p>}
      {artists && artists.length === 0 && <p>Couldn't load top artists</p>}
      {artists && artists.length > 0 && (
        <table className="top-artists">
          <tbody>
            {artists.map((artist, index) => (
              <tr key={artist.spotifyUrl}>
                <td className="artist-rank">{index + 1}</td>
                <td className="artist-image">
                  {artist.image && <img src={artist.image} width={80} alt={`${artist.name}`} />}
                </td>
                <td className="artist-name">
                  <a href={artist.spotifyUrl} target="_blank" rel="noreferrer">
                    {artist.name}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default TopArtists
