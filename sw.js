const ROMA_FINANZAS_CACHE = 'roma-finanzas-v2';

const LOCAL_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './app.js',
    './utils/supabase.js',
    './utils/finance.js',
    './utils/mockData.js',
    './utils/store.js',
    './components/BottomNav.js',
    './components/TopBar.js',
    './views/Login.js',
    './views/Dashboard.js',
    './views/Income.js',
    './views/Expenses.js',
    './views/Menu.js',
    './views/Services.js',
    './views/Materials.js',
    './views/CostSheet.js',
    './views/Config.js',
    './vendor/bcrypt.min.js',
    './vendor/react.production.min.js',
    './vendor/react-dom.production.min.js',
    './vendor/babel.min.js',
    './vendor/supabase.min.js',
    './vendor/tailwind-browser.js',
    './vendor/lucide.css',
    './vendor/lucide.woff2',
    './vendor/lucide.ttf',
    './icons/icon-192x192.png',
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
    const isSupabaseApi = url.hostname.includes('supabase.co');

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
