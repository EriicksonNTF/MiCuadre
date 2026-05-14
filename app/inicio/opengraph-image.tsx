import { ImageResponse } from "next/og"

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "54px",
          color: "white",
          background:
            "radial-gradient(circle at 20% 20%, rgba(20,184,166,0.4), transparent 35%), radial-gradient(circle at 80% 10%, rgba(56,189,248,0.35), transparent 40%), #020617",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg, #14B8A6 0%, #38BDF8 100%)",
            }}
          />
          <div style={{ fontSize: 34, fontWeight: 700 }}>MiCuadre</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: "78%" }}>
          <div style={{ fontSize: 72, lineHeight: 1.05, fontWeight: 800 }}>Controla tu dinero con claridad</div>
          <div style={{ fontSize: 30, color: "#cbd5e1" }}>Finanzas personales para RD: cuentas, tarjetas, metas, suscripciones y reportes.</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#99f6e4" }}>
          <span>MiCuadre</span>
          <span>Hecha para Republica Dominicana</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
