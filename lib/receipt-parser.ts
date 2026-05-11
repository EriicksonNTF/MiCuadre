import type { Currency } from "@/lib/types/database"

export type ParsedField<T> = {
  value: T | null
  confidence: number
  source?: string
  score?: number
}

export type OcrLine = {
  text: string
  y?: number
}

type CandidateBase<T> = {
  value: T
  line: string
  lineIndex: number
  score: number
  confidence: number
  reasons: string[]
}

export type AmountCandidate = CandidateBase<number>
export type DateCandidate = CandidateBase<string> & { source: string }

export type ReceiptParseResult = {
  amount: ParsedField<number>
  currency: ParsedField<Currency>
  date: ParsedField<string>
  merchant: ParsedField<string>
  categorySuggestion: ParsedField<string>
  overallConfidence: number
  rawText: string
  debug?: {
    amountCandidates: AmountCandidate[]
    dateCandidates: DateCandidate[]
    chosenAmountReason?: string
    chosenDateReason?: string
  }
}

const POSITIVE_AMOUNT_KEYWORDS = [
  "total",
  "total a pagar",
  "total factura",
  "total compra",
  "gran total",
  "monto total",
  "monto pagado",
  "valor pagado",
  "importe total",
  "neto",
  "paid",
  "amount",
  "total amount",
  "payment",
]

const NEGATIVE_AMOUNT_KEYWORDS = [
  "subtotal",
  "itbis",
  "iva",
  "tax",
  "impuesto",
  "descuento",
  "cambio",
  "devuelta",
  "recibido",
  "efectivo recibido",
  "exento",
  "gravado",
  "autorizacion",
  "referencia",
  "comprobante",
  "ncf",
  "rnc",
]

const POSITIVE_DATE_KEYWORDS = ["fecha", "fec", "date", "emision", "venta", "transaccion", "factura"]
const NEGATIVE_DATE_KEYWORDS = ["vence", "vencimiento", "valido hasta", "expira", "tarjeta", "autorizacion"]

const MERCHANT_BLACKLIST = ["rnc", "caja", "factura", "ncf", "tel", "direccion", "av.", "calle"]

const MONTH_MAP: Record<string, number> = {
  enero: 1, ene: 1, jan: 1,
  febrero: 2, feb: 2,
  marzo: 3, mar: 3,
  abril: 4, abr: 4, apr: 4,
  mayo: 5, may: 5,
  junio: 6, jun: 6,
  julio: 7, jul: 7,
  agosto: 8, ago: 8, aug: 8,
  septiembre: 9, sep: 9, sept: 9,
  octubre: 10, oct: 10,
  noviembre: 11, nov: 11,
  diciembre: 12, dic: 12, dec: 12,
}

const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  jumbo: "compras",
  sirena: "compras",
  ikea: "vivienda",
  shell: "transporte",
  texaco: "transporte",
  mcdonalds: "comida",
  "pizza hut": "comida",
  farmacia: "salud",
  "la cadena": "salud",
}

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeOcrLine(line: string) {
  return line
    .replace(/[|]/g, "I")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim()
}

function normalizeMoneyToken(token: string) {
  return token
    .replace(/RDS|RD8|RD5/gi, "RD$")
    .replace(/[oO]/g, "0")
    .replace(/[iIl]/g, "1")
    .replace(/[B]/g, "8")
    .replace(/(\d)[sS](\d)/g, "$15$2")
    .replace(/\s+/g, "")
}

function amountFromToken(token: string): number | null {
  const normalized = normalizeMoneyToken(token)
    .replace(/(rd\$|dop|usd|us\$|\$)/gi, "")
    .replace(/(\d)[\s](\d{3})(\D|$)/g, "$1$2$3")

  const commaAsDecimal = /,\d{2}$/.test(normalized)
  let clean = normalized
  if (commaAsDecimal) clean = clean.replace(/\./g, "").replace(/,/g, ".")
  else clean = clean.replace(/,/g, "")

  clean = clean.replace(/\.(?=.*\.)/g, "")
  const value = Number(clean)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100) / 100
}

