"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Camera, Loader2, Upload, AlertTriangle, CheckCircle2, Sparkles, FileImage } from "lucide-react"
import { Button } from "@/components/ui/button"
import { parseReceiptText } from "@/lib/receipt-parser"
import { MobilePageShell } from "@/components/ui/mobile-foundation"

type ScanStep = "idle" | "preprocess" | "ocr" | "parse" | "done" | "error"

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function parseNumericToken(token: string) {
  const normalized = token
    .replace(/\s/g, "")
    .replace(/(rd\$|dop|usd|us\$)/gi, "")
    .replace(/[oO]/g, "0")
    .replace(/[sS]/g, "5")
    .replace(/[iIl]/g, "1")
    .replace(/[B]/g, "8")
    .replace(/,(?=\d{3}(\D|$))/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(/,/, ".")
  const value = Number(normalized)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

function pickPlausibleFooterAmount(rawText: string) {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const start = Math.max(0, Math.floor(lines.length * 0.55))
  const tail = lines.slice(start)
  const amountRegex = /(?:RD\$|DOP|USD|US\$|\$)?\s?[0-9oOilSB]{1,3}(?:[.,\s][0-9oOilSB]{3})*(?:[.,][0-9oOilSB]{2})?/gi

  const candidates: Array<{ value: number; lineIndex: number; hasTotalWord: boolean }> = []
  for (let i = 0; i < tail.length; i++) {
    const line = tail[i]
    const matches = line.match(amountRegex) || []
    const hasTotalWord = /total|importe|monto|pagado|payment|paid/i.test(line)
    for (const match of matches) {
      const value = parseNumericToken(match)
      if (!value || value < 5) continue
      candidates.push({ value, lineIndex: i, hasTotalWord })
    }
  }

  if (candidates.length === 0) return null
  const prioritized = candidates
    .sort((a, b) => {
      if (a.hasTotalWord !== b.hasTotalWord) return a.hasTotalWord ? -1 : 1
      if (a.lineIndex !== b.lineIndex) return b.lineIndex - a.lineIndex
      return b.value - a.value
    })[0]
  return prioritized?.value ?? null
}

function sanitizeParsedAmount(parsed: ReturnType<typeof parseReceiptText>) {
  const currentAmount = parsed.amount.value ?? 0
  if (currentAmount >= 5) return parsed

  const fallbackAmount = pickPlausibleFooterAmount(parsed.rawText || "")
  if (!fallbackAmount) return parsed

  return {
    ...parsed,
    amount: {
      ...parsed.amount,
      value: fallbackAmount,
      confidence: Math.max(parsed.amount.confidence, 0.88),
      source: "scan-footer-fallback",
    },
    overallConfidence: Math.max(parsed.overallConfidence, 0.84),
  }
}

type PreprocessVariant = {
  name: "enhanced" | "high-contrast" | "rotated"
  dataUrl: string
}

async function preprocessImage(file: File): Promise<{ variants: PreprocessVariant[]; blurScore: number }> {
  const imageBitmap = await createImageBitmap(file)
  const maxSide = 1800
  const scale = Math.min(1, maxSide / Math.max(imageBitmap.width, imageBitmap.height))
  const width = Math.max(1, Math.round(imageBitmap.width * scale))
  const height = Math.max(1, Math.round(imageBitmap.height * scale))

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("No se pudo procesar la imagen")

  ctx.drawImage(imageBitmap, 0, 0, width, height)
  const img = ctx.getImageData(0, 0, width, height)
  const data = img.data

  // grayscale + contrast stretch + tiny denoise
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const contrasted = clamp((gray - 128) * 1.28 + 128, 0, 255)
    data[i] = contrasted
    data[i + 1] = contrasted
    data[i + 2] = contrasted
  }

  // blur score (variance of laplacian approx)
  let laplacianSum = 0
  let laplacianSqSum = 0
  let count = 0
  const grayAt = (x: number, y: number) => data[(y * width + x) * 4]
  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const center = grayAt(x, y)
      const lap = 4 * center - grayAt(x - 1, y) - grayAt(x + 1, y) - grayAt(x, y - 1) - grayAt(x, y + 1)
      laplacianSum += lap
      laplacianSqSum += lap * lap
      count++
    }
  }
  const mean = count > 0 ? laplacianSum / count : 0
  const variance = count > 0 ? laplacianSqSum / count - mean * mean : 0

  ctx.putImageData(img, 0, 0)
  const enhanced = canvas.toDataURL("image/jpeg", 0.92)

  const thresholdCanvas = document.createElement("canvas")
  thresholdCanvas.width = width
  thresholdCanvas.height = height
  const tctx = thresholdCanvas.getContext("2d")
  if (!tctx) throw new Error("No se pudo crear variante de imagen")
  tctx.putImageData(img, 0, 0)
  const tImg = tctx.getImageData(0, 0, width, height)
  const td = tImg.data
  for (let i = 0; i < td.length; i += 4) {
    const v = td[i] > 150 ? 255 : 0
    td[i] = v
    td[i + 1] = v
    td[i + 2] = v
  }
  tctx.putImageData(tImg, 0, 0)
  const highContrast = thresholdCanvas.toDataURL("image/jpeg", 0.92)

  const rotatedCanvas = document.createElement("canvas")
  rotatedCanvas.width = width
  rotatedCanvas.height = height
  const rctx = rotatedCanvas.getContext("2d")
  if (!rctx) throw new Error("No se pudo crear variante rotada")
  rctx.fillStyle = "#fff"
  rctx.fillRect(0, 0, width, height)
  rctx.translate(width / 2, height / 2)
  rctx.rotate((1.2 * Math.PI) / 180)
  rctx.drawImage(canvas, -width / 2, -height / 2, width, height)
  const rotated = rotatedCanvas.toDataURL("image/jpeg", 0.9)

  return {
    variants: [
      { name: "enhanced", dataUrl: enhanced },
      { name: "high-contrast", dataUrl: highContrast },
      { name: "rotated", dataUrl: rotated },
    ],
    blurScore: variance,
  }
}

