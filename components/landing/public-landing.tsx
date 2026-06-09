"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { 
  AlertCircle, Apple, ArrowRight, CheckCircle2, CircleDollarSign, 
  CreditCard, Goal, Instagram, Landmark, Menu, Repeat, 
  ShieldCheck, Wallet, X, ChevronDown, Sparkles, PieChart, TrendingUp,
  CalendarDays, BadgeDollarSign
} from "lucide-react"
import { showToast } from "@/components/toast/smart-toast"
import { ANNUAL_DISCOUNT_PERCENT, PLAN_CONFIG, PLAN_ORDER, formatPlanPrice, getBillingIntervalSuffix } from "@/lib/billing/plans"
import type { BillingInterval } from "@/types/billing"

const navItems = [
  { id: "inicio", label: "Inicio" },
  { id: "funciones", label: "Funciones" },
  { id: "reportes", label: "Reportes" },
  { id: "tarjetas", label: "Tarjetas" },
  { id: "suscripciones", label: "Suscripciones" },
  { id: "precios", label: "Precios" },
  { id: "preguntas", label: "Preguntas" },
]

function LogoMark({ dark = true }: { dark?: boolean }) {
  return (
    <div className="inline-flex items-center gap-3">
      <Image src="/icono-favicon.png" alt="Icono MiCuadre" width={40} height={40} className="rounded-xl shadow-lg shadow-black/20" />
      <div>
        <p className={`text-lg font-bold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>MiCuadre</p>
        <p className={`text-[11px] font-medium tracking-wide uppercase ${dark ? "text-emerald-400/80" : "text-emerald-600/80"}`}>Copiloto Financiero</p>
      </div>
    </div>
  )
}

function PhoneFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-[2rem] border border-border bg-background p-2 shadow-xl shadow-slate-900/10">
      <div className="overflow-hidden rounded-[1.5rem] border border-border bg-card text-card-foreground">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Planificación</p>
            <p className="text-sm font-black text-foreground">{label}</p>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        </div>
        <div className="min-h-[270px] p-4">{children}</div>
      </div>
    </div>
  )
}

function BudgetMockupCard() {
  const budgets = [
    { name: "Comida", value: 77, tone: "bg-accent" },
    { name: "Transporte", value: 52, tone: "bg-sky-500" },
    { name: "Entretenimiento", value: 112, tone: "bg-destructive" },
  ]

  return (
    <PhoneFrame label="Presupuestos">
      <div className="rounded-2xl bg-muted p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><BadgeDollarSign className="h-3.5 w-3.5" /> Presupuesto usado</p>
        <p className="mt-1 text-2xl font-black text-foreground">RD$18,450</p>
        <p className="text-xs text-muted-foreground">de RD$24,000 este mes</p>
      </div>
      <div className="mt-4 space-y-3">
        {budgets.map((budget) => (
          <div key={budget.name}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">{budget.name}</span>
              <span className={budget.value > 100 ? "font-bold text-destructive" : "text-muted-foreground"}>{budget.value}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${budget.tone}`} style={{ width: `${Math.min(budget.value, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
        Entretenimiento excedido
      </div>
    </PhoneFrame>
  )
}

function CalendarMockupCard() {
  const marked = new Set([4, 8, 14, 21, 26])
  const payments = [
    { name: "Visa Popular", date: "08 Jun", amount: "RD$18,650" },
    { name: "Netflix", date: "14 Jun", amount: "RD$450" },
    { name: "Préstamo personal", date: "21 Jun", amount: "RD$7,200" },
  ]

  return (
    <PhoneFrame label="Calendario">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 28 }, (_, index) => {
          const day = index + 1
          return (
            <div key={day} className="flex aspect-square flex-col items-center justify-center rounded-lg bg-muted text-[10px] font-semibold text-muted-foreground">
              {day}
              {marked.has(day) && <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />}
            </div>
          )
        })}
      </div>
      <div className="mt-4 space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> Próximos pagos</p>
        {payments.map((item) => (
          <div key={item.name} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
            <div>
              <p className="text-xs font-bold text-foreground">{item.name}</p>
              <p className="text-[11px] text-muted-foreground">{item.date}</p>
            </div>
            <p className="text-xs font-bold text-foreground">{item.amount}</p>
          </div>
        ))}
      </div>
    </PhoneFrame>
  )
}

function DebtsMockupCard() {
  const debts = [
    { name: "Préstamo personal", paid: 64, next: "15 Jun" },
    { name: "Tarjeta Visa", paid: 38, next: "08 Jun" },
  ]

  return (
    <PhoneFrame label="Deudas">
      <div className="rounded-2xl bg-primary p-4 text-primary-foreground">
        <p className="text-xs opacity-75">Total pendiente</p>
        <p className="mt-1 text-2xl font-black">RD$92,300</p>
        <p className="mt-2 text-xs opacity-80">Pago próximo: RD$7,200</p>
      </div>
      <div className="mt-4 space-y-3">
        {debts.map((debt) => (
          <div key={debt.name} className="rounded-xl border border-border bg-background p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground">{debt.name}</span>
              <span className="text-muted-foreground">{debt.paid}% pagado</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent" style={{ width: `${debt.paid}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Pago próximo: {debt.next}</p>
          </div>
        ))}
      </div>
    </PhoneFrame>
  )
}

