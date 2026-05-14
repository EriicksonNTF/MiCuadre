import type { Metadata } from "next"
import { PublicLanding } from "@/components/landing/public-landing"

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://micuadre.app"),
  title: "MiCuadre | Controla tu dinero con claridad",
  description:
    "MiCuadre es la app de finanzas personales en RD para organizar cuentas, gastos, tarjetas, metas, suscripciones y reportes desde un solo lugar.",
  openGraph: {
    title: "MiCuadre | Controla tu dinero con claridad",
    description:
      "Organiza tus cuentas, gastos, tarjetas, metas, suscripciones y reportes en una sola app.",
    url: "/inicio",
    siteName: "MiCuadre",
    locale: "es_DO",
    type: "website",
    images: [{ url: "/inicio/opengraph-image", width: 1200, height: 630, alt: "MiCuadre" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MiCuadre | Controla tu dinero con claridad",
    description: "Tu control financiero en RD, en una sola app.",
    images: ["/inicio/opengraph-image"],
  },
}

export default function LandingInicioPage() {
  return <PublicLanding />
}
