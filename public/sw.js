/* MiCuadre service worker
 * - Precache del app shell y assets de /_next/static (cache-first)
 * - Navegaciones: network-first con fallback a cache y, si no, a /offline
 * - Solo intercepta GET
 * - Bypassea: /api/*, supabase.co (auth/storage/realtime)
 * - skipWaiting + clients.claim en actualizaciones
 */

const CACHE_VERSION = "v5";
const STATIC_CACHE = `micuadre-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `micuadre-runtime-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  "/",
  "/offline",
  "/manifest.json",
  "/favicon.ico",
  "/favicon-32x32.png",
  "/favicon-48x48.png",
  "/apple-touch-icon.png",
  "/icon-192x192.png",
  "/icon-512x512.png",
  "/placeholder.svg",
  "/micuadre-logo.svg",
];

const NEXT_STATIC = /^\/_next\/static\//;
const NEXT_IMAGE = /^\/_next\/image/;
const SUPABASE_HOSTS = [
  /\.supabase\.co$/,
  /\.supabase\.in$/,
];

function isSupabase(url) {
  return SUPABASE_HOSTS.some((rx) => rx.test(url.hostname));
}

function isBypass(url) {
  if (url.pathname.startsWith("/api/")) return true;
  if (isSupabase(url)) return true;
  return false;
}

function isPrecachable(url) {
  if (NEXT_STATIC.test(url.pathname)) return true;
  if (NEXT_IMAGE.test(url.pathname)) return true;
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          fetch(url, { credentials: "same-origin" })
            .then((response) => {
              if (response && response.ok) {
                return cache.put(url, response);
              }
              return null;
            })
            .catch(() => null)
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((name) => name !== STATIC_CACHE && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin: si es Supabase u otro backend, dejar pasar a la red
  if (url.origin !== self.location.origin) {
    if (isSupabase(url)) return;
    // Otros cross-origin: dejar pasar también
    return;
  }

  // Mismo origen: bypass para /api/*
  if (isBypass(url)) return;

  // Cache-first para assets de Next
  if (isPrecachable(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Navegaciones: network-first con fallback a cache y a /offline
  if (request.mode === "navigate") {
    event.respondWith(handleNavigate(request));
    return;
  }

  // Otros GETs mismo origen: stale-while-revalidate (icons, fonts, etc.)
  event.respondWith(staleWhileRevalidate(request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok && response.status === 200) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return new Response("", { status: 504, statusText: "Offline" });
  }
}

async function handleNavigate(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response(
      "<h1>Sin conexión</h1><p>Vuelve cuando tengas internet.</p>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok && response.status === 200) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  return cached || (await networkPromise) || new Response("", { status: 504 });
}

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Push notifications (existente)
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? "MiCuadre";
  const options = {
    body: data.body ?? "",
    icon: "/apple-touch-icon.png",
    badge: "/favicon-32x32.png",
    data: data.url ?? "/",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data));
});
