const CACHE_NAME = 'meihua-v3.8.50';
const SHELL_ASSETS = [
    '/',
    '/index.html'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Never cache API calls (AI streaming endpoints)
    if (request.url.includes('/v1/') || request.url.includes('/api/')) {
        return;
    }

    // Network-first: always try to get the latest version
    event.respondWith(
        fetch(request)
            .then(response => {
                if (!response || response.status !== 200) {
                    return response;
                }
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
                return response;
            })
            .catch(() => caches.match(request))
    );
});
