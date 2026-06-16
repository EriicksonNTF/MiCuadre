import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"
import readline from "node:readline/promises"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")

function run(cmd, label) {
  console.log(`\n▶ ${label}`)
  console.log(`  $ ${cmd}`)
  execSync(cmd, { cwd: root, stdio: "inherit" })
}

async function confirm(question) {
  const reader = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await reader.question(`${question} (s/n): `)
  reader.close()
  return answer.trim().toLowerCase() === "s" || answer.trim().toLowerCase() === "si"
}

async function main() {
  console.log("════════════════════════════════════════════")
  console.log("  MiCuadre — Build mobile + push")
  console.log("════════════════════════════════════════════")

  // Step 1: Pull latest
  run("git pull --rebase", "Actualizando con git pull")

  // Step 2: Build web locally
  console.log("\n════════════════════════════════════════════")
  console.log("  Fase 1: Build web estático")
  console.log("════════════════════════════════════════════")
  run("node scripts/prebuild-export.mjs", "Moviendo app/api → .api-backup")
  run("npm run build:mobile", "Next.js static export")
  run("node scripts/postbuild-export.mjs", "Restaurando app/api")

  // Step 3: Fix paths + copy to iOS
  console.log("\n════════════════════════════════════════════")
  console.log("  Fase 2: Preparar assets iOS")
  console.log("════════════════════════════════════════════")
  run("node scripts/fix-asset-paths.mjs", "Fijando rutas relativas")
  run("npx cap copy", "Copiando assets a ios/App/App/public")

  // Step 4: Commit + push
  console.log("\n════════════════════════════════════════════")
  console.log("✅ Build local completado sin errores")
  console.log("════════════════════════════════════════════")
  console.log("")
  console.log("Ahora puedes hacer push para que GitHub Actions compile el IPA.")
  console.log("")

  const doPush = await confirm("¿Hacer commit + push para disparar la build iOS?")
  if (!doPush) {
    console.log("\nBuild local listo. Haz push manual cuando quieras:")
    console.log("  git add -A")
    console.log('  git commit -m "build: preparar iOS"')
    console.log("  git push")
    console.log("\nLuego ve a:")
    console.log("  https://github.com/EriicksonNTF/MiCuadre/actions/workflows/build-ios.yml")
    return
  }

  run("git add -A", "Staging cambios")
  run('git commit -m "build: preparar assets iOS" --allow-empty', "Committing")
  run("git push", "Haciendo push")

  console.log("\n════════════════════════════════════════════")
  console.log("✅ Push completado")
  console.log("")
  console.log("Ve a GitHub Actions y dispara el workflow:")
  console.log("  https://github.com/EriicksonNTF/MiCuadre/actions/workflows/build-ios.yml")
  console.log("")
  console.log("Da click en 'Run workflow' → espera ~10 min")
  console.log("Descarga el IPA desde los artifacts cuando termine.")
  console.log("════════════════════════════════════════════")
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message)
  process.exit(1)
})
