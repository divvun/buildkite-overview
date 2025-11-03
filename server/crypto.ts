// Cryptographic utilities for secure session handling
// Server-only module - should never be imported by client code

if (typeof Deno === "undefined") {
  throw new Error("Crypto utilities can only be used on the server side")
}

import { getSessionSecret } from "~/server/config.ts"

// Convert string to Uint8Array for crypto operations
function stringToUint8Array(str: string): Uint8Array {
  return new TextEncoder().encode(str) as Uint8Array
}

// Convert Uint8Array to string
function uint8ArrayToString(arr: Uint8Array): string {
  return new TextDecoder().decode(arr)
}

// Convert Uint8Array to hex string
function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr, (byte) => byte.toString(16).padStart(2, "0")).join("")
}

// Convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes as Uint8Array
}

// Generate a random IV for encryption
function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(12)) as Uint8Array // 12 bytes for GCM
}

// Derive key from session secret using PBKDF2
async function deriveKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    // @ts-expect-error: TypeScript type definitions issue with ArrayBufferLike vs ArrayBuffer
    stringToUint8Array(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  )

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      // @ts-expect-error: TypeScript type definitions issue with ArrayBufferLike vs ArrayBuffer
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"],
  )
}

// Generate HMAC signature for data integrity
async function generateHMAC(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    // @ts-expect-error: TypeScript type definitions issue with ArrayBufferLike vs ArrayBuffer
    stringToUint8Array(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  )

  // @ts-expect-error: TypeScript type definitions issue with ArrayBufferLike vs ArrayBuffer
  const signature = await crypto.subtle.sign("HMAC", key, stringToUint8Array(data))
  return uint8ArrayToHex(new Uint8Array(signature))
}

// Verify HMAC signature
async function verifyHMAC(data: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    // @ts-expect-error: TypeScript type definitions issue with ArrayBufferLike vs ArrayBuffer
    stringToUint8Array(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  )

  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    // @ts-expect-error: TypeScript type definitions issue with ArrayBufferLike vs ArrayBuffer
    hexToUint8Array(signature),
    stringToUint8Array(data),
  )

  return isValid
}

// Encrypt data using AES-GCM
export async function encryptData(data: string): Promise<string> {
  const secret = getSessionSecret()
  const salt = crypto.getRandomValues(new Uint8Array(16)) as Uint8Array
  const iv = generateIV()

  const key = await deriveKey(secret, salt)
  const encrypted = await crypto.subtle.encrypt(
    // @ts-expect-error: TypeScript type definitions issue with ArrayBufferLike vs ArrayBuffer
    { name: "AES-GCM", iv },
    key,
    stringToUint8Array(data),
  )

  // Combine salt, iv, and encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
  combined.set(salt, 0)
  combined.set(iv, salt.length)
  combined.set(new Uint8Array(encrypted), salt.length + iv.length)

  // Create HMAC of the encrypted data for integrity
  const encryptedHex = uint8ArrayToHex(combined)
  const hmac = await generateHMAC(encryptedHex, secret)

  // Return format: hmac:encrypted_data
  return `${hmac}:${encryptedHex}`
}

// Decrypt data using AES-GCM
export async function decryptData(encryptedData: string): Promise<string | null> {
  try {
    const secret = getSessionSecret()
    const [hmac, encryptedHex] = encryptedData.split(":")

    if (!hmac || !encryptedHex) {
      return null
    }

    // Verify HMAC first
    const isValid = await verifyHMAC(encryptedHex, hmac, secret)
    if (!isValid) {
      console.warn("Session cookie HMAC verification failed")
      return null
    }

    const combined = hexToUint8Array(encryptedHex)

    // Extract salt, iv, and encrypted data
    const salt = combined.slice(0, 16)
    const iv = combined.slice(16, 28)
    const encrypted = combined.slice(28)

    const key = await deriveKey(secret, salt)
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      encrypted,
    )

    return uint8ArrayToString(new Uint8Array(decrypted))
  } catch (error) {
    console.warn("Session decryption failed:", error)
    return null
  }
}

// Generate secure random token for CSRF protection
export function generateCSRFToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return uint8ArrayToHex(bytes)
}

// Constant-time string comparison to prevent timing attacks
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}
