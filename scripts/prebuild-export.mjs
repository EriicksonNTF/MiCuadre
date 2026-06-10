/**
 * Temporarily removes server-only files that block static export.
 * Moves them to .api-backup/ so they're restored post-build.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const dirsToBackup = [
  { src: "app/api", backup: ".api-backup" },
]

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

  console.log(`[prebuild] Moving ${dir.src} → ${dir.backup}`)
  fs.renameSync(srcPath, backupPath)
}

console.log("[prebuild] Preparing for static export build...")
dirsToBackup.forEach(backup)
console.log("[prebuild] Done. Run next build now.")
