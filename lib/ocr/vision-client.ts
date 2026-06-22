import "server-only"

/**
 * Cliente de visión (VLM) reutilizable.
 *
 * Sigue el mismo patrón que `.api-backup/mia/chat/route.ts`: llamadas `fetch()`
 * directas a OpenRouter (formato OpenAI-compatible) en vez de un SDK dedicado.
 * Esto evita añadir una dependencia nueva y mantiene consistencia con el resto
 * de la integración LLM del proyecto.
 */

const LLM_API_KEY = process.env.LLM_API_KEY || ""
const LLM_API_BASE = process.env.LLM_API_BASE || "https://openrouter.ai/api/v1"
const LLM_VISION_MODEL = process.env.LLM_VISION_MODEL || "z-ai/glm-4.5v"
const LLM_VISION_FALLBACKS = (process.env.LLM_VISION_FALLBACKS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)

const VISION_TIMEOUT_MS = 30_000

export type VisionContentType = "image/jpeg" | "image/png" | "image/webp"

/**
 * Llama al modelo de visión con una imagen y un prompt, devuelve el contenido
 * de texto de la respuesta (típicamente un JSON en string).
 *
 * - Prueba el modelo principal y luego los fallbacks configurados.
 * - Timeout de 30s por intento vía AbortController.
 * - Limpia fences de markdown ``` por si el modelo los añade.
 *
 * Lanza Error si todos los modelos fallan o si no hay API key configurada.
 */
export async function callVisionModel(
  imageBase64: string,
  mimeType: VisionContentType,
  prompt: string,
): Promise<string> {
  if (!LLM_API_KEY) {
    throw new Error("LLM_API_KEY no configurada para el servicio de visión")
  }

  const modelsToTry = [LLM_VISION_MODEL, ...LLM_VISION_FALLBACKS]
  const baseUrl = LLM_API_BASE.replace(/\/$/, "")
  const dataUrl = `data:${mimeType};base64,${imageBase64}`

  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), VISION_TIMEOUT_MS)

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LLM_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 1500,
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout))

      if (!response.ok) {
        const detail = await response.text().catch(() => "")
        console.warn(`[ocr/vision] provider error for ${model}`, {
          status: response.status,
          detail: detail.slice(0, 200),
        })
        lastError = new Error(`Vision provider ${response.status} for ${model}`)
        continue
      }

      const data = (await response.json().catch(() => null)) as
        | {
            choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
            error?: { message?: string }
          }
        | null

      if (data?.error?.message) {
        console.warn(`[ocr/vision] provider error in body for ${model}`, data.error.message)
        lastError = new Error(data.error.message)
        continue
      }

      const content = data?.choices?.[0]?.message?.content
      if (!content) {
        console.warn(`[ocr/vision] empty response for ${model}`, {
          finish_reason: data?.choices?.[0]?.finish_reason,
        })
        lastError = new Error(`Respuesta vacía del modelo ${model}`)
        continue
      }

      return cleanMarkdownFences(content)
    } catch (err) {
      const isAbort = err instanceof Error && err.name === "AbortError"
      console.warn(`[ocr/vision] ${isAbort ? "timeout" : "error"} for ${model}`, err)
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw lastError ?? new Error("Todos los modelos de visión fallaron")
}

/** Quita fences ```json ... ``` que algunos modelos añaden por error. */
function cleanMarkdownFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
}
