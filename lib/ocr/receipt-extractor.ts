import "server-only";

import ZAI from "z-ai-web-dev-sdk";
import type { ExtractedReceipt } from "./types";
import { validateReceipt, isReceiptValid } from "./validate";

let zaiInstance: ZAI | null = null;

async function getZai(): Promise<ZAI> {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

const RECEIPT_OCR_PROMPT = `Eres un extractor OCR especializado en recibos y facturas de República Dominicana.

Analiza la imagen y extrae la información en formato JSON EXACTO con este schema:

{
  "doc_type": "receipt" | "invoice" | "bank_statement" | "credit_card_statement" | "unknown",
  "merchant": {
    "name": string | null,
    "category": "Supermercado" | "Restaurant" | "Gasolina" | "Farmacia" | "Ropa" | "Servicios" | "Transporte" | "Entretenimiento" | "Otro" | null,
    "rnc": string | null
  },
  "date": "YYYY-MM-DD" | null,
  "time": "HH:MM" | null,
  "currency": "DOP" | "USD" | null,
  "subtotal": number | null,
  "tax_itbis": number | null,
  "tip": number | null,
  "total": number | null,
  "line_items": [
    { "description": string, "quantity": number, "unit_price": number, "total": number }
  ],
  "payment_method": "cash" | "credit_card" | "debit_card" | "transfer" | "unknown",
  "card_last4": string | null,
  "auth_code": string | null,
  "confidence": number,
  "language": "es" | "en",
  "warnings": string[]
}

REGLAS CRÍTICAS:
1. Devuelve SOLO JSON válido, sin texto antes ni después, sin markdown \`\`\` ni explicaciones.
2. Si un campo no está visible o es ilegible, usa null (no inventes).
3. Los montos deben ser números (sin comas, sin símbolos): 1840.50, no "RD$1,840.50".
4. Las fechas en formato ISO: "2026-05-15", no "15/05/26".
5. Reconoce símbolo "RD$" como DOP y "$" o "US$" como USD.
6. Reconoce ITBIS (impuesto dominicano, 18%) en campos como "ITBIS", "IVA", "Tax".
7. Reconoce RNC dominicano (9 dígitos) y NCF (formato B01XXXXXXXX o E31XXXXXXXX).
8. Si subtotal + tax_itbis + tip no cuadra con total (±0.50), agrega "total_mismatch" a warnings.
9. Si la fecha es futura o anterior a 2020, agrega "date_suspicious" a warnings.
10. Confidence entre 0 y 1 basado en legibilidad de la imagen.
11. Para merchant.category usa exactamente uno de los valores del enum, infiere del nombre del comercio si no es explícito.
12. Si la imagen NO es un recibo válido, devuelve {"doc_type": "unknown", "warnings": ["not_a_receipt"]}.
13. card_last4 debe ser exactamente 4 dígitos, sin espacios ni guiones.
14. Para line_items: si no se pueden identificar items individuales, devuelve array vacío [].`;

const FIX_JSON_PROMPT = `El JSON que devolviste no es válido. Corrígelo y devuelve SOLO JSON válido (sin markdown), respetando exactamente el schema solicitado. JSON original:\n\n`;

export async function extractReceiptData(
  imageBase64: string,
  mimeType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg"
): Promise<ExtractedReceipt> {
  const zai = await getZai();

  const response = await zai.chat.completions.createVision({
    model: "glm-4.5v",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: RECEIPT_OCR_PROMPT },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
        ],
      },
    ],
    thinking: { type: "disabled" },
  });

  const raw = response.choices[0]?.message?.content ?? "";
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: ExtractedReceipt;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const fixResponse = await zai.chat.completions.createVision({
      model: "glm-4.5v",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: FIX_JSON_PROMPT + raw },
          ],
        },
      ],
      thinking: { type: "disabled" },
    });

    const fixedRaw = fixResponse.choices[0]?.message?.content ?? "";
    const fixedCleaned = fixedRaw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    parsed = JSON.parse(fixedCleaned);
  }

  const validated = validateReceipt(parsed);

  if (!isReceiptValid(validated)) {
    return {
      ...validated,
      warnings: [...validated.warnings, "invalid_receipt"],
    };
  }

  return validated;
}