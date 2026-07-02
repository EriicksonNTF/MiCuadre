"use client"

import { useEffect, useRef, useCallback } from "react"
import "@/app/landing-redesign.css"

export function PublicLanding() {
  const rootRef = useRef<HTMLDivElement>(null)

  const initEffects = useCallback(() => {
    const root = rootRef.current
    if (!root) return

    // Magnetic Buttons
    if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      root.querySelectorAll<HTMLElement>(".magnetic").forEach(btn => {
        let tx = 0, ty = 0, cx = 0, cy = 0
        let raf: number | null = null
        function loop() {
          cx += (tx - cx) * 0.10
          cy += (ty - cy) * 0.10
          btn.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`
          if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) {
            raf = requestAnimationFrame(loop)
          } else { raf = null }
        }
        btn.addEventListener("mousemove", e => {
          const rect = btn.getBoundingClientRect()
          tx = (e.clientX - rect.left - rect.width / 2) * 0.25
          ty = (e.clientY - rect.top - rect.height / 2) * 0.4
          if (!raf) raf = requestAnimationFrame(loop)
        })
        btn.addEventListener("mouseleave", () => {
          tx = 0; ty = 0
          if (!raf) raf = requestAnimationFrame(loop)
        })
      })
    }

    // Scroll progress
    const scrollProgress = root.querySelector<HTMLElement>(".l-scroll-progress")
    const header = root.querySelector<HTMLElement>("header.l-header")

    const onScroll = () => {
      const h = document.documentElement
      const pct = (h.scrollTop / (h.scrollHeight - h.clientHeight)) * 100
      if (scrollProgress) scrollProgress.style.width = pct + "%"
      if (header) {
        if (window.scrollY > 30) header.classList.add("scrolled")
        else header.classList.remove("scrolled")
      }
    }
    window.addEventListener("scroll", onScroll)

    // Mobile menu
    const menuToggle = root.querySelector<HTMLElement>(".l-menu-toggle")
    const mobileDrawer = root.querySelector<HTMLElement>(".l-mobile-drawer")
    const backdrop = root.querySelector<HTMLElement>(".l-backdrop")
    const closeMenu = () => {
      menuToggle?.classList.remove("open")
      mobileDrawer?.classList.remove("open")
      backdrop?.classList.remove("show")
      menuToggle?.setAttribute("aria-expanded", "false")
      document.body.style.overflow = ""
    }
    menuToggle?.addEventListener("click", () => {
      const isOpen = menuToggle.classList.contains("open")
      if (isOpen) closeMenu()
      else {
        menuToggle.classList.add("open")
        mobileDrawer?.classList.add("open")
        backdrop?.classList.add("show")
        menuToggle.setAttribute("aria-expanded", "true")
        document.body.style.overflow = "hidden"
      }
    })
    backdrop?.addEventListener("click", closeMenu)
    mobileDrawer?.querySelectorAll("a").forEach(a => a.addEventListener("click", closeMenu))

    // Reveal on scroll
    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view")
            entry.target.querySelectorAll<HTMLElement>(".counter").forEach((c) => animateCounter(c))
            entry.target.querySelectorAll<HTMLElement>("[data-width]").forEach((el) => {
              el.style.width = el.dataset.width + "%"
            })
            entry.target.querySelectorAll<HTMLElement>(".donut-progress[data-offset]").forEach((el) => {
              el.style.strokeDashoffset = el.dataset.offset!
            })
          }
        })
      },
      { threshold: 0.15, rootMargin: "0px 0px -80px 0px" }
    )
    root.querySelectorAll<HTMLElement>(".l-reveal, .l-reveal-stagger").forEach((el) =>
      revealObserver.observe(el)
    )

    // Counter animation
    function animateCounter(el: HTMLElement) {
      if (el.dataset.animated) return
      el.dataset.animated = "true"
      const target = parseInt(el.dataset.target || "0")
      const duration = 3000
      const start = performance.now()
      function tick(now: number) {
        const t = Math.min((now - start) / duration, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        const val = Math.floor(target * eased)
        el.textContent = val.toLocaleString("es-DO")
        if (t < 1) requestAnimationFrame(tick)
        else el.textContent = target.toLocaleString("es-DO")
      }
      requestAnimationFrame(tick)
    }

    // Hero card 3D tilt
    const heroCard = root.querySelector<HTMLElement>(".l-hero-card")
    if (heroCard && window.matchMedia("(hover: hover)").matches) {
      const onHeroMove = (e: MouseEvent) => {
        const rect = heroCard.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width - 0.5
        const y = (e.clientY - rect.top) / rect.height - 0.5
        heroCard.style.transform = `rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateZ(10px)`
      }
      const onHeroLeave = () => { heroCard.style.transform = "" }
      heroCard.addEventListener("mousemove", onHeroMove)
      heroCard.addEventListener("mouseleave", onHeroLeave)
    }

    // Credit card 3D tilt
    const card3d = root.querySelector<HTMLElement>(".l-card-3d")
    if (card3d && window.matchMedia("(hover: hover)").matches) {
      const stage = card3d.parentElement!
      const onCardMove = (e: MouseEvent) => {
        const rect = stage.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width - 0.5
        const y = (e.clientY - rect.top) / rect.height - 0.5
        card3d.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 18}deg)`
      }
      const onCardLeave = () => { card3d.style.transform = "" }
      stage.addEventListener("mousemove", onCardMove)
      stage.addEventListener("mouseleave", onCardLeave)
    }

    // FAQ accordion
    root.querySelectorAll<HTMLElement>(".l-faq-item").forEach((item) => {
      const q = item.querySelector<HTMLElement>(".l-faq-q")
      const toggle = () => {
        const isOpen = item.classList.contains("open")
        root.querySelectorAll<HTMLElement>(".l-faq-item").forEach((i) => {
          i.classList.remove("open")
          i.querySelector<HTMLElement>(".l-faq-q")?.setAttribute("aria-expanded", "false")
        })
        if (!isOpen) {
          item.classList.add("open")
          q?.setAttribute("aria-expanded", "true")
        }
      }
      q?.addEventListener("click", toggle)
      q?.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle() }
      })
    })

    // Billing toggle
    const billingToggle = root.querySelector<HTMLElement>(".l-billing-toggle")
    const billingSlider = root.querySelector<HTMLElement>(".l-billing-toggle .slider")
    const proPrice = root.querySelector<HTMLElement>("#l-proPrice")
    const proPeriod = root.querySelector<HTMLElement>("#l-proPeriod")
    const annualNote = root.querySelector<HTMLElement>("#l-annualNote")

    function setBilling(mode: string) {
      if (!billingToggle || !billingSlider) return
      const buttons = billingToggle.querySelectorAll("button")
      buttons.forEach((b) => b.classList.remove("active"))
      const activeBtn = billingToggle.querySelector<HTMLButtonElement>(`[data-billing="${mode}"]`)
      activeBtn?.classList.add("active")
      if (mode === "monthly") {
        billingSlider.style.width = (activeBtn?.offsetWidth || 0) + "px"
        billingSlider.style.left = "6px"
        if (proPrice) proPrice.textContent = "2.99"
        if (proPeriod) proPeriod.textContent = "/mes"
        if (annualNote) annualNote.innerHTML = "&nbsp;"
      } else {
        billingSlider.style.width = (activeBtn?.offsetWidth || 0) + "px"
        billingSlider.style.left = (activeBtn?.offsetLeft || 0) + "px"
        if (proPrice) proPrice.textContent = "28.70"
        if (proPeriod) proPeriod.textContent = "/año"
        if (annualNote) annualNote.textContent = "Equivale a $2.39/mes · Ahorra 20%"
      }
    }
    billingToggle?.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => setBilling(btn.dataset.billing || "monthly"))
    })
    setBilling("monthly")

    // Credit card points hover
    root.querySelectorAll<HTMLElement>(".l-cp-item").forEach((item) => {
      const activate = () => {
        root.querySelectorAll<HTMLElement>(".l-cp-item").forEach((i) => i.classList.remove("active"))
        item.classList.add("active")
      }
      item.addEventListener("click", activate)
      item.addEventListener("mouseenter", activate)
    })

    // Chapter rail + nav active state
    const chapters = [
      { id: "inicio", num: 0 },
      { id: "filosofia", num: 1 },
      { id: "funciones", num: 2 },
      { id: "tarjetas", num: 3 },
      { id: "planificacion", num: 4 },
      { id: "precios", num: 5 },
      { id: "faq", num: 6 },
    ]
    const railLinks = root.querySelectorAll<HTMLElement>(".l-chapter-rail a")
    const navLinks = root.querySelectorAll<HTMLElement>(".l-main-nav a")
    const chapterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id
            const chapter = chapters.find((c) => c.id === id)
            if (chapter) {
              railLinks.forEach((l) => l.classList.remove("active"))
              navLinks.forEach((l) => l.classList.remove("active"))
              root.querySelector(`.l-chapter-rail a[data-chapter="${chapter.num}"]`)?.classList.add("active")
              root.querySelector(`.l-main-nav a[href="#${id}"]`)?.classList.add("active")
            }
          }
        })
      },
      { threshold: 0.3 }
    )
    chapters.forEach((c) => {
      const el = document.getElementById(c.id)
      if (el) chapterObserver.observe(el)
    })

    // Parallax on floating cards
    const onMouseMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth - 0.5
      const y = e.clientY / window.innerHeight - 0.5
      root.querySelectorAll<HTMLElement>(".l-float-card-1, .l-float-card-2, .l-float-card-3, .l-card-orbit-1, .l-card-orbit-2").forEach((card, i) => {
        const factor = (i + 1) * 8
        card.style.translate = `${x * factor}px ${y * factor}px`
      })
    }
    window.addEventListener("mousemove", onMouseMove)

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("mousemove", onMouseMove)
      revealObserver.disconnect()
      chapterObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    const cleanup = initEffects()
    return cleanup
  }, [initEffects])

  return (
    <div ref={rootRef} className="landing-redesign">

      {/* Scroll Progress */}
      <div className="l-scroll-progress" />

      {/* Chapter Rail */}
      <nav className="l-chapter-rail">
        <a href="#inicio" data-chapter="0" className="active"><span>Inicio</span></a>
        <a href="#filosofia" data-chapter="1"><span>Filosofía</span></a>
        <a href="#funciones" data-chapter="2"><span>Funciones</span></a>
        <a href="#tarjetas" data-chapter="3"><span>Tarjetas</span></a>
        <a href="#planificacion" data-chapter="4"><span>Planificación</span></a>
        <a href="#precios" data-chapter="5"><span>Precios</span></a>
        <a href="#faq" data-chapter="6"><span>FAQ</span></a>
      </nav>

      {/* Header */}
      <header className="l-header">
        <div className="l-header-inner">
          <a href="#inicio" className="l-brand">
            <div className="l-brand-mark">M</div>
            <div>
              <div className="l-brand-name">MiCuadre</div>
              <div className="l-brand-sub">Copiloto Financiero</div>
            </div>
          </a>
          <div className="l-header-right">
            <nav className="l-main-nav">
              <a href="#inicio" className="active">Inicio</a>
              <a href="#filosofia">Filosofía</a>
              <a href="#funciones">Funciones</a>
              <a href="#tarjetas">Tarjetas</a>
              <a href="#planificacion">Planificación</a>
              <a href="#precios">Precios</a>
              <a href="#faq">FAQ</a>
            </nav>
            <div className="l-header-cta">
	              <a href="/auth/login" className="l-login-link">Iniciar sesión</a>
	              <a href="/auth/sign-up" className="l-btn-primary magnetic">Crear cuenta <span className="arrow">→</span></a>
              <button className="l-menu-toggle" aria-label="Abrir menú" aria-expanded="false" aria-controls="l-mobile-drawer">
                <span></span><span></span><span></span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <div className="l-backdrop" />
      <aside id="l-mobile-drawer" className="l-mobile-drawer" role="dialog" aria-modal="true" aria-label="Menú de navegación">
        <a href="#inicio">Inicio</a>
        <a href="#filosofia">Filosofía</a>
        <a href="#funciones">Funciones</a>
        <a href="#tarjetas">Tarjetas</a>
        <a href="#planificacion">Planificación</a>
        <a href="#precios">Precios</a>
        <a href="#faq">Preguntas</a>
        <div className="l-drawer-cta">
	          <a href="/auth/sign-up" className="primary">Crear cuenta gratis</a>
	          <a href="/auth/login">Iniciar sesión</a>
	        </div>
      </aside>

      {/* HERO */}
      <section id="inicio" className="l-hero">
        <div className="l-hero-bg">
          <div className="l-hero-grid" />
        </div>
        <div className="l-container">
          <div className="l-hero-inner">
            <div className="l-hero-text">
              <div className="l-hero-eyebrow l-reveal">
                <span className="pill">✦</span>
                <span>Hecho en República Dominicana</span>
                <span className="dot" />
              </div>
              <h1 className="l-reveal">
                Tu dinero,<br />
                <span className="line-2">totalmente</span> <span className="underline">claro.</span>
              </h1>
              <p className="lead l-reveal">
                Entiende cuánto tienes, cuánto debes y hacia dónde se va cada peso.
                Cuentas, tarjetas, presupuestos y suscripciones en una sola experiencia
                diseñada para dominicanos.
              </p>
              <div className="l-hero-cta-row l-reveal">
                <a href="/auth/sign-up" className="l-btn-primary-lg magnetic">
	                  Crear cuenta gratis
	                  <span className="arrow">→</span>
	                </a>
	                <a href="/auth/login" className="l-btn-ghost-lg magnetic">Iniciar sesión</a>
              </div>
              <div className="l-hero-stats l-reveal-stagger">
                <div className="l-hero-stat">
                  <div className="num"><span className="prefix">$</span><span className="counter" data-target="0">0</span><span className="suffix">/mes</span></div>
                  <div className="label">Plan inicial</div>
                </div>
                <div className="l-hero-stat">
                  <div className="num"><span className="counter" data-target="2">0</span><span className="suffix">monedas</span></div>
                  <div className="label">DOP &amp; USD</div>
                </div>
                <div className="l-hero-stat">
                  <div className="num"><span className="counter" data-target="100">0</span><span className="suffix">%</span></div>
                  <div className="label">Privado y manual</div>
                </div>
              </div>
            </div>

            <div className="l-hero-visual l-reveal">
              <div className="l-float-card l-float-card-1">
                <div className="fc-label"><span style={{ color: "var(--l-emerald-400)" }}>●</span> Balance</div>
                <div className="fc-value">RD$152,840</div>
              </div>
              <div className="l-float-card l-float-card-2">
                <div className="fc-label"><span style={{ color: "var(--l-sky-400)" }}>●</span> Disponible</div>
                <div className="fc-value">RD$75,100</div>
              </div>
              <div className="l-float-card l-float-card-3">
                <div className="fc-label"><span style={{ color: "var(--l-rose-400)" }}>●</span> Gastado hoy</div>
                <div className="fc-value">RD$3,420</div>
              </div>

              <div className="l-hero-card">
                <div className="l-hero-card-header">
                  <div className="label">Resumen · Mayo 2026</div>
                  <div className="live"><span className="dot" />En vivo</div>
                </div>
                <div className="l-balance-row">
                  <div>
                    <div className="balance-label">Balance total</div>
                    <div className="balance-num">
                      <span className="currency">RD$</span><span className="counter" data-target="152840">0</span>
                    </div>
                    <div className="trend">↑ +12.4% vs abril</div>
                  </div>
                </div>
                <div className="l-mini-chart">
                  <svg viewBox="0 0 300 80" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="lChartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34D399" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path className="l-chart-area" d="M0,60 L30,55 L60,58 L90,40 L120,42 L150,30 L180,35 L210,22 L240,28 L270,18 L300,15 L300,80 L0,80 Z" />
                    <path className="l-chart-line" d="M0,60 L30,55 L60,58 L90,40 L120,42 L150,30 L180,35 L210,22 L240,28 L270,18 L300,15" />
                    <circle className="l-chart-dot" cx="300" cy="15" r="4" />
                  </svg>
                </div>
                <div className="l-hero-card-tabs">
                  <div className="l-hero-tab active">
                    <div className="tab-label">Ingresos</div>
                    <div className="tab-value">+RD$48K</div>
                  </div>
                  <div className="l-hero-tab">
                    <div className="tab-label">Gastos</div>
                    <div className="tab-value">−RD$31K</div>
                  </div>
                  <div className="l-hero-tab">
                    <div className="tab-label">Ahorro</div>
                    <div className="tab-value">RD$17K</div>
                  </div>
                </div>
                <div className="l-hero-transaction">
                  <div className="icon expense">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M12 3v18" /></svg>
                  </div>
                  <div className="info">
                    <div className="name">Supermercado Nacional</div>
                    <div className="time">Hoy · 14:32</div>
                  </div>
                  <div className="amount expense">−RD$2,840</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="l-marquee" aria-hidden="true">
        <div className="l-marquee-track">
          <span className="l-marquee-item">Cuentas sincronizadas <span className="star">✦</span></span>
          <span className="l-marquee-item" style={{ color: "var(--l-emerald-400)" }}>Tarjetas sin intereses <span className="star">✦</span></span>
          <span className="l-marquee-item">Presupuestos inteligentes <span className="star">✦</span></span>
          <span className="l-marquee-item" style={{ color: "var(--l-sky-400)" }}>Reportes visuales <span className="star">✦</span></span>
          <span className="l-marquee-item">Calendario financiero <span className="star">✦</span></span>
          <span className="l-marquee-item" style={{ color: "var(--l-emerald-400)" }}>DOP &amp; USD <span className="star">✦</span></span>
          <span className="l-marquee-item">100% privado <span className="star">✦</span></span>
          <span className="l-marquee-item">Cuentas sincronizadas <span className="star">✦</span></span>
          <span className="l-marquee-item" style={{ color: "var(--l-emerald-400)" }}>Tarjetas sin intereses <span className="star">✦</span></span>
          <span className="l-marquee-item">Presupuestos inteligentes <span className="star">✦</span></span>
          <span className="l-marquee-item" style={{ color: "var(--l-sky-400)" }}>Reportes visuales <span className="star">✦</span></span>
          <span className="l-marquee-item">Calendario financiero <span className="star">✦</span></span>
          <span className="l-marquee-item" style={{ color: "var(--l-emerald-400)" }}>DOP &amp; USD <span className="star">✦</span></span>
          <span className="l-marquee-item">100% privado <span className="star">✦</span></span>
        </div>
      </div>

      {/* FILOSOFÍA */}
      <section id="filosofia" className="l-philosophy">
        <div className="l-container">
          <div className="l-philosophy-grid">
            <div className="l-philosophy-left l-reveal">
              <div className="l-section-label">
                <span className="num">01</span>
                <span className="line" />
                Filosofía
              </div>
              <h2 className="l-section-title">
                No es una app más.<br />
                Es <em>claridad</em> con propósito.
              </h2>
              <p className="l-section-lead">
                Construimos MiCuadre sobre tres principios que cambian cómo te relacionas
                con tu dinero. Sin promesas vacías, sin conexiones bancarias forzadas,
                sin venderte productos que no necesitas.
              </p>
            </div>
            <div className="l-philosophy-right">
              <article className="l-principle l-reveal">
                <div className="l-principle-head">
                  <span className="l-principle-num">P · 01</span>
                  <div className="l-principle-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2L3 7v6c0 5 3.5 9 9 11 5.5-2 9-6 9-11V7l-9-5z" /><path d="M9 12l2 2 4-4" /></svg>
                  </div>
                </div>
                <h3>Privacidad primero, siempre.</h3>
                <p>Tus datos financieros son tuyos. Por eso MiCuadre funciona de forma 100% manual: tú registras, tú decides, tú controlas. No conectamos con tu banco, no vendemos tu información, no accedemos a tus credenciales.</p>
                <div className="l-principle-tag">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6" /></svg>
                  Sin integraciones bancarias
                </div>
              </article>
              <article className="l-principle l-reveal">
                <div className="l-principle-head">
                  <span className="l-principle-num">P · 02</span>
                  <div className="l-principle-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                  </div>
                </div>
                <h3>Tiempo real, sin esperas.</h3>
                <p>Cada movimiento que registras se refleja instantáneamente en tus balances, presupuestos y reportes. Sin sincronización lenta, sin &quot;espera 24 horas&quot;, sin sorpresas.</p>
                <div className="l-principle-tag">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6" /></svg>
                  Actualización instantánea
                </div>
              </article>
              <article className="l-principle l-reveal">
                <div className="l-principle-head">
                  <span className="l-principle-num">P · 03</span>
                  <div className="l-principle-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-5" /></svg>
                  </div>
                </div>
                <h3>Diseñado para dominicanos.</h3>
                <p>Pensado desde cero para la realidad del país: pesos dominicanos y dólares conviviendo, fechas de corte de tarjetas locales, productos financieros que realmente usas.</p>
                <div className="l-principle-tag">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="6" /></svg>
                  DOP · USD · RD$ nativo
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      {/* FUNCIONES (BENTO) */}
      <section id="funciones" className="l-bento-section">
        <div className="l-container">
          <div className="l-bento-header l-reveal">
            <div>
              <div className="l-section-label">
                <span className="num">02</span>
                <span className="line" />
                Funciones
              </div>
              <h2 className="l-section-title">
                Todo lo que necesitas,<br />
                <em>nada</em> que no uses.
              </h2>
            </div>
            <a href="/auth/sign-up" className="link-cta">Ver demo completa →</a>
          </div>
          <div className="l-bento-grid">
            <article className="l-bento-tile featured l-tile-1 l-reveal">
              <div className="l-tile-num">F · 01</div>
              <h3 className="l-tile-title">Cuentas sincronizadas<br />en un solo lugar.</h3>
              <p className="l-tile-desc">Bancos, efectivo, ahorros y USD. Visualiza cada peso que tienes y dónde está, sin saltar entre apps ni hojas de cálculo.</p>
              <div className="l-viz-bars">
                <div className="bar" style={{ height: "70%" }} data-label="Banres" />
                <div className="bar" style={{ height: "45%" }} data-label="Popular" />
                <div className="bar" style={{ height: "88%" }} data-label="BHD" />
                <div className="bar" style={{ height: "30%" }} data-label="Efectivo" />
                <div className="bar" style={{ height: "60%" }} data-label="USD" />
                <div className="bar" style={{ height: "22%" }} data-label="Ahorro" />
              </div>
            </article>
            <article className="l-bento-tile l-tile-2 l-reveal">
              <div className="l-tile-num">F · 02</div>
              <h3 className="l-tile-title">Registros sin fricción.</h3>
              <p className="l-tile-desc">Captura montos, categorías y detalles en segundos. Impacto inmediato en balances.</p>
              <svg className="l-tile-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12h18M12 3v18" /></svg>
            </article>
            <article className="l-bento-tile l-tile-3 l-reveal">
              <div className="l-tile-num">F · 03</div>
              <h3 className="l-tile-title">Presupuestos vivos.</h3>
              <div className="l-viz-progress">
                <div className="vp-row">
                  <div className="vp-head"><span className="name">Comida</span><span className="pct">77%</span></div>
                  <div className="vp-track"><div className="vp-fill" data-width="77" /></div>
                </div>
                <div className="vp-row">
                  <div className="vp-head"><span className="name">Transporte</span><span className="pct">52%</span></div>
                  <div className="vp-track"><div className="vp-fill sky" data-width="52" /></div>
                </div>
                <div className="vp-row">
                  <div className="vp-head"><span className="name">Ocio</span><span className="pct">112%</span></div>
                  <div className="vp-track"><div className="vp-fill rose" data-width="100" /></div>
                </div>
              </div>
            </article>
            <article className="l-bento-tile dark l-tile-4 l-reveal">
              <div className="l-tile-num">F · 04</div>
              <h3 className="l-tile-title">DOP<br />&amp; USD.</h3>
              <div className="l-currency-convert">
                <div className="l-cc-row">
                  <span className="cc-amount">RD$1,000</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                  <span className="cc-result">$16.85</span>
                </div>
                <div className="l-cc-rate">Tasa · 1 USD = RD$59.35</div>
              </div>
            </article>
            <article className="l-bento-tile l-tile-5 l-reveal">
              <div className="l-tile-num">F · 05</div>
              <h3 className="l-tile-title">Reportes que hablan.</h3>
              <div className="l-viz-donut">
                <svg viewBox="0 0 100 100">
                  <circle className="l-donut-center" cx="50" cy="50" r="40" />
                  <circle className="l-donut-progress" cx="50" cy="50" r="40" strokeDasharray="251.2" strokeDashoffset="251.2" data-offset="62.8" />
                </svg>
                <div>
                  <div className="l-donut-label">Comida</div>
                  <div className="l-donut-value">75%</div>
                </div>
              </div>
            </article>
            <article className="l-bento-tile l-tile-6 l-reveal">
              <div className="l-tile-num">F · 06</div>
              <h3 className="l-tile-title">Suscripciones bajo control.</h3>
              <p className="l-tile-desc">Netflix, Spotify, iCloud, gimnasio. Ve todas tus suscripciones, cuánto suman y cuándo cobran.</p>
              <div className="l-viz-circles">
                <div className="vc active">NFLX</div>
                <div className="vc active">SPOT</div>
                <div className="vc active">iCLD</div>
                <div className="vc active">GYM</div>
                <div className="vc">+2</div>
              </div>
            </article>
            <article className="l-bento-tile l-tile-7 l-reveal">
              <div className="l-tile-num">F · 07</div>
              <h3 className="l-tile-title">Control de comisiones e impuestos.</h3>
              <p className="l-tile-desc">Calcula automáticamente ITBIS y comisiones bancarias para que sepas el costo real de cada transacción.</p>
              <svg className="l-tile-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M8 6h8M8 10h8M8 14h5" /></svg>
            </article>
          </div>
        </div>
      </section>

      {/* TARJETAS 3D */}
      <section id="tarjetas" className="l-cards-section">
        <div className="l-container">
          <div className="l-cards-grid">
            <div className="l-cards-text l-reveal">
              <div className="l-section-label">
                <span className="num">03</span>
                <span className="line" />
                Tarjetas de crédito
              </div>
              <h2 className="l-section-title">
                Domina los ciclos.<br />
                <em>Cero</em> intereses.
              </h2>
              <p className="l-section-lead">
                No pagues ni un peso en intereses. MiCuadre está diseñado para que tengas
                control absoluto de tus fechas de corte, fechas de pago y separes tu balance
                actual del balance que debes pagar.
              </p>
              <div className="l-cards-points">
                <div className="l-cp-item active">
                  <div className="l-cp-num">01</div>
                  <div className="l-cp-content">
                    <h3 className="l-cp-title">Domina las fechas.</h3>
                    <p className="l-cp-desc">Alertas tempranas de cuándo cierra tu ciclo (corte) y cuál es el último día para pagar sin penalidad.</p>
                  </div>
                </div>
                <div className="l-cp-item">
                  <div className="l-cp-num">02</div>
                  <div className="l-cp-content">
                    <h3 className="l-cp-title">Claridad en balances.</h3>
                    <p className="l-cp-desc">Separa el balance al corte (lo que debes pagar ahora) del balance actual (lo que llevas consumido en el ciclo nuevo).</p>
                  </div>
                </div>
                <div className="l-cp-item">
                  <div className="l-cp-num">03</div>
                  <div className="l-cp-content">
                    <h3 className="l-cp-title">Límite inteligente.</h3>
                    <p className="l-cp-desc">Conoce exactamente cuánto te queda disponible para gastar sin sobregirarte ni afectar tu buró de crédito.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="l-card-stage l-reveal">
              <div className="l-card-orbit l-card-orbit-1">
                <div className="label"><span style={{ color: "var(--l-emerald-400)" }}>●</span> Disponible</div>
                <div className="val">RD$75,100</div>
              </div>
              <div className="l-card-orbit l-card-orbit-2">
                <div className="label"><span style={{ color: "var(--l-rose-400)" }}>●</span> Al corte</div>
                <div className="val">RD$18,650</div>
              </div>
              <div className="l-card-3d">
                <div className="l-card-face">
                  <div className="l-card-shine" />
                  <div className="l-card-top">
                    <div className="l-card-brand">
                      <div className="l-card-chip" />
                      <div>
                        <div className="l-card-issuer">Platinum Rewards</div>
                        <div className="l-card-issuer-sub">MiCuadre · Visa</div>
                      </div>
                    </div>
                    <div className="l-card-limit">
                      <div className="label">Límite total</div>
                      <div className="val">RD$100,000</div>
                    </div>
                  </div>
                  <div className="l-card-middle">
                    <div className="l-card-stat danger">
                      <div className="label">⚠ Al corte</div>
                      <div className="val">RD$18,650</div>
                      <div className="sub">Pagar antes 08 Jun</div>
                    </div>
                    <div className="l-card-stat">
                      <div className="label">Balance actual</div>
                      <div className="val">RD$24,900</div>
                      <div className="sub">Incluye ciclo nuevo</div>
                    </div>
                  </div>
                  <div className="l-card-bottom">
                    <div className="l-card-date amber">
                      <span className="dot" />
                      <div className="info">
                        <div className="label">Próx. corte</div>
                        <div className="val">24 Mayo</div>
                      </div>
                    </div>
                    <div className="l-card-date green">
                      <span className="dot" />
                      <div className="info">
                        <div className="label">Fecha pago</div>
                        <div className="val">08 Junio</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PLANIFICACIÓN */}
      <section id="planificacion" className="l-planning-section">
        <div className="l-container">
          <div className="l-planning-header l-reveal">
            <div className="l-section-label">
              <span className="num">04</span>
              <span className="line" />
              Planificación
            </div>
            <h2 className="l-section-title">
              Planifica tu mes <em>antes</em><br />de gastar.
            </h2>
            <p className="l-section-lead">
              Presupuestos, calendario y deudas trabajan juntos para que sepas cuánto puedes
              gastar, qué pagos vienen y qué compromisos siguen pendientes.
            </p>
          </div>
          <div className="l-planning-grid l-reveal-stagger">
            <div className="l-mockup">
              <div className="l-mockup-head">
                <div><div className="label">Planificación</div><div className="title">Presupuestos</div></div>
                <span className="dot emerald" />
              </div>
              <div className="l-budget-summary">
                <div className="label">💰 Presupuesto usado</div>
                <div className="val">RD$18,450</div>
                <div className="sub">de RD$24,000 este mes</div>
              </div>
              <div className="l-budget-list">
                <div className="l-budget-row">
                  <div className="head"><span className="name">Comida</span><span className="pct">77%</span></div>
                  <div className="l-budget-track"><div className="l-budget-fill" data-width="77" /></div>
                </div>
                <div className="l-budget-row">
                  <div className="head"><span className="name">Transporte</span><span className="pct">52%</span></div>
                  <div className="l-budget-track"><div className="l-budget-fill sky" data-width="52" /></div>
                </div>
                <div className="l-budget-row">
                  <div className="head"><span className="name">Entretenimiento</span><span className="pct danger">112%</span></div>
                  <div className="l-budget-track"><div className="l-budget-fill rose" data-width="100" /></div>
                </div>
              </div>
              <div className="l-budget-alert">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
                Entretenimiento excedido
              </div>
            </div>
            <div className="l-mockup">
              <div className="l-mockup-head">
                <div><div className="label">Planificación</div><div className="title">Calendario</div></div>
                <span className="dot sky" />
              </div>
              <div className="l-cal-grid">
                <div className="l-cal-cell">1</div><div className="l-cal-cell">2</div><div className="l-cal-cell">3</div>
                <div className="l-cal-cell has-event">4<span className="event-dot" /></div>
                <div className="l-cal-cell">5</div><div className="l-cal-cell">6</div><div className="l-cal-cell">7</div>
                <div className="l-cal-cell has-event">8<span className="event-dot" /></div>
                <div className="l-cal-cell">9</div><div className="l-cal-cell">10</div><div className="l-cal-cell">11</div>
                <div className="l-cal-cell today">12</div>
                <div className="l-cal-cell">13</div>
                <div className="l-cal-cell has-event has-event-amber">14<span className="event-dot" /></div>
                <div className="l-cal-cell">15</div><div className="l-cal-cell">16</div><div className="l-cal-cell">17</div>
                <div className="l-cal-cell">18</div><div className="l-cal-cell">19</div><div className="l-cal-cell">20</div>
                <div className="l-cal-cell">21</div>
              </div>
              <div className="l-cal-events">
                <div className="l-cal-event">
                  <div><div className="name">Visa Popular</div><div className="date">08 Jun</div></div>
                  <div className="amt" style={{ color: "var(--l-rose-400)" }}>RD$18,650</div>
                </div>
                <div className="l-cal-event">
                  <div><div className="name">Netflix</div><div className="date">14 Jun</div></div>
                  <div className="amt">RD$450</div>
                </div>
              </div>
            </div>
            <div className="l-mockup">
              <div className="l-mockup-head">
                <div><div className="label">Planificación</div><div className="title">Deudas</div></div>
                <span className="dot amber" />
              </div>
              <div className="l-debt-summary">
                <div className="label">Total pendiente</div>
                <div className="val">RD$92,300</div>
                <div className="sub">Pago próximo: RD$7,200</div>
              </div>
              <div className="l-debt-list">
                <div className="l-debt-row">
                  <div className="head"><span className="name">Préstamo personal</span><span className="pct">64% pagado</span></div>
                  <div className="l-debt-track"><div className="l-debt-fill" data-width="64" /></div>
                  <div className="sub">Pago próximo · 15 Jun</div>
                </div>
                <div className="l-debt-row">
                  <div className="head"><span className="name">Tarjeta Visa</span><span className="pct">38% pagado</span></div>
                  <div className="l-debt-track"><div className="l-debt-fill" data-width="38" /></div>
                  <div className="sub">Pago próximo · 08 Jun</div>
                </div>
              </div>
            </div>
          </div>
          <div className="l-planning-features l-reveal-stagger">
            <div className="l-pf-item"><span className="num">01</span><h3>Presupuestos inteligentes</h3><p>Define límites por categoría y recibe alertas antes de pasarte.</p></div>
            <div className="l-pf-item"><span className="num">02</span><h3>Calendario financiero</h3><p>Visualiza tarjetas, suscripciones y deudas antes de que se te pasen.</p></div>
            <div className="l-pf-item"><span className="num">03</span><h3>Deudas y pagos</h3><p>Controla préstamos, cuotas y tarjetas con seguimiento claro.</p></div>
          </div>
        </div>
      </section>

      {/* PRECIOS */}
      <section id="precios" className="l-pricing-section">
        <div className="l-container">
          <div className="l-pricing-header l-reveal">
            <div className="l-section-label">
              <span className="num">05</span>
              <span className="line" />
              Precios
            </div>
            <h2 className="l-section-title">
              Empieza gratis.<br />
              Mejora cuando <em>necesites</em> control total.
            </h2>
            <p className="l-section-lead">
              Organiza tus cuentas, presupuestos, tarjetas, gastos y suscripciones desde
              una experiencia simple y móvil.
            </p>
          </div>
          <div className="l-billing-toggle-wrap l-reveal">
            <div className="l-billing-toggle" role="radiogroup" aria-label="Tipo de facturación">
              <div className="slider" />
              <button className="active" data-billing="monthly" role="radio" aria-checked="true">Mensual</button>
              <button data-billing="yearly" role="radio" aria-checked="false">Anual · Ahorra 20%</button>
            </div>
          </div>
          <div className="l-annual-note">&nbsp;</div>
          <div className="l-pricing-grid">
            <article className="l-price-card l-reveal">
              <div className="tier-name">Free</div>
              <p className="tier-desc">Para empezar a organizar tus finanzas.</p>
              <div className="l-price-display">
                <span className="currency">$</span>
                <span className="amount">0</span>
                <span className="period">/mes</span>
              </div>
              <ul className="l-price-features">
                <li><span className="check">✓</span> 3 cuentas</li>
                <li><span className="check">✓</span> 10 transacciones por día</li>
                <li><span className="check">✓</span> Historial básico</li>
                <li><span className="check">✓</span> 1 suscripción financiera</li>
              </ul>
	              <a href="/auth/sign-up" className="l-price-cta ghost magnetic">Comenzar gratis →</a>
            </article>
            <article className="l-price-card featured l-reveal">
              <span className="badge">Recomendado</span>
              <div className="tier-name">Pro</div>
              <p className="tier-desc">Para controlar tu dinero sin límites.</p>
              <div className="l-price-display">
                <span className="currency">$</span>
                <span className="amount" id="l-proPrice">2.99</span>
                <span className="period" id="l-proPeriod">/mes</span>
              </div>
              <ul className="l-price-features">
                <li><span className="check">✓</span> Cuentas ilimitadas</li>
                <li><span className="check">✓</span> Transacciones ilimitadas</li>
                <li><span className="check">✓</span> Historial completo</li>
                <li><span className="check">✓</span> Presupuestos ilimitados</li>
              </ul>
	              <a href="/auth/sign-up?plan=pro" className="l-price-cta primary magnetic">Ver Pro →</a>
            </article>
          </div>
          <div className="l-price-foot">
            <div className="l-price-foot-item">Pago seguro con Stripe</div>
            <div className="l-price-foot-item">Cancela cuando quieras</div>
            <div className="l-price-foot-item">Sin conexión bancaria</div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="l-faq-section">
        <div className="l-container">
          <div className="l-faq-grid">
            <div className="l-faq-left l-reveal">
              <div className="l-section-label">
                <span className="num">06</span>
                <span className="line" />
                Preguntas
              </div>
              <h2 className="l-section-title">
                Todo lo que<br />necesitas <em>saber.</em>
              </h2>
              <p className="l-section-lead">
                Si tienes otra duda que no está aquí, escríbenos. Respondemos rápido.
              </p>
            </div>
            <div className="l-faq-list">
              <div className="l-faq-item l-reveal">
                <div className="l-faq-q" role="button" tabIndex={0} aria-expanded="false">
                  ¿MiCuadre se conecta automáticamente con mis bancos?
                  <span className="icon" />
                </div>
                <div className="l-faq-a" role="region">
                  <div className="l-faq-a-inner">
                    Por ahora funciona de forma manual para garantizar tu privacidad y darte
                    control total sin depender de integraciones bancarias complejas. Tú registras
                    cada movimiento — tus credenciales nunca salen de tus manos.
                  </div>
                </div>
              </div>
              <div className="l-faq-item l-reveal">
                <div className="l-faq-q" role="button" tabIndex={0} aria-expanded="false">
                  ¿Soporta pesos dominicanos (DOP) y dólares (USD)?
                  <span className="icon" />
                </div>
                <div className="l-faq-a" role="region">
                  <div className="l-faq-a-inner">
                    Sí. MiCuadre soporta múltiples monedas, permitiendo registrar cuentas tanto
                    en DOP como en USD sin confusiones.
                  </div>
                </div>
              </div>
              <div className="l-faq-item l-reveal">
                <div className="l-faq-q" role="button" tabIndex={0} aria-expanded="false">
                  ¿Puedo registrar mis tarjetas de crédito?
                  <span className="icon" />
                </div>
                <div className="l-faq-a" role="region">
                  <div className="l-faq-a-inner">
                    Absolutamente. Puedes controlar tu balance actual, balance al corte, monto
                    disponible y mantener a la vista tus fechas de corte y de pago.
                  </div>
                </div>
              </div>
              <div className="l-faq-item l-reveal">
                <div className="l-faq-q" role="button" tabIndex={0} aria-expanded="false">
                  ¿Hay una aplicación móvil disponible?
                  <span className="icon" />
                </div>
                <div className="l-faq-a" role="region">
                  <div className="l-faq-a-inner">
                    Actualmente puedes usarla desde tu navegador web móvil o instalarla como PWA.
                    Muy pronto lanzaremos versiones nativas para iOS y Android.
                  </div>
                </div>
              </div>
              <div className="l-faq-item l-reveal">
                <div className="l-faq-q" role="button" tabIndex={0} aria-expanded="false">
                  ¿Cómo manejan mis datos financieros?
                  <span className="icon" />
                </div>
                <div className="l-faq-a" role="region">
                  <div className="l-faq-a-inner">
                    Tus datos se almacenan de forma segura y nunca se comparten con terceros.
                    No vendemos información, no mostramos publicidad, no usamos tus números para
                    perfiles comerciales.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="l-final-cta">
        <div className="l-container">
          <div className="l-final-cta-inner l-reveal">
            <h2>Tu dinero,<br /><em>claro.</em> Hoy.</h2>
            <p>Crea tu cuenta gratis en menos de un minuto. Sin tarjeta, sin compromisos, sin letra pequeña.</p>
            <div className="cta-row">
              <a href="/auth/sign-up" className="l-btn-primary-lg magnetic">
	                Crear cuenta gratis
	                <span className="arrow">→</span>
	              </a>
	              <a href="/auth/login" className="l-btn-ghost-lg magnetic">Hablar con nosotros</a>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="l-footer">
        <div className="l-container">
          <div className="l-footer-grid">
            <div className="l-footer-brand">
              <a href="#inicio" className="l-brand">
                <div className="l-brand-mark">M</div>
                <div>
                  <div className="l-brand-name">MiCuadre</div>
                  <div className="l-brand-sub">Copiloto Financiero</div>
                </div>
              </a>
              <h3>Hecho con <em>cariño</em><br />en República Dominicana.</h3>
              <p>El copiloto financiero diseñado para revolucionar cómo los dominicanos controlan su dinero.</p>
            </div>
            <div className="l-footer-col">
              <h4>Producto</h4>
              <ul>
                <li><a href="#funciones">Funciones</a></li>
                <li><a href="#tarjetas">Tarjetas</a></li>
                <li><a href="#planificacion">Planificación</a></li>
                <li><a href="#precios">Precios</a></li>
              </ul>
            </div>
	            <div className="l-footer-col">
	              <h4>Empresa</h4>
	              <ul>
	                <li><a href="#inicio">Sobre nosotros</a></li>
	                <li><a href="#inicio">Blog</a></li>
	                <li><a href="#inicio">Contacto</a></li>
	              </ul>
	            </div>
	            <div className="l-footer-col">
	              <h4>Legal</h4>
	              <ul>
	                <li><a href="/legal/privacidad">Privacidad</a></li>
	                <li><a href="/legal/terminos">Términos</a></li>
	                <li><a href="/legal/aviso-legal">Aviso legal</a></li>
	              </ul>
	            </div>
          </div>
          <div className="l-footer-bottom">
            <p>© 2026 MiCuadre · Todos los derechos reservados</p>
            <div className="l-footer-marquee">República Dominicana ✦</div>
            <p>v1.0 · Santo Domingo</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
