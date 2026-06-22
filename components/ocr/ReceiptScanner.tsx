"use client";

import { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload, Loader2, AlertTriangle, CheckCircle2, FileImage, X, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { MobilePageShell } from "@/components/ui/mobile-foundation";

type ScanStep = "idle" | "uploading" | "processing" | "done" | "error";

interface ExtractedReceipt {
  doc_type: string;
  merchant: { name: string | null; category: string | null; rnc: string | null };
  date: string | null;
  time: string | null;
  currency: "DOP" | "USD" | null;
  subtotal: number | null;
  tax_itbis: number | null;
  tip: number | null;
  total: number | null;
  line_items: Array<{ description: string; quantity: number; unit_price: number; total: number }>;
  payment_method: string;
  card_last4: string | null;
  auth_code: string | null;
  confidence: number;
  language: string;
  warnings: string[];
}

export function ReceiptScanner() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<ScanStep>("idle");
  const [status, setStatus] = useState("Sube una foto del recibo");
  const [progress, setProgress] = useState(0);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractedReceipt | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const lowConfidence = result && (result.confidence < 0.7 || result.warnings.length > 0);

  const compressImage = useCallback(async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_DIMENSION = 1500;
        let { width, height } = img;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No se pudo crear canvas"));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Compresión fallida"));
          },
          "image/jpeg",
          0.8
        );
      };
      img.onerror = () => reject(new Error("Error cargando imagen"));
      img.src = URL.createObjectURL(file);
    });
  }, []);

  const handleImage = async (file?: File) => {
    if (!file || isProcessing) return;
    setIsProcessing(true);
    setError(null);
    setResult(null);
    setPreviewUrl(null);
    setShowPreview(false);
    setSelectedFileName(file.name);
    setProgress(0);
    setStep("uploading");
    setStatus("Comprimiendo imagen...");

    try {
      const compressedBlob = await compressImage(file);
      setProgress(20);
      setStep("processing");
      setStatus("Enviando al servidor OCR...");

      const formData = new FormData();
      formData.append("image", compressedBlob, file.name.replace(/\.[^.]+$/, ".jpg"));

      const response = await fetch("/api/ocr/receipt", {
        method: "POST",
        body: formData,
      });

      setProgress(60);
      setStatus("Procesando respuesta...");

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Error ${response.status}`);
      }

      const data = await response.json();
      setProgress(90);
      setStatus("Datos recibidos");

      if (!data.success || !data.data) {
        throw new Error(data.error || "Respuesta inválida del servidor");
      }

      setResult(data.data);
      setStep("done");
      setProgress(100);
      setStatus(data.cached ? "Datos desde caché" : "¡Datos extraídos correctamente!");

      if (data.data.confidence >= 0.8 && data.data.total != null) {
        setStatus("Abriendo formulario de gasto...");
        const params = new URLSearchParams();
        if (data.data.total) params.set("amount", String(data.data.total));
        if (data.data.merchant.name) params.set("description", data.data.merchant.name);
        if (data.data.currency) params.set("currency", data.data.currency);
        if (data.data.date) params.set("date", data.data.date);
        if (data.data.merchant.category) params.set("category", data.data.merchant.category);
        if (data.data.payment_method !== "unknown") params.set("payment_method", data.data.payment_method);
        params.set("source", "scan");
        router.push(`/expense?${params.toString()}`);
        return;
      }

      setStatus("Revisa los datos detectados");
    } catch (scanError) {
      console.error(scanError);
      setStep("error");
      setError(
        scanError instanceof Error
          ? scanError.message
          : "No se pudo completar el escaneo. Intenta con mejor luz y coloca el recibo completo en la foto."
      );
      setStatus("Error");
    } finally {
      setIsProcessing(false);
    }
  };

  const openExpenseWithPrefill = () => {
    if (!result) return;
    const params = new URLSearchParams();
    if (result.total) params.set("amount", String(result.total));
    if (result.merchant.name) params.set("description", result.merchant.name);
    if (result.currency) params.set("currency", result.currency);
    if (result.date) params.set("date", result.date);
    if (result.merchant.category) params.set("category", result.merchant.category);
    if (result.payment_method !== "unknown") params.set("payment_method", result.payment_method);
    if (result.card_last4) params.set("card_last4", result.card_last4);
    params.set("source", "scan");
    router.push(`/expense?${params.toString()}`);
  };

  const resetScan = () => {
    setStep("idle");
    setStatus("Sube una foto del recibo");
    setProgress(0);
    setSelectedFileName(null);
    setPreviewUrl(null);
    setShowPreview(false);
    setError(null);
    setResult(null);
  };

  return (
    <MobilePageShell fullBleed className="pb-nav-safe">
      <header className="flex items-center gap-3 px-6 pb-4 pt-8">
        <button
          onClick={resetScan}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted"
          aria-label="Volver"
        >
          <X className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Escanear recibo</h1>
      </header>

      <div className="px-6 pb-8">
        {isProcessing && (
          <ModalOverlay open={true} blocking>
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="w-[92%] max-w-md rounded-3xl border border-border bg-card p-6 shadow-2xl">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">Procesando recibo</p>
                    <p className="text-xs text-muted-foreground">IA de MiCuadre analizando la imagen</p>
                  </div>
                </div>

                <div className="h-2 rounded-full bg-muted">
                  <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{status}</p>

                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className={`rounded-lg px-2 py-2 text-center ${step === "uploading" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Subir</div>
                  <div className={`rounded-lg px-2 py-2 text-center ${step === "processing" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Procesar</div>
                  <div className={`rounded-lg px-2 py-2 text-center ${step === "done" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>Listo</div>
                </div>
              </div>
            </div>
          </ModalOverlay>
        )}

        <div className="rounded-2xl bg-card p-4">
          <p className="text-sm font-medium text-foreground">{status}</p>
          {(step === "uploading" || step === "processing") && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-muted">
                <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{progress}%</p>
            </div>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card p-5">
          {previewUrl && showPreview ? (
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-muted">
              <img src={previewUrl} alt="Vista previa del recibo" className="h-full w-full object-cover" />
              <button
                onClick={() => setShowPreview(false)}
                className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                aria-label="Ocultar vista previa"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (step === "uploading" || step === "processing") ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Analizando recibo</p>
                  <p className="text-xs text-muted-foreground">La imagen se procesa en el servidor de forma segura.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className={`rounded-lg px-3 py-2 ${step === "uploading" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>1. Subir</div>
                <div className={`rounded-lg px-3 py-2 ${step === "processing" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>2. Extraer</div>
                <div className={`rounded-lg px-3 py-2 ${["done", "error"].includes(step) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>3. Confirmar</div>
              </div>
            </div>
          ) : (
            <div className="flex h-28 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <FileImage className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{selectedFileName || "Sin imagen seleccionada"}</p>
                <p className="text-xs text-muted-foreground">Se envía al servidor, se procesa con IA y se eliminan los datos temporales.</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-red-300/50 bg-red-100/40 p-3 text-sm text-red-900 dark:border-red-700/40 dark:bg-red-950/20 dark:text-red-300">{error}</div>
        )}

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button variant="outline" className="h-12 gap-2" onClick={() => cameraInputRef.current?.click()} disabled={isProcessing}>
            <Camera className="h-5 w-5" />
            Abrir cámara
          </Button>
          <Button variant="outline" className="h-12 gap-2" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
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

        {previewUrl && (
          <Button variant="ghost" className="mt-2 w-full gap-2" onClick={() => setShowPreview(true)} disabled={isProcessing}>
            {showPreview ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            {showPreview ? "Ocultar vista previa" : "Ver vista previa"}
          </Button>
        )}

        {result && (
          <div className="mt-6 space-y-3 rounded-2xl bg-card p-4 text-sm">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-medium">Datos detectados</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                {Math.round(result.confidence * 100)}%
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex justify-between"><span className="text-muted-foreground">Comercio</span><span className="font-medium">{result.merchant.name || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Categoría</span><span>{result.merchant.category || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Monto total</span><span className="font-semibold">{result.total ?? "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Moneda</span><span>{result.currency || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Fecha</span><span>{result.date || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Hora</span><span>{result.time || "-"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Método de pago</span><span>{result.payment_method || "-"}</span></div>
              {result.card_last4 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Tarjeta terminada en</span><span className="font-mono">{result.card_last4}</span></div>
              )}
              {result.tax_itbis != null && (
                <div className="flex justify-between"><span className="text-muted-foreground">ITBIS</span><span>{result.tax_itbis}</span></div>
              )}
              {result.subtotal != null && (
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{result.subtotal}</span></div>
              )}
              {result.tip != null && result.tip > 0 && (
                <div className="flex justify-between"><span className="text-muted-foreground">Propina</span><span>{result.tip}</span></div>
              )}
            </div>

            {result.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-300/40 bg-amber-100/40 p-3 text-xs text-amber-900 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
                <div className="font-medium mb-1">⚠️ Advertencias:</div>
                <ul className="list-disc list-inside space-y-1">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w.replace(/_/g, " ")}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.line_items.length > 0 && (
              <details className="mt-2 rounded-lg border border-border p-3">
                <summary className="cursor-pointer font-medium text-sm">Ver items ({result.line_items.length})</summary>
                <div className="mt-2 space-y-1 text-xs">
                  {result.line_items.slice(0, 10).map((item, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="truncate">{item.description}</span>
                      <span className="whitespace-nowrap font-mono">{item.quantity} × {item.unit_price} = {item.total}</span>
                    </div>
                  ))}
                  {result.line_items.length > 10 && (
                    <p className="text-muted-foreground">... y {result.line_items.length - 10} más</p>
                  )}
                </div>
              </details>
            )}

            <div className="mt-4 flex gap-2">
              <Button className="flex-1 h-11" onClick={openExpenseWithPrefill}>
                Revisar y crear gasto
              </Button>
              <Button variant="outline" className="h-11" onClick={resetScan}>
                Escanear otro
              </Button>
            </div>
          </div>
        )}

        {(step === "uploading" || step === "processing") && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Procesando en el servidor (privacidad garantizada)
          </div>
        )}
      </div>
    </MobilePageShell>
  );
}