function buildLines(rawText: string, ocrLines?: OcrLine[]) {
  const lines = (ocrLines?.length
    ? ocrLines.map((l, i) => ({ text: normalizeOcrLine(l.text), y: l.y ?? i }))
    : rawText.split(/\r?\n/).map((line, i) => ({ text: normalizeOcrLine(line), y: i })))
    .filter((l) => l.text.length > 0)
    .sort((a, b) => a.y - b.y)

  return lines.map((line) => line.text)
}

function lineHasAny(line: string, words: string[]) {
  const normalized = normalizeText(line)
  return words.some((w) => normalized.includes(w))
}

function scoreAmountCandidate(lines: string[], idx: number, value: number): { score: number; reasons: string[] } {
  const current = lines[idx] || ""
  const prev = lines[idx - 1] || ""
  const next = lines[idx + 1] || ""
  const neighborhood = [prev, current, next].join(" | ")
  const reasons: string[] = []
  let score = 10

  if (lineHasAny(neighborhood, POSITIVE_AMOUNT_KEYWORDS)) {
    score += 100
    reasons.push("cerca de keyword total")
  }
  if (lineHasAny(neighborhood, NEGATIVE_AMOUNT_KEYWORDS)) {
    score -= 70
    reasons.push("cerca de keyword negativa")
  }

  if (idx >= Math.floor(lines.length * 0.66)) {
    score += 30
    reasons.push("zona footer")
  }

  if (value > 500) score += 12
  if (value > 1500) score += 8
  if (value < 10) score -= 20

  if (/total\s*a\s*pagar|gran\s*total|total\s*factura|total\s*compra/.test(normalizeText(neighborhood))) {
    score += 45
    reasons.push("frase fuerte de total")
  }

  return { score, reasons }
}

function extractAmount(lines: string[]) {
  const regex = /(?:RD\$|DOP|USD|US\$|\$)?\s?\d{1,3}(?:[\s,.]\d{3})*(?:[.,]\d{2})?|(?:RD\$|DOP|USD|US\$|\$)?\s?\d+(?:[.,]\d{2})?/gi
  const candidates: AmountCandidate[] = []

  lines.forEach((line, idx) => {
    const matches = line.match(regex) || []
    for (const token of matches) {
      const value = amountFromToken(token)
      if (!value || value <= 0) continue
      const { score, reasons } = scoreAmountCandidate(lines, idx, value)
      candidates.push({
        value,
        line,
        lineIndex: idx,
        score,
        confidence: Math.max(0.2, Math.min(0.99, score / 130)),
        reasons,
      })
    }
  })

  if (candidates.length === 0) {
    return {
      field: { value: null, confidence: 0, score: 0 } as ParsedField<number>,
      candidates,
      reason: "sin candidatos",
    }
  }

  const totalCandidates = candidates.filter((c) => {
    const n = normalizeText(c.line)
    return n.includes("total") && !n.includes("subtotal")
  })

  let chosen: AmountCandidate
  let reason = ""

  if (totalCandidates.length > 0) {
    totalCandidates.sort((a, b) => a.lineIndex - b.lineIndex)
    chosen = totalCandidates[totalCandidates.length - 1]
    reason = "ultimo TOTAL valido"
  } else {
    candidates.sort((a, b) => b.score - a.score || b.value - a.value)
    chosen = candidates[0]
    reason = "mayor score"
  }

  const safer = candidates
    .filter((c) => c.score >= chosen.score - 10)
    .sort((a, b) => b.value - a.value)
  if (safer.length > 0 && lineHasAny(chosen.line, NEGATIVE_AMOUNT_KEYWORDS)) {
    chosen = safer[0]
    reason = "evitar keyword negativa"
  }

  return {
    field: {
      value: chosen.value,
      confidence: Math.max(0.35, Math.min(0.99, chosen.score / 120)),
      source: chosen.line,
      score: chosen.score,
    },
    candidates: candidates.sort((a, b) => b.score - a.score),
    reason,
  }
}

