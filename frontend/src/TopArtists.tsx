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
  { value: 'long_term', label: 'All time' },
]

function TopArtists() {
  const [artists, setArtists] = useState<Artist[] | null>(null)
  const [timeRange, setTimeRange] = useState('medium_term')

  useEffect(() => {
    setArtists(null)
    fetch(`/api/top/artists?time_range=${timeRange}`)
      .then((res) => res.json())
      .then(setArtists)
      .catch(() => setArtists([]))
  }, [timeRange])

  return (
    <div>
      <div className="time-range-buttons">
        {TIME_RANGES.map((range) => (
          <button
            key={range.value}
            type="button"
            disabled={range.value === timeRange}
            onClick={() => setTimeRange(range.value)}
          >
            {range.label}
          </button>
        ))}
      </div>

      {!artists && <p>Loading...</p>}
      {artists && artists.length === 0 && <p>Couldn't load top artists</p>}
      {artists && artists.length > 0 && (
        <ol className="top-artists">
          {artists.map((artist) => (
            <li key={artist.name}>
              {artist.image && <img src={artist.image} width={80} alt={`${artist.name}`} />}
              <a href={artist.spotifyUrl} target="_blank" rel="noreferrer">
                {artist.name}
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default TopArtists
