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

export type ReceiptParseResult = {
  amount: ParsedField<number>
  currency: ParsedField<Currency>
  date: ParsedField<string>
  merchant: ParsedField<string>
  categorySuggestion: ParsedField<string>
  overallConfidence: number
  rawText: string
}

const HIGH_AMOUNT_KEYWORDS = [
  "total",
  "total rd$",
  "total dop",
  "monto",
  "importe",
  "balance",
  "total final",
  "valor pagado",
  "pagado",
  "neto",
]

const MEDIUM_NEGATIVE_KEYWORDS = ["subtotal", "itbis", "tax", "descuento", "exento", "propina", "cambio"]
const MERCHANT_BLACKLIST = ["rnc", "caja", "factura", "ncf", "tel", "direccion", "av.", "calle"]

const MERCHANT_CATEGORY_MAP: Record<string, string> = {
  jumbo: "compras",
  bravo: "compras",
  nacional: "compras",
  sirena: "compras",
  ikea: "vivienda",
  shell: "transporte",
  texaco: "transporte",
  totalenergies: "transporte",
  mcdonalds: "comida",
  "pizza hut": "comida",
  farmacia: "salud",
  "la cadena": "salud",
  claro: "servicios",
  altice: "servicios",
}

function normalizeText(input: string) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeForNumeric(text: string) {
  return text
    .replace(/[oO]/g, "0")
    .replace(/[sS]/g, "5")
    .replace(/[iIl]/g, "1")
    .replace(/[B]/g, "8")
}

