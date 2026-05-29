const CACHE_NAME = 'micuadre-v4';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/favicon-32x32.png',
  '/apple-touch-icon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/placeholder.svg',
];

function isNextAsset(url) {
  return url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/_next/image');
}

function isBypassedAsset(url) {
  return (
    isNextAsset(url) ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/callback') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.ico' ||
    /\.(?:js|css|mjs|map|json|woff2?|png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname)
  );
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);

  // Never serve app-shell HTML for framework assets, API/auth requests, or static files.
  if (isBypassedAsset(url)) {
    return;
  }

  // Always prefer fresh document responses in web app mode
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/'))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone the response
        const responseClone = response.clone();
        
        const contentType = response.headers.get('content-type') || '';

        // Cache only matching non-HTML responses. A redirected app shell must never poison JS/CSS caches.
        if (response.status === 200 && event.request.destination !== 'document' && !contentType.includes('text/html')) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request);
      })
  );
});

// Handle push notifications (placeholder for future)
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? 'MiCuadre';
  const options = {
    body: data.body ?? '',
    icon: '/apple-touch-icon.png',
    badge: '/favicon-32x32.png',
    data: data.url ?? '/',
  };
  
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});
