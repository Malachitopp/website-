import './App.css'
import NowPlaying from './NowPlaying'
import TopArtists from './TopArtists'

function App() {
  return (
    <>
      <section id="center">
        <h1>Now playing</h1>
        <NowPlaying />
        <h1>Top artists</h1>
        <TopArtists />
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
