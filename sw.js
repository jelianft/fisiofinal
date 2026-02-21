// Jelian FT — Service Worker v1
// Cachea los assets principales para funcionamiento offline

const CACHE_NAME = 'jelianft-v1';
const ASSETS = [
  './',
  './index.html',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js',
];

// Instalacion: precachear assets clave
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['./index.html']).catch(() => {});
    }).then(() => self.skipWaiting())
  );
});

// Activacion: limpiar caches antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first para Supabase, cache-first para assets locales
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase y APIs externas: siempre red, sin cache
  if (url.hostname.includes('supabase.co') || url.hostname.includes('anthropic.com')) {
    return; // dejar pasar normalmente
  }

  // Assets locales: cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cachear solo respuestas exitosas de mismo origen o CDNs
        if (response && response.status === 200 && (url.origin === self.location.origin || url.hostname.includes('jsdelivr') || url.hostname.includes('tailwindcss'))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback: devolver index.html para rutas de la app
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
