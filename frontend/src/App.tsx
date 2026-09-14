import './App.css'
import NowPlaying from './NowPlaying'

function App() {
  return (
    <>
      <section id="center">
        <h1>Now playing</h1>
        <NowPlaying />
        <a href="http://127.0.0.1:3000/login">Log in with Spotify</a>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
