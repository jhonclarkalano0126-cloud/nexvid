import { render } from 'preact'
import './index.css'
import App from './app.jsx'

render(<App />, document.getElementById('app'))

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .catch((error) => {
        console.error('Service Worker registration failed:', error)
      })
  })
}
