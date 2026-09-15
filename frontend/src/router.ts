import { useSyncExternalStore, type MouseEvent } from 'react'

// A tiny History-API router: the URL is the single source of truth and components
// re-render when it changes. pushState doesn't fire any event on its own, so
// navigate() dispatches one that subscribers listen for alongside popstate
// (back/forward buttons).
const NAVIGATE_EVENT = 'app:navigate'

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange)
  window.addEventListener(NAVIGATE_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(NAVIGATE_EVENT, onChange)
  }
}

export function usePathname() {
  return useSyncExternalStore(subscribe, () => window.location.pathname)
}

export function navigate(to: string) {
  if (to === window.location.pathname) return
  window.history.pushState(null, '', to)
  window.scrollTo(0, 0)
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
}

// Clicks the browser should keep handling itself: new tab/window, middle click, etc.
export function isModifiedClick(event: MouseEvent) {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}
