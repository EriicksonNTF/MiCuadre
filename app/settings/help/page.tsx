"use client"
import { useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronDown, Mail, HelpCircle, MessageSquare, BookOpen, Plus, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

const faqs = [
  { q: "¿Cómo creo una cuenta?", a: "Ve a Cuentas y presiona el botón +. Selecciona el tipo (efectivo, débito o crédito) e ingresa un nombre." },
  { q: "¿Puedo usar dólares?", a: "Sí. En Ajustes puedes cambiar tu moneda principal entre Peso Dominicano (RD$) y Dólar (US$)." },
  { q: "¿Cómo funciona el ahorro?", a: "En Metas crea una meta de ahorro y agrega dinero cuando quieras. Verás tu progreso en tiempo real." },
  { q: "¿Cómo transfiero dinero?", a: "En Cuentas presiona Transferir. Selecciona la cuenta de origen, destino e ingresa el monto." },
  { q: "¿Mis datos son seguros?", a: "Sí. Usamos encriptación de grado bancario y nunca compartimos tu información financiera." },
  { q: "¿Puedo exportar mis datos?", a: "Próximamente podrás exportar tus movimientos en formato CSV o Excel." },
]

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  return (
    <div className="min-h- screen bg-background pb-28">
      <div className="sticky top-0 z-10 border- b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max- w-md px-6 py-4">
          <div className="flex items- center gap-4">
            <Link href="/settings" className="flex h-10 w-10 items- center justify-center rounded-full bg- muted">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <h1 className="text- lg font-semibold">Ayuda y soporte</h1>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w- md px-6 pt-6 space-y-6">
        <div className="rounded-2xl bg-card p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg- accent/10">
              <MessageSquare className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold">Chatear con soporte</p>
              <p className="text-sm text-muted-foreground">Respuesta en minutos</p>
            </div>
          </div>
          <button onClick={() => alert("Próximamente")} className="h-12 w-full rounded-xl bg-accent text-accent-foreground font-semibold">
            Abrir chat
          </button>
        </div>

        <div className="rounded-2xl bg-card p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg- accent/10">
              <Mail className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold">Enviar correo</p>
              <p className="text-sm text-muted-foreground">soporte@micuadre.app</p>
            </div>
          </div>
          <a href="mailto:soporte@micuadre.app" className="block h-12 w-full rounded-xl border border-border bg- muted flex items-center justify-center font-semibold text-foreground">
            Escribir correo
          </a>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg- accent/10">
              <HelpCircle className="h-5 w-5 text-accent" />
            </div>
            <h2 className="text-lg font-bold">Preguntas frecuentes</h2>
          </div>
          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-2xl bg-card overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between p-5 text-left">
                  <span className="flex-1 font-medium pr-4">{faq.q}</span>
                  {openFaq === i ? <Minus className="h-4 w-4 shrink-0 text-muted-foreground" /> : <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />}
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-sm text-muted-foreground border-t border-border pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg- accent/10">
              <BookOpen className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold">Guía de inicio</p>
              <p className="text-sm text-muted-foreground">Aprende a usar MiCuadre</p>
            </div>
          </div>
          <button onClick={() => alert("Próximamente")} className="mt-4 h-12 w-full rounded-xl border border-border bg-muted font-semibold text-foreground">
            Ver guía
          </button>
        </div>
      </div>
    </div>
  )
}