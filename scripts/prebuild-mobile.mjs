#!/usr/bin/env node

/**
 * prebuild-mobile.mjs
 *
 * Moves app/api/ to .api-backup/ before a static export build.
 * Static export (output: 'export') doesn't support API routes,
 * so they must be removed before build and restored afterwards.
 *
 * Usage: node scripts/prebuild-mobile.mjs
 */

import { existsSync, cpSync, rmSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()
const API_DIR = join(ROOT, "app", "api")
const BACKUP_DIR = join(ROOT, ".api-backup")

if (!existsSync(API_DIR)) {
  console.log("[prebuild-mobile] app/api/ not found — nothing to move.")
  process.exit(0)
}

if (existsSync(BACKUP_DIR)) {
  rmSync(BACKUP_DIR, { recursive: true, force: true })
}

console.log("[prebuild-mobile] Moving app/api/ → .api-backup/...")
cpSync(API_DIR, BACKUP_DIR, { recursive: true })
rmSync(API_DIR, { recursive: true, force: true })

console.log("[prebuild-mobile] Done. Run postbuild:mobile after build to restore.")
