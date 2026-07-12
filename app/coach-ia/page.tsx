"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronLeft, Send, Sparkles, Plus, Trash2 } from "lucide-react"
import { Z_INDEX } from "@/lib/z-index"
import { Button } from "@/components/ui/button"
import type { CoachResponse, CoachUIBlock, CoachAction } from "@/lib/coach-ia"
import { useAuth } from "@/hooks/use-auth"
import { UpgradePrompt } from "@/components/entitlements/upgrade-prompt"

type Message = {
  id: string
  role: "user" | "assistant"
  text: string
  uiBlocks?: CoachUIBlock[]
  actions?: CoachAction[]
  disclaimer?: string
}

const GENERAL_PROMPTS = [
  "¿Cuánto me queda del presupuesto de comida?",
  "¿Qué pagos tengo esta semana?",
  "¿Estoy cerca de pasarme del presupuesto?",
  "¿En qué estoy gastando más este mes?",
]

const CARD_PROMPTS = [
  "¿Cuál es el saldo actual de mi tarjeta?",
  "¿Cuánto crédito disponible tengo?",
  "¿Cuánto debo en total de mis tarjetas?",
  "¿Cuántos días me quedan para pagar?",
]

function BlockCard({ block }: { block: CoachUIBlock }) {
  if (block.type === "kpi_card") {
    return (
      <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{block.title}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{block.value}</p>
      </div>
    )
  }

  if (block.type === "warning_bar") {
    return (
      <div className="mt-3 rounded-xl border border-amber-300/50 bg-amber-50/60 px-3 py-2 dark:border-amber-700/40 dark:bg-amber-900/20">
        <p className="text-[0.6875rem] font-semibold text-amber-700 dark:text-amber-300">{block.title}</p>
        <p className="text-sm text-amber-800 dark:text-amber-200">{block.value}</p>
      </div>
    )
  }

  if (block.type === "category_list") {
    return (
      <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
        <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{block.title}</p>
        <div className="mt-2 space-y-1.5">
          {block.items.map((item) => (
            <div key={`${item.label}-${item.value}`} className="flex items-center justify-between text-xs">
              <span className="text-foreground">{item.label}</span>
              <span className="font-semibold text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
      <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">{block.title}</p>
      <p className="mt-1 text-sm text-foreground">{block.amount} · {block.category}</p>
    </div>
  )
}

export default function CoachIAPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [requiresUpgrade, setRequiresUpgrade] = useState(false)
  const [conversationId, setConversationId] = useState<string | undefined>(undefined)
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "assistant",
      text: "Soy tu Coach IA de MiCuadre. Te respondo con tus datos reales y con acciones concretas para hoy.",
      actions: [{ label: "Agregar transacción", href: "/expense", actionType: "navigate" }],
    },
  ])

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollContainerRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    async function loadHistory() {
      if (authLoading) return
      if (!user) {
        setInitialLoading(false)
        return
      }

      try {
        const response = await fetch("/api/mia/chat")
        if (response.status === 403) {
          setRequiresUpgrade(true)
          return
        }
        
        const data = await response.json()
        if (data.requiresUpgrade) {
          setRequiresUpgrade(true)
          return
        }

        if (data.conversationId) {
          setConversationId(data.conversationId)
        }
        
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages)
        }
      } catch (err) {
        console.error("Failed to load MIA conversation history:", err)
      } finally {
        setInitialLoading(false)
      }
    }

    void loadHistory()
  }, [user, authLoading])

  async function startNewChat() {
    if (sending) return
    setSending(true)
    try {
      const res = await fetch("/api/mia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "new_conversation" }),
      })
      if (res.status === 403) {
        setRequiresUpgrade(true)
        return
      }
      const data = await res.json()
      setConversationId(data.conversationId)
      setMessages([
        {
          id: "init",
          role: "assistant",
          text: "Soy tu Coach IA de MiCuadre. Te respondo con tus datos reales y con acciones concretas para hoy.",
          actions: [{ label: "Agregar transacción", href: "/expense", actionType: "navigate" }],
        },
      ])
    } catch (err) {
      console.error("Failed to start new chat:", err)
    } finally {
      setSending(false)
    }
  }

  async function clearHistory() {
    if (sending) return
    if (!confirm("¿Estás seguro de que quieres borrar todo tu historial de conversaciones con MIA?")) return
    setSending(true)
    try {
      const res = await fetch("/api/mia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_history" }),
      })
      if (res.status === 403) {
        setRequiresUpgrade(true)
        return
      }
      setConversationId(undefined)
      setMessages([
        {
          id: "init",
          role: "assistant",
          text: "Historial borrado. Soy tu Coach IA de MiCuadre. ¿En qué te puedo ayudar hoy?",
          actions: [{ label: "Agregar transacción", href: "/expense", actionType: "navigate" }],
        },
      ])
    } catch (err) {
      console.error("Failed to clear chat history:", err)
    } finally {
      setSending(false)
    }
  }

  async function askCoach(question: string) {
    const trimmed = question.trim()
    if (!trimmed || sending) return

    const userMessage: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setSending(true)

    try {
      const response = await fetch("/api/mia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, screenContext: "coach_page", conversationId }),
      })

      if (response.status === 403) {
        setRequiresUpgrade(true)
        return
      }

      const data = (await response.json()) as CoachResponse
      const assistantMessage: Message = {
        id: `a-${Date.now() + 1}`,
        role: "assistant",
        text: data.answer,
        uiBlocks: data.uiBlocks,
        actions: data.actions,
        disclaimer: data.disclaimer,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now() + 1}`,
          role: "assistant",
          text: "Ahora mismo no pude responderte. Dame un segundo y vuelve a intentar.",
          actions: [{ label: "Reintentar", href: "/coach-ia", actionType: "navigate" }],
        },
      ])
    } finally {
      setSending(false)
    }
  }

  async function confirmDraft(action: CoachAction) {
    if (sending || action.actionType !== "confirm_draft" || !action.mutationType) return
    setSending(true)
    try {
      const response = await fetch("/api/mia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          confirmAction: {
            mutationType: action.mutationType,
            payload: action.payload || {},
          },
        }),
      })

      if (response.status === 403) {
        setRequiresUpgrade(true)
        return
      }

      const data = (await response.json()) as CoachResponse
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now() + 1}`,
          role: "assistant",
          text: data.answer,
          uiBlocks: data.uiBlocks,
          actions: data.actions,
          disclaimer: data.disclaimer,
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now() + 1}`,
          role: "assistant",
          text: "No pude confirmar esa acción ahora mismo. Intenta otra vez.",
          actions: [{ label: "Reintentar", href: "/coach-ia", actionType: "navigate" }],
        },
      ])
    } finally {
      setSending(false)
    }
  }

  if (initialLoading || authLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
        <p className="mt-4 text-xs text-muted-foreground">Iniciando copiloto financiero...</p>
      </div>
    )
  }

  if (requiresUpgrade) {
    return (
      <div className="min-h-[100dvh] bg-background p-6 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-6">
            <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </Link>
          </div>
          <UpgradePrompt
            title="MIA Avanzada requiere Pro"
            description="Tu plan actual no incluye acceso al asistente inteligente de MIA. Actualiza hoy para hacerle preguntas personalizadas sobre tus finanzas, saldos, planificacion y realizar acciones con confirmación."
            feature="mia_advanced"
          />
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollContainerRef} className="app-scroll min-h-[100dvh] overflow-y-auto bg-background pb-nav-safe">
      <div className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <ChevronLeft className="h-5 w-5 text-foreground" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Coach IA</h1>
              <p className="text-xs text-muted-foreground">Tu copiloto financiero dominicano</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={startNewChat}
              size="icon"
              variant="ghost"
              title="Nuevo chat"
              disabled={sending}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              onClick={clearHistory}
              size="icon"
              variant="ghost"
              title="Limpiar chat"
              disabled={sending}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-md px-6 py-5">
        <div className="rounded-3xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2 text-primary"><Sparkles className="h-4 w-4" /></div>
            <div>
              <p className="text-sm font-semibold text-foreground">Pregúntale a MiCuadre</p>
              <p className="text-xs text-muted-foreground">Respuestas cortas con acción directa.</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Finanzas generales</p>
            <div className="flex flex-wrap gap-2">
              {GENERAL_PROMPTS.map((prompt) => (
                <button type="button"
                  key={prompt}
                  onClick={() => askCoach(prompt)}
                  disabled={sending}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tarjetas de credito</p>
            <div className="flex flex-wrap gap-2">
              {CARD_PROMPTS.map((prompt) => (
                <button type="button"
                  key={prompt}
                  onClick={() => askCoach(prompt)}
                  disabled={sending}
                  className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3 pb-40">
          {messages.map((message) => (
            <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div className={message.role === "user" ? "max-w-[86%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-sm text-primary-foreground" : "max-w-[94%] rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 text-sm text-foreground"}>
                <p className="leading-relaxed whitespace-pre-wrap">{message.text}</p>

                {message.uiBlocks?.map((block, index) => (
                  <BlockCard key={`${message.id}-block-${index}`} block={block} />
                ))}

                {!!message.actions?.length && message.role === "assistant" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.actions.map((action) => (
                      <button type="button"
                        key={`${message.id}-${action.label}`}
                        disabled={sending}
                        onClick={() => {
                          if (action.actionType === "confirm_draft") {
                            void confirmDraft(action)
                            return
                          }
                          router.push(action.href)
                        }}
                        className="rounded-full bg-muted px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {message.disclaimer && (
                  <p className="mt-2 text-[0.6875rem] text-muted-foreground">{message.disclaimer}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-[5.5rem] left-0 right-0 border-t border-border bg-background/95 px-4 pb-safe pt-3 backdrop-blur-xl" style={{ zIndex: Z_INDEX.fab }}>
        <div className="mx-auto flex max-w-md items-center gap-2">
          <input
            value={input}
            disabled={sending}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") askCoach(input)
            }}
            placeholder="Ej: ¿En qué estoy gastando más?"
            className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary"
          />
          <Button onClick={() => askCoach(input)} size="icon" disabled={sending || !input.trim()} className="h-11 w-11 rounded-xl">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

