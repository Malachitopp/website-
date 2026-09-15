import NowPlaying from './NowPlaying'
import TopArtists from './TopArtists'

function SpotifyPage() {
  return (
    <div className="card-page">
      <div className="card-name-wrapper">
        <p className="card-name">Malachi Topp</p>
      </div>

      <section id="center">
        <h1>Now playing</h1>
        <NowPlaying />
        <h1>My Top Artists</h1>
        <TopArtists />
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </div>
  )
}

export default SpotifyPage
