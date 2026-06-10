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
  fs.renameSync(backupPath, srcPath)
}

console.log("[postbuild] Restoring server-only files...")
dirsToRestore.forEach(restore)
console.log("[postbuild] Done.")
