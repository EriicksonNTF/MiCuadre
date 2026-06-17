/**
 * Restores server-only files after static export build.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

const dirsToRestore = [
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

function restore(dir) {
  const srcPath = path.join(root, dir.src)
  const backupPath = path.join(root, dir.backup)

  if (!fs.existsSync(backupPath)) {
    console.log(`[postbuild] ${dir.backup} does not exist, nothing to restore`)
    return
  }

  if (fs.existsSync(srcPath)) {
    console.log(`[postbuild] ${dir.src} already exists, removing`)
    fs.rmSync(srcPath, { recursive: true, force: true })
  }

  console.log(`[postbuild] Restoring ${dir.backup} → ${dir.src}`)
  copyRecursiveSync(backupPath, srcPath)
}

console.log("[postbuild] Restoring server-only files...")
dirsToRestore.forEach(restore)
console.log("[postbuild] Done.")
