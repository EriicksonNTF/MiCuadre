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
  const NAV_TIMEOUT_MS = 3000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NAV_TIMEOUT_MS);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
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
  if (!event.data) return;

  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data.type === "PRECACHE_ROUTES" && Array.isArray(event.data.routes)) {
    event.waitUntil(precacheRoutes(event.data.routes));
  }
});

async function precacheRoutes(routes) {
  const cache = await caches.open(RUNTIME_CACHE);
  await Promise.allSettled(
    routes.map(async (route) => {
      try {
        const response = await fetch(route, {
          credentials: "same-origin",
          redirect: "follow",
        });
        if (response && response.ok) {
          await cache.put(route, response.clone());
        }
      } catch (err) {
        // Ignorar: si no hay red, simplemente no pre-cacheamos
      }
    })
  );
}

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

// Background Sync API — retry pending offline operations when connectivity is restored
// Registered by lib/offline/sync-engine.ts::registerBackgroundSync()
self.addEventListener("sync", (event) => {
  if (event.tag === "micuadre-sync") {
    event.waitUntil(
      (async () => {
        // Import sync engine dynamically to avoid circular deps in SW context
        // The SW can't import app modules, so we use a lightweight inline approach:
        // Post a message to all clients to trigger sync, then they call syncPendingOperations()
        const allClients = await clients.matchAll({ type: "window", includeUncontrolled: true });
        if (allClients.length > 0) {
          // Client is open — let it handle sync via the existing online/visibility listeners
          allClients.forEach((client) => {
            client.postMessage({ type: "BACKGROUND_SYNC_TRIGGER" });
          });
        } else {
          // No client open — the sync will happen on next page load via initSyncEngine
          console.log("[sw] Background sync triggered but no active client. Sync will run on next visit.");
        }
      })()
    );
  }
});
