import './App.css'
import Home from './Home'
import SpotifyPage from './SpotifyPage'
import Studio from './Studio'
import { usePathname } from './router'

function App() {
  const pathname = usePathname()

  switch (pathname) {
    case '/studio':
    case '/studio/music':
      return <Studio />
    case '/spotify':
      return <SpotifyPage />
    default:
      return <Home />
  }
}

export default App
