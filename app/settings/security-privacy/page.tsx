"use client"

import Link from "next/link"
import { ChevronLeft, ShieldCheck, Brain, BadgeAlert, SlidersHorizontal, CircleHelp } from "lucide-react"

const sections = [
  {
    icon: ShieldCheck,
    title: "Tus datos son privados",
    body: "Usamos tu información financiera solo para personalizar tu experiencia dentro de MiCuadre. No vendemos tus datos.",
  },
  {
    icon: Brain,
    title: "La IA te ayuda, pero no decide por ti",
    body: "Coach IA te da sugerencias educativas y prácticas. Tú decides qué acción tomar con tu dinero.",
  },
  {
    icon: BadgeAlert,
    title: "No somos asesores financieros certificados",
    body: "MiCuadre no ofrece asesoría financiera, de inversión, fiscal ni legal certificada.",
  },
  {
    icon: SlidersHorizontal,
    title: "Tú tienes el control",
    body: "Puedes ajustar notificaciones, preferencias y uso de la app cuando quieras desde Ajustes.",
  },
  {
    icon: CircleHelp,
    title: "Uso responsable de la IA",
    body: "La IA puede equivocarse. Verifica decisiones importantes antes de ejecutarlas.",
  },
]

export default function SecurityPrivacyPage() {
  return (
    <div className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <div className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-4 px-6 py-4">
          <Link href="/settings" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Seguridad y privacidad</h1>
            <p className="text-xs text-muted-foreground">Cómo protegemos tus datos en MiCuadre</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md space-y-3 px-6 py-6">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <div key={section.title} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-primary/10 p-2 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{section.body}</p>
                </div>
              </div>
            </div>
          )
        })}

        <div className="rounded-2xl bg-muted/60 p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
            MiCuadre es un copiloto financiero con IA para ayudarte a tomar mejores decisiones diarias. Siempre conserva tu criterio final.
          </p>
        </div>
      </div>
    </div>
  )
}
