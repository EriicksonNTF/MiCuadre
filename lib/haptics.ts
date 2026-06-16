"use client"

import { Capacitor } from "@capacitor/core"
import { Haptics, ImpactStyle } from "@capacitor/haptics"

type HapticStrength = "light" | "medium"

function vibrateFallback(strength: HapticStrength) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return
  navigator.vibrate(strength === "medium" ? 16 : 10)
}

export async function triggerHaptic(strength: HapticStrength = "light") {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: strength === "medium" ? ImpactStyle.Medium : ImpactStyle.Light })
      return
    }
  } catch {
    // ignore haptics failures
  }

  vibrateFallback(strength)
}
