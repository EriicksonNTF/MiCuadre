"use client"

type HapticStrength = "light" | "medium"

function vibrateFallback(strength: HapticStrength) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return
  navigator.vibrate(strength === "medium" ? 16 : 10)
}

export async function triggerHaptic(strength: HapticStrength = "light") {
  try {
    const capacitor = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Haptics?: { impact?: (payload: { style: string }) => Promise<void> } } } }).Capacitor
    const haptics = capacitor?.Plugins?.Haptics
    const isNative = Boolean(capacitor?.isNativePlatform?.())

    if (isNative && haptics?.impact) {
      await haptics.impact({ style: strength === "medium" ? "MEDIUM" : "LIGHT" })
      return
    }
  } catch {
    // ignore haptics failures
  }

  vibrateFallback(strength)
}
