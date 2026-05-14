"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Apple, ArrowRight, BarChart3, CheckCircle2, CircleDollarSign, CreditCard, Goal, Instagram, Landmark, Menu, Repeat, ShieldCheck, Wallet, X } from "lucide-react"
import { showToast } from "@/components/toast/smart-toast"

const navItems = [
  { id: "inicio", label: "Inicio" },
  { id: "funciones", label: "Funciones" },
  { id: "reportes", label: "Reportes" },
  { id: "tarjetas", label: "Tarjetas" },
  { id: "suscripciones", label: "Suscripciones" },
  { id: "preguntas", label: "Preguntas" },
]

function LogoMark({ dark = true }: { dark?: boolean }) {
  return (
    <div className="inline-flex items-center gap-3">
      <Image src="/icono-favicon.png" alt="Icono MiCuadre" width={40} height={40} className="rounded-xl shadow-lg shadow-black/20" />
      <div>
        <p className={`text-lg font-semibold tracking-tight ${dark ? "text-white" : "text-[#07111F]"}`}>MiCuadre</p>
        <p className={`text-xs ${dark ? "text-[#CCFBF1]" : "text-slate-500"}`}>Controla tu dinero con claridad</p>
      </div>
    </div>
  )
}

export function PublicLanding() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [active, setActive] = useState("inicio")
  const sectionIds = useMemo(() => navItems.map((n) => n.id), [])

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(id)
        })
      }, { rootMargin: "-32% 0px -55% 0px", threshold: 0.08 })
      observer.observe(el)
      observers.push(observer)
    })
    return () => observers.forEach((o) => o.disconnect())
  }, [sectionIds])

  const showComingSoon = () => {
    showToast({
      title: "Próximamente disponible",
      body: "Estamos preparando el lanzamiento para iOS y Android.",
      type: "info",
      duration: 2800,
    })
  }

  const showInstagramSoon = () => {
    showToast({
      title: "Instagram próximamente",
      body: "Estamos preparando nuestro perfil oficial.",
      type: "info",
      duration: 2400,
    })
  }

  return (
    <main className="min-h-screen scroll-smooth bg-[#F8FAFC] text-[#07111F]">
      <section id="inicio" className="relative overflow-hidden bg-[#020617] pb-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(20,184,166,0.3),transparent_35%),radial-gradient(circle_at_90%_0%,rgba(56,189,248,0.25),transparent_35%)]" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <header className="sticky top-0 z-40 mt-4 rounded-2xl border border-white/15 bg-[#07111F]/75 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <LogoMark />
              <nav className="hidden items-center gap-2 lg:flex">
                {navItems.map((item) => (
                  <a key={item.id} href={`#${item.id}`} className={`rounded-lg px-3 py-2 text-sm transition ${active === item.id ? "bg-white/15 text-white" : "text-slate-200 hover:text-white"}`}>{item.label}</a>
                ))}
              </nav>
              <div className="hidden items-center gap-2 lg:flex">
                <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#14B8A6] to-[#10B981] px-4 py-2 text-sm font-semibold text-[#05211d] shadow-lg shadow-[#14B8A6]/35">Crear cuenta <ArrowRight className="h-4 w-4" /></Link>
                <Link href="/login" className="rounded-xl border border-white/25 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">Iniciar sesion</Link>
              </div>
              <button aria-label="Abrir menu" onClick={() => setMobileOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-lg border border-white/20 bg-white/10 text-white lg:hidden">{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
            </div>
            {mobileOpen && (
              <div className="mt-3 rounded-xl border border-white/15 bg-[#07111F]/95 p-2 lg:hidden">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {navItems.map((item) => <a key={item.id} href={`#${item.id}`} onClick={() => setMobileOpen(false)} className="shrink-0 rounded-lg bg-white/10 px-3 py-2 text-sm text-white">{item.label}</a>)}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="rounded-lg bg-[#14B8A6] px-3 py-2 text-center text-sm font-semibold text-[#05211d]">Crear cuenta</Link>
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="rounded-lg border border-white/25 px-3 py-2 text-center text-sm text-white">Iniciar sesion</Link>
                </div>
              </div>
            )}
          </header>

          <div className="grid items-center gap-12 pt-14 lg:grid-cols-[1fr_1.05fr]">
            <div className="animate-[fadeUp_700ms_ease-out]">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#14B8A6]/35 bg-[#14B8A6]/10 px-3 py-1 text-xs text-[#CCFBF1]"><ShieldCheck className="h-3.5 w-3.5" /> Copiloto financiero dominicano</p>
              <h1 className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">Tu dinero en orden, con una experiencia fintech premium.</h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">MiCuadre te muestra lo que tienes, lo que debes y hacia donde se va tu dinero con una claridad que impulsa mejores decisiones.</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={showComingSoon}
                  aria-label="Disponible próximamente en App Store"
                  className="group inline-flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-left text-white backdrop-blur-md transition duration-300 hover:border-[#14B8A6]/55 hover:bg-white/15 hover:shadow-[0_0_30px_rgba(20,184,166,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14B8A6]"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-[#CCFBF1] transition group-hover:bg-white/15">
                    <Apple className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-[11px] text-slate-300">App Store</span>
                    <span className="block text-sm font-semibold">Disponible próximamente</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={showComingSoon}
                  aria-label="Disponible próximamente en Google Play"
                  className="group inline-flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-left text-white backdrop-blur-md transition duration-300 hover:border-[#38BDF8]/55 hover:bg-white/15 hover:shadow-[0_0_30px_rgba(56,189,248,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8]"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 text-[#BAE6FD] transition group-hover:bg-white/15">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[11px] text-slate-300">Google Play</span>
                    <span className="block text-sm font-semibold">Disponible próximamente</span>
                  </span>
                </button>

                <span className="text-xs font-medium text-[#99f6e4]">iOS y Android</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[620px] animate-[fadeUp_930ms_ease-out]">
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-r from-[#14B8A6]/30 to-[#38BDF8]/25 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 p-3 shadow-[0_35px_80px_-22px_rgba(20,184,166,0.55)] backdrop-blur">
                <Image src="/landing/mockup-dashboard-3d.png" alt="Mockup 3D Dashboard MiCuadre" width={600} height={600} sizes="(max-width: 768px) 100vw, 600px" className="h-auto w-full rounded-[1.4rem]" priority />
              </div>
              <div className="absolute -left-3 top-8 rounded-xl border border-white/20 bg-[#10273D]/95 px-3 py-2 text-xs text-[#D1FAE5] shadow-xl animate-[floatY_7s_ease-in-out_infinite]">Balance actual <p className="text-sm font-semibold text-white">RD$ 152,840</p></div>
              <div className="absolute -right-2 top-20 rounded-xl border border-white/20 bg-[#132A2A]/95 px-3 py-2 text-xs text-[#D1FAE5] shadow-xl animate-[floatY_7.6s_ease-in-out_infinite] [animation-delay:200ms]">Balance al corte <p className="text-sm font-semibold text-white">RD$ 18,650</p></div>
              <div className="absolute -left-2 bottom-24 rounded-xl border border-white/20 bg-[#143247]/95 px-3 py-2 text-xs text-[#BAE6FD] shadow-xl animate-[floatY_6.8s_ease-in-out_infinite] [animation-delay:300ms]">Disponible <p className="text-sm font-semibold text-white">RD$ 75,100</p></div>
              <div className="absolute right-0 bottom-12 rounded-xl border border-white/20 bg-[#1A3A2A]/95 px-3 py-2 text-xs text-[#86EFAC] shadow-xl animate-[floatY_8s_ease-in-out_infinite] [animation-delay:420ms]">Meta de ahorro <p className="text-sm font-semibold text-white">72%</p></div>
              <div className="absolute left-10 -bottom-2 rounded-xl border border-white/20 bg-[#263244]/95 px-3 py-2 text-xs text-[#E2E8F0] shadow-xl animate-[floatY_7.2s_ease-in-out_infinite] [animation-delay:120ms]">Gasto del mes <p className="text-sm font-semibold text-white">RD$ 31,120</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="funciones" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <h2 className="text-3xl font-semibold">Registrar transacciones se siente rapido y preciso</h2>
            <p className="mt-4 text-slate-600">Desde una sola pantalla controlas monto, cuenta, categoria y detalle del movimiento para mantener tus finanzas actualizadas en tiempo real.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[{ icon: Wallet, title: "Cuenta sugerida" }, { icon: CircleDollarSign, title: "Comision visible" }, { icon: Landmark, title: "Impacto inmediato" }, { icon: Goal, title: "Control mensual" }].map(({ icon: Icon, title }) => (
                <article key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <Icon className="h-5 w-5 text-[#10B981]" />
                  <p className="mt-2 text-sm font-medium text-slate-700">{title}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-r from-[#10B981]/20 to-[#38BDF8]/20 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.28)]">
              <Image src="/landing/mockup-transaccion-3d.png" alt="Mockup 3D Transaccion MiCuadre" width={600} height={600} sizes="(max-width: 768px) 100vw, 600px" className="h-auto w-full rounded-[1.4rem]" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      <section id="reportes" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold">Reportes que convierten datos en decisiones</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6"><p className="text-sm text-slate-500">Tu mayor gasto</p><p className="mt-1 font-semibold">Comida</p><p className="mt-3 text-sm text-slate-600">RD$ 3,250 este mes</p></article>
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6"><p className="text-sm text-slate-500">Flujo neto</p><p className="mt-1 font-semibold">Positivo</p><p className="mt-3 text-sm text-slate-600">Ingresos por encima de gastos</p></article>
            <article className="rounded-3xl border border-slate-200 bg-slate-50 p-6"><p className="text-sm text-slate-500">Suscripciones</p><p className="mt-1 font-semibold">RD$ 1,250/mes</p><p className="mt-3 text-sm text-slate-600">Pagos automaticos</p></article>
          </div>
        </div>
      </section>

      <section id="tarjetas" className="bg-[#020617] py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold">Tarjetas de credito sin confusion</h2>
            <p className="mt-4 text-slate-300">Separa balance actual, balance al corte y disponible para pagar a tiempo y evitar intereses.</p>
            <ul className="mt-6 space-y-2 text-sm text-slate-200">
              {["Balance actual", "Balance al corte", "Disponible", "Fecha de corte", "Fecha de pago"].map((item) => <li key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#22C55E]" />{item}</li>)}
            </ul>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl">
            <div className="flex items-center justify-between rounded-xl bg-white/5 p-3 text-sm"><span>Balance actual</span><span>RD$ 24,900</span></div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-white/5 p-3"><p className="text-slate-400">Balance al corte</p><p className="mt-1">RD$ 18,650</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="text-slate-400">Disponible</p><p className="mt-1 text-[#38BDF8]">RD$ 75,100</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="text-slate-400">Fecha de corte</p><p className="mt-1 text-[#F59E0B]">24 mayo</p></div>
              <div className="rounded-xl bg-white/5 p-3"><p className="text-slate-400">Fecha de pago</p><p className="mt-1 text-[#22C55E]">28 mayo</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="suscripciones" className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_1.05fr]">
            <div>
              <h2 className="text-3xl font-semibold">Metas visibles y suscripciones bajo control</h2>
              <p className="mt-4 text-slate-600">Visualiza tu avance de ahorro y controla pagos recurrentes como Netflix, Spotify, Apple y Amazon con alertas de proximos cobros.</p>
              <div className="mt-6 space-y-3 text-sm text-slate-700">
                <p className="rounded-xl border border-slate-200 bg-white px-4 py-3">Progreso de metas con barras claras y porcentaje real.</p>
                <p className="rounded-xl border border-slate-200 bg-white px-4 py-3">Suscripciones agrupadas por monto y fecha de pago.</p>
                <p className="rounded-xl border border-slate-200 bg-white px-4 py-3">Alertas de pago para no perder fechas importantes.</p>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-r from-[#14B8A6]/20 to-[#10B981]/20 blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-3 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.24)]">
                <Image src="/landing/mockup-metas-3d.png" alt="Mockup 3D Metas MiCuadre" width={600} height={600} sizes="(max-width: 768px) 100vw, 600px" className="h-auto w-full rounded-[1.4rem]" loading="lazy" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="preguntas" className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-semibold">Preguntas frecuentes</h2>
        <div className="mt-8 space-y-3">
          {[
            ["¿MiCuadre conecta con bancos?", "Por ahora funciona de forma manual para darte control total sin depender de integraciones bancarias."],
            ["¿Soporta pesos y dolares?", "Si. MiCuadre soporta DOP y USD."],
            ["¿Puedo registrar tarjetas de credito?", "Si. Puedes controlar balance actual, balance al corte, disponible y fechas de pago."],
            ["¿Funciona en iPhone y Android?", "Si. Tambien puedes instalarla como PWA."],
          ].map(([q, a]) => (
            <details key={String(q)} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">{q}</summary>
              <p className="mt-2 text-sm text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <LogoMark dark={false} />
          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <Link href="/legal/privacidad" className="hover:text-slate-800">Privacidad</Link>
            <Link href="/legal/terminos" className="hover:text-slate-800">Términos</Link>
            <Link href="/legal/aviso-legal" className="hover:text-slate-800">Aviso Legal</Link>
            <button
              type="button"
              onClick={showInstagramSoon}
              aria-label="Instagram de MiCuadre (próximamente)"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:border-[#14B8A6]/60 hover:text-[#0f766e]"
            >
              <Instagram className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm text-slate-500">© 2026 MiCuadre.</p>
        </div>
      </footer>
    </main>
  )
}
