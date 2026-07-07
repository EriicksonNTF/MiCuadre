#!/usr/bin/env node

/**
 * postbuild-export.mjs
 *
 * Restores app/api/ from .api-backup/ after a static export build.
 * The prebuild step (prebuild:mobile) moves app/api/ to .api-backup/
 * because static export doesn't support API routes. This script reverses that.
 *
 * Usage: node scripts/postbuild-export.mjs
 */

import { existsSync, cpSync, rmSync } from "node:fs"
import { join } from "node:path"

const ROOT = process.cwd()
const API_DIR = join(ROOT, "app", "api")
const BACKUP_DIR = join(ROOT, ".api-backup")

if (!existsSync(BACKUP_DIR)) {
  console.log("[postbuild-export] No .api-backup/ found — nothing to restore.")
  process.exit(0)
}

if (existsSync(API_DIR)) {
  console.log("[postbuild-export] app/api/ already exists — skipping restore.")
  process.exit(0)
}

console.log("[postbuild-export] Restoring app/api/ from .api-backup/...")

cpSync(BACKUP_DIR, API_DIR, { recursive: true })

console.log("[postbuild-export] Done. app/api/ restored.")
