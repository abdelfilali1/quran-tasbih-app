const CACHE_NAME = 'quran-tasbih-v3';
const APP_SHELL = [
  './',
  './index.html',
  './tasbih.html',
  './manifest.webmanifest',
  './css/main.css',
  './css/quran.css',
  './css/tasbih.css',
  './js/api.js',
  './js/pwa.js',
  './js/quran.js',
  './js/tasbih.js',
  './js/utils/quran-utils.js',
  './js/utils/tasbih-utils.js',
  './assets/pattern.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((oldKey) => caches.delete(oldKey))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (!isSameOrigin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        event.waitUntil(
          fetch(event.request)
            .then((fresh) => caches.open(CACHE_NAME).then((cache) => cache.put(event.request, fresh.clone())))
            .catch(() => {})
        );
        return cached;
      }

      return fetch(event.request).then((resp) => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return resp;
      });
    })
  );
});
