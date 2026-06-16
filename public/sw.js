const CACHE_NAME = 'apu-engine-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

const SKIP_HOSTS = [
  'googleapis.com', 'accounts.google.com', 'gstatic.com',
  'esm.sh', 'cdnjs.cloudflare.com', 'fonts.googleapis.com',
  'cdn.tailwindcss.com', 'generativelanguage.googleapis.com'
];

self.addEventListener('fetch', event => {
  const url = event.request.url;
  const isApi = url.includes('/api/');
  const isExternal = SKIP_HOSTS.some(host => url.includes(host));

  if (isApi || isExternal || event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached =>
          cached || new Response('Sin conexion — abre la app cuando tengas internet para actualizar el cache.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          })
        )
      )
  );
});
