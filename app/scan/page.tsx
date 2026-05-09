"use client"

import Link from "next/link"
import { useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Camera, Loader2, Upload, AlertTriangle, CheckCircle2 } from "lucide-react"
import { createWorker } from "tesseract.js"
import { Button } from "@/components/ui/button"
import { parseReceiptText } from "@/lib/receipt-parser"

type ScanStep = "idle" | "preprocess" | "ocr" | "parse" | "done" | "error"

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

async function preprocessImage(file: File): Promise<{ dataUrl: string; blurScore: number }> {
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
  return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), blurScore: variance }
}

export default function ScanPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  const [step, setStep] = useState<ScanStep>("idle")
  const [status, setStatus] = useState("Sube una foto del recibo")
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [rawText, setRawText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [blurScore, setBlurScore] = useState<number | null>(null)
  const [result, setResult] = useState<ReturnType<typeof parseReceiptText> | null>(null)

  const lowConfidence = useMemo(() => {
    if (!result) return false
    return result.amount.confidence < 0.6 || result.date.confidence < 0.6 || result.overallConfidence < 0.7
  }, [result])

  const handleImage = async (file?: File) => {
    if (!file) return
    setError(null)
    setResult(null)
    setRawText("")
    setProgress(0)
    setStep("preprocess")
    setStatus("Mejorando imagen...")

    try {
      const { dataUrl, blurScore: score } = await preprocessImage(file)
      setPreviewUrl(dataUrl)
      setBlurScore(score)

      setStep("ocr")
      setStatus("Detectando texto...")

      const worker = await createWorker("spa+eng", 1, {
        logger: (msg) => {
          if (msg.status === "recognizing text" && typeof msg.progress === "number") {
            setProgress(Math.round(msg.progress * 100))
          }
        },
      })

      const { data } = await worker.recognize(dataUrl)
      await worker.terminate()

      setRawText(data.text || "")
      setStep("parse")
      setStatus("Buscando monto, fecha y comercio...")

      const ocrLines = Array.isArray((data as any).lines)
        ? (data as any).lines.map((line: any) => ({
            text: String(line?.text || ""),
            y: Number(line?.bbox?.y0 ?? 0),
          }))
        : undefined

      const parsed = parseReceiptText(data.text || "", ocrLines)
      setResult(parsed)
      setStep("done")
      setStatus("Revisa los datos detectados")
    } catch (scanError) {
      console.error(scanError)
      setStep("error")
      setError("No se pudo procesar la imagen. Intenta con mejor luz y el recibo mas cerca.")
      setStatus("Error")
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
    router.push(`/expense?${params.toString()}`)
  }

  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <header className="flex items-center gap-3 px-6 pb-4 pt-8">
        <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold text-foreground">Escanear recibo</h1>
      </header>

      <div className="px-6 pb-8">
        <div className="rounded-2xl bg-card p-4">
          <p className="text-sm font-medium text-foreground">{status}</p>
          {(step === "ocr" || step === "parse") && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{progress}%</p>
            </div>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-muted">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Recibo" className="w-full object-contain" />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Sin imagen seleccionada</div>
          )}
        </div>

        {blurScore !== null && blurScore < 120 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300/40 bg-amber-100/40 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            La foto parece borrosa. Para mejor resultado: mas luz, acercate y evita movimiento.
          </div>
        )}

        {error && (
          <div className="mt-3 rounded-xl border border-red-300/50 bg-red-100/40 p-3 text-sm text-red-900">{error}</div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button variant="outline" className="h-12 gap-2" onClick={() => cameraInputRef.current?.click()}>
            <Camera className="h-5 w-5" />
            Abrir camara
          </Button>
          <Button variant="outline" className="h-12 gap-2" onClick={() => fileInputRef.current?.click()}>
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
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">Datos detectados</span>
            </div>
            <div className="flex justify-between"><span className="text-muted-foreground">Comercio</span><span>{result.merchant.value || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Monto</span><span>{result.amount.value ?? "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Moneda</span><span>{result.currency.value || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Fecha</span><span>{result.date.value || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Categoria sugerida</span><span>{result.categorySuggestion.value || "-"}</span></div>

            <div className="flex justify-between"><span className="text-muted-foreground">Confianza general</span><span>{Math.round(result.overallConfidence * 100)}%</span></div>

            {lowConfidence && (
              <div className="rounded-lg border border-amber-300/40 bg-amber-100/40 p-3 text-xs text-amber-900">
                Deteccion con confianza baja. Revisa cuidadosamente antes de guardar.
              </div>
            )}

            <Button className="mt-2 h-11 w-full" onClick={openExpenseWithPrefill}>
              Usar datos para nuevo gasto
            </Button>
          </div>
        )}

        {rawText && (
          <details className="mt-4 rounded-2xl bg-card p-4">
            <summary className="cursor-pointer text-sm font-medium">Ver texto OCR</summary>
            <pre className="mt-3 whitespace-pre-wrap text-xs text-muted-foreground">{rawText}</pre>
          </details>
        )}

        {(step === "preprocess" || step === "ocr" || step === "parse") && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando localmente en tu dispositivo (sin enviar imagen a terceros)
          </div>
        )}
      </div>
    </div>
  )
}
