"use client"

type HapticStrength = "light" | "medium"

export async function triggerHaptic(strength: HapticStrength = "light") {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return
  navigator.vibrate(strength === "medium" ? 16 : 10)
}