function parseDateYMD(year: number, month: number, day: number) {
  if (year < 2018 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const d = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  if (d > new Date()) return null
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

function yearFromToken(y: string) {
  if (y.length === 4) return Number(y)
  const yy = Number(y)
  return yy <= 69 ? 2000 + yy : 1900 + yy
}

function scoreDateLine(lines: string[], idx: number) {
  const current = lines[idx] || ""
  const prev = lines[idx - 1] || ""
  const next = lines[idx + 1] || ""
  const context = normalizeText(`${prev} ${current} ${next}`)
  let score = 45
  const reasons: string[] = []

  if (POSITIVE_DATE_KEYWORDS.some((k) => context.includes(k))) {
    score += 35
    reasons.push("contexto fecha positivo")
  }
  if (NEGATIVE_DATE_KEYWORDS.some((k) => context.includes(k))) {
    score -= 30
    reasons.push("contexto fecha negativo")
  }
  if (idx < Math.floor(lines.length * 0.4)) {
    score += 12
    reasons.push("zona header")
  }

  return { score, reasons }
}

function extractDate(lines: string[]) {
  const candidates: DateCandidate[] = []

  lines.forEach((line, idx) => {
    const text = normalizeText(line)
    const entries: Array<{ value: string; source: string }> = []

    for (const m of text.matchAll(/\b(20\d{2})[-\/.](0?[1-9]|1[0-2])[-\/.](0?[1-9]|[12]\d|3[01])\b/g)) {
      const v = parseDateYMD(Number(m[1]), Number(m[2]), Number(m[3]))
      if (v) entries.push({ value: v, source: m[0] })
    }

    for (const m of text.matchAll(/\b(0?[1-9]|[12]\d|3[01])[-\/.](0?[1-9]|1[0-2])[-\/.](\d{2}|20\d{2})\b/g)) {
      const v = parseDateYMD(yearFromToken(m[3]), Number(m[2]), Number(m[1]))
      if (v) entries.push({ value: v, source: m[0] })
    }

    for (const m of text.matchAll(/\b(0?[1-9]|[12]\d|3[01])\s+([a-záéíóúñ]+)\s+(\d{2}|20\d{2})\b/g)) {
      const month = MONTH_MAP[m[2]]
      if (!month) continue
      const v = parseDateYMD(yearFromToken(m[3]), month, Number(m[1]))
      if (v) entries.push({ value: v, source: m[0] })
    }

    for (const entry of entries) {
      const { score, reasons } = scoreDateLine(lines, idx)
      candidates.push({
        value: entry.value,
        source: entry.source,
        line,
        lineIndex: idx,
        score,
        confidence: Math.max(0.3, Math.min(0.98, score / 100)),
        reasons,
      })
    }
  })

  if (candidates.length === 0) {
    return { field: { value: null, confidence: 0, score: 0 } as ParsedField<string>, candidates, reason: "sin candidatos" }
  }

  candidates.sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex)
  const chosen = candidates[0]
  return {
    field: {
      value: chosen.value,
      confidence: chosen.confidence,
      source: chosen.source,
      score: chosen.score,
    },
    candidates,
    reason: "mayor score contextual",
  }
}

function detectCurrency(rawText: string): ParsedField<Currency> {
  const t = normalizeText(rawText)
  if (/\brd\$|\bdop\b/.test(t)) return { value: "DOP", confidence: 0.92, source: "rd-symbol", score: 92 }
  if (/\bus\$|\busd\b/.test(t)) return { value: "USD", confidence: 0.92, source: "usd-symbol", score: 92 }
  if (/\$/.test(t)) return { value: "DOP", confidence: 0.6, source: "dollar-locale-rd", score: 60 }
  return { value: "DOP", confidence: 0.45, source: "rd-default", score: 45 }
}

function extractMerchant(lines: string[]): ParsedField<string> {
  const header = lines.slice(0, 6)
  const candidates: Array<{ text: string; score: number }> = []
  header.forEach((line, idx) => {
    const n = normalizeText(line)
    let score = 0
    if (idx < 3) score += 50
    if (/^[A-Z0-9\s.-]{3,}$/.test(line)) score += 20
    if (line.length <= 40) score += 15
    if (/\d/.test(line)) score -= 20
    if (MERCHANT_BLACKLIST.some((k) => n.includes(k))) score -= 50
    candidates.push({ text: line, score })
  })

  if (candidates.length === 0) {
    return { value: null, confidence: 0, score: 0 }
  }

  candidates.sort((a, b) => b.score - a.score)
  const best = candidates[0]

  if (best.score < 20) {
    const fallbackScore = best.score
    return { value: null, confidence: 0, score: fallbackScore }
  }
  return { value: best.text, confidence: Math.max(0.45, Math.min(0.9, best.score / 100)), source: "header", score: best.score }
}

function suggestCategory(merchant: string | null, rawText: string): ParsedField<string> {
  const hay = normalizeText(`${merchant || ""} ${rawText}`)
  for (const [word, cat] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    if (hay.includes(word)) return { value: cat, confidence: 0.86, source: word, score: 86 }
  }
  return { value: "compras", confidence: 0.45, source: "fallback", score: 45 }
}

export function parseReceiptText(rawText: string, ocrLines?: OcrLine[]): ReceiptParseResult {
  const safeText = rawText || ""
  const lines = buildLines(safeText, ocrLines)

  const amountData = extractAmount(lines)
  const dateData = extractDate(lines)
  const currency = detectCurrency(safeText)
  const merchant = extractMerchant(lines)
  const categorySuggestion = suggestCategory(merchant.value, safeText)

  const overallConfidence = Math.round(
    (amountData.field.confidence * 0.7 + dateData.field.confidence * 0.15 + currency.confidence * 0.1 + merchant.confidence * 0.05) * 100
  ) / 100

  return {
    amount: amountData.field,
    currency,
    date: dateData.field,
    merchant,
    categorySuggestion,
    overallConfidence,
    rawText: safeText,
    debug: {
      amountCandidates: amountData.candidates,
      dateCandidates: dateData.candidates,
      chosenAmountReason: amountData.reason,
      chosenDateReason: dateData.reason,
    },
  }
}

export function runReceiptParserSelfCheck() {
  const cases = [
    {
      name: "Caso 1",
      text: "SUPERMERCADO NACIONAL\nFECHA: 03/05/2026\nSUBTOTAL 1,000.00\nITBIS 180.00\nTOTAL A PAGAR RD$ 1,180.00",
      expectedAmount: 1180,
      expectedDate: "2026-05-03",
    },
    {
      name: "Caso 2",
      text: "FARMACIA CAROL\n03-05-2026\nTOTAL FACTURA 545.50\nEFECTIVO RECIBIDO 1000.00\nCAMBIO 454.50",
      expectedAmount: 545.5,
      expectedDate: "2026-05-03",
    },
    {
      name: "Caso 3",
      text: "RESTAURANTE\nTOTAL\nRD$ 2,350.00\nFECHA 3/5/26",
      expectedAmount: 2350,
      expectedDate: "2026-05-03",
    },
    {
      name: "Caso 4",
      text: "TICKET\nSUBTOTAL 900\nITBIS 162\nTOTAL COMPRA 1062",
      expectedAmount: 1062,
    },
    {
      name: "Caso 5",
      text: "COMPROBANTE\nVENCE 30/12/2026\nFECHA 03/05/2026\nTOTAL 800",
      expectedAmount: 800,
      expectedDate: "2026-05-03",
    },
  ]

  return cases.map((c) => {
    const parsed = parseReceiptText(c.text)
    return {
      name: c.name,
      amount: parsed.amount.value,
      date: parsed.date.value,
      amountOk: parsed.amount.value === c.expectedAmount,
      dateOk: c.expectedDate ? parsed.date.value === c.expectedDate : true,
      confidence: parsed.overallConfidence,
    }
  })
}
