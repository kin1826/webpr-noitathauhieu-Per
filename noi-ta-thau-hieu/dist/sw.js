const CACHE = 'noi-ta-thau-hieu-v8';
const CORE_ASSETS = [
  './', './index.html', './styles.css?v=8', './app.js?v=8', './manifest.webmanifest',
  './assets/favicon-32.png', './assets/apple-touch-icon.png', './assets/icon-192.png', './assets/icon-512.png',
  './assets/logo-192.png', './assets/trai-long-background.jpg',
  './assets/CormorantGaramond-Medium.ttf', './assets/BeVietnamPro-Regular.ttf',
  './data/deck-index.json', './data/trai-long.json', './data/sau-canh-cua.json',
  './data/quyt-ki.json', './data/noi-hay-nam.json', './data/loi-hay-lam.json',
  './data/loi-hay-nam.json', './data/lam-di-dung-noi.json', './data/uong-nhanh-len.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (error) {
      if (request.mode === 'navigate') {
        const offlinePage = await cache.match('./index.html');
        if (offlinePage) return offlinePage;
      }
      throw error;
    }
  })());
});
