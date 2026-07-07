#!/usr/bin/env node

/**
 * fix-asset-paths.mjs
 *
 * Converts absolute asset paths (/_next/..., /favicon, etc.) to relative
 * paths in the static export directory (out/). Required for Capacitor
 * WKWebView which loads files via file:// protocol.
 *
 * Usage: node scripts/fix-asset-paths.mjs
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs"
import { join, relative, dirname } from "node:path"

const OUT_DIR = join(process.cwd(), "out")

function walkDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath))
    } else if (entry.name.endsWith(".html") || entry.name.endsWith(".js") || entry.name.endsWith(".json")) {
      files.push(fullPath)
    }
  }
  return files
}

function getRelativePrefix(filePath) {
  const depth = dirname(filePath).replace(OUT_DIR, "").split(/[\\/]/).filter(Boolean).length
  return "../".repeat(depth)
}

function fixHtmlFile(filePath) {
  let content = readFileSync(filePath, "utf-8")
  const prefix = getRelativePrefix(filePath)

  // Convert absolute paths to relative
  content = content.replace(/"\/_next\//g, `"${prefix}_next/`)
  content = content.replace(/'\/_next\//g, `'${prefix}_next/`)
  content = content.replace(/"\/favicon/g, `"${prefix}favicon`)
  content = content.replace(/"\/manifest\.json"/g, `"${prefix}manifest.json"`)
  content = content.replace(/"\/apple-touch-icon/g, `"${prefix}apple-touch-icon`)
  content = content.replace(/"\/icon-/g, `"${prefix}icon-`)
  content = content.replace(/"\/placeholder-/g, `"${prefix}placeholder-`)
  content = content.replace(/"\/micuadre-logo/g, `"${prefix}micuadre-logo`)
  content = content.replace(/"\/icono-favicon/g, `"${prefix}icono-favicon`)
  content = content.replace(/"\/offline"/g, `"${prefix}offline"`)

  writeFileSync(filePath, content, "utf-8")
}

function fixManifest(filePath) {
  let content = readFileSync(filePath, "utf-8")
  const prefix = getRelativePrefix(filePath)

  content = content.replace(/"scope":\s*"\//g, `"scope": "${prefix}`)
  content = content.replace(/"start_url":\s*"\//g, `"start_url": "${prefix}`)
  content = content.replace(/"src":\s*"\/icons\//g, `"src": "${prefix}icons/`)
  content = content.replace(/"src":\s*"\/icon-/g, `"src": "${prefix}icon-`)

  writeFileSync(filePath, content, "utf-8")
}

function fixServiceWorker(filePath) {
  let content = readFileSync(filePath, "utf-8")
  const prefix = getRelativePrefix(filePath)

  // Fix precache URLs in service worker
  content = content.replace(/"\/_next\//g, `"${prefix}_next/`)
  content = content.replace(/"\/favicon/g, `"${prefix}favicon`)
  content = content.replace(/"\/manifest\.json"/g, `"${prefix}manifest.json"`)
  content = content.replace(/"\/offline"/g, `"${prefix}offline"`)

  writeFileSync(filePath, content, "utf-8")
}

console.log("[fix-asset-paths] Scanning out/ directory...")

const allFiles = walkDir(OUT_DIR)
let htmlCount = 0
let manifestCount = 0
let swCount = 0

for (const file of allFiles) {
  if (file.endsWith(".html")) {
    fixHtmlFile(file)
    htmlCount++
  } else if (file.endsWith("manifest.json")) {
    fixManifest(file)
    manifestCount++
  } else if (file.includes("sw.") && file.endsWith(".js")) {
    fixServiceWorker(file)
    swCount++
  }
}

console.log(`[fix-asset-paths] Done: ${htmlCount} HTML, ${manifestCount} manifest, ${swCount} service worker files fixed.`)