export default function ScanPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)
  const scanningRef = useRef(false)

  const [step, setStep] = useState<ScanStep>("idle")
  const [status, setStatus] = useState("Sube una foto del recibo")
  const [progress, setProgress] = useState(0)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [rawText, setRawText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [blurScore, setBlurScore] = useState<number | null>(null)
  const [result, setResult] = useState<ReturnType<typeof parseReceiptText> | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  const lowConfidence = useMemo(() => {
    if (!result) return false
    return result.amount.confidence < 0.75 || result.date.confidence < 0.65 || result.overallConfidence < 0.9
  }, [result])

  const handleImage = async (file?: File) => {
    if (!file || scanningRef.current) return
    scanningRef.current = true
    setIsScanning(true)
    setError(null)
    setResult(null)
    setRawText("")
    setSelectedFileName(file.name)
    setProgress(0)
    setStep("preprocess")
    setStatus("Mejorando imagen...")

    let worker: any = null
    try {
      const { createWorker, PSM } = await import("tesseract.js")

      const { variants, blurScore: score } = await preprocessImage(file)
      setBlurScore(score)
      setProgress(20)

      setStep("ocr")
      setStatus("Detectando texto...")

      worker = await createWorker("spa+eng", 1, {
        logger: (msg) => {
          if (msg.status === "recognizing text" && typeof msg.progress === "number") {
            setProgress(Math.max(20, Math.round(20 + msg.progress * 70)))
          }
        },
      })

      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
        preserve_interword_spaces: "1",
      })

      let bestResult: ReturnType<typeof parseReceiptText> | null = null
      let bestText = ""

      for (let i = 0; i < variants.length; i++) {
        const variant = variants[i]
        setStatus(`Detectando texto (${i + 1}/${variants.length})...`)

        const { data } = await worker.recognize(variant.dataUrl)

        const ocrLines = Array.isArray((data as any).lines)
          ? (data as any).lines.map((line: any) => ({
              text: String(line?.text || ""),
              y: Number(line?.bbox?.y0 ?? 0),
            }))
          : undefined

        const parsed = sanitizeParsedAmount(parseReceiptText(data.text || "", ocrLines))
        const variantScore = parsed.amount.confidence * 0.65 + parsed.currency.confidence * 0.2 + parsed.date.confidence * 0.15
        const bestScore = bestResult
          ? bestResult.amount.confidence * 0.65 + bestResult.currency.confidence * 0.2 + bestResult.date.confidence * 0.15
          : -1

        if (!bestResult || variantScore > bestScore) {
          bestResult = parsed
          bestText = data.text || ""
        }

        setProgress(Math.min(90, 40 + Math.round(((i + 1) / variants.length) * 45)))
      }

      if (!bestResult) {
        throw new Error("No se pudo extraer texto del recibo")
      }

      setProgress(92)

      setRawText(bestText)
      setStep("parse")
      setStatus("Buscando monto, fecha y comercio...")

      const finalResult = bestResult
      setResult(finalResult)
      setStep("done")
      setProgress(100)

      if (finalResult.amount.confidence >= 0.8 && finalResult.date.confidence >= 0.75) {
        setStatus("Datos detectados. Abriendo nueva transaccion...")
        const params = new URLSearchParams()
        if (finalResult.amount.value) params.set("amount", String(finalResult.amount.value))
        if (finalResult.merchant.value) params.set("description", finalResult.merchant.value)
        if (finalResult.currency.value) params.set("currency", finalResult.currency.value)
        if (finalResult.date.value) params.set("date", finalResult.date.value)
        if (finalResult.categorySuggestion.value) params.set("category", finalResult.categorySuggestion.value)
        params.set("source", "scan")
        router.push(`/expense?${params.toString()}`)
        return
      }

      setStatus("Revisa los datos detectados")
    } catch (scanError) {
      console.error(scanError)
      setStep("error")
      setError("No se pudo completar el escaneo. Intenta con mejor luz, evita movimiento y coloca el recibo completo dentro de la foto.")
      setStatus("Error")
    } finally {
      if (worker) {
        await worker.terminate()
      }
      scanningRef.current = false
      setIsScanning(false)
    }
  }

  const openExpenseWithPrefill = () => {
    if (!result) return
    const params = new URLSearchParams()
    if (result.amount.value) params.set("amount", String(result.amount.value))
    if (result.merchant.value) params.set("description", result.merchant.value)
    if (result.currency.value) params.set("currency", result.currency.value)
    if (result.date.value) params.set("date", result.date.value)
    if (result.categorySuggestion.value) params.set("category", result.categorySuggestion.value)
    params.set("source", "scan")
    router.push(`/expense?${params.toString()}`)
  }

  return (
    <MobilePageShell fullBleed className="pb-nav-safe">
      <header className="flex items-center gap-3 px-6 pb-4 pt-8">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Escanear recibo</h1>
      </header>

      <div className="px-6 pb-8">
        {isScanning && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-[6px]">
            <div className="w-[92%] max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Sparkles className="h-6 w-6 animate-pulse" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">IA de MiCuadre trabajando</p>
                  <p className="text-xs text-muted-foreground">Interpretando texto del recibo en tiempo real</p>
                </div>
              </div>

              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{status}</p>

              <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                <div className={`rounded-lg px-2 py-2 text-center ${step === "preprocess" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Mejora</div>
                <div className={`rounded-lg px-2 py-2 text-center ${step === "ocr" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>OCR</div>
                <div className={`rounded-lg px-2 py-2 text-center ${step === "parse" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Parser</div>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-card p-4">
          <p className="text-sm font-medium text-foreground">{status}</p>
          {(step === "preprocess" || step === "ocr" || step === "parse") && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{progress}%</p>
            </div>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card p-5">
          {(step === "preprocess" || step === "ocr" || step === "parse") ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Analizando recibo</p>
                  <p className="text-xs text-muted-foreground">No mostramos la imagen completa para una experiencia más limpia.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className={`rounded-lg px-3 py-2 ${step === "preprocess" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>1. Mejorar</div>
                <div className={`rounded-lg px-3 py-2 ${step === "ocr" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>2. Leer texto</div>
                <div className={`rounded-lg px-3 py-2 ${step === "parse" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>3. Extraer datos</div>
              </div>
            </div>
          ) : (
            <div className="flex h-28 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FileImage className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{selectedFileName || "Sin imagen seleccionada"}</p>
                <p className="text-xs text-muted-foreground">Se procesa localmente y se extrae texto OCR real.</p>
              </div>
            </div>
          )}
        </div>

        {blurScore !== null && blurScore < 120 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/40 bg-amber-100/40 p-3 text-sm text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            La foto parece borrosa. Para mejor resultado: mas luz, acercate y evita movimiento.
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-red-300/50 bg-red-100/40 p-3 text-sm text-red-900 dark:border-red-700/40 dark:bg-red-950/20 dark:text-red-300">{error}</div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button variant="outline" className="h-12 gap-2" onClick={() => cameraInputRef.current?.click()} disabled={isScanning}>
            <Camera className="h-5 w-5" />
            Abrir camara
          </Button>
          <Button variant="outline" className="h-12 gap-2" onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
            <Upload className="h-5 w-5" />
            Subir imagen
          </Button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => void handleImage(e.target.files?.[0])}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void handleImage(e.target.files?.[0])}
          />
        </div>

        {result && (
          <div className="mt-6 space-y-3 rounded-2xl bg-card p-4 text-sm">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">Datos detectados</span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Comercio</span><span>{result.merchant.value || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Monto</span><span>{result.amount.value ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Moneda</span><span>{result.currency.value || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fecha</span><span>{result.date.value || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Categoría sugerida</span><span>{result.categorySuggestion.value || "-"}</span></div>

            <div className="flex justify-between"><span className="text-muted-foreground">Precision de monto</span><span>{Math.round(result.amount.confidence * 100)}%</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Confianza general</span><span>{Math.round(result.overallConfidence * 100)}%</span></div>

            {lowConfidence && (
              <div className="rounded-lg border border-amber-300/40 bg-amber-100/40 p-3 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
                Deteccion con confianza baja. Revisa cuidadosamente antes de guardar.
              </div>
            )}

            <Button className="mt-2 h-11 w-full" onClick={openExpenseWithPrefill}>
              Revisar y crear gasto
            </Button>
          </div>
        )}

        {rawText && (
          <details className="mt-4 rounded-2xl bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">Ver texto OCR</summary>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">{rawText}</pre>
            {result?.debug && (
              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <p className="font-medium text-foreground">Candidatos de monto</p>
                  <p className="text-muted-foreground">Regla elegida: {result.debug.chosenAmountReason || "-"}</p>
                  <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">{JSON.stringify(result.debug.amountCandidates.slice(0, 6), null, 2)}</pre>
                </div>
                <div>
                  <p className="font-medium text-foreground">Candidatos de fecha</p>
                  <p className="text-muted-foreground">Regla elegida: {result.debug.chosenDateReason || "-"}</p>
                  <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">{JSON.stringify(result.debug.dateCandidates.slice(0, 6), null, 2)}</pre>
                </div>
              </div>
            )}
          </details>
        )}

        {(step === "preprocess" || step === "ocr" || step === "parse") && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando localmente en tu dispositivo (sin enviar imagen a terceros)
          </div>
        )}
      </div>
    </MobilePageShell>
  )
}