function PlanningMockups() {
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <BudgetMockupCard />
      <CalendarMockupCard />
      <DebtsMockupCard />
    </div>
  )
}

export function PublicLanding() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [active, setActive] = useState("inicio")
  const [scrolled, setScrolled] = useState(false)
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly")
  const sectionIds = useMemo(() => navItems.map((n) => n.id), [])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

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
    <main className="min-h-screen scroll-smooth bg-slate-50 text-slate-900 font-sans selection:bg-teal-500/30">
      {/* HEADER */}
      <header className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#020617]/85 backdrop-blur-xl border-b border-white/10 py-3' : 'bg-transparent py-5'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <LogoMark dark={true} />
          
          <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1 backdrop-blur-md xl:flex">
            {navItems.map((item) => (
              <a 
                key={item.id} 
                href={`#${item.id}`} 
                className={`inline-flex whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-300 ${active === item.id ? "bg-white/15 text-white shadow-sm" : "text-slate-300 hover:text-white hover:bg-white/5"}`}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-4 xl:flex">
            <Link href="/login" className="text-sm font-semibold text-slate-300 transition-colors hover:text-white">
              Iniciar sesión
            </Link>
            <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95">
              Crear cuenta <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <button type="button" aria-label="Abrir menú" onClick={() => setMobileOpen((v) => !v)} className="grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-white/5 text-white backdrop-blur-md xl:hidden">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* MOBILE MENU */}
        {mobileOpen && (
          <div className="absolute inset-x-4 top-[calc(100%+1rem)] flex flex-col gap-4 rounded-3xl border border-white/10 bg-[#07111F]/95 p-5 shadow-2xl backdrop-blur-2xl xl:hidden animate-in slide-in-from-top-4 duration-300">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <a 
                  key={item.id} 
                  href={`#${item.id}`} 
                  onClick={() => setMobileOpen(false)} 
                  className="block rounded-xl px-4 py-3 text-base font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section id="inicio" className="relative overflow-hidden bg-[#020617] pt-32 pb-24 lg:pt-40 lg:pb-32">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] opacity-40 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/30 to-sky-500/30 blur-[100px] rounded-full mix-blend-screen" />
        </div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-teal-500/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-16 lg:grid-cols-[1fr_1.1fr]">
            
            {/* Hero Content */}
            <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm font-medium text-emerald-300 backdrop-blur-sm mb-6">
                <Sparkles className="h-4 w-4" /> La revolución financiera dominicana
              </div>
              
              <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.1]">
                Tu dinero, <br className="hidden sm:block"/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-sky-400">totalmente claro.</span>
              </h1>
              
              <p className="mt-6 text-lg leading-relaxed text-slate-300 sm:text-xl">
                Entiende cuánto tienes, cuánto debes y hacia dónde se va tu dinero. Controla cuentas, tarjetas, presupuestos y suscripciones en una sola app premium.
              </p>
              
              <div className="mt-10 flex flex-col sm:flex-row items-center gap-4">
                <Link href="/register" className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-emerald-500 px-8 py-4 text-base font-bold text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.25)] transition-all hover:bg-emerald-400 hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] hover:scale-105 active:scale-95">
                  Crear cuenta gratis <ArrowRight className="h-5 w-5" />
                </Link>
                <Link href="/login" className="flex w-full sm:w-auto items-center justify-center rounded-full border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/30">
                  Iniciar sesión
                </Link>
              </div>

              <div className="mt-12 flex flex-col sm:flex-row items-start sm:items-center gap-4 border-t border-white/10 pt-8">
                <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Próximamente en</span>
                <div className="flex gap-3">
                  <button type="button" onClick={showComingSoon} className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 transition-colors hover:bg-white/10">
                    <Apple className="h-4 w-4 text-slate-300 group-hover:text-white" />
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white">App Store</span>
                  </button>
                  <button type="button" onClick={showComingSoon} className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 transition-colors hover:bg-white/10">
                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-white" />
                    <span className="text-xs font-semibold text-slate-300 group-hover:text-white">Google Play</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Hero 3D Mockup with Floating Cards */}
            <div className="relative mx-auto w-full max-w-[600px] animate-in fade-in slide-in-from-right-8 duration-1000 delay-200 fill-mode-both">
              <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-tr from-emerald-500/20 to-sky-500/20 blur-3xl transform rotate-6 scale-105" />
              
              <div className="relative rounded-[2.5rem] border border-white/10 bg-slate-900/50 p-2 shadow-2xl backdrop-blur-xl">
                <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950">
                  <Image src="/landing/mockup-dashboard-3d.png" alt="Panel MiCuadre" width={800} height={800} className="w-full h-auto opacity-90 transition-opacity hover:opacity-100" priority />
                </div>
              </div>

              {/* Floating Cards */}
              <div className="absolute -left-6 top-12 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 shadow-2xl backdrop-blur-xl transition-transform hover:-translate-y-1 hidden sm:block">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Balance actual</p>
                <p className="text-lg font-bold text-white">RD$152,840</p>
              </div>
              
              <div className="absolute -right-4 top-1/3 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 shadow-2xl backdrop-blur-xl transition-transform hover:-translate-y-1 hidden sm:block">
                <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Disponible</p>
                <p className="text-lg font-bold text-white">RD$75,100</p>
              </div>

              <div className="absolute left-8 -bottom-6 rounded-2xl border border-white/10 bg-slate-900/80 px-4 py-3 shadow-2xl backdrop-blur-xl transition-transform hover:-translate-y-1 hidden sm:block">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-400">Gasto del mes</p>
                <p className="text-lg font-bold text-white">RD$31,120</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* FUNCIONES SECTION */}
      <section id="funciones" className="relative overflow-hidden bg-white py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-16 lg:grid-cols-[1fr_1.1fr]">
            
            <div className="order-2 lg:order-1 relative">
              <div className="absolute inset-0 rounded-[3rem] bg-emerald-500/10 blur-3xl transform -rotate-6 scale-105" />
              <div className="relative rounded-[2.5rem] border border-slate-200 bg-white p-2 shadow-xl">
                <div className="overflow-hidden rounded-[2rem] bg-slate-50">
                  <Image src="/landing/mockup-transaccion-3d.png" alt="Transacción MiCuadre" width={800} height={800} className="w-full h-auto" />
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Registros rápidos, precisos y sin fricción.</h2>
              <p className="mt-6 text-lg text-slate-600 leading-relaxed">
                Controla montos, cuentas, categorías y detalles del movimiento desde una sola pantalla para mantener tus finanzas actualizadas en tiempo real.
              </p>
              
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {[
                  { icon: Wallet, title: "Cuentas sincronizadas", desc: "Múltiples cuentas en un solo lugar" },
                  { icon: CircleDollarSign, title: "Control de comisiones", desc: "Calcula impuestos automáticamente" },
                  { icon: Landmark, title: "Impacto inmediato", desc: "Reflejo instantáneo en balances" },
                  { icon: Goal, title: "Categorización ágil", desc: "Organiza sin pensar demasiado" }
                ].map(({ icon: Icon, title, desc }) => (
                  <article key={title} className="group rounded-3xl border border-slate-100 bg-slate-50 p-6 transition-all hover:bg-white hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-1">
                    <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 transition-transform group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                    <p className="mt-1 text-sm text-slate-500">{desc}</p>
                  </article>
                ))}
              </div>
            </div>
            
          </div>
        </div>
      </section>

      {/* REPORTES SECTION */}
      <section id="reportes" className="bg-slate-50 py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Reportes que hablan por sí solos</h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
            Convierte tus datos en decisiones. Visualiza hacia dónde se va tu dinero con gráficos interactivos y resúmenes inteligentes de tu salud financiera.
          </p>
          
          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            <article className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-sm border border-slate-200 transition-all hover:shadow-xl hover:-translate-y-1 text-left">
              <div className="absolute top-0 right-0 p-6 opacity-5 transition-opacity group-hover:opacity-10"><PieChart className="w-24 h-24 text-emerald-500" /></div>
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Tu mayor gasto</p>
              <p className="mt-4 text-3xl font-extrabold text-slate-900">Comida</p>
              <p className="mt-2 text-base font-medium text-rose-500">RD$8,250 este mes</p>
            </article>
            
            <article className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-sm border border-slate-200 transition-all hover:shadow-xl hover:-translate-y-1 text-left">
              <div className="absolute top-0 right-0 p-6 opacity-5 transition-opacity group-hover:opacity-10"><TrendingUp className="w-24 h-24 text-sky-500" /></div>
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Flujo neto</p>
              <p className="mt-4 text-3xl font-extrabold text-slate-900">Positivo</p>
              <p className="mt-2 text-base font-medium text-emerald-500">+ RD$12,400 ahorrados</p>
            </article>
            
            <article className="group relative overflow-hidden rounded-3xl bg-white p-8 shadow-sm border border-slate-200 transition-all hover:shadow-xl hover:-translate-y-1 text-left">
              <div className="absolute top-0 right-0 p-6 opacity-5 transition-opacity group-hover:opacity-10"><Repeat className="w-24 h-24 text-indigo-500" /></div>
              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Suscripciones</p>
              <p className="mt-4 text-3xl font-extrabold text-slate-900">RD$1,850/mes</p>
              <p className="mt-2 text-base font-medium text-slate-500">6 pagos automáticos</p>
            </article>
          </div>
        </div>
      </section>

      {/* TARJETAS SECTION */}
      <section id="tarjetas" className="relative overflow-hidden bg-[#020617] py-32 text-white">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full max-w-[800px] h-[600px] bg-sky-500/10 blur-[150px] rounded-full pointer-events-none" />
        
        <div className="relative mx-auto grid max-w-7xl gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-1.5 text-sm font-medium text-sky-300 backdrop-blur-sm mb-6">
              <CreditCard className="h-4 w-4" /> Tarjetas de crédito
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Domina los ciclos de tus tarjetas de crédito.</h2>
            <p className="mt-6 text-lg leading-relaxed text-slate-300">
              No pagues ni un peso en intereses. MiCuadre está diseñado para que tengas el control absoluto de tus fechas de corte, fechas de pago y separes mentalmente tu balance actual del balance que debes pagar.
            </p>
            <div className="mt-10 grid gap-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/20 text-sky-400">
                  <span className="font-bold text-xl">1</span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Domina las Fechas</h4>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">Alertas tempranas de cuándo cierra tu ciclo (Corte) y cuál es el último día para pagar sin penalidad.</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                  <span className="font-bold text-xl">2</span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Claridad en tus Balances</h4>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">No te confundas. Separa el <strong>balance al corte</strong> (lo que debes pagar ahora) del <strong>balance actual</strong> (lo que has consumido en total).</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
                  <span className="font-bold text-xl">3</span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Límite Inteligente</h4>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">Conoce exactamente cuánto dinero te queda disponible para gastar sin sobregirarte ni afectar tu buró de crédito.</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="relative rounded-[2.5rem] border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-8 backdrop-blur-3xl shadow-[0_0_80px_rgba(14,165,233,0.15)]">
            <div className="absolute top-0 right-10 w-32 h-32 bg-sky-500/30 blur-[80px] rounded-full" />
            <div className="absolute bottom-0 left-10 w-40 h-40 bg-emerald-500/20 blur-[80px] rounded-full" />
            
            <div className="relative z-10 overflow-hidden rounded-[1.5rem] bg-[#0B132B]/90 p-6 border border-white/10 shadow-2xl">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-5 bg-gradient-to-tr from-slate-300 to-white rounded-sm flex items-center justify-end px-1 shadow-sm">
                      <div className="w-3 h-3 bg-red-500 rounded-full opacity-80 mix-blend-multiply" />
                      <div className="w-3 h-3 bg-amber-500 rounded-full opacity-80 mix-blend-multiply -ml-1.5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-300">Platinum Rewards</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">**** **** **** 8421</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Límite Total</p>
                  <p className="text-sm font-semibold text-slate-300">RD$100,000</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 border border-white/5 shadow-inner">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1"><AlertCircle className="w-3 h-3 text-rose-400" /> Al Corte</p>
                  <p className="mt-1 text-2xl font-bold text-white tracking-tight">RD$18,650</p>
                  <p className="text-xs text-rose-400 font-medium mt-1">Pagar antes del 08 Jun</p>
                </div>
                
                <div className="rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 p-4 border border-white/5 shadow-inner">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Balance Actual</p>
                  <p className="mt-1 text-2xl font-bold text-slate-300 tracking-tight">RD$24,900</p>
                  <p className="text-xs text-slate-500 mt-1">Incluye ciclo nuevo</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="text-slate-400">Disponible para compras</span>
                    <span className="text-emerald-400">RD$75,100</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800 flex">
                    <div className="h-full bg-gradient-to-r from-rose-500 to-rose-400 w-[24.9%] rounded-full shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/5">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Próximo Corte</span>
                    <div className="flex items-center gap-2 text-slate-300 font-medium bg-white/5 rounded-lg p-2 border border-white/5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> 24 de Mayo
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Fecha de Pago</span>
                    <div className="flex items-center gap-2 text-slate-300 font-medium bg-white/5 rounded-lg p-2 border border-white/5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" /> 08 de Junio
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SUSCRIPCIONES Y PLANIFICACION SECTION */}
      <section id="suscripciones" className="overflow-hidden bg-white py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-50 px-4 py-1.5 text-sm font-bold text-emerald-700">
              <Goal className="h-4 w-4" /> Planificación financiera
            </div>
            <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">Planifica tu mes antes de gastar</h2>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
              Presupuestos, calendario y deudas trabajan juntos para que sepas cuánto puedes gastar, qué pagos vienen y qué compromisos siguen pendientes.
            </p>
          </div>

          <div className="mt-14">
            <PlanningMockups />
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-4 md:grid-cols-3">
            {[
              { title: "Presupuestos inteligentes", desc: "Define límites por categoría y recibe alertas antes de pasarte." },
              { title: "Calendario financiero", desc: "Visualiza tarjetas, suscripciones y deudas antes de que se te pasen." },
              { title: "Deudas y pagos", desc: "Controla préstamos, cuotas y tarjetas con seguimiento claro." }
            ].map((item, i) => (
              <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 transition-colors hover:border-emerald-200 hover:bg-white hover:shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <span className="font-bold text-sm">{i + 1}</span>
                </div>
                <h4 className="mt-4 font-bold text-slate-900">{item.title}</h4>
                <p className="mt-1 text-sm text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/register" className="inline-flex h-11 items-center justify-center rounded-full bg-emerald-500 px-5 text-sm font-bold text-slate-950 transition hover:bg-emerald-400">
              Comenzar gratis
            </Link>
            <Link href="/register" className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100">
              Ver Pro
            </Link>
          </div>
        </div>
      </section>

      {/* PRECIOS SECTION */}
      <section id="precios" className="bg-[#020617] py-28 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-1.5 text-sm font-bold text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              Pago seguro con Stripe
            </div>
            <h2 className="mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Empieza gratis. Mejora cuando necesites control total.
            </h2>
            <p className="mt-5 text-lg leading-relaxed text-slate-300">
              Organiza tus cuentas, presupuestos, tarjetas, gastos y suscripciones desde una experiencia simple y móvil.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-sm rounded-2xl border border-white/10 bg-white/5 p-1.5">
            <div className="grid grid-cols-2 gap-1">
              {(["monthly", "yearly"] as BillingInterval[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setBillingInterval(value)}
                  className={`h-11 rounded-xl text-sm font-black transition-all active:scale-[0.98] ${billingInterval === value ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:bg-white/10"}`}
                >
                  {value === "monthly" ? "Mensual" : `Anual · Ahorra ${ANNUAL_DISCOUNT_PERCENT}%`}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-2">
            {PLAN_ORDER.map((tier) => {
              const plan = PLAN_CONFIG[tier]
              const highlighted = tier === "pro"
              return (
                <article
                  key={tier}
                  className={`relative overflow-hidden rounded-[2rem] border p-6 transition-all hover:-translate-y-1 ${
                    highlighted
                      ? "border-emerald-400/50 bg-emerald-400/10 shadow-[0_20px_60px_rgba(16,185,129,0.14)]"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  {plan.badge && (
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${highlighted ? "bg-emerald-400 text-slate-950" : "bg-amber-400/15 text-amber-200"}`}>
                      {plan.badge}
                    </span>
                  )}
                  <h3 className="mt-4 text-2xl font-black">{plan.label}</h3>
                  <p className="mt-2 min-h-10 text-sm leading-relaxed text-slate-300">{plan.audience}</p>
                  <div className="mt-5">
                    <span className="text-4xl font-black">{formatPlanPrice(tier, billingInterval)}</span>
                    <span className="ml-1 text-sm font-bold text-slate-400">{getBillingIntervalSuffix(billingInterval)}</span>
                  </div>
                  {billingInterval === "yearly" && tier !== "free" && (
                    <p className="mt-1 text-xs font-bold text-emerald-300">
                      Equivale a ${plan.price.yearlyMonthlyEquivalent.toFixed(2)}/mes
                    </p>
                  )}
                  <div className="mt-6 space-y-2 text-sm text-slate-300">
                    {plan.benefits.slice(0, 4).map((benefit) => (
                      <p key={benefit} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        {benefit}
                      </p>
                    ))}
                  </div>
                  <Link
                    href={tier === "free" ? "/register" : "/register"}
                    className={`mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-black transition-all active:scale-[0.98] ${
                      highlighted ? "bg-emerald-400 text-slate-950 hover:bg-emerald-300" : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                    }`}
                  >
                  {tier === "free" ? "Comenzar gratis" : "Ver Pro"}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              )
            })}
          </div>

          <div className="mt-8 grid gap-3 text-center text-sm text-slate-400 sm:grid-cols-3">
            <p>Pago seguro con Stripe.</p>
            <p>Puedes cancelar cuando quieras.</p>
            <p>Sin conexión bancaria obligatoria.</p>
          </div>
        </div>
      </section>

      {/* PREGUNTAS SECTION */}
      <section id="preguntas" className="bg-slate-50 py-32">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">Preguntas frecuentes</h2>
            <p className="mt-4 text-slate-600">Todo lo que necesitas saber sobre MiCuadre.</p>
          </div>
          
          <div className="space-y-4">
            {[
              ["¿MiCuadre se conecta automáticamente con mis bancos?", "Por ahora funciona de forma manual para garantizar tu privacidad y darte control total sin depender de integraciones bancarias complejas."],
              ["¿Soporta pesos dominicanos (DOP) y dólares (USD)?", "Sí. MiCuadre soporta múltiples monedas, permitiendo registrar cuentas tanto en DOP como en USD sin confusiones."],
              ["¿Puedo registrar mis tarjetas de crédito?", "Absolutamente. Puedes controlar tu balance actual, balance al corte, monto disponible y mantener a la vista tus fechas de corte y de pago."],
              ["¿Hay una aplicación móvil disponible?", "Actualmente puedes usarla desde tu navegador web móvil o instalarla como PWA (Añadir a la pantalla de inicio). Muy pronto lanzaremos versiones nativas para iOS y Android."],
            ].map(([q, a]) => (
              <details key={String(q)} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all open:ring-2 open:ring-emerald-500/20">
                <summary className="flex cursor-pointer items-center justify-between text-lg font-semibold text-slate-900 list-none [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180 shrink-0 ml-4" />
                </summary>
                <p className="mt-4 text-base text-slate-600 leading-relaxed animate-in fade-in slide-in-from-top-2">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-200 bg-white pt-16 pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-8 mb-12">
            <div className="lg:col-span-2">
              <LogoMark dark={false} />
              <p className="mt-6 max-w-xs text-sm text-slate-500 leading-relaxed">
                El copiloto financiero diseñado para revolucionar cómo los dominicanos controlan su dinero.
              </p>
              <div className="mt-6 flex gap-4">
                <button type="button" onClick={showInstagramSoon} aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-emerald-500 hover:text-white">
                  <Instagram className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Producto</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-500">
                <li><a href="#funciones" className="hover:text-emerald-600 transition-colors">Funciones</a></li>
                <li><a href="#reportes" className="hover:text-emerald-600 transition-colors">Reportes</a></li>
                <li><a href="#tarjetas" className="hover:text-emerald-600 transition-colors">Tarjetas</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Legal</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-500">
                <li><Link href="/legal/privacidad" className="hover:text-emerald-600 transition-colors">Privacidad</Link></li>
                <li><Link href="/legal/terminos" className="hover:text-emerald-600 transition-colors">Términos</Link></li>
                <li><Link href="/legal/aviso-legal" className="hover:text-emerald-600 transition-colors">Aviso Legal</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-slate-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-slate-400">© {new Date().getFullYear()} MiCuadre. Todos los derechos reservados.</p>
            <div className="text-sm font-medium text-slate-400">Hecho con ❤️ en República Dominicana</div>
          </div>
        </div>
      </footer>
    </main>
  )
}

