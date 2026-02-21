// Jelian FT — Service Worker
// ⚠️  Cambia el número al desplegar: v136 → v137 → v138...
const CACHE_NAME = 'jelianft-v136';

self.addEventListener('install', (event) => {
  // Forzar activación inmediata sin esperar a que cierren las tabs
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['./index.html']).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // No interceptar peticiones externas (Supabase, APIs, etc.)
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('anthropic.com')) return;
  if (url.hostname.includes('fonts.googleapis.com')) return;
  if (url.hostname.includes('fonts.gstatic.com')) return;

  // index.html y raíz → siempre red primero (chequeo de versión)
  if (url.pathname === '/' || url.pathname.endsWith('index.html') || url.pathname.endsWith('paciente.html') || url.pathname.endsWith('fisiofinal/')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then((res) => {
          // FIX: clone ANTES de cualquier otra operación
          try {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, copy)).catch(() => {});
          } catch (_) {}
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // CDN libs (jsdelivr, tailwind, etc.) → cache-first
  if (url.hostname.includes('jsdelivr') || url.hostname.includes('tailwindcss') || url.hostname.includes('cdnjs')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          if (res && res.status === 200) {
            // FIX: clone ANTES de retornar
            try {
              const copy = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(event.request, copy)).catch(() => {});
            } catch (_) {}
          }
          return res;
        }).catch(() => { /* sin red, sin caché: nada */ });
      })
    );
    return;
  }

  // Resto de recursos del mismo origen → network-first con fallback a caché
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            // FIX: clone ANTES de retornar
            try {
              const copy = res.clone();
              caches.open(CACHE_NAME).then(c => c.put(event.request, copy)).catch(() => {});
            } catch (_) {}
          }
          return res;
        })
        .catch(() => caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
        }))
    );
    return;
  }

  // Cualquier otra petición: dejar pasar sin interceptar
});
