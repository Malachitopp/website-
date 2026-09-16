import './App.css'
import Home from './Home'
import SpotifyPage from './SpotifyPage'
import Studio from './Studio'
import { usePathname } from './router'

function App() {
  const pathname = usePathname()

  // Every studio path is the same element, so Studio keeps its state and walks the camera between
  // the shots. /studio/easel/gallery is the easel shot too: the gallery wall is that easel's
  // canvas filled out to the screen.
  switch (pathname) {
    case '/studio':
    case '/studio/music':
    case '/studio/laptop':
    case '/studio/easel':
    case '/studio/easel/gallery':
      return <Studio />
    case '/spotify':
      return <SpotifyPage />
    default:
      return <Home />
  }
}

export default App
