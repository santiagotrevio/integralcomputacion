// ── Integral Computación — Service Worker ─────────────────────────────────────
// Versión: incrementar al hacer cambios para invalidar caché
const CACHE_VERSION = 'integral-v1';

// Recursos que siempre se cachean al instalar la PWA
const PRECACHE = [
    '/admin/cotizador.html',
    '/admin/manifest.json',
    '/admin/icon-192.png',
    '/admin/apple-touch-icon.png',
];

// ── Instalación: pre-cachear recursos esenciales ──────────────────────────────
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_VERSION).then(cache => cache.addAll(PRECACHE))
    );
});

// ── Activación: limpiar cachés viejas ─────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// ── Fetch: Network-first con fallback a caché ─────────────────────────────────
// • Llamadas /api/* → siempre red (nunca cachear datos dinámicos)
// • Assets estáticos → caché primero, luego red
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // API calls: siempre red, sin caché
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() =>
                new Response(JSON.stringify({ error: 'Sin conexión' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                })
            )
        );
        return;
    }

    // Todo lo demás: red primero, caché como fallback
    event.respondWith(
        fetch(event.request)
            .then(res => {
                // Cachear respuestas exitosas de recursos estáticos
                if (res.ok && ['GET'].includes(event.request.method)) {
                    const clone = res.clone();
                    caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
                }
                return res;
            })
            .catch(() => caches.match(event.request))
    );
});