function levenshtein(a: string, b: string) {
  const aa = normalizeText(a)
  const bb = normalizeText(b)
  const matrix: number[][] = []
  for (let i = 0; i <= bb.length; i++) matrix[i] = [i]
  for (let j = 0; j <= aa.length; j++) matrix[0][j] = j
  for (let i = 1; i <= bb.length; i++) {
    for (let j = 1; j <= aa.length; j++) {
      const cost = bb[i - 1] === aa[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[bb.length][aa.length]
}

function similarity(a: string, b: string) {
  const maxLen = Math.max(a.length, b.length) || 1
  return 1 - levenshtein(a, b) / maxLen
}

function buildLineBlocks(rawText: string, ocrLines?: OcrLine[]) {
  const lines = (ocrLines && ocrLines.length > 0
    ? ocrLines.map((l) => ({ text: l.text.trim(), y: l.y ?? 0 })).filter((l) => l.text.length > 0)
    : rawText
        .split(/\r?\n/)
        .map((line, index) => ({ text: line.trim(), y: index }))
        .filter((l) => l.text.length > 0))

  lines.sort((a, b) => a.y - b.y)
  const n = lines.length
  const headerEnd = Math.max(1, Math.floor(n * 0.3))
  const footerStart = Math.max(0, Math.floor(n * 0.65))

  return {
    all: lines,
    header: lines.slice(0, headerEnd),
    body: lines.slice(headerEnd, footerStart),
    footer: lines.slice(footerStart),
  }
}

function detectCurrency(text: string): ParsedField<Currency> {
  const t = normalizeText(text)
  if (/\brd\$|\bdop\b|peso/.test(t)) return { value: "DOP", confidence: 0.92, source: "rd-symbol", score: 92 }
  if (/\bus\$|\busd\b|dolar/.test(t)) return { value: "USD", confidence: 0.92, source: "usd-symbol", score: 92 }
  if (/\$/.test(t)) return { value: "DOP", confidence: 0.55, source: "dollar-fallback-rd", score: 55 }
  return { value: "DOP", confidence: 0.45, source: "locale-rd", score: 45 }
}

function parseAmountToken(match: string) {
  const cleaned = normalizeForNumeric(match).replace(/\s/g, "")
  const noCurrency = cleaned.replace(/(rd\$|dop|usd|us\$)/gi, "")
  const normalized = noCurrency
    .replace(/,(?=\d{3}(\D|$))/g, "")
    .replace(/\.(?=.*\.)/g, "")
    .replace(/,/, ".")
  const value = Number(normalized)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

function extractAmount(rawText: string, blocks: ReturnType<typeof buildLineBlocks>): ParsedField<number> {
  const amountRegex = /(?:RD\$|DOP|USD|US\$|\$)?\s?[0-9oOilSB]{1,3}(?:[.,\s][0-9oOilSB]{3})*(?:[.,][0-9oOilSB]{2})?/gi
  const candidates: Array<{ value: number; score: number; line: string; idx: number }> = []

  blocks.all.forEach((entry, idx) => {
    const line = normalizeText(entry.text)
    const matches = entry.text.match(amountRegex) || []
    for (const match of matches) {
      const value = parseAmountToken(match)
      if (!value || value <= 0) continue

      let score = 20
      if (value > 50) score += 6
      if (value > 500) score += 8
      if (value > 2000) score += 6

      if (blocks.footer.some((f) => f.text === entry.text)) score += 30
      if (idx >= Math.floor(blocks.all.length * 0.66)) score += 15

      if (HIGH_AMOUNT_KEYWORDS.some((keyword) => line.includes(keyword))) score += 100
      if (MEDIUM_NEGATIVE_KEYWORDS.some((keyword) => line.includes(keyword))) score -= 50

      const hasTotalLike = line.includes("total") || similarity(line, "total") > 0.72
      if (hasTotalLike) score += 30

      candidates.push({ value, score, line: entry.text, idx })
    }
  })

  if (candidates.length === 0) return { value: null, confidence: 0, score: 0 }

  const totals = candidates.filter((c) => {
    const ln = normalizeText(c.line)
    return ln.includes("total") || similarity(ln, "total") > 0.72
  })

  let winner: typeof candidates[number]
  if (totals.length > 0) {
    totals.sort((a, b) => a.idx - b.idx)
    const lastTotal = totals[totals.length - 1]
    winner = lastTotal
  } else {
    candidates.sort((a, b) => b.score - a.score || b.value - a.value)
    winner = candidates[0]
  }

  const confidence = Math.max(0.35, Math.min(0.98, winner.score / 150))
  return { value: winner.value, confidence, source: winner.line, score: winner.score }
}

function extractDate(rawText: string, blocks: ReturnType<typeof buildLineBlocks>): ParsedField<string> {
  const headerText = blocks.header.map((l) => l.text).join("\n")
  const text = `${headerText}\n${rawText}`

  const iso = text.match(/\b(20\d{2})[-\/.](0?[1-9]|1[0-2])[-\/.](0?[1-9]|[12]\d|3[01])\b/)
  if (iso) {
    const value = `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`
    return { value, confidence: 0.95, source: iso[0], score: 95 }
  }

  const dmy = text.match(/\b(0?[1-9]|[12]\d|3[01])[-\/.](0?[1-9]|1[0-2])[-\/.](20\d{2})\b/)
  if (dmy) {
    const day = Number(dmy[1])
    const month = Number(dmy[2])
    const year = Number(dmy[3])
    const date = new Date(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00`)
    const now = new Date()
    const minDate = new Date("2018-01-01T00:00:00")
    if (date.getTime() <= now.getTime() && date.getTime() >= minDate.getTime()) {
      const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
      return { value, confidence: 0.82, source: dmy[0], score: 82 }
    }
  }

  return { value: null, confidence: 0, score: 0 }
}

function extractMerchant(blocks: ReturnType<typeof buildLineBlocks>): ParsedField<string> {
  const candidates = blocks.header.map((line, idx) => {
    const normalized = normalizeText(line.text)
    let score = 0
    if (idx < 3) score += 50
    if (/^[A-Z0-9\s\-\.]{3,}$/.test(line.text)) score += 20
    if (line.text.length <= 32) score += 15
    if (/\d/.test(line.text)) score -= 20
    if (MERCHANT_BLACKLIST.some((kw) => normalized.includes(kw))) score -= 50
    return { text: line.text, score }
  })

  candidates.sort((a, b) => b.score - a.score)
  const top = candidates[0]
  if (!top || top.score < 20) return { value: null, confidence: 0, score: top?.score ?? 0 }

  const confidence = Math.max(0.4, Math.min(0.9, top.score / 100))
  return { value: top.text, confidence, source: "header", score: top.score }
}

function suggestCategory(merchant: string | null, rawText: string): ParsedField<string> {
  const source = normalizeText(`${merchant || ""} ${rawText}`)

  let bestMatch: { category: string; score: number; key: string } | null = null
  for (const [key, category] of Object.entries(MERCHANT_CATEGORY_MAP)) {
    const score = similarity(source, key) * 100
    const contains = source.includes(key)
    const finalScore = contains ? 96 : score
    if (!bestMatch || finalScore > bestMatch.score) {
      bestMatch = { category, score: finalScore, key }
    }
  }

  if (bestMatch && bestMatch.score >= 72) {
    return {
      value: bestMatch.category,
      confidence: Math.min(0.95, bestMatch.score / 100),
      source: bestMatch.key,
      score: bestMatch.score,
    }
  }

  if (/gasolina|combustible|peaje/.test(source)) return { value: "transporte", confidence: 0.72, score: 72 }
  if (/farmacia|medic/.test(source)) return { value: "salud", confidence: 0.72, score: 72 }
  if (/super|market|colmado/.test(source)) return { value: "compras", confidence: 0.68, score: 68 }
  if (/restaurante|cafe|bar|pizza|burger/.test(source)) return { value: "comida", confidence: 0.68, score: 68 }

  return { value: "compras", confidence: 0.45, source: "fallback", score: 45 }
}

export function parseReceiptText(rawText: string, ocrLines?: OcrLine[]): ReceiptParseResult {
  const safeText = rawText || ""
  const blocks = buildLineBlocks(safeText, ocrLines)

  const amount = extractAmount(safeText, blocks)
  const currency = detectCurrency(safeText)
  const date = extractDate(safeText, blocks)
  const merchant = extractMerchant(blocks)
  const categorySuggestion = suggestCategory(merchant.value, safeText)

  const overallConfidence = Math.round(
    ((amount.confidence * 0.45 + date.confidence * 0.2 + merchant.confidence * 0.2 + categorySuggestion.confidence * 0.1 + currency.confidence * 0.05) * 100)
  ) / 100

  return {
    amount,
    currency,
    date,
    merchant,
    categorySuggestion,
    overallConfidence,
    rawText: safeText,
  }
}
