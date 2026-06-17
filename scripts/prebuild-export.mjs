/**
 * Temporarily removes server-only files that block static export.
 * Moves them to .api-backup/ so they're restored post-build.
 * Also cleans .next to avoid stale TypeScript definitions.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const dirsToBackup = [
  { src: "app/api", backup: ".api-backup" },
]

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
    }
  }
}

function backup(dir) {
  const srcPath = path.join(root, dir.src)
  const backupPath = path.join(root, dir.backup)

  if (!fs.existsSync(srcPath)) {
    console.log(`[prebuild] ${dir.src} does not exist, skipping`)
    return
  }

  if (fs.existsSync(backupPath)) {
    console.log(`[prebuild] ${dir.backup} already exists, removing first`)
    fs.rmSync(backupPath, { recursive: true, force: true })
  }

  console.log(`[prebuild] Copying ${dir.src} → ${dir.backup}`)
  copyRecursiveSync(srcPath, backupPath)

  console.log(`[prebuild] Removing ${dir.src}`)
  fs.rmSync(srcPath, { recursive: true, force: true })
}

// Clean .next to avoid stale TypeScript definitions
const nextDir = path.join(root, ".next")
if (fs.existsSync(nextDir)) {
  console.log("[prebuild] Cleaning .next directory...")
  fs.rmSync(nextDir, { recursive: true, force: true })
}

console.log("[prebuild] Preparing for static export build...")
dirsToBackup.forEach(backup)
console.log("[prebuild] Done. Run next build now.")
