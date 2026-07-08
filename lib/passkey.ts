"use client"

import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser"

const PASSKEY_CREDENTIAL_ID_KEY = "micuadre_passkey_credential_id"
const PASSKEY_ENABLED_KEY = "micuadre_passkey_enabled"

function getRpId(): string {
  if (typeof window === "undefined") return "localhost"
  try {
    return window.location.hostname
  } catch {
    return "localhost"
  }
}

function randomChallengeBase64(): string {
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)
  const binary = String.fromCharCode(...challenge)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function bytesToBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function userIdToBase64(userId: string): string {
  const bytes = new TextEncoder().encode(userId.slice(0, 32))
  return bytesToBase64Url(bytes)
}

export function isPasskeySupported() {
  return browserSupportsWebAuthn()
}

export function isPasskeyEnabled() {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(PASSKEY_ENABLED_KEY) === "true"
}

export async function registerPasskey(userId: string, userName: string) {
  if (!isPasskeySupported()) {
    throw new Error("Tu dispositivo no soporta Passkeys.")
  }

  const credential = await startRegistration({
    optionsJSON: {
      challenge: randomChallengeBase64(),
      rp: {
        id: getRpId(),
        name: "MiCuadre",
      },
      user: {
        id: userIdToBase64(userId),
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
      timeout: 60000,
      attestation: "none",
    },
  })

  const idBytes = base64UrlToBytes(credential.id)
  window.localStorage.setItem(PASSKEY_CREDENTIAL_ID_KEY, bytesToBase64Url(idBytes))
  window.localStorage.setItem(PASSKEY_ENABLED_KEY, "true")
}

export async function verifyPasskeyUnlock() {
  if (!isPasskeySupported()) {
    throw new Error("Passkey no disponible en este dispositivo.")
  }
  const storedId = window.localStorage.getItem(PASSKEY_CREDENTIAL_ID_KEY)
  if (!storedId) {
    throw new Error("No hay Passkey registrada.")
  }

  await startAuthentication({
    optionsJSON: {
      challenge: randomChallengeBase64(),
      rpId: getRpId(),
      allowCredentials: [{
        type: "public-key",
        id: storedId,
      }],
      userVerification: "required",
      timeout: 60000,
    },
  })
}

export function disablePasskey() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(PASSKEY_ENABLED_KEY)
}
