import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { API_RATE_LIMIT } from "@/lib/rate-limit";
import { extractReceiptData } from "@/lib/ocr/receipt-extractor";
import type { ExtractedReceipt } from "@/lib/ocr/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const TARGET_MAX_SIZE = 1 * 1024 * 1024;

const cache = new Map<string, { data: ExtractedReceipt; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000;

const inflight = new Map<string, Promise<NextResponse>>();

async function compressImage(
  buffer: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  if (buffer.length <= TARGET_MAX_SIZE) {
    return { buffer, mimeType };
  }

  const sharp = await import("sharp");
  const compressed = await sharp.default(buffer)
    .resize(1500, 1500, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  return { buffer: compressed, mimeType: "image/jpeg" };
}

function generateCacheKey(buffer: Buffer): string {
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const rateLimitResult = await API_RATE_LIMIT.ocr(`ocr:${user.id}`);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Demasiadas solicitudes. Intenta de nuevo en un momento.",
          retryAfter: rateLimitResult.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimitResult.retryAfterSeconds) },
        }
      );
    }

    const formData = await req.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ success: false, error: "No image provided" }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ success: false, error: "File is not an image" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "Image too large (max 5MB)" },
        { status: 413 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const cacheKey = generateCacheKey(buffer);

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({ success: true, data: cached.data, cached: true });
    }

    const inflightPromise = inflight.get(cacheKey);
    if (inflightPromise) {
      return inflightPromise;
    }

    const processingPromise = (async () => {
      try {
        const { buffer: compressedBuffer, mimeType } = await compressImage(buffer, file.type);
        const base64 = compressedBuffer.toString("base64");

        const extracted = await extractReceiptData(base64, mimeType as "image/jpeg" | "image/png" | "image/webp");

        cache.set(cacheKey, { data: extracted, timestamp: Date.now() });

        if (cache.size > 100) {
          const oldestKey = cache.keys().next().value;
          if (oldestKey) cache.delete(oldestKey);
        }

        return NextResponse.json({ success: true, data: extracted });
      } catch (error) {
        console.error("[api/ocr/receipt] Processing error:", error);

        if (error instanceof Error && error.name === "AbortError") {
          return NextResponse.json(
            { success: false, error: "Request timeout" },
            { status: 504 }
          );
        }

        return NextResponse.json(
          { success: false, error: "OCR processing failed" },
          { status: 500 }
        );
      } finally {
        inflight.delete(cacheKey);
      }
    })();

    inflight.set(cacheKey, processingPromise);
    return processingPromise;
  } catch (error) {
    console.error("[api/ocr/receipt] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export const maxDuration = 60;
