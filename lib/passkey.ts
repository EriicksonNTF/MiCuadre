"use client"

const PASSKEY_CREDENTIAL_ID_KEY = "micuadre_passkey_credential_id"
const PASSKEY_ENABLED_KEY = "micuadre_passkey_enabled"

function bytesToBase64Url(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function randomChallenge(length = 32): Uint8Array {
  const challenge = new Uint8Array(length)
  crypto.getRandomValues(challenge)
  return challenge
}

export function isPasskeySupported() {
  return typeof window !== "undefined" && "PublicKeyCredential" in window && !!navigator.credentials
}

export function isPasskeyEnabled() {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(PASSKEY_ENABLED_KEY) === "true"
}

export async function registerPasskey(userId: string, userName: string) {
  if (!isPasskeySupported()) {
    throw new Error("Tu dispositivo no soporta Passkeys.")
  }

  const userBytes = new TextEncoder().encode(userId.slice(0, 32))
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomChallenge(),
      rp: { name: "MiCuadre" },
      user: {
        id: userBytes,
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

  if (!credential || !(credential instanceof PublicKeyCredential)) {
    throw new Error("No se pudo crear la Passkey.")
  }

  const idBytes = new Uint8Array(credential.rawId)
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

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomChallenge(),
      allowCredentials: [{
        type: "public-key",
        id: base64UrlToBytes(storedId),
      }],
      userVerification: "required",
      timeout: 60000,
    },
  })

  if (!assertion || !(assertion instanceof PublicKeyCredential)) {
    throw new Error("No se pudo verificar con biometría.")
  }
}

export function disablePasskey() {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(PASSKEY_ENABLED_KEY)
}
