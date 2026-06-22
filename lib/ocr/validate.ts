import type { ExtractedReceipt, MerchantCategory, PaymentMethod, DocType } from "./types";

const VALID_CATEGORIES: MerchantCategory[] = [
  "Supermercado",
  "Restaurant",
  "Gasolina",
  "Farmacia",
  "Ropa",
  "Servicios",
  "Transporte",
  "Entretenimiento",
  "Otro",
];

const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "credit_card",
  "debit_card",
  "transfer",
  "unknown",
];

const VALID_DOC_TYPES: DocType[] = [
  "receipt",
  "invoice",
  "bank_statement",
  "credit_card_statement",
  "unknown",
];

const VALID_CURRENCIES = ["DOP", "USD"] as const;

function clamp01(n: unknown): number {
  const num = Number(n);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(1, num));
}

function isValidDate(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  if (d > new Date()) return false;
  if (d < new Date("2020-01-01")) return false;
  return true;
}

function isValidAmount(n: unknown): boolean {
  const num = Number(n);
  return Number.isFinite(num) && num >= 0;
}

function isValidCardLast4(s: string | null): boolean {
  if (!s) return false;
  return /^\d{4}$/.test(s);
}

function isValidCategory(cat: string | null): cat is MerchantCategory {
  return !!cat && VALID_CATEGORIES.includes(cat as MerchantCategory);
}

function isValidPaymentMethod(pm: string | null): pm is PaymentMethod {
  return !!pm && VALID_PAYMENT_METHODS.includes(pm as PaymentMethod);
}

function isValidDocType(dt: string | null): dt is DocType {
  return !!dt && VALID_DOC_TYPES.includes(dt as DocType);
}

function isValidCurrency(c: string | null): c is "DOP" | "USD" {
  return !!c && VALID_CURRENCIES.includes(c as "DOP" | "USD");
}

export function validateAndSanitizeReceipt(raw: unknown): ExtractedReceipt {
  const r = (raw ?? {}) as Record<string, unknown>;

  const doc_type = isValidDocType(r.doc_type as string) ? (r.doc_type as DocType) : "unknown";

  const merchant = r.merchant as Record<string, unknown> | undefined;
  const merchantName = typeof merchant?.name === "string" && merchant.name.trim() ? merchant.name.trim() : null;
  const merchantCategory = isValidCategory(merchant?.category as string) ? (merchant?.category as MerchantCategory) : null;
  const merchantRnc = typeof merchant?.rnc === "string" && /^\d{9}$/.test(merchant.rnc) ? merchant.rnc : null;

  const date = typeof r.date === "string" && isValidDate(r.date) ? r.date : null;
  const time = typeof r.time === "string" && /^\d{2}:\d{2}$/.test(r.time) ? r.time : null;
  const currency = isValidCurrency(r.currency as string) ? (r.currency as "DOP" | "USD") : null;

  const subtotal = isValidAmount(r.subtotal) ? Number(r.subtotal) : null;
  const tax_itbis = isValidAmount(r.tax_itbis) ? Number(r.tax_itbis) : null;
  const tip = isValidAmount(r.tip) ? Number(r.tip) : null;
  const total = isValidAmount(r.total) ? Number(r.total) : null;

  let line_items: ExtractedReceipt["line_items"] = [];
  if (Array.isArray(r.line_items)) {
    line_items = r.line_items
      .filter((item: unknown) => {
        const i = item as Record<string, unknown>;
        return (
          typeof i.description === "string" &&
          isValidAmount(i.quantity) &&
          isValidAmount(i.unit_price) &&
          isValidAmount(i.total)
        );
      })
      .map((item: unknown) => {
        const i = item as Record<string, unknown>;
        return {
          description: String(i.description).trim(),
          quantity: Number(i.quantity),
          unit_price: Number(i.unit_price),
          total: Number(i.total),
        };
      });
  }

  const payment_method = isValidPaymentMethod(r.payment_method as string) ? (r.payment_method as PaymentMethod) : "unknown";
  const card_last4 = isValidCardLast4(r.card_last4 as string) ? String(r.card_last4) : null;
  const auth_code = typeof r.auth_code === "string" && r.auth_code.trim() ? r.auth_code.trim() : null;

  const confidence = clamp01(r.confidence);
  const language = r.language === "en" ? "en" : "es";

  const warnings: string[] = Array.isArray(r.warnings)
    ? r.warnings.filter((w): w is string => typeof w === "string")
    : [];

  if (subtotal != null && tax_itbis != null && total != null) {
    const expected = subtotal + tax_itbis + (tip ?? 0);
    if (Math.abs(expected - total) > 0.5) {
      warnings.push("total_mismatch");
    }
  }

  if (date && !isValidDate(date)) {
    warnings.push("date_suspicious");
  }

  if (confidence < 0.5) {
    warnings.push("low_confidence");
  }

  if (merchantName && currency === "USD" && merchantName.toLowerCase().includes("nacional")) {
    warnings.push("currency_mismatch");
  }

  if (doc_type === "unknown") {
    warnings.push("not_a_receipt");
  }

  const result: ExtractedReceipt = {
    doc_type,
    merchant: {
      name: merchantName,
      category: merchantCategory,
      rnc: merchantRnc,
    },
    date,
    time,
    currency,
    subtotal,
    tax_itbis,
    tip,
    total,
    line_items,
    payment_method,
    card_last4,
    auth_code,
    confidence,
    language,
    warnings,
  };

  return result;
}

export function validateReceipt(raw: unknown): ExtractedReceipt {
  return validateAndSanitizeReceipt(raw);
}

export function isReceiptValid(receipt: ExtractedReceipt): boolean {
  return (
    receipt.doc_type !== "unknown" &&
    receipt.total != null &&
    receipt.confidence >= 0.3
  );
}