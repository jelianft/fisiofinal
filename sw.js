// Jelian FT — Service Worker
// ⚠️  Sube el número cada vez que despliegues: v136 → v137 → v138...
const CACHE_NAME = 'jelianft-v136';

// Instalación: cachear index.html
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['./index.html']).catch(() => {});
    })
  );
  // NO llamamos skipWaiting aquí — lo controla el cliente (index.html)
});

// Activación: limpiar cachés viejas y tomar control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Mensaje desde index.html: activar nueva versión automáticamente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // APIs externas: siempre red, sin caché
  if (url.hostname.includes('supabase.co') || url.hostname.includes('anthropic.com')) {
    return;
  }

  // index.html → Network-first: siempre busca la versión más reciente del servidor
  if (url.pathname === '/' || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Resto → Cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 &&
          (url.origin === self.location.origin ||
           url.hostname.includes('jsdelivr') ||
           url.hostname.includes('tailwindcss'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
