const CACHE_NAME = 'nexvid-shell-v1';

// Keep YouTube/API requests fresh. Do not cache video data.
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
      await self.clients.claim()
    })()
  )
})

// Network-only: no stale cached YouTube content.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
