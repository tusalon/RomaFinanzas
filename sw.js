const ROMA_FINANZAS_CACHE = 'roma-finanzas-__ROMA_APP_VERSION__';
const ROMA_SUPABASE_ORIGIN = '__ROMA_SUPABASE_ORIGIN__';

const LOCAL_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './assets/app.js',
    './assets/app.css',
    './assets/register-sw.js',
    './vendor/lucide.css',
    './vendor/lucide.woff2',
    './vendor/lucide.ttf',
    './vendor/inter-latin.woff2',
    './icons/icon-192x192.png',
    './icons/icon-167x167.png',
    './icons/icon-180x180.png',
    './icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(ROMA_FINANZAS_CACHE)
            .then((cache) => cache.addAll(LOCAL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys
                .filter((key) => key !== ROMA_FINANZAS_CACHE)
                .map((key) => caches.delete(key))
        )).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    const isNavigation = event.request.mode === 'navigate';
    const isSupabaseApi = url.origin === ROMA_SUPABASE_ORIGIN;

    if (isSupabaseApi) {
        event.respondWith(fetch(event.request));
        return;
    }

    if (isNavigation) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(ROMA_FINANZAS_CACHE).then((cache) => cache.put('./index.html', copy));
                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetchPromise = fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(ROMA_FINANZAS_CACHE).then((cache) => cache.put(event.request, copy));
                    }
                    return response;
                })
                .catch(() => cached);

            return cached || fetchPromise;
        })
    );
});
