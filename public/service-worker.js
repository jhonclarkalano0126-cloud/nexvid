const CACHE_NAME = 'nexvid-shell-v1'

// Keep this worker intentionally lightweight: live YouTube/API requests
// should always go to the network and must not be cached as stale feed data.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      await self.clients.claim()
    })()
  )
})
