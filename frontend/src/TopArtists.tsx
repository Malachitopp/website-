import { useState } from 'react'
import { useTopArtists, type TimeRange } from './spotify'

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'short_term', label: 'Last 4 weeks' },
  { value: 'medium_term', label: 'Last 6 months' },
]

function TopArtists() {
  const [timeRange, setTimeRange] = useState<TimeRange>('medium_term')
  const { artists } = useTopArtists(timeRange)

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
