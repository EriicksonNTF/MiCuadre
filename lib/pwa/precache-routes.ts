"use client"

const PRECACHE_FLAG_KEY = "micuadre:precache-after-login:v1"
const PRECACHE_ROUTES = ["/dashboard", "/expense", "/accounts"]

export function requestPrecacheAfterLogin() {
  if (typeof window === "undefined") return
  if (process.env.NODE_ENV !== "production") return

  try {
    if (window.sessionStorage.getItem(PRECACHE_FLAG_KEY) === "1") return
    window.sessionStorage.setItem(PRECACHE_FLAG_KEY, "1")
  } catch {
    return
  }

  if (!("serviceWorker" in navigator)) return

  const send = () => {
    navigator.serviceWorker.controller?.postMessage({
      type: "PRECACHE_ROUTES",
      routes: PRECACHE_ROUTES,
    })
  }

  if (navigator.serviceWorker.controller) {
    send()
  } else {
    navigator.serviceWorker.addEventListener("controllerchange", send, {
      once: true,
    })
  }
}
