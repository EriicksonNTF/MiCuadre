export type MerchantCategory =
  | "Supermercado"
  | "Restaurant"
  | "Gasolina"
  | "Farmacia"
  | "Ropa"
  | "Servicios"
  | "Transporte"
  | "Entretenimiento"
  | "Otro";

export type PaymentMethod =
  | "cash"
  | "credit_card"
  | "debit_card"
  | "transfer"
  | "unknown";

export type DocType =
  | "receipt"
  | "invoice"
  | "bank_statement"
  | "credit_card_statement"
  | "unknown";

export interface ExtractedLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface ExtractedMerchant {
  name: string | null;
  category: MerchantCategory | null;
  rnc: string | null;
}

export interface ExtractedReceipt {
  doc_type: DocType;
  merchant: ExtractedMerchant;
  date: string | null;
  time: string | null;
  currency: "DOP" | "USD" | null;
  subtotal: number | null;
  tax_itbis: number | null;
  tip: number | null;
  total: number | null;
  line_items: ExtractedLineItem[];
  payment_method: PaymentMethod;
  card_last4: string | null;
  auth_code: string | null;
  confidence: number;
  language: "es" | "en";
  warnings: string[];
}

export interface OcrResponse {
  success: boolean;
  data?: ExtractedReceipt;
  error?: string;
}

export interface OcrCacheEntry {
  data: ExtractedReceipt;
  timestamp: number;
}