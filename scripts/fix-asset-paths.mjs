/**
 * Post-build script: converts absolute /-prefixed asset paths in
 * Next.js static export to relative paths compatible with local
 * file:// serving (Capacitor WKWebView).
 *
 * Handles:
 *   - All .html files (src/href attributes, inline script data)
 *   - sw.js (precache URLs, routing patterns)
 *   - manifest.json (scope/start_url, icon paths)
 */

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const OUT = path.join(root, "out")

if (!fs.existsSync(OUT)) {
  console.error("[fix-asset-paths] out/ directory not found")
  process.exit(1)
}

// Paths that should have their leading / converted to a relative prefix.
// These appear in HTML attributes, JS strings, and JSON.
const RELOCATABLE_PREFIXES = [
  "_next/",
  "favicon",
  "manifest.json",
  "apple-touch-icon",
  "icon-",
  "placeholder-",
  "micuadre-logo",
  "icono-favicon",
  "background_music.m4a",
  "offline",
]

function isRelocatable(p) {
  return RELOCATABLE_PREFIXES.some((pfx) => p.startsWith(pfx))
}

/**
 * Computes the relative path prefix from an output file back to the
 * out/ root.  Examples:
 *   out/index.html           →  "./"
 *   out/auth/login.html      →  "../"
 *   out/accounts/123.html    →  "../"
 *   out/a/b/c.html           →  "../../"
 */
function relativePrefix(absPath) {
  const rel = path.relative(OUT, absPath)
  const dirs = path.dirname(rel).split(path.sep)
  // dirname("index.html") → ".", which splits to ["."]
  if (dirs.length === 1 && dirs[0] === ".") return "./"
  return dirs.map(() => "../").join("")
}

// ── 1. HTML files ─────────────────────────────────────────────

function fixHtmlFile(filePath) {
  let html = fs.readFileSync(filePath, "utf8")
  const prefix = relativePrefix(filePath)

  const orig = html

  // Comprehensive fix: any " or ' or \" followed by / and a
  // relocatable path prefix. Catches HTML attributes, JS strings,
  // and RSC JSON payloads inside <script> tags.
  const escPath = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  html = html.replace(
    new RegExp(
      `(["'\\\\])/(${RELOCATABLE_PREFIXES.map(escPath).join("|")}[^"'\\\\]*)`,
      "g",
    ),
    (match, quote, path) => {
      // For escaped quotes (\"), keep the backslash
      if (quote === "\\") return `\\"${prefix}${path}`
      return `${quote}${prefix}${path}`
    },
  )

  // Escape hatch: prevent malformed double-prefix if script already
  // contains a prefixed path from a previous run.
  html = html.replace(
    new RegExp(`${prefix.replace(/\//g, "\\/")}${prefix.replace(/\//g, "\\/")}`, "g"),
    prefix,
  )

  if (html !== orig) {
    fs.writeFileSync(filePath, html, "utf8")
    console.log(`[fix-asset-paths] Fixed: ${path.relative(OUT, filePath)}  (prefix=${prefix})`)
  }
}

function walkHtml(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkHtml(full)
    else if (entry.name.endsWith(".html")) fixHtmlFile(full)
  }
}

console.log("[fix-asset-paths] Fixing HTML files...")
walkHtml(OUT)

// ── 2. manifest.json ──────────────────────────────────────────

const manifestPath = path.join(OUT, "manifest.json")
if (fs.existsSync(manifestPath)) {
  let manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

  if (manifest.start_url === "/") manifest.start_url = "./"
  if (manifest.scope === "/") manifest.scope = "./"
  if (manifest.id === "/") manifest.id = "./"

  if (manifest.icons) {
    manifest.icons = manifest.icons.map((icon) => {
      if (icon.src && icon.src.startsWith("/")) {
        icon.src = "." + icon.src
      }
      if (icon.src && icon.src.startsWith("./../icons/")) {
        icon.src = icon.src.replace("./../icons/", "./icons/")
      }
      return icon
    })
  }

  if (manifest.shortcuts) {
    for (const shortcut of manifest.shortcuts) {
      if (shortcut.url) {
        if (shortcut.url === "/") shortcut.url = "./"
        else if (shortcut.url.startsWith("/")) shortcut.url = "." + shortcut.url
      }
      if (shortcut.icons) {
        shortcut.icons = shortcut.icons.map((icon) => {
          if (icon.src && icon.src.startsWith("/")) icon.src = "." + icon.src
          return icon
        })
      }
    }
  }

  if (manifest.screenshots) {
    manifest.screenshots = manifest.screenshots.map((s) => {
      if (s.src && s.src.startsWith("/")) s.src = "." + s.src
      return s
    })
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8")
  console.log("[fix-asset-paths] Fixed: manifest.json")
}

// ── 3. sw.js ──────────────────────────────────────────────────

const swPath = path.join(OUT, "sw.js")
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, "utf8")

  // Fix OFFLINE_URL
  sw = sw.replace(
    /const OFFLINE_URL\s*=\s*"[^"]+"/,
    'const OFFLINE_URL = "./offline"',
  )

  // Fix PRECACHE_URLS — each string starting with "/"
  sw = sw.replace(
    /"\/[^"]+"/g,
    (match) => {
      const inner = match.slice(2, -1) // remove the leading "/" and trailing "
      if (inner === "") return match
      return `".${inner}"`
    },
  )
  // But undo "./" for "/" (just keep it as ""./"" is awkward)
  sw = sw.replace('"./",', '"./",')

  // Fix NEXT_STATIC regex: change ^\/_next\/ to pathname.*_next
  sw = sw.replace(
    /const NEXT_STATIC\s*=\s*\/\^\\\/_next\\\/static\\\/\//,
    'const NEXT_STATIC = /\\/_next\\/static\\//',
  )

  sw = sw.replace(
    /const NEXT_IMAGE\s*=\s*\/\^\\\/_next\\\/image\//,
    'const NEXT_IMAGE = /\\/_next\\/image/',
  )

  // Fix SUPABASE_HOSTS: they use event.request.url — for file:// the
  // check should be based on hostname, which is "" for file://.
  // We keep the array as-is since Supabase requests won't match
  // anyway when offline. The bypass still works because file://
  // requests will have empty hostname.

  fs.writeFileSync(swPath, sw, "utf8")
  console.log("[fix-asset-paths] Fixed: sw.js")
}

console.log("[fix-asset-paths] Done.")